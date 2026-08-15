import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { boardMoods } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/** 删除某一天的心情记录。 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ date: string }> }
) {
  return handleApiRoute("moods:delete", async () => {
    const { date } = await context.params;
    const deleted = await db
      .delete(boardMoods)
      .where(eq(boardMoods.date, date))
      .returning({ date: boardMoods.date });
    if (deleted.length === 0) {
      throw AppError.notFound("该日无心情记录");
    }
    return { deleted: date };
  });
}
