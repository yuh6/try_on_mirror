import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, lt, or, SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { generations } from "@/db/schema";
import type { GenerationRow } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { generateImage } from "@/lib/seedream";
import { getWardrobeItemAsDataUri, getWardrobeItem } from "@/lib/services/wardrobe.service";

export const DEFAULT_PROMPT =
  "将图一的服饰，穿到图二的人物身上，保持图二背景内容与人物面貌一致性不变，同时稍微把人物的气质提升一下，稍微变好看一点，自信一点";

// Seedream 服务端超时（DESIGN 5.2：服务端 90s，前端 120s）
const SEEDREAM_TIMEOUT_MS = 90_000;

function shortId(bytes = 8): string {
  return randomBytes(bytes)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);
}

function sha256Base64Body(dataUri: string): string {
  const commaIdx = dataUri.indexOf(",");
  const body = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri;
  return createHash("sha256").update(body).digest("hex");
}

export type GenerationApiItem = {
  id: string;
  createdAt: number;
  clothingSource: "uploaded" | "wardrobe";
  clothingRef: string;
  outputUrl: string | null;
  status: "success" | "failed";
  errorMessage: string | null;
  latencyMs: number;
};

function rowToApiItem(row: GenerationRow): GenerationApiItem {
  return {
    id: row.id,
    createdAt: Math.floor(row.createdAt.getTime() / 1000),
    clothingSource: row.clothingSource,
    clothingRef: row.clothingRef,
    outputUrl: row.outputUrl ?? null,
    status: row.status,
    errorMessage: row.errorMessage ?? null,
    latencyMs: row.latencyMs,
  };
}

/**
 * cursor 编码：`<created_at_unix_seconds>:<id>` → base64url。
 * 键集分页：WHERE (created_at, id) < (cursor.createdAt, cursor.id) 按 created_at DESC, id DESC。
 */
export function encodeCursor(createdAtUnix: number, id: string): string {
  return Buffer.from(`${createdAtUnix}:${id}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): { createdAtUnix: number; id: string } {
  let raw: string;
  try {
    raw = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw AppError.badRequest("cursor 解码失败");
  }
  const idx = raw.indexOf(":");
  if (idx < 0) throw AppError.badRequest("cursor 格式非法");
  const createdAtUnix = Number(raw.slice(0, idx));
  const id = raw.slice(idx + 1);
  if (!Number.isFinite(createdAtUnix) || createdAtUnix <= 0 || !id) {
    throw AppError.badRequest("cursor 内容非法");
  }
  return { createdAtUnix, id };
}

export type CreateGenerationParams = {
  personImage: string;
  clothingImage?: string;
  clothingId?: string;
};

export type CreateGenerationResult = {
  outputUrl: string;
  generationId: string;
};

/**
 * 触发一次换衣生成。
 * - 无论成功失败都写一行 generations。
 * - 失败时抛 AppError，route 层统一转 HTTP status。
 */
export async function createGeneration(
  params: CreateGenerationParams
): Promise<CreateGenerationResult> {
  if (!params.personImage) {
    throw AppError.badRequest("请上传人物图");
  }
  if (!params.clothingImage && !params.clothingId) {
    throw AppError.badRequest("请上传衣服图或从衣橱选择一件");
  }

  const clothingSource: "uploaded" | "wardrobe" = params.clothingImage
    ? "uploaded"
    : "wardrobe";

  let clothingRef: string;
  let clothing: string;

  if (clothingSource === "wardrobe") {
    const id = params.clothingId!;
    const row = await getWardrobeItem(id);
    if (!row) throw AppError.notFound(`衣橱中不存在 id: ${id}`);
    clothingRef = id;
    clothing = await getWardrobeItemAsDataUri(id);
  } else {
    clothing = params.clothingImage!;
    clothingRef = sha256Base64Body(clothing);
  }

  const personImageHash = sha256Base64Body(params.personImage);
  const prompt = DEFAULT_PROMPT;
  const generationId = `gen_${shortId(10)}`;
  const startedAt = Date.now();

  let outputUrl: string | undefined;
  let errorForRecord: { code: "UPSTREAM" | "UPSTREAM_TIMEOUT" | "INTERNAL"; message: string } | undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEEDREAM_TIMEOUT_MS);

  try {
    outputUrl = await generateImage({
      prompt,
      images: [clothing, params.personImage],
      size: "2K",
      signal: controller.signal,
    });
  } catch (err) {
    const isAbort =
      (err as Error)?.name === "AbortError" ||
      controller.signal.aborted;
    if (isAbort) {
      errorForRecord = { code: "UPSTREAM_TIMEOUT", message: "Seedream 请求超时" };
    } else {
      const msg = err instanceof Error ? err.message : "上游生成失败";
      errorForRecord = { code: "UPSTREAM", message: msg };
    }
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - startedAt;

  // 写库（成功/失败都写）
  try {
    await db.insert(generations).values({
      id: generationId,
      personImageHash,
      clothingSource,
      clothingRef,
      outputUrl: outputUrl ?? null,
      prompt,
      status: errorForRecord ? "failed" : "success",
      errorMessage: errorForRecord?.message ?? null,
      latencyMs,
    });
  } catch (err) {
    // 落盘失败不能吞掉上游成功的图片 URL；但报错要冒出来
    console.error("[generation] 写库失败:", err);
    if (!errorForRecord) {
      throw AppError.internal("生成记录写库失败", err);
    }
  }

  if (errorForRecord) {
    throw new AppError(errorForRecord.code, errorForRecord.message);
  }

  return { outputUrl: outputUrl!, generationId };
}

export type ListGenerationsParams = {
  limit?: number;
  cursor?: string;
  status?: "success" | "failed";
};

export type ListGenerationsResult = {
  items: GenerationApiItem[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function listGenerations(
  params: ListGenerationsParams = {}
): Promise<ListGenerationsResult> {
  const limit = Math.min(
    Math.max(1, Math.floor(params.limit ?? DEFAULT_LIMIT)),
    MAX_LIMIT
  );

  const conds: SQL<unknown>[] = [];
  if (params.status) {
    conds.push(eq(generations.status, params.status));
  }
  if (params.cursor) {
    const { createdAtUnix, id } = decodeCursor(params.cursor);
    // (created_at, id) < (cursorTs, cursorId) 的键集分页
    // Drizzle 的 timestamp mode 底层存 unix seconds；用 raw SQL 精确表达
    conds.push(
      or(
        lt(generations.createdAt, new Date(createdAtUnix * 1000)),
        and(
          eq(generations.createdAt, new Date(createdAtUnix * 1000)),
          lt(generations.id, id)
        )
      ) as SQL<unknown>
    );
  }

  const whereExpr =
    conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select()
    .from(generations)
    .where(whereExpr as SQL<unknown> | undefined)
    .orderBy(desc(generations.createdAt), desc(generations.id))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = pageRows.map(rowToApiItem);
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
    : null;

  return { items, nextCursor };
}

export async function getGeneration(id: string): Promise<GenerationRow | null> {
  const row = await db
    .select()
    .from(generations)
    .where(eq(generations.id, id))
    .get();
  return row ?? null;
}

export async function deleteGeneration(id: string): Promise<void> {
  const row = await getGeneration(id);
  if (!row) {
    throw AppError.notFound(`生成记录不存在: ${id}`);
  }
  try {
    await db.delete(generations).where(eq(generations.id, id));
  } catch (err) {
    throw AppError.internal("删除生成记录失败", err);
  }
}

/**
 * 允许外部（例如测试或脚本）直接补写一条生成记录。
 * DESIGN 3.4 要求成功/失败都写一行，本方法用于绕过实际上游调用做记录。
 */
export async function recordGenerationResult(input: {
  personImageHash: string;
  clothingSource: "uploaded" | "wardrobe";
  clothingRef: string;
  outputUrl?: string | null;
  prompt: string;
  status: "success" | "failed";
  errorMessage?: string | null;
  latencyMs: number;
}): Promise<GenerationRow> {
  const id = `gen_${shortId(10)}`;
  await db.insert(generations).values({
    id,
    personImageHash: input.personImageHash,
    clothingSource: input.clothingSource,
    clothingRef: input.clothingRef,
    outputUrl: input.outputUrl ?? null,
    prompt: input.prompt,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    latencyMs: input.latencyMs,
  });
  const row = await getGeneration(id);
  if (!row) throw AppError.internal("record 后无法回读生成行");
  return row;
}

// 消除未使用告警：raw SQL helper 保留给未来复杂条件
void sql;
