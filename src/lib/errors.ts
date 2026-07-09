/**
 * 领域错误的统一表达。
 * service 层抛出 AppError，route 层捕获后转成对应 HTTP status。
 * 未识别的错误应该走 500 且不暴露堆栈。
 */
export type AppErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "UPSTREAM"
  | "UPSTREAM_TIMEOUT"
  | "INTERNAL";

const HTTP_STATUS_BY_CODE: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UPSTREAM: 502,
  UPSTREAM_TIMEOUT: 504,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = HTTP_STATUS_BY_CODE[code];
    if (cause !== undefined) this.cause = cause;
  }

  static badRequest(message: string, cause?: unknown) {
    return new AppError("BAD_REQUEST", message, cause);
  }
  static notFound(message: string, cause?: unknown) {
    return new AppError("NOT_FOUND", message, cause);
  }
  static payloadTooLarge(message: string, cause?: unknown) {
    return new AppError("PAYLOAD_TOO_LARGE", message, cause);
  }
  static upstream(message: string, cause?: unknown) {
    return new AppError("UPSTREAM", message, cause);
  }
  static upstreamTimeout(message: string, cause?: unknown) {
    return new AppError("UPSTREAM_TIMEOUT", message, cause);
  }
  static internal(message: string, cause?: unknown) {
    return new AppError("INTERNAL", message, cause);
  }
}
