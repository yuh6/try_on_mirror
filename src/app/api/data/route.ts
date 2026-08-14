import { handleApiRoute } from "@/lib/api-helpers";
import { getAllData } from "@/lib/family-board";

export const runtime = "nodejs";

/** 全量数据（与 Flask 版 GET /api/data 结构一致）。 */
export async function GET() {
  return handleApiRoute("data:get", async () => {
    return await getAllData();
  });
}
