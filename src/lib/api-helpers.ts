import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

/**
 * route 层通用包装：
 *  - 捕获 AppError → 对应 httpStatus
 *  - 捕获 ZodError → 400 + 简化的字段错误信息
 *  - 其它 → 500，仅返回泛化文案，堆栈只落 stderr
 */
export async function handleApiRoute<T>(
  scope: string,
  handler: () => Promise<T>
): Promise<NextResponse> {
  try {
    const result = await handler();
    // 允许 handler 直接返回 NextResponse（例如需要自定义 status）
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      // 4xx 只打 warn，5xx 才打 error
      const log = error.httpStatus >= 500 ? console.error : console.warn;
      log(`[${scope}] ${error.code}: ${error.message}`, error.cause ?? "");
      return NextResponse.json(
        { error: error.message },
        { status: error.httpStatus }
      );
    }
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const path = issue?.path?.join(".") ?? "";
      const message = path ? `${path}: ${issue.message}` : issue?.message ?? "参数错误";
      console.warn(`[${scope}] ZOD: ${message}`);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(`[${scope}] UNCAUGHT:`, error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
