import { handleApiRoute } from "@/lib/api-helpers";
import { deleteReport } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** 删除一条汇报（只能删自己的）。 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRoute("reports:delete", async () => {
    const { id } = await context.params;
    const owner = await getCurrentOwnerId();
    const ok = await deleteReport(owner, id);
    if (!ok) throw AppError.notFound("汇报不存在");
    return { deleted: id };
  });
}
