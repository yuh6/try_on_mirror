import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { addMessage } from "@/lib/family-board";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1, "留言内容不能为空").max(500, "留言最多 500 字"),
  from: z.string().trim().max(30).optional(),
});

/** 子女添加一条留言（替代 Flask 版 POST /add_message 表单）。 */
export async function POST(request: Request) {
  return handleApiRoute("messages:add", async () => {
    const json = await request.json().catch(() => null);
    const body = bodySchema.parse(json);
    const message = await addMessage(body.text, body.from || "子女");
    return { message };
  });
}
