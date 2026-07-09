import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { seedCategories, seedWardrobeItem } from "../../helpers/fixtures";
import { DELETE } from "@/app/api/wardrobe/[id]/route";
import { WARDROBE_DIR, getWardrobeItem } from "@/lib/services/wardrobe.service";

beforeEach(() => {
  seedCategories();
});

function del(id: string) {
  const req = new NextRequest(`http://localhost/api/wardrobe/${id}`, {
    method: "DELETE",
  });
  return DELETE(req, { params: Promise.resolve({ id }) });
}

describe("DELETE /api/wardrobe/[id]", () => {
  it("存在的 id → 200 + { ok: true }，DB 行和磁盘文件同时消失", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    const filePath = path.join(WARDROBE_DIR, "w001.png");
    expect(existsSync(filePath)).toBe(true);

    const res = await del("w001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    expect(getWardrobeItem("w001")).toBeNull();
    expect(existsSync(filePath)).toBe(false);
  });

  it("不存在的 id → 404", async () => {
    const res = await del("ghost");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("同一个 id 连删两次：第二次返回 404（幂等语义为「不存在」）", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    const r1 = await del("w001");
    expect(r1.status).toBe(200);
    const r2 = await del("w001");
    expect(r2.status).toBe(404);
  });
});
