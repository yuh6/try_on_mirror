import { Suspense } from "react";
import type { Metadata } from "next";
import { loadElderProfile } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "小棉袄 · 老人档案",
};

export default async function ProfilePage() {
  // 档案页：当前登录人的档案（未登录=张阿姨演示档案），可编辑保存
  const owner = await getCurrentOwnerId();
  const profile = await loadElderProfile(owner);
  return (
    <Suspense>
      <ProfileClient initialProfile={profile} showChat={false} />
    </Suspense>
  );
}
