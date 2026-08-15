import { handleApiRoute } from "@/lib/api-helpers";
import { getAllData } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";

export const runtime = "nodejs";

/** 全量数据（当前登录人的；未登录=演示数据）。 */
export async function GET() {
  return handleApiRoute("data:get", async () => {
    const owner = await getCurrentOwnerId();
    return await getAllData(owner);
  });
}
