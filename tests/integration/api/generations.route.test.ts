import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { seedGeneration } from "../../helpers/fixtures";
import { GET } from "@/app/api/generations/route";

function get(qs = "") {
  return new NextRequest(`http://localhost/api/generations${qs}`, { method: "GET" });
}

function seedMany(count: number) {
  for (let i = 0; i < count; i++) {
    seedGeneration({
      id: `gen_${String(i).padStart(4, "0")}`,
      status: i % 2 === 0 ? "success" : "failed",
      createdAt: new Date(2025, 0, 1, 0, 0, i),
    });
  }
}

beforeEach(() => {
  // 每个用例自行 seed —— 无需分类
});

describe("GET /api/generations", () => {
  it("空表 → 200 items=[] nextCursor=null", async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });

  it("默认 limit 返回全部 (少于 20 条时)", async () => {
    seedMany(5);
    const res = await GET(get());
    const body = await res.json();
    expect(body.items).toHaveLength(5);
    expect(body.nextCursor).toBeNull();
  });

  it("limit + cursor 组合翻页 —— 顺序稳定，无重复", async () => {
    seedMany(7);
    const p1 = await (await GET(get("?limit=3"))).json();
    expect(p1.items).toHaveLength(3);
    expect(p1.nextCursor).not.toBeNull();

    const p2 = await (
      await GET(get(`?limit=3&cursor=${encodeURIComponent(p1.nextCursor)}`))
    ).json();
    expect(p2.items).toHaveLength(3);

    const p3 = await (
      await GET(get(`?limit=3&cursor=${encodeURIComponent(p2.nextCursor)}`))
    ).json();
    expect(p3.items).toHaveLength(1);
    expect(p3.nextCursor).toBeNull();

    const allIds = [...p1.items, ...p2.items, ...p3.items].map(
      (r: { id: string }) => r.id
    );
    expect(new Set(allIds).size).toBe(7);
  });

  it("status=failed 只返回 failed 行", async () => {
    seedMany(6);
    const res = await GET(get("?status=failed&limit=100"));
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((r: { status: string }) => r.status === "failed")).toBe(true);
  });

  it("status=success 只返回 success 行", async () => {
    seedMany(6);
    const res = await GET(get("?status=success&limit=100"));
    const body = await res.json();
    expect(body.items.every((r: { status: string }) => r.status === "success")).toBe(true);
  });

  it("非法 status 枚举 → 400", async () => {
    const res = await GET(get("?status=weird"));
    expect(res.status).toBe(400);
  });

  it("非法 limit → 400", async () => {
    const res = await GET(get("?limit=abc"));
    expect(res.status).toBe(400);
  });

  it("非法 cursor → 400", async () => {
    const res = await GET(get("?cursor=%21%21%21non-base64%21%21%21"));
    expect(res.status).toBe(400);
  });
});
