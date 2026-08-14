import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { qwenChat, isQwenConfigured } from "@/lib/qwen";
import { CALL_PERSONA, type CallTurn } from "@/lib/call-persona";

export const runtime = "nodejs";
export const maxDuration = 60;

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const bodySchema = z.object({
  /** 对话历史（不含本轮） */
  history: z.array(turnSchema).max(60).default([]),
  /** true = 电话刚接通，让小棉说开场白 */
  opening: z.boolean().optional(),
});

/**
 * 通话对话：接收张阿姨说的话（或开场请求），返回小棉的回复。
 * 无状态：客户端持有完整对话历史。
 */
export async function POST(request: Request) {
  return handleApiRoute("call:chat", async () => {
    if (!isQwenConfigured()) {
      throw AppError.upstream(
        "通话服务未配置 DASHSCOPE_API_KEY（Vercel 环境变量）"
      );
    }
    const json = await request.json().catch(() => null);
    const body = bodySchema.parse(json ?? {});

    const messages = [
      { role: "system" as const, content: CALL_PERSONA },
      ...body.history.map((t) => ({
        role: t.role as "user" | "assistant",
        content: t.content,
      })),
    ];

    // 开场白：电话刚接通，让小棉主动开口
    if (body.opening === true) {
      messages.push({
        role: "user",
        content: "（电话刚接通，张阿姨拿起了电话。请你直接说出开场白。）",
      });
    }

    const reply = await qwenChat(messages);
    return { reply };
  });
}
