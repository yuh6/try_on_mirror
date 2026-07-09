import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/errors";

describe("AppError", () => {
  it("badRequest 工厂返回 400", () => {
    const err = AppError.badRequest("参数不合法");
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.httpStatus).toBe(400);
    expect(err.message).toBe("参数不合法");
    expect(err.name).toBe("AppError");
  });

  it("notFound 工厂返回 404", () => {
    const err = AppError.notFound("不存在");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.httpStatus).toBe(404);
  });

  it("payloadTooLarge 工厂返回 413", () => {
    const err = AppError.payloadTooLarge("图太大");
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    expect(err.httpStatus).toBe(413);
  });

  it("upstream 工厂返回 502", () => {
    const err = AppError.upstream("上游炸了");
    expect(err.code).toBe("UPSTREAM");
    expect(err.httpStatus).toBe(502);
  });

  it("upstreamTimeout 工厂返回 504", () => {
    const err = AppError.upstreamTimeout("上游超时");
    expect(err.code).toBe("UPSTREAM_TIMEOUT");
    expect(err.httpStatus).toBe(504);
  });

  it("internal 工厂返回 500", () => {
    const err = AppError.internal("崩了");
    expect(err.code).toBe("INTERNAL");
    expect(err.httpStatus).toBe(500);
  });

  it("接受 cause 并透传", () => {
    const cause = new Error("root cause");
    const err = AppError.internal("wrap", cause);
    expect(err.cause).toBe(cause);
  });

  it("未传 cause 时 cause 属性未定义", () => {
    const err = AppError.badRequest("x");
    expect(err.cause).toBeUndefined();
  });

  it("是标准 Error 子类，可被 instanceof Error 捕获", () => {
    const err = AppError.notFound("x");
    expect(err instanceof Error).toBe(true);
  });
});
