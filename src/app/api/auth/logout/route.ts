import { NextResponse } from "next/server";
import { handleApiRoute } from "@/lib/api-helpers";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

/** 退出登录。 */
export async function POST() {
  return handleApiRoute("auth:logout", async () => {
    const res = NextResponse.json({ loggedOut: true });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  });
}
