import { Suspense } from "react";
import type { Metadata } from "next";
import { loadElderProfile } from "@/lib/family-board";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "小棉袄 · 老人档案",
};

export default async function ProfilePage() {
  // 档案页：直接显示已保存的老人档案，可编辑保存（无AI对话）
  const profile = await loadElderProfile();
  return (
    <Suspense>
      <ProfileClient initialProfile={profile} showChat={false} />
    </Suspense>
  );
}
