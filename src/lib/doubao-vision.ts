// Ark（豆包）视觉聊天模型客户端 —— OpenAI 兼容协议。
// 与 seedream.ts 共用 ARK_API_KEY / ARK_API_BASE。
// 用于形象分析（多模态图像理解），非用于图像生成。

const ARK_API_KEY = process.env.ARK_API_KEY!;
const ARK_API_BASE =
  process.env.ARK_API_BASE || "https://ark.cn-beijing.volces.com/api/v3";

// 视觉模型可通过 env 覆盖（新模型上线时无须改代码）
const VISION_MODEL =
  process.env.ARK_VISION_MODEL || "doubao-seed-1-6-flash-250715";

export type VisionMessagePart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type VisionMessage = {
  role: "system" | "user";
  content: string | VisionMessagePart[];
};

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: { code?: string; message?: string };
}

/**
 * 调用豆包视觉聊天，返回文本内容（通常是 JSON 字符串，由调用方 parse）。
 * 上游 4xx / 5xx / 缺失内容 都抛 Error，由 service 层归类。
 */
export async function chatWithVision(params: {
  messages: VisionMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  responseFormatJson?: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: VISION_MODEL,
    messages: params.messages,
    temperature: params.temperature ?? 0.6,
    max_tokens: params.maxTokens ?? 512,
  };
  if (params.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${ARK_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  const data: ChatCompletionResponse = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    throw new Error(
      data.error?.message || `Ark vision 请求失败 (${res.status})`
    );
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Ark vision 未返回文本内容");
  }
  return content;
}
