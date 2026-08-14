/**
 * 通义千问客户端（DashScope 的 OpenAI 兼容接口）。
 *
 * 移植自 callinggrandma 的 src/llm.py（QwenClient）。
 * 环境变量：
 *   DASHSCOPE_API_KEY   必填
 *   DASHSCOPE_BASE_URL  可选，默认官方 compatible-mode 端点
 *   QWEN_MODEL          可选，默认 qwen-plus
 */
import OpenAI from "openai";
import { AppError } from "./errors";

const TEMPERATURE = 0.8;
const MAX_TOKENS = 1024;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

let cached: OpenAI | null = null;

function getClient(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw AppError.upstream(
      "未配置 DASHSCOPE_API_KEY，无法调用通义千问（请在 Vercel 项目环境变量中添加）"
    );
  }
  cached = new OpenAI({
    apiKey,
    baseURL:
      process.env.DASHSCOPE_BASE_URL ??
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });
  return cached;
}

export function isQwenConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}

/** 非流式对话：一次性返回完整回复。 */
export async function qwenChat(messages: ChatMessage[]): Promise<string> {
  const model = process.env.QWEN_MODEL ?? "qwen-plus";
  const response = await getClient().chat.completions.create({
    model,
    messages,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  });
  return response.choices[0]?.message?.content ?? "";
}
