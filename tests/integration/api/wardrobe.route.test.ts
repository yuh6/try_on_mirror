import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "../../helpers/db";
import { seedCategories, seedWardrobeItem, TINY_PNG_DATA_URI } from "../../helpers/fixtures";
import { GET, POST } from "@/app/api/wardrobe/route";
import { wardrobeItems } from "@/db/schema";

beforeEach(() => {
  seedCategories();
});

function makeGet(url: string) {
  return new NextRequest(url, { method: "GET" });
}
function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/wardrobe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/wardrobe", () => {
  it("空表返回 categories 与空 items", async () => {
    const res = await GET(makeGet("http://localhost/api/wardrobe"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories.length).toBeGreaterThan(0);
  });

  it("落库后返回条目结构完整", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    const res = await GET(makeGet("http://localhost/api/wardrobe"));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "w001",
      name: "衫",
      category: "top",
      file: "w001.png",
      url: "/wardrobe/w001.png",
    });
  });

  it("category query 只返回对应分类", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    seedWardrobeItem({ id: "w002", name: "裙", categoryId: "dress", file: "w002.png" });
    const res = await GET(makeGet("http://localhost/api/wardrobe?category=top"));
    const body = await res.json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["w001"]);
  });
});

describe("POST /api/wardrobe", () => {
  it("合法参数 → 200，落库 + 返回 item", async () => {
    const res = await POST(
      makePost({
        name: "新单品",
        categoryId: "top",
        fileBase64: TINY_PNG_DATA_URI,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.name).toBe("新单品");
    expect(body.item.id.startsWith("wu_")).toBe(true);
    expect(db.select().from(wardrobeItems).all()).toHaveLength(1);
  });

  it("name 缺失 → zod 400", async () => {
    const res = await POST(
      makePost({ categoryId: "top", fileBase64: TINY_PNG_DATA_URI })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("categoryId 缺失 → 400", async () => {
    const res = await POST(
      makePost({ name: "x", fileBase64: TINY_PNG_DATA_URI })
    );
    expect(res.status).toBe(400);
  });

  it("fileBase64 前缀非 data:image/ → 400", async () => {
    const res = await POST(
      makePost({
        name: "x",
        categoryId: "top",
        fileBase64: "http://example.com/img.png",
      })
    );
    expect(res.status).toBe(400);
  });

  it("body 不是合法 JSON → 400", async () => {
    const req = new NextRequest("http://localhost/api/wardrobe", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("categoryId 不存在 → 400", async () => {
    const res = await POST(
      makePost({
        name: "x",
        categoryId: "ghost",
        fileBase64: TINY_PNG_DATA_URI,
      })
    );
    expect(res.status).toBe(400);
  });
});
