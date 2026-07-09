import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helpers";
import { deleteGeneration } from "@/lib/services/generation.service";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRoute("generations:delete", async () => {
    const { id } = await context.params;
    await deleteGeneration(id);
    return { ok: true };
  });
}
