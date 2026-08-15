import { z } from "zod";
import { handleApiRoute } from "@/lib/api-helpers";
import { loadElderProfile, saveElderProfile } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** 当前登录人（或演示）的老人档案。 */
export async function GET() {
  return handleApiRoute("profile:get", async () => {
    const owner = await getCurrentOwnerId();
    return await loadElderProfile(owner);
  });
}

/** 保存老人档案（存到当前登录人的空间）。 */
export async function POST(request: Request) {
  return handleApiRoute("profile:save", async () => {
    const json = await request.json().catch(() => null);
    const profile = profileSchema.parse(json);
    const owner = await getCurrentOwnerId();
    await saveElderProfile(owner, profile);
    return { saved: true, name: profile.name };
  });
}
