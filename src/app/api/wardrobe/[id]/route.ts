import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helpers";
import { deleteWardrobeItem } from "@/lib/services/wardrobe.service";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRoute("wardrobe:delete", async () => {
    const { id } = await context.params;
    await deleteWardrobeItem(id);
    return { ok: true };
  });
}
