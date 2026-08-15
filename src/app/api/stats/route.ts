import { handleApiRoute } from "@/lib/api-helpers";
import { getStats } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";

export const runtime = "nodejs";

/** 统计信息（当前登录人的）。 */
export async function GET() {
  return handleApiRoute("stats:get", async () => {
    const owner = await getCurrentOwnerId();
    return await getStats(owner);
  });
}
