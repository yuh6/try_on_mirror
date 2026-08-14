import { handleApiRoute } from "@/lib/api-helpers";
import { GREETING } from "@/lib/profile-collector";

export const runtime = "nodejs";

/** 开始语音收集会话：返回小棉的开场白（会话状态由客户端持有）。 */
export async function POST() {
  return handleApiRoute("voice:start", async () => {
    return { reply: GREETING };
  });
}
