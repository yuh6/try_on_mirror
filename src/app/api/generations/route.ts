import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { listGenerations } from "@/lib/services/generation.service";

export const runtime = "nodejs";

const QuerySchema = z.object({
  limit: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v > 0, "limit 必须为正整数")
    .optional(),
  cursor: z.string().min(1).optional(),
  status: z.enum(["success", "failed"]).optional(),
});

export async function GET(request: NextRequest) {
  return handleApiRoute("generations:list", async () => {
    const sp = request.nextUrl.searchParams;
    const parsed = QuerySchema.parse({
      limit: sp.get("limit") ?? undefined,
      cursor: sp.get("cursor") ?? undefined,
      status: sp.get("status") ?? undefined,
    });
    return await listGenerations(parsed);
  });
}
