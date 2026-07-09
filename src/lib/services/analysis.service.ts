// 形象分析 service
// 依据 .claude/skills/xingxiang-analysis/SKILL.md 实现
// 输出严格双轨:
//   - structured: { skinTone, bodyType } —— 后台传递,用户不感知
//   - qualitative: { compliments[], suggestion } —— UI 展示
// 降级:上游失败/结构不合规时,结构化取默认,qualitative 走兜底话术库。

import { AppError } from "@/lib/errors";
import { chatWithVision } from "@/lib/doubao-vision";

// ---------- 类型 ----------

export type SkinTone = "warm" | "cool" | "neutral";
export type BodyType = "slim" | "medium" | "fuller";

export type AnalysisStructured = {
  skinTone: SkinTone;
  bodyType: BodyType;
};

export type AnalysisQualitative = {
  compliments: string[]; // 2-3 句,每句 ≤ 15 字
  suggestion: string; // 单句选衣建议 ≤ 40 字
};

export type AnalysisResult = {
  structured: AnalysisStructured;
  qualitative: AnalysisQualitative;
  /** true 表示走了兜底,前端可自行决定是否额外提示（当前不提示） */
  fallback: boolean;
};

// ---------- 常量 ----------

const ANALYSIS_TIMEOUT_MS = 12_000;

const SKIN_TONES: SkinTone[] = ["warm", "cool", "neutral"];
const BODY_TYPES: BodyType[] = ["slim", "medium", "fuller"];

const DEFAULT_STRUCTURED: AnalysisStructured = {
  skinTone: "neutral",
  bodyType: "medium",
};

// SKILL §5.2:模型失败时的兜底彩虹屁库(全部落在"夸人本身"安全区)
const FALLBACK_COMPLIMENTS: string[][] = [
  ["您很有气质", "整体形象很大方", "一看就有故事感"],
  ["您很上相", "气色特别好", "站姿很有气场"],
  ["整体状态很松弛", "自带清爽感", "很有辨识度"],
  ["形象干净利落", "气质在线", "眼神很有戏"],
  ["整个人很有精神", "很上镜", "自然感很好"],
];

const FALLBACK_SUGGESTIONS = [
  "今天想从哪种感觉开始试起？",
  "先挑一件你今天最想变成的样子",
  "跟着感觉走,先选一件试试",
];

// SKILL §3.3 提示词框架 —— 结构化 + 定性 同一次调用返回严格 JSON
const SYSTEM_PROMPT = `你是专业的造型顾问,正在为门店顾客做形象分析。
请严格按以下 JSON 结构返回,不允许输出 JSON 之外的任何内容:
{
  "skinTone": "warm" | "cool" | "neutral",
  "bodyType": "slim" | "medium" | "fuller",
  "compliments": ["...", "...", "..."],
  "suggestion": "..."
}

规则:
1. skinTone / bodyType 只允许上述枚举值,不能自造词。
2. compliments 必须 2-3 句,每句 ≤ 15 字,口语、真人感。
3. 只允许夸这些维度:气质、上相、大方、气色、气场、精神状态、故事感、松弛感。
4. 严禁提及:具体颜色是否适合、具体风格是否适合、具体版型是否适合、
   身材缺陷、面部特征评价、年龄/职业猜测、与他人比较、打分、明星像谁。
5. suggestion 一句,≤ 40 字,是"开场引导"而不是"结论建议",
   例如"今天想从哪种感觉开始试起?",不要写"你适合 XX"。
6. 全程中文,不要输出英文解释、不要输出 markdown、不要输出注释。`;

const USER_PROMPT_TEXT =
  "请分析这张照片里人物的形象,按 system 里的 JSON 结构返回。";

// ---------- 解析 ----------

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  if (typeof v !== "string") return null;
  const lower = v.toLowerCase().trim();
  return (allowed as readonly string[]).includes(lower) ? (lower as T) : null;
}

function parseModelJson(raw: string): Partial<{
  skinTone: unknown;
  bodyType: unknown;
  compliments: unknown;
  suggestion: unknown;
}> | null {
  // 有的模型会在 JSON 前后夹一段解释,先尝试直接 parse,失败再截取。
  const attempt = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let obj = attempt(raw);
  if (!obj) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      obj = attempt(raw.slice(start, end + 1));
    }
  }
  if (!obj || typeof obj !== "object") return null;
  return obj as Partial<{
    skinTone: unknown;
    bodyType: unknown;
    compliments: unknown;
    suggestion: unknown;
  }>;
}

function clampCompliment(s: string): string {
  // SKILL §2.2:单条 ≤ 15 字。超出截断而非报错——避免因单点长度阻断体验。
  return s.trim().slice(0, 15);
}

function pickFallback(): { compliments: string[]; suggestion: string } {
  const idx = Math.floor(Math.random() * FALLBACK_COMPLIMENTS.length);
  const sidx = Math.floor(Math.random() * FALLBACK_SUGGESTIONS.length);
  return {
    compliments: FALLBACK_COMPLIMENTS[idx],
    suggestion: FALLBACK_SUGGESTIONS[sidx],
  };
}

// ---------- 主入口 ----------

export type AnalyzeParams = {
  /** data:image/...;base64,... */
  personImage: string;
};

export async function analyzeAppearance(
  params: AnalyzeParams
): Promise<AnalysisResult> {
  if (!params.personImage || !params.personImage.startsWith("data:image/")) {
    throw AppError.badRequest("请上传合法的人像图片");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  let raw: string | undefined;
  let upstreamError: string | undefined;
  try {
    raw = await chatWithVision({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT_TEXT },
            { type: "image_url", image_url: { url: params.personImage } },
          ],
        },
      ],
      temperature: 0.6,
      maxTokens: 400,
      responseFormatJson: true,
      signal: controller.signal,
    });
  } catch (err) {
    const isAbort =
      (err as Error)?.name === "AbortError" || controller.signal.aborted;
    upstreamError = isAbort
      ? "分析超时"
      : err instanceof Error
        ? err.message
        : "分析失败";
    console.warn("[analysis] 上游失败,走兜底:", upstreamError);
  } finally {
    clearTimeout(timer);
  }

  // 上游整条失败 → 全兜底
  if (!raw) {
    const fb = pickFallback();
    return {
      structured: DEFAULT_STRUCTURED,
      qualitative: fb,
      fallback: true,
    };
  }

  // 解析
  const parsed = parseModelJson(raw);
  if (!parsed) {
    console.warn("[analysis] JSON 解析失败,走兜底. raw=", raw.slice(0, 200));
    const fb = pickFallback();
    return {
      structured: DEFAULT_STRUCTURED,
      qualitative: fb,
      fallback: true,
    };
  }

  const skinTone =
    pickEnum(parsed.skinTone, SKIN_TONES) ?? DEFAULT_STRUCTURED.skinTone;
  const bodyType =
    pickEnum(parsed.bodyType, BODY_TYPES) ?? DEFAULT_STRUCTURED.bodyType;

  let compliments: string[] = [];
  if (Array.isArray(parsed.compliments)) {
    compliments = parsed.compliments
      .map((c) => pickString(c))
      .filter((c): c is string => c !== null)
      .map(clampCompliment)
      .slice(0, 3);
  }
  const suggestion = pickString(parsed.suggestion);

  // 定性缺失关键字段 → 定性部分走兜底,结构化保留
  const qualitativeFallback = compliments.length < 2 || !suggestion;
  const qualitative: AnalysisQualitative = qualitativeFallback
    ? pickFallback()
    : { compliments, suggestion: suggestion!.slice(0, 40) };

  return {
    structured: { skinTone, bodyType },
    qualitative,
    fallback: qualitativeFallback,
  };
}
