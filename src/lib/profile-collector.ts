/**
 * 语音收集老人档案（移植自 callinggrandma 的 src/profile_collector.py）。
 *
 * 差异：Flask 版把会话状态放在服务端内存单例里；serverless 环境
 * 下不可靠，这里改为无状态——客户端每次请求带上完整对话历史和
 * 已收集字段，服务端只做一次 LLM 调用并返回合并结果。
 */
import { qwenChat, type ChatMessage } from "./qwen";
import {
  EMPTY_ELDER_PROFILE,
  type ElderProfile,
  type CollectedProfile,
  type FamilyMember,
  type ChatTurn,
} from "./elder-profile";

export type { ElderProfile, CollectedProfile, FamilyMember, ChatTurn };
export { EMPTY_ELDER_PROFILE };

const SYSTEM_PROMPT = `你是小棉袄，一个陪伴独居老人的AI助手。现在你正在和老人的子女对话，通过聊天的方式收集老人的基本信息，以便你更好地陪伴老人。

【你的任务】
每次子女说完一句话，你要做两件事：
1. 从Ta说的话里提取已有的信息
2. 生成你下一句自然的提问（问还缺的信息）

【要收集的信息（按顺序）】
1. 子女和老人的关系（儿子/女儿/...）
2. 老人的称呼（怎么称呼Ta）
3. 年龄和性别（男/女）
4. 所在城市
5. 健康状况（有什么慢性病、吃什么药、身体有什么需要注意的）
6. 家人信息（家里还有谁、姓名、关系、电话、在哪工作）
7. 兴趣爱好（选填，如果子女说了就记，没说不用追问）
8. 性格特点（选填）

【对话规则】
- 一次只问一个或两个相关的问题，不要一次问太多
- 语气温暖、自然，像朋友聊天
- 如果子女一句话里包含了多个信息，你要都提取出来
- 称呼对方"您"
- 不要说"作为AI"之类的话

【返回格式（严格JSON，不要加其他内容）】
{
  "extracted": {
    "relation": "子女和老人的关系，没有就null",
    "title": "老人称呼，没有就null",
    "age": "年龄，没有就null",
    "gender": "性别（男/女），没有就null",
    "living": "城市，没有就null",
    "health": "健康状况描述，没有就null",
    "family": [{"name":"姓名","relation":"关系","phone":"电话","job":"职业","location":"所在地"}, ...]，没有就null",
    "hobbies": "兴趣爱好，没有就null",
    "personality": "性格特点，没有就null"
  },
  "reply": "你下一句要说的话（自然的提问）",
  "complete": false
}

当所有必填信息（关系/称呼/年龄/城市/健康/家人）都收集齐了，把 complete 设为 true，
reply 改成总结确认的话（"我都记下来了，谢谢您！"之类）。

注意：family 可以是空数组 []（表示没有其他家人信息），但只有当子女明确说"就这些"或话题已经过去才算收集完。`;

export const GREETING =
  "您好，我是小棉袄。为了让我更好地陪伴老人，我需要了解一下Ta的基本情况。咱们聊几句就行，很简单的。请问您是老人的什么人呀？";

export interface VoiceChatResult {
  reply: string;
  profile: CollectedProfile;
  complete: boolean;
  error?: string;
}

/**
 * 处理子女的一句话。
 * @param history 之前的对话（不含本轮 user_text）
 * @param collected 之前已收集的字段
 * @param userText 本轮子女说的话
 */
export async function processVoiceReply(
  history: ChatTurn[],
  collected: CollectedProfile,
  userText: string
): Promise<VoiceChatResult> {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.text });
  }
  messages.push({ role: "user", content: userText });

  let resultText: string;
  try {
    resultText = await qwenChat(messages);
  } catch (e) {
    return {
      reply: "抱歉，我没听清，能再说一遍吗？",
      profile: collected,
      complete: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 解析JSON（AI可能加了```json包裹）
  let cleaned = resultText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```json/g, "").replace(/```/g, "").trim();
  }

  let data: {
    extracted?: Record<string, unknown>;
    reply?: string;
    complete?: boolean;
  };
  try {
    data = JSON.parse(cleaned);
  } catch {
    // JSON解析失败，把整段当reply
    data = { extracted: {}, reply: cleaned, complete: false };
  }

  // 合并提取的信息
  const merged: CollectedProfile = { ...collected };
  const extracted = data.extracted ?? {};
  for (const [key, value] of Object.entries(extracted)) {
    if (value !== null && value !== "") {
      if (key === "family" && Array.isArray(value)) {
        if (value.length > 0) merged.family = value as FamilyMember[];
      } else if (typeof value === "string") {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }

  return {
    reply: data.reply ?? "嗯嗯，您继续说。",
    profile: merged,
    complete: Boolean(data.complete),
  };
}

/** 把语音收集到的信息转成 elder_profile 档案格式。 */
export function collectedToProfile(c: CollectedProfile): ElderProfile {
  const profile: ElderProfile = {
    ...EMPTY_ELDER_PROFILE,
    name: c.title ?? "",
    age: c.age != null ? String(c.age) : "",
    gender: c.gender ?? "",
    title: c.title ?? "",
    living: c.living ?? "",
    hobbies: c.hobbies ?? "",
    personality: c.personality ?? "",
  };

  if (c.health) {
    profile.health_items = [{ name: c.health, medicine: "", notes: "" }];
  }

  if (c.family && c.family.length > 0) {
    profile.family = c.family.map((f) => ({
      name: f.name ?? "",
      relation: f.relation ?? "",
      age: "",
      job: f.job ?? "",
      location: f.location ?? "",
      phone: f.phone ?? "",
      note: "",
    }));
  }

  if (c.relation) {
    profile.living_status = `子女（${c.relation}）填写`;
  }

  return profile;
}
