import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import {
  createWardrobeItem,
  listWardrobe,
} from "@/lib/services/wardrobe.service";

export const runtime = "nodejs";

const CreateBodySchema = z.object({
  name: z.string().min(1).max(64),
  categoryId: z.string().min(1).max(64),
  fileBase64: z.string().min(1).startsWith("data:image/"),
  tagIds: z.array(z.string().min(1)).max(32).optional(),
});

export async function GET(request: NextRequest) {
  return handleApiRoute("wardrobe:list", async () => {
    const category = request.nextUrl.searchParams.get("category") ?? undefined;
    return await listWardrobe({ category });
  });
}

export async function POST(request: NextRequest) {
  return handleApiRoute("wardrobe:create", async () => {
    const json = await request.json().catch(() => {
      throw AppError.badRequest("请求体不是合法 JSON");
    });
    const body = CreateBodySchema.parse(json);
    const item = await createWardrobeItem(body);
    return { item };
  });
}
