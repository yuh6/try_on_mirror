import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { seedCategories, seedWardrobeItem, TINY_PNG_DATA_URI } from "../../helpers/fixtures";

// 上游 mock —— 必须在 import route 之前
vi.mock("@/lib/seedream", () => ({
  generateImage: vi.fn(),
}));

import { POST } from "@/app/api/generate/route";
import { generateImage } from "@/lib/seedream";
import { db } from "../../helpers/db";
import { generations } from "@/db/schema";

const mocked = vi.mocked(generateImage);

beforeEach(() => {
  seedCategories();
  mocked.mockReset();
});

function post(body: unknown) {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/generate", () => {
  it("上传衣服图 + 上游成功 → 200 且落库 status=success", async () => {
    mocked.mockResolvedValueOnce("https://mock/o.png");
    const res = await POST(
      post({
        personImage: TINY_PNG_DATA_URI,
        clothingImage: TINY_PNG_DATA_URI,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outputUrl).toBe("https://mock/o.png");
    expect(body.generationId.startsWith("gen_")).toBe(true);

    const rows = await db.select().from(generations).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("success");
    expect(rows[0].clothingSource).toBe("uploaded");
  });

  it("使用衣橱 id + 上游成功 → 200 且 clothingSource=wardrobe", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    mocked.mockResolvedValueOnce("https://mock/o.png");
    const res = await POST(
      post({ personImage: TINY_PNG_DATA_URI, clothingId: "w001" })
    );
    expect(res.status).toBe(200);
    const rows = await db.select().from(generations).all();
    expect(rows[0].clothingSource).toBe("wardrobe");
    expect(rows[0].clothingRef).toBe("w001");
  });

  it("两个衣服参数都缺 → 400", async () => {
    const res = await POST(post({ personImage: TINY_PNG_DATA_URI }));
    expect(res.status).toBe(400);
  });

  it("personImage 缺失 → 400", async () => {
    const res = await POST(post({ clothingImage: TINY_PNG_DATA_URI }));
    expect(res.status).toBe(400);
  });

  it("personImage 前缀不是 data:image/ → 400", async () => {
    const res = await POST(
      post({ personImage: "http://x", clothingImage: TINY_PNG_DATA_URI })
    );
    expect(res.status).toBe(400);
  });

  it("clothingId 不存在 → 404 且不写库", async () => {
    const res = await POST(
      post({ personImage: TINY_PNG_DATA_URI, clothingId: "ghost" })
    );
    expect(res.status).toBe(404);
    expect(await db.select().from(generations).all()).toEqual([]);
  });

  it("上游失败 → 502 且落库 status=failed", async () => {
    mocked.mockRejectedValueOnce(new Error("上游炸"));
    const res = await POST(
      post({
        personImage: TINY_PNG_DATA_URI,
        clothingImage: TINY_PNG_DATA_URI,
      })
    );
    expect(res.status).toBe(502);
    const rows = await db.select().from(generations).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
  });

  it("上游 AbortError → 504 且落库 failed", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    mocked.mockRejectedValueOnce(err);
    const res = await POST(
      post({
        personImage: TINY_PNG_DATA_URI,
        clothingImage: TINY_PNG_DATA_URI,
      })
    );
    expect(res.status).toBe(504);
    const rows = await db.select().from(generations).all();
    expect(rows[0].status).toBe("failed");
  });

  it("body 不是 JSON → 400", async () => {
    const req = new NextRequest("http://localhost/api/generate", {
      method: "POST",
      body: "garbage",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
