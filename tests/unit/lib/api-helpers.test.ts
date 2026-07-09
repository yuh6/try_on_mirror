import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";

describe("handleApiRoute", () => {
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    // 静音 log —— 不影响断言输出
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.warn = originalWarn;
    console.error = originalError;
  });

  it("handler 成功返回 payload → NextResponse.json 200", async () => {
    const res = await handleApiRoute("scope", async () => ({ ok: true, value: 42 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, value: 42 });
  });

  it("捕获 AppError.badRequest → 400", async () => {
    const res = await handleApiRoute("scope", async () => {
      throw AppError.badRequest("参数错了");
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "参数错了" });
  });

  it("捕获 AppError.notFound → 404", async () => {
    const res = await handleApiRoute("scope", async () => {
      throw AppError.notFound("不存在");
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("不存在");
  });

  it("捕获 AppError.payloadTooLarge → 413", async () => {
    const res = await handleApiRoute("scope", async () => {
      throw AppError.payloadTooLarge("过大");
    });
    expect(res.status).toBe(413);
  });

  it("捕获 AppError.upstream → 502", async () => {
    const res = await handleApiRoute("scope", async () => {
      throw AppError.upstream("上游炸");
    });
    expect(res.status).toBe(502);
  });

  it("捕获 AppError.upstreamTimeout → 504", async () => {
    const res = await handleApiRoute("scope", async () => {
      throw AppError.upstreamTimeout("超时");
    });
    expect(res.status).toBe(504);
  });

  it("捕获 AppError.internal → 500", async () => {
    const res = await handleApiRoute("scope", async () => {
      throw AppError.internal("内部错");
    });
    expect(res.status).toBe(500);
  });

  it("捕获 ZodError → 400 且附带字段路径", async () => {
    const schema = z.object({ name: z.string().min(3) });
    const res = await handleApiRoute("scope", async () => {
      schema.parse({ name: "a" });
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    // 形如 "name: ..." —— 字段路径前置
    expect(typeof body.error).toBe("string");
    expect(body.error.startsWith("name")).toBe(true);
  });

  it("未识别 Error → 500 且响应不含堆栈/内部消息", async () => {
    const res = await handleApiRoute("scope", async () => {
      throw new Error("秘密堆栈信息 stackTrace at internals");
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("服务器内部错误");
    // 泛化文案不能暴露原始 message
    expect(body.error).not.toContain("秘密");
    expect(body.error).not.toContain("stackTrace");
  });

  it("throw 非 Error 值（例如字符串）也被兜底 500", async () => {
    const res = await handleApiRoute("scope", async () => {
      throw "raw string";
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("服务器内部错误");
  });

  it("允许 handler 直接返回 NextResponse（不重复 wrap）", async () => {
    const { NextResponse } = await import("next/server");
    const res = await handleApiRoute("scope", async () => {
      return NextResponse.json({ custom: true }, { status: 201 });
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ custom: true });
  });

  it("4xx 走 console.warn，5xx 走 console.error", async () => {
    const warnSpy = console.warn as ReturnType<typeof vi.fn>;
    const errorSpy = console.error as ReturnType<typeof vi.fn>;

    await handleApiRoute("scope", async () => {
      throw AppError.badRequest("客户端错");
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockClear();
    errorSpy.mockClear();

    await handleApiRoute("scope", async () => {
      throw AppError.internal("服务端错");
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});
