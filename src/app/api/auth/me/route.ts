import { handleApiRoute } from "@/lib/api-helpers";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentOwnerId, getSessionToken } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 当前登录状态。
 * 同时返回原始会话 token（仅同源可取，用于语音桥携带凭证查登录人档案）。
 */
export async function GET() {
  return handleApiRoute("auth:me", async () => {
    const ownerId = await getCurrentOwnerId();
    if (!ownerId) {
      return { loggedIn: false, username: null, token: null };
    }
    const rows = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, ownerId));
    if (rows.length === 0) {
      return { loggedIn: false, username: null, token: null };
    }
    return { loggedIn: true, username: rows[0].username, token: await getSessionToken() };
  });
}
