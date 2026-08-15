import { z } from "zod";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword, makeSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "用户名至少 2 个字符")
    .max(20, "用户名最多 20 个字符")
    .regex(/^[\w\u4e00-\u9fa5-]+$/, "用户名只能是中英文、数字、下划线、横线"),
  password: z.string().min(6, "密码至少 6 位").max(64),
});

/** 注册：成功后直接登录（种会话 Cookie）。 */
export async function POST(request: Request) {
  return handleApiRoute("auth:register", async () => {
    const json = await request.json().catch(() => null);
    const body = bodySchema.parse(json);
    const username = body.username.toLowerCase();

    const exists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));
    if (exists.length > 0) {
      throw AppError.badRequest("这个用户名已经被注册了，换一个吧");
    }

    const id = randomUUID().replace(/-/g, "").slice(0, 16);
    await db.insert(users).values({
      id,
      username,
      passwordHash: hashPassword(body.password),
    });

    const res = NextResponse.json({ registered: true, username });
    res.cookies.set(SESSION_COOKIE, makeSessionToken(id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86400,
    });
    return res;
  });
}
