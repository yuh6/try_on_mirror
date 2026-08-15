import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { deleteMessage } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";

export const runtime = "nodejs";

/** 删除一条留言（只能删自己的）。 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRoute("messages:delete", async () => {
    const { id } = await context.params;
    const owner = await getCurrentOwnerId();
    const ok = await deleteMessage(owner, id);
    if (!ok) throw AppError.notFound("留言不存在");
    return { deleted: id };
  });
}
