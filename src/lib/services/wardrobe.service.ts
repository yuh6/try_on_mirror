import { randomBytes } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { db } from "@/db/client";
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

// seed 老数据以纯文件名保存 → 走 public/wardrobe 静态资源；
// 用户新上传走 Vercel Blob，file 直接存完整 https URL。
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

function isRemoteUrl(file: string): boolean {
  return /^https?:\/\//i.test(file);
}

function resolveWardrobeUrl(file: string): string {
  return isRemoteUrl(file) ? file : `/wardrobe/${file}`;
}

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
async function fetchTagsByItemIds(
  itemIds: string[]
): Promise<Map<string, WardrobeTag[]>> {
  const map = new Map<string, WardrobeTag[]>();
  if (itemIds.length === 0) return map;
  // 简单实现：跑一次 join，避免 IN(...) 拼接的手动风险
  const rows = await db
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
  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id))
    .all();

  const q = db
    .select()
    .from(wardrobeItems)
    .orderBy(asc(wardrobeItems.createdAt), asc(wardrobeItems.id));
  const rows = options?.category
    ? await q.where(eq(wardrobeItems.categoryId, options.category)).all()
    : await q.all();

  const tagsByItem = await fetchTagsByItemIds(rows.map((r) => r.id));

  const items: WardrobeListItem[] = rows.map((row) => {
    const t = tagsByItem.get(row.id);
    const item: WardrobeListItem = {
      ...rowToItem(row),
      url: resolveWardrobeUrl(row.file),
    };
    if (t && t.length > 0) item.tags = t;
    return item;
  });

  return { categories: cats, items };
}

export async function getWardrobeItem(
  id: string
): Promise<WardrobeItemRow | null> {
  const row = await db
    .select()
    .from(wardrobeItems)
    .where(eq(wardrobeItems.id, id))
    .get();
  return row ?? null;
}

async function fetchRemoteAsDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw AppError.internal(
      `拉取远端图片失败 ${res.status}: ${url}`
    );
  }
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function getWardrobeItemAsDataUri(id: string): Promise<string> {
  const row = await getWardrobeItem(id);
  if (!row) {
    throw AppError.notFound(`衣橱中不存在 id: ${id}`);
  }

  // 远端 Blob：直接 fetch
  if (isRemoteUrl(row.file)) {
    return fetchRemoteAsDataUri(row.file);
  }

  // 本地 seed 文件：防止 file 字段包含路径分隔符逃出 wardrobe 目录
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
  const cat = await db
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
    const found = (await db.select({ id: tags.id }).from(tags).all())
      .filter((t) => tagIds.includes(t.id))
      .map((t) => t.id);
    const missing = tagIds.filter((t) => !found.includes(t));
    if (missing.length > 0) {
      throw AppError.badRequest(`tagId 不存在: ${missing.join(",")}`);
    }
  }

  const { mime, ext, buffer } = decodeDataUri(params.fileBase64);
  const id = `wu_${shortId(8)}`;
  const objectKey = `wardrobe/${id}${ext}`;

  // 先落 Blob，再写 DB；DB 写失败时删 Blob 回滚
  const uploaded = await put(objectKey, buffer, {
    access: "public",
    contentType: mime,
  });

  try {
    await db.transaction(async (tx) => {
      await tx.insert(wardrobeItems).values({
        id,
        name,
        categoryId: params.categoryId,
        file: uploaded.url,
      });
      for (const tagId of tagIds) {
        await tx
          .insert(wardrobeItemTags)
          .values({ wardrobeItemId: id, tagId })
          .onConflictDoNothing();
      }
    });
  } catch (err) {
    // 回滚已落 Blob
    await del(uploaded.url).catch(() => {});
    throw AppError.internal("写入数据库失败", err);
  }

  const row = await getWardrobeItem(id);
  if (!row) {
    throw AppError.internal("写入后无法回读单品");
  }
  const tagsByItem = await fetchTagsByItemIds([id]);
  const t = tagsByItem.get(id);
  const item: WardrobeListItem = {
    ...rowToItem(row),
    url: resolveWardrobeUrl(row.file),
  };
  if (t && t.length > 0) item.tags = t;
  return item;
}

export async function deleteWardrobeItem(id: string): Promise<void> {
  const row = await getWardrobeItem(id);
  if (!row) {
    throw AppError.notFound(`衣橱中不存在 id: ${id}`);
  }

  try {
    await db.delete(wardrobeItems).where(eq(wardrobeItems.id, id));
  } catch (err) {
    throw AppError.internal("删除数据库行失败", err);
  }

  // 远端 Blob：调 del；本地 seed 文件：unlink（幂等）
  if (isRemoteUrl(row.file)) {
    try {
      await del(row.file);
    } catch (err) {
      // DB 已删，Blob 删失败仅打日志
      console.error(`[wardrobe] del blob ${row.file} 失败:`, err);
    }
    return;
  }

  const safeName = path.basename(row.file);
  if (safeName !== row.file) {
    console.error(`[wardrobe] 条目 ${id} 的 file 字段非法: ${row.file}`);
    return;
  }
  const filePath = path.join(WARDROBE_DIR, safeName);
  try {
    await unlink(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return; // 幂等
    console.error(`[wardrobe] unlink ${filePath} 失败:`, err);
  }
}
