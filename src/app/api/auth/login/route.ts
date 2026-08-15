import { z } from "zod";
import { NextResponse } from "next/server";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword, makeSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().trim().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

/** 登录。 */
export async function POST(request: Request) {
  return handleApiRoute("auth:login", async () => {
    const json = await request.json().catch(() => null);
    const body = bodySchema.parse(json);

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, body.username.toLowerCase()));
    const user = rows[0];
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      throw AppError.badRequest("用户名或密码不对");
    }

    const res = NextResponse.json({ loggedIn: true, username: user.username });
    res.cookies.set(SESSION_COOKIE, makeSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86400,
    });
    return res;
  });
}
