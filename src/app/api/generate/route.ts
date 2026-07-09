import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { createGeneration } from "@/lib/services/generation.service";

export const runtime = "nodejs";

const GenerateBodySchema = z
  .object({
    personImage: z.string().min(1).startsWith("data:image/"),
    clothingImage: z.string().min(1).startsWith("data:image/").optional(),
    clothingId: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.clothingImage) || Boolean(v.clothingId), {
    message: "clothingImage 与 clothingId 至少提供一个",
    path: ["clothingImage"],
  });

export async function POST(request: NextRequest) {
  return handleApiRoute("generate", async () => {
    const json = await request.json().catch(() => {
      throw AppError.badRequest("请求体不是合法 JSON");
    });
    const body = GenerateBodySchema.parse(json);
    const result = await createGeneration(body);
    return result;
  });
}
