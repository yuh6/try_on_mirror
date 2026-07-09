/**
 * 通用 seed 数据 —— 一小撮 categories / tags / wardrobe items，供各测试复用。
 * 所有依赖 sqlite 的用例先 seed 再断言。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "./db";
import { categories, generations, tags, wardrobeItems, wardrobeItemTags } from "../../src/db/schema";

// 1x1 透明 PNG（长度 67 字节）—— 最小可解码 PNG
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

export const TINY_PNG_DATA_URI = `data:image/png;base64,${TINY_PNG_BASE64}`;
export const TINY_JPEG_DATA_URI = `data:image/jpeg;base64,${TINY_PNG_BASE64}`; // 内容不重要
export const TINY_WEBP_DATA_URI = `data:image/webp;base64,${TINY_PNG_BASE64}`;

export function seedCategories() {
  db.insert(categories)
    .values([
      { id: "top", name: "上衣", sortOrder: 1 },
      { id: "dress", name: "连衣裙", sortOrder: 2 },
      { id: "bottom", name: "下装", sortOrder: 3 },
    ])
    .run();
}

export function seedTags() {
  db.insert(tags).values([
    { id: "tag_slim", name: "显瘦", createdAt: new Date(2025, 0, 1) },
    { id: "tag_work", name: "通勤", createdAt: new Date(2025, 0, 1) },
  ]).run();
}

/**
 * 插一条 wardrobe_item 行 + 落盘一张最小 PNG 文件到 WARDROBE_DIR。
 * 让后续 getWardrobeItemAsDataUri / delete 可以完整走一遍。
 */
export function seedWardrobeItem(opts: {
  id: string;
  name: string;
  categoryId: string;
  file: string;
  tagIds?: string[];
}) {
  db.insert(wardrobeItems).values({
    id: opts.id,
    name: opts.name,
    categoryId: opts.categoryId,
    file: opts.file,
    createdAt: new Date(2025, 0, 1),
  }).run();
  if (opts.tagIds?.length) {
    for (const tagId of opts.tagIds) {
      db.insert(wardrobeItemTags).values({ wardrobeItemId: opts.id, tagId }).run();
    }
  }
  // 落盘
  const dir = path.join(process.cwd(), "public", "wardrobe");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, opts.file), Buffer.from(TINY_PNG_BASE64, "base64"));
}

/** 造搭配（generation）行——便于 list / delete 测试。 */
export function seedGeneration(opts: {
  id: string;
  status: "success" | "failed";
  createdAt: Date;
  clothingSource?: "uploaded" | "wardrobe";
  clothingRef?: string;
  outputUrl?: string | null;
  errorMessage?: string | null;
  latencyMs?: number;
}) {
  db.insert(generations).values({
    id: opts.id,
    createdAt: opts.createdAt,
    personImageHash: "hash_" + opts.id,
    clothingSource: opts.clothingSource ?? "uploaded",
    clothingRef: opts.clothingRef ?? "ref_" + opts.id,
    outputUrl: opts.outputUrl ?? (opts.status === "success" ? "https://example.com/x.png" : null),
    prompt: "test-prompt",
    status: opts.status,
    errorMessage: opts.errorMessage ?? (opts.status === "failed" ? "test error" : null),
    latencyMs: opts.latencyMs ?? 1234,
  }).run();
}
