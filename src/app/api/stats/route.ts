import { handleApiRoute } from "@/lib/api-helpers";
import { getStats } from "@/lib/family-board";

export const runtime = "nodejs";

/** 统计信息（与 Flask 版 GET /api/stats 一致）。 */
export async function GET() {
  return handleApiRoute("stats:get", async () => {
    return await getStats();
  });
}
