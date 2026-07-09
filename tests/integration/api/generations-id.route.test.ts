import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { seedGeneration } from "../../helpers/fixtures";
import { DELETE } from "@/app/api/generations/[id]/route";
import { getGeneration } from "@/lib/services/generation.service";

function del(id: string) {
  const req = new NextRequest(`http://localhost/api/generations/${id}`, {
    method: "DELETE",
  });
  return DELETE(req, { params: Promise.resolve({ id }) });
}

describe("DELETE /api/generations/[id]", () => {
  it("存在的 id → 200 且落库删除", async () => {
    seedGeneration({ id: "gen_x", status: "success", createdAt: new Date() });
    const res = await del("gen_x");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(await getGeneration("gen_x")).toBeNull();
  });

  it("不存在 → 404", async () => {
    const res = await del("ghost");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("同一 id 连删两次：第二次 404", async () => {
    seedGeneration({ id: "gen_y", status: "failed", createdAt: new Date() });
    expect((await del("gen_y")).status).toBe(200);
    expect((await del("gen_y")).status).toBe(404);
  });
});
