import { handleApiRoute } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 服务器时间（客户端时钟不可信时以此为准）。 */
export async function GET() {
  return handleApiRoute("time:get", async () => {
    const now = new Date();
    return {
      epochMs: now.getTime(),
      beijing: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now),
    };
  });
}
