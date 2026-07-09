import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { analyzeAppearance } from "@/lib/services/analysis.service";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  personImage: z.string().min(1).startsWith("data:image/"),
});

export async function POST(request: NextRequest) {
  return handleApiRoute("analysis:create", async () => {
    const json = await request.json().catch(() => {
      throw AppError.badRequest("请求体不是合法 JSON");
    });
    const body = BodySchema.parse(json);
    return await analyzeAppearance({ personImage: body.personImage });
  });
}
