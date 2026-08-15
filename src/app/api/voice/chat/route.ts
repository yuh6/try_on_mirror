import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { saveElderProfile } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";
import {
  processVoiceReply,
  collectedToProfile,
  type ChatTurn,
  type CollectedProfile,
} from "@/lib/profile-collector";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(4000),
});

const familyMemberSchema = z.object({
  name: z.string().optional(),
  relation: z.string().optional(),
  phone: z.string().optional(),
  job: z.string().optional(),
  location: z.string().optional(),
});

const collectedSchema = z.object({
  relation: z.string().optional(),
  title: z.string().optional(),
  age: z.string().optional(),
  gender: z.string().optional(),
  living: z.string().optional(),
  health: z.string().optional(),
  family: z.array(familyMemberSchema).optional(),
  hobbies: z.string().optional(),
  personality: z.string().optional(),
});

const bodySchema = z.object({
  text: z.string().trim().min(1, "内容不能为空").max(4000),
  history: z.array(chatTurnSchema).max(60).default([]),
  collected: collectedSchema.default({}),
});

/**
 * 语音对话一轮（替代 Flask 版 /api/voice_chat）。
 * 无状态：客户端带上完整对话历史 history 和已收集字段 collected。
 */
export async function POST(request: Request) {
  return handleApiRoute("voice:chat", async () => {
    const json = await request.json().catch(() => null);
    const body = bodySchema.parse(json);
    const history: ChatTurn[] = body.history;
    const collected = body.collected as CollectedProfile;
    const result = await processVoiceReply(history, collected, body.text);

    // 收集完成 → 自动存档（存到当前登录人的空间）
    if (result.complete) {
      const owner = await getCurrentOwnerId();
      await saveElderProfile(owner, collectedToProfile(result.profile));
    }

    return result;
  });
}
