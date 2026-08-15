import { handleApiRoute } from "@/lib/api-helpers";
import { deleteMood } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** 删除某一天的心情记录（只能删自己的）。 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ date: string }> }
) {
  return handleApiRoute("moods:delete", async () => {
    const { date } = await context.params;
    const owner = await getCurrentOwnerId();
    const ok = await deleteMood(owner, date);
    if (!ok) throw AppError.notFound("该日无心情记录");
    return { deleted: date };
  });
}
