import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { loadElderProfile, saveElderProfile } from "@/lib/family-board";

export const runtime = "nodejs";

const healthItemSchema = z.object({
  name: z.string().default(""),
  medicine: z.string().default(""),
  notes: z.string().default(""),
});

const familyMemberSchema = z.object({
  name: z.string().default(""),
  relation: z.string().default(""),
  age: z.string().default(""),
  job: z.string().default(""),
  location: z.string().default(""),
  phone: z.string().default(""),
  note: z.string().default(""),
});

const profileSchema = z.object({
  name: z.string().default(""),
  age: z.string().default(""),
  gender: z.string().default(""),
  title: z.string().default(""),
  living: z.string().default(""),
  marriage: z.string().default(""),
  spouse: z.string().default(""),
  living_status: z.string().default(""),
  health_items: z.array(healthItemSchema).default([]),
  family: z.array(familyMemberSchema).default([]),
  routine: z.string().default(""),
  activities: z.string().default(""),
  hobbies: z.string().default(""),
  contact_habit: z.string().default(""),
  personality: z.string().default(""),
  speech_habits: z.string().default(""),
  call_ai: z.string().default(""),
  emotion_style: z.string().default(""),
});

/** 老人档案 JSON（与 Flask 版 GET /api/elder_profile 一致）。 */
export async function GET() {
  return handleApiRoute("profile:get", async () => {
    return await loadElderProfile();
  });
}

/** 保存老人档案（替代 Flask 版 POST /save_profile 表单）。 */
export async function POST(request: Request) {
  return handleApiRoute("profile:save", async () => {
    const json = await request.json().catch(() => null);
    const profile = profileSchema.parse(json);
    await saveElderProfile(profile);
    return { saved: true, name: profile.name };
  });
}
