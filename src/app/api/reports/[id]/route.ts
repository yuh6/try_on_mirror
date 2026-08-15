import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { boardReports } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/** 删除一条汇报。 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRoute("reports:delete", async () => {
    const { id } = await context.params;
    const deleted = await db
      .delete(boardReports)
      .where(eq(boardReports.id, id))
      .returning({ id: boardReports.id });
    if (deleted.length === 0) {
      throw AppError.notFound("汇报不存在");
    }
    return { deleted: id };
  });
}
