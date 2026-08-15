import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { qwenChat, isQwenConfigured } from "@/lib/qwen";
import { loadElderProfile } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";
import {
  buildCallPersona,
  FALLBACK_PROFILE,
  OPENING_TRIGGER,
  type CallTurn,
} from "@/lib/call-persona";

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

/* ---------- 实时上下文：时间 + 真实天气（wttr.in，免费无key） ---------- */

const weatherCache: { at: number; text: string } = { at: 0, text: "" };

async function getLiveContext(city: string): Promise<string> {
  const parts: string[] = [];

  // 北京时间
  const now = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  parts.push(`现在是${now}（北京时间）`);

  // 天气（10 分钟缓存，3 秒超时，失败就跳过——小棉会诚实说不知道）
  if (city && Date.now() - weatherCache.at > 600_000) {
    try {
      const res = await fetch(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`,
        { signal: AbortSignal.timeout(3000) }
      );
      const j = (await res.json()) as {
        current_condition?: Array<{
          temp_C?: string;
          FeelsLikeC?: string;
          weatherDesc?: Array<{ value: string }>;
          lang_zh?: Array<{ value: string }>;
        }>;
      };
      const c = j.current_condition?.[0];
      if (c) {
        const desc = c.lang_zh?.[0]?.value || c.weatherDesc?.[0]?.value || "";
        weatherCache.text = `${desc} ${c.temp_C}°C（体感${c.FeelsLikeC}°C）`;
        weatherCache.at = Date.now();
      }
    } catch {
      weatherCache.text = "";
      weatherCache.at = Date.now(); // 短时间内不重试
    }
  }
  if (city && weatherCache.text) {
    parts.push(`${city}当前天气：${weatherCache.text}`);
  }

  return parts.join("；");
}

/**
 * 通话对话：接收老人说的话（或开场请求），返回小棉的回复。
 * 无状态：客户端持有完整对话历史；人设基于数据库里的真实老人档案动态生成。
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

    // 档案：当前登录人的（未登录=张阿姨演示档案）
    const owner = await getCurrentOwnerId();
    const profile = await loadElderProfile(owner).catch(() => FALLBACK_PROFILE);
    const persona = buildCallPersona(profile.name ? profile : FALLBACK_PROFILE);

    const liveCtx = await getLiveContext(profile.living || "大连");

    const messages = [
      { role: "system" as const, content: persona + (liveCtx ? `\n\n【实时信息】${liveCtx}` : "") },
      ...body.history.map((t) => ({
        role: t.role as "user" | "assistant",
        content: t.content,
      })),
    ];

    // 开场白：电话刚接通，让小棉主动开口
    if (body.opening === true) {
      messages.push({ role: "user", content: OPENING_TRIGGER });
    }

    const reply = await qwenChat(messages);
    return { reply };
  });
}
