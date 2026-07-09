import OpenAI from "openai";

// 智谱 GLM 客户端（兼容 OpenAI SDK）
// 如果没有 API Key，创建一个占位客户端（调用时会失败但不会在模块加载时崩溃）
export const glmClient = new OpenAI({
  apiKey: process.env.GLM_API_KEY || "not-configured",
  baseURL: "https://open.bigmodel.cn/api/paas/v4/",
});

export const isGlmConfigured = () => Boolean(process.env.GLM_API_KEY);
