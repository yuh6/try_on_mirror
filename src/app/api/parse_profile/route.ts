import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";
import { qwenChat } from "@/lib/qwen";
import { EMPTY_ELDER_PROFILE, type ElderProfile } from "@/lib/profile-collector";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(3, "请输入更多描述"),
});

const PARSE_PROMPT_PREFIX = `你是档案信息提取助手。用户会给你一段关于老人的自由描述，
请你从中提取结构化信息，严格返回以下JSON格式（不要加其他内容）：
{
  "name": "姓名",
  "age": "年龄",
  "gender": "性别（男/女，判断不了就空）",
  "title": "称呼（如张阿姨/李爷爷，没有就空）",
  "living": "所在城市",
  "marriage": "婚姻状况（没有就空）",
  "living_status": "居住情况（独居/和子女住等，没有就空）",
  "health_items": [{"name":"疾病或状况","medicine":"用药","notes":"备注"}],
  "family": [{"name":"姓名","relation":"关系","age":"","job":"职业","location":"所在地","phone":"电话","note":"备注"}],
  "routine": "日常作息（没有就空）",
  "hobbies": "兴趣爱好（没有就空）",
  "personality": "性格特点（没有就空）"
}

注意：
- 没有提到的字段填空字符串，health_items/family 没有就填空数组
- phone 要是纯数字，没有就空
- 只返回JSON，不要加\`\`\`json包裹

用户描述：
`;

/** 从自由文本提取结构化档案信息（移植 Flask 版 /api/parse_profile）。 */
export async function POST(request: Request) {
  return handleApiRoute("profile:parse", async () => {
    const json = await request.json().catch(() => null);
    const { text } = bodySchema.parse(json);

    let result: string;
    try {
      result = (
        await qwenChat([
          { role: "system", content: "你是档案信息提取助手。只返回JSON。" },
          { role: "user", content: PARSE_PROMPT_PREFIX + text },
        ])
      ).trim();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw AppError.upstream("解析失败，请换一种描述再试试");
    }

    if (result.startsWith("```")) {
      result = result.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result);
    } catch {
      throw AppError.upstream("解析失败，请换一种描述再试试");
    }

    const profile: ElderProfile = { ...EMPTY_ELDER_PROFILE, ...parsed };
    return profile;
  });
}
