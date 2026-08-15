import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { qwenChat, isQwenConfigured } from "@/lib/qwen";
import { addReport, addMood } from "@/lib/family-board";

export const runtime = "nodejs";
export const maxDuration = 60;

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(3000),
});

const bodySchema = z.object({
  /** 通话对话记录（老人 user / 小棉 assistant） */
  history: z.array(turnSchema).min(2).max(120),
});

/**
 * 通话结束后生成汇报并写入看板：
 * 用千问把通话记录总结成 {summary, mood, details}，
 * 存为一条 board_reports + 一条当日心情。
 */
export async function POST(request: Request) {
  return handleApiRoute("call:report", async () => {
    if (!isQwenConfigured()) {
      throw AppError.upstream("未配置 DASHSCOPE_API_KEY，无法生成汇报");
    }
    const json = await request.json().catch(() => null);
    const body = bodySchema.parse(json ?? {});

    const transcript = body.history
      .map((t) => `${t.role === "user" ? "老人" : "小棉"}：${t.content}`)
      .join("\n");

    // 服务器的真实日期时间（东八区）——AI 不许猜日期
    const nowLabel = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

    const prompt = `你是一个 AI 陪伴电话系统的通话记录分析员。现在是${nowLabel}（北京时间）。下面是刚刚小棉袄（AI）给老人打的一通关怀电话的对话记录。请你站在"给子女看的汇报"角度，输出严格 JSON（不要加其他内容、不要加markdown包裹）：

{
  "summary": "一句话摘要，60字以内，开头带上今天的日期（今天的日期以我给你的时间为准，格式如'${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" }).format(new Date())} 通话：'），有异常用🚨开头",
  "mood": "老人情绪，从这些里选一个：开心/平静/低落/想念/担忧/紧急",
  "details": "详细汇报，300字以内：聊了什么、老人身体状况（药吃了没）、情绪变化、有没有需要子女注意的事"
}

对话记录：
${transcript}`;

    let resultText: string;
    try {
      resultText = (
        await qwenChat([
          { role: "system", content: "你是通话记录分析员，只返回JSON。" },
          { role: "user", content: prompt },
        ])
      ).trim();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw AppError.upstream("总结生成失败");
    }

    if (resultText.startsWith("```")) {
      resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    let parsed: { summary?: string; mood?: string; details?: string };
    try {
      parsed = JSON.parse(resultText);
    } catch {
      // 解析失败就存原文摘要，保证汇报不丢
      parsed = { summary: resultText.slice(0, 60), mood: "平静", details: resultText.slice(0, 300) };
    }

    const summary = parsed.summary?.slice(0, 100) || "通话完成";
    const mood = parsed.mood || "平静";
    const details = parsed.details || "";

    const report = await addReport(summary, mood, details);
    // 当日心情也更新（同一天只留最新一条）
    if (["开心", "平静", "低落", "想念", "担忧", "紧急"].includes(mood)) {
      await addMood(mood, summary.slice(0, 20));
    }

    return { saved: true, report };
  });
}
