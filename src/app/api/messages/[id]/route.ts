import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { boardMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/** 删除一条留言。 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRoute("messages:delete", async () => {
    const { id } = await context.params;
    const deleted = await db
      .delete(boardMessages)
      .where(eq(boardMessages.id, id))
      .returning({ id: boardMessages.id });
    if (deleted.length === 0) {
      throw AppError.notFound("留言不存在");
    }
    return { deleted: id };
  });
}
