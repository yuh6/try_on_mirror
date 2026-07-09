import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../../helpers/db";
import { seedCategories, seedWardrobeItem, seedGeneration, TINY_PNG_DATA_URI } from "../../helpers/fixtures";

// 在 import 生成服务之前必须先 mock 上游 seedream，防止真实网络调用
vi.mock("@/lib/seedream", () => ({
  generateImage: vi.fn(),
}));

import {
  createGeneration,
  listGenerations,
  deleteGeneration,
  getGeneration,
  encodeCursor,
  decodeCursor,
  recordGenerationResult,
  DEFAULT_PROMPT,
} from "@/lib/services/generation.service";
import { generateImage } from "@/lib/seedream";
import { AppError } from "@/lib/errors";
import { generations } from "@/db/schema";

const mockedGenerateImage = vi.mocked(generateImage);

beforeEach(() => {
  seedCategories();
  mockedGenerateImage.mockReset();
});

describe("generation.service · cursor 编解码", () => {
  it("encode 之后 decode 得到同样的 (createdAt, id)", () => {
    const cursor = encodeCursor(1_700_000_000, "gen_abcxyz1234");
    const back = decodeCursor(cursor);
    expect(back).toEqual({ createdAtUnix: 1_700_000_000, id: "gen_abcxyz1234" });
  });

  it("非法 base64 → BAD_REQUEST", () => {
    // 缺少 ':' 分隔符
    const bad = Buffer.from("nocolon", "utf8").toString("base64url");
    expect(() => decodeCursor(bad)).toThrow(AppError);
    try {
      decodeCursor(bad);
    } catch (e) {
      expect((e as AppError).code).toBe("BAD_REQUEST");
    }
  });

  it("createdAt 非正数 → BAD_REQUEST", () => {
    const bad = Buffer.from("0:gen_x", "utf8").toString("base64url");
    expect(() => decodeCursor(bad)).toThrow();
    try {
      decodeCursor(bad);
    } catch (e) {
      expect((e as AppError).code).toBe("BAD_REQUEST");
    }
  });

  it("id 为空 → BAD_REQUEST", () => {
    const bad = Buffer.from("1700000000:", "utf8").toString("base64url");
    expect(() => decodeCursor(bad)).toThrow();
  });
});

describe("generation.service · createGeneration", () => {
  it("上传衣服图 + 上游成功 → 写 status=success 一行，返回 outputUrl / generationId", async () => {
    mockedGenerateImage.mockResolvedValueOnce("https://mock/output.png");

    const res = await createGeneration({
      personImage: TINY_PNG_DATA_URI,
      clothingImage: TINY_PNG_DATA_URI,
    });

    expect(res.outputUrl).toBe("https://mock/output.png");
    expect(res.generationId.startsWith("gen_")).toBe(true);

    const row = await getGeneration(res.generationId);
    expect(row).not.toBeNull();
    expect(row!.status).toBe("success");
    expect(row!.clothingSource).toBe("uploaded");
    expect(row!.outputUrl).toBe("https://mock/output.png");
    expect(row!.errorMessage).toBeNull();
    expect(row!.prompt).toBe(DEFAULT_PROMPT);
    expect(row!.latencyMs).toBeGreaterThanOrEqual(0);
    // hash 不为空且 uploaded 场景的 clothingRef 也是 hash
    expect(row!.personImageHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.clothingRef).toMatch(/^[0-9a-f]{64}$/);
    // 上游被调用一次
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("使用衣橱 id + 上游成功 → clothingSource=wardrobe 且 ref=id", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    mockedGenerateImage.mockResolvedValueOnce("https://mock/output2.png");

    const res = await createGeneration({
      personImage: TINY_PNG_DATA_URI,
      clothingId: "w001",
    });

    const row = await getGeneration(res.generationId);
    expect(row!.clothingSource).toBe("wardrobe");
    expect(row!.clothingRef).toBe("w001");
    expect(row!.status).toBe("success");
  });

  it("衣橱 id 不存在 → NOT_FOUND 且不写库", async () => {
    await expect(
      createGeneration({ personImage: TINY_PNG_DATA_URI, clothingId: "ghost" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.select().from(generations).all()).toEqual([]);
    expect(mockedGenerateImage).not.toHaveBeenCalled();
  });

  it("缺失 personImage → BAD_REQUEST", async () => {
    await expect(
      // @ts-expect-error 故意缺参
      createGeneration({ clothingImage: TINY_PNG_DATA_URI })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("两个衣服参数都缺 → BAD_REQUEST", async () => {
    await expect(
      createGeneration({ personImage: TINY_PNG_DATA_URI })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("上游失败也写一行 status=failed 且抛 UPSTREAM", async () => {
    mockedGenerateImage.mockRejectedValueOnce(new Error("上游炸"));

    await expect(
      createGeneration({
        personImage: TINY_PNG_DATA_URI,
        clothingImage: TINY_PNG_DATA_URI,
      })
    ).rejects.toMatchObject({ code: "UPSTREAM" });

    const rows = db.select().from(generations).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].outputUrl).toBeNull();
    expect(rows[0].errorMessage).toBe("上游炸");
  });

  it("上游 AbortError 视为超时 → UPSTREAM_TIMEOUT，写库 failed", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    mockedGenerateImage.mockRejectedValueOnce(abortErr);

    await expect(
      createGeneration({
        personImage: TINY_PNG_DATA_URI,
        clothingImage: TINY_PNG_DATA_URI,
      })
    ).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT" });

    const rows = db.select().from(generations).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].errorMessage).toContain("超时");
  });

  it("uploaded 与 wardrobe 两个来源的 clothingRef 格式不同", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    mockedGenerateImage.mockResolvedValue("https://mock/x.png");

    const a = await createGeneration({
      personImage: TINY_PNG_DATA_URI,
      clothingImage: TINY_PNG_DATA_URI,
    });
    const b = await createGeneration({
      personImage: TINY_PNG_DATA_URI,
      clothingId: "w001",
    });

    const rowA = await getGeneration(a.generationId);
    const rowB = await getGeneration(b.generationId);
    expect(rowA!.clothingRef).toMatch(/^[0-9a-f]{64}$/);
    expect(rowB!.clothingRef).toBe("w001");
  });
});

describe("generation.service · listGenerations 键集分页", () => {
  function seedMany(count: number, opts?: { status?: "success" | "failed" }) {
    for (let i = 0; i < count; i++) {
      // createdAt 递增，id 亦递增，让分页顺序稳定
      seedGeneration({
        id: `gen_${String(i).padStart(4, "0")}`,
        status: opts?.status ?? (i % 3 === 0 ? "failed" : "success"),
        createdAt: new Date(2025, 0, 1, 0, 0, i), // 每条差 1 秒
      });
    }
  }

  it("空表 → items=[]、nextCursor=null", async () => {
    const res = await listGenerations();
    expect(res.items).toEqual([]);
    expect(res.nextCursor).toBeNull();
  });

  it("按 created_at DESC 排序返回", async () => {
    seedMany(5);
    const res = await listGenerations({ limit: 10 });
    expect(res.items).toHaveLength(5);
    // 时间戳应严格递减
    for (let i = 1; i < res.items.length; i++) {
      expect(res.items[i - 1].createdAt).toBeGreaterThanOrEqual(res.items[i].createdAt);
    }
    expect(res.nextCursor).toBeNull();
  });

  it("limit 小于总数 → 返回 nextCursor，第二页衔接不重复不遗漏", async () => {
    seedMany(7);
    const p1 = await listGenerations({ limit: 3 });
    expect(p1.items).toHaveLength(3);
    expect(p1.nextCursor).not.toBeNull();

    const p2 = await listGenerations({ limit: 3, cursor: p1.nextCursor! });
    expect(p2.items).toHaveLength(3);

    const p3 = await listGenerations({ limit: 3, cursor: p2.nextCursor! });
    expect(p3.items).toHaveLength(1);
    expect(p3.nextCursor).toBeNull();

    // 全量拼接后 id 唯一且总数等于 seed 数
    const allIds = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(new Set(allIds).size).toBe(7);
    expect(allIds).toHaveLength(7);
  });

  it("cursor encode/decode round-trip 保持一致性", async () => {
    seedMany(4);
    const p1 = await listGenerations({ limit: 2 });
    const decoded = decodeCursor(p1.nextCursor!);
    const encodedAgain = encodeCursor(decoded.createdAtUnix, decoded.id);
    expect(encodedAgain).toBe(p1.nextCursor);
  });

  it("status='success' 过滤只返回 success 行", async () => {
    seedMany(6);
    const res = await listGenerations({ limit: 100, status: "success" });
    expect(res.items.every((r) => r.status === "success")).toBe(true);
    // 至少一条 failed 被排除
    expect(res.items.length).toBeLessThan(6);
  });

  it("status='failed' 过滤只返回 failed 行", async () => {
    seedMany(6);
    const res = await listGenerations({ limit: 100, status: "failed" });
    expect(res.items.every((r) => r.status === "failed")).toBe(true);
    expect(res.items.length).toBeGreaterThan(0);
  });

  it("limit 会被 clamp 到 [1, 50]", async () => {
    seedMany(3);
    const zero = await listGenerations({ limit: 0 });
    // 应至少返回一条（clamp 到 1）
    expect(zero.items.length).toBeGreaterThanOrEqual(1);

    const huge = await listGenerations({ limit: 1000 });
    // 只 seed 了 3 条，返回不应超过 3
    expect(huge.items.length).toBe(3);
  });

  it("非法 cursor → BAD_REQUEST", async () => {
    await expect(
      listGenerations({ cursor: "!!!非法!!!" })
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("generation.service · deleteGeneration", () => {
  it("成功删除", async () => {
    seedGeneration({
      id: "gen_x",
      status: "success",
      createdAt: new Date(),
    });
    await deleteGeneration("gen_x");
    expect(await getGeneration("gen_x")).toBeNull();
  });

  it("不存在 → NOT_FOUND", async () => {
    await expect(deleteGeneration("ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("generation.service · recordGenerationResult", () => {
  it("补写一条 success 记录", async () => {
    const row = await recordGenerationResult({
      personImageHash: "abc",
      clothingSource: "uploaded",
      clothingRef: "def",
      outputUrl: "https://x/y.png",
      prompt: "p",
      status: "success",
      latencyMs: 42,
    });
    expect(row.id.startsWith("gen_")).toBe(true);
    expect(row.status).toBe("success");
    expect(row.outputUrl).toBe("https://x/y.png");
  });

  it("补写一条 failed 记录", async () => {
    const row = await recordGenerationResult({
      personImageHash: "abc",
      clothingSource: "wardrobe",
      clothingRef: "w001",
      prompt: "p",
      status: "failed",
      errorMessage: "上游炸",
      latencyMs: 999,
    });
    expect(row.status).toBe("failed");
    expect(row.errorMessage).toBe("上游炸");
    expect(row.outputUrl).toBeNull();
  });
});
