import { randomBytes } from "node:crypto";
import { readFile, unlink, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { db, sqlite } from "@/db/client";
import {
  categories,
  wardrobeItems,
  tags,
  wardrobeItemTags,
} from "@/db/schema";
import type { Category, WardrobeItemRow } from "@/db/schema";
import { AppError } from "@/lib/errors";

export type WardrobeCategory = Pick<Category, "id" | "name">;
export type WardrobeItem = {
  id: string;
  name: string;
  category: string;
  file: string;
};
export type WardrobeTag = { id: string; name: string };
export type WardrobeListItem = WardrobeItem & {
  url: string;
  tags?: WardrobeTag[];
};

export const WARDROBE_DIR = path.join(process.cwd(), "public", "wardrobe");

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// 5MB — 与 DESIGN 5.1 对齐，服务端二次校验解码后字节数
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// URL-safe short id 生成（避免额外依赖）
function shortId(bytes = 8): string {
  return randomBytes(bytes)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);
}

const rowToItem = (row: WardrobeItemRow): WardrobeItem => ({
  id: row.id,
  name: row.name,
  category: row.categoryId,
  file: row.file,
});

/** 拉出每个单品对应的 tag 列表，按 wardrobeItemId 分组。 */
function fetchTagsByItemIds(itemIds: string[]): Map<string, WardrobeTag[]> {
  const map = new Map<string, WardrobeTag[]>();
  if (itemIds.length === 0) return map;
  // 简单实现：跑一次 join，避免 IN(...) 拼接的手动风险
  const rows = db
    .select({
      itemId: wardrobeItemTags.wardrobeItemId,
      tagId: tags.id,
      tagName: tags.name,
    })
    .from(wardrobeItemTags)
    .innerJoin(tags, eq(wardrobeItemTags.tagId, tags.id))
    .all();
  const wanted = new Set(itemIds);
  for (const r of rows) {
    if (!wanted.has(r.itemId)) continue;
    const arr = map.get(r.itemId) ?? [];
    arr.push({ id: r.tagId, name: r.tagName });
    map.set(r.itemId, arr);
  }
  return map;
}

export async function listWardrobe(options?: { category?: string }) {
  const cats = db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id))
    .all();

  const q = db
    .select()
    .from(wardrobeItems)
    .orderBy(asc(wardrobeItems.createdAt), asc(wardrobeItems.id));
  const rows = options?.category
    ? q.where(eq(wardrobeItems.categoryId, options.category)).all()
    : q.all();

  const tagsByItem = fetchTagsByItemIds(rows.map((r) => r.id));

  const items: WardrobeListItem[] = rows.map((row) => {
    const t = tagsByItem.get(row.id);
    const item: WardrobeListItem = {
      ...rowToItem(row),
      url: `/wardrobe/${row.file}`,
    };
    if (t && t.length > 0) item.tags = t;
    return item;
  });

  return { categories: cats, items };
}

export function getWardrobeItem(id: string): WardrobeItemRow | null {
  const row = db
    .select()
    .from(wardrobeItems)
    .where(eq(wardrobeItems.id, id))
    .get();
  return row ?? null;
}

export async function getWardrobeItemAsDataUri(id: string): Promise<string> {
  const row = getWardrobeItem(id);
  if (!row) {
    throw AppError.notFound(`衣橱中不存在 id: ${id}`);
  }

  // 防止 file 字段包含路径分隔符逃出 wardrobe 目录
  const safeName = path.basename(row.file);
  if (safeName !== row.file) {
    throw AppError.internal(`衣橱条目 ${id} 的 file 字段非法: ${row.file}`);
  }

  const ext = path.extname(safeName).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw AppError.internal(`不支持的图片扩展名: ${ext}`);
  }

  const buf = await readFile(path.join(WARDROBE_DIR, safeName));
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * 解析 data:image/*;base64,... URI 到 { mime, buffer }。
 * 校验 MIME 白名单 + 尺寸上限。
 */
function decodeDataUri(input: string): { mime: string; ext: string; buffer: Buffer } {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    input
  );
  if (!match) {
    throw AppError.badRequest("图片 data URI 非法");
  }
  const mime = match[1].toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    throw AppError.badRequest(`不支持的图片 MIME: ${mime}`);
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    throw AppError.badRequest("base64 解码失败");
  }
  if (buffer.byteLength === 0) {
    throw AppError.badRequest("图片内容为空");
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw AppError.payloadTooLarge(
      `图片解码后 ${buffer.byteLength} 字节，超过 ${MAX_UPLOAD_BYTES} 字节上限`
    );
  }
  return { mime, ext, buffer };
}

export type CreateWardrobeItemParams = {
  name: string;
  categoryId: string;
  fileBase64: string;
  tagIds?: string[];
};

export async function createWardrobeItem(
  params: CreateWardrobeItemParams
): Promise<WardrobeListItem> {
  const name = params.name.trim();
  if (name.length === 0 || name.length > 64) {
    throw AppError.badRequest("name 长度需在 1..64");
  }

  // 校验分类
  const cat = db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, params.categoryId))
    .get();
  if (!cat) {
    throw AppError.badRequest(`categoryId 不存在: ${params.categoryId}`);
  }

  // 校验 tagIds
  const tagIds = params.tagIds ?? [];
  if (tagIds.length > 0) {
    const found = db
      .select({ id: tags.id })
      .from(tags)
      .all()
      .filter((t) => tagIds.includes(t.id))
      .map((t) => t.id);
    const missing = tagIds.filter((t) => !found.includes(t));
    if (missing.length > 0) {
      throw AppError.badRequest(`tagId 不存在: ${missing.join(",")}`);
    }
  }

  const { ext, buffer } = decodeDataUri(params.fileBase64);
  const id = `wu_${shortId(8)}`;
  const rawFileName = `${id}${ext}`;
  // path.basename() 净化 —— 防止 id 或 ext 泄漏路径分隔符
  const fileName = path.basename(rawFileName);
  if (fileName !== rawFileName) {
    throw AppError.internal("生成的文件名不合法");
  }

  await mkdir(WARDROBE_DIR, { recursive: true });
  const filePath = path.join(WARDROBE_DIR, fileName);
  await writeFile(filePath, buffer);

  try {
    const tx = sqlite.transaction(() => {
      db.insert(wardrobeItems)
        .values({
          id,
          name,
          categoryId: params.categoryId,
          file: fileName,
        })
        .run();
      for (const tagId of tagIds) {
        db.insert(wardrobeItemTags)
          .values({ wardrobeItemId: id, tagId })
          .onConflictDoNothing()
          .run();
      }
    });
    tx();
  } catch (err) {
    // 回滚已落盘文件
    await unlink(filePath).catch(() => {});
    throw AppError.internal("写入数据库失败", err);
  }

  const row = getWardrobeItem(id);
  if (!row) {
    throw AppError.internal("写入后无法回读单品");
  }
  const tagsByItem = fetchTagsByItemIds([id]);
  const t = tagsByItem.get(id);
  const item: WardrobeListItem = {
    ...rowToItem(row),
    url: `/wardrobe/${row.file}`,
  };
  if (t && t.length > 0) item.tags = t;
  return item;
}

export async function deleteWardrobeItem(id: string): Promise<void> {
  const row = getWardrobeItem(id);
  if (!row) {
    throw AppError.notFound(`衣橱中不存在 id: ${id}`);
  }
  const safeName = path.basename(row.file);
  if (safeName !== row.file) {
    throw AppError.internal(`衣橱条目 ${id} 的 file 字段非法: ${row.file}`);
  }

  try {
    const tx = sqlite.transaction(() => {
      db.delete(wardrobeItems).where(eq(wardrobeItems.id, id)).run();
    });
    tx();
  } catch (err) {
    throw AppError.internal("删除数据库行失败", err);
  }

  const filePath = path.join(WARDROBE_DIR, safeName);
  try {
    await unlink(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return; // 幂等
    // DB 已删，磁盘失败仅打日志，不重新插回
    console.error(`[wardrobe] unlink ${filePath} 失败:`, err);
  }
}
