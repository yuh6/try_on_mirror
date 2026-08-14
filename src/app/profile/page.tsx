import { Suspense } from "react";
import type { Metadata } from "next";
import { loadElderProfile } from "@/lib/family-board";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "小棉袄 · 老人档案",
};

export default async function ProfilePage() {
  // 打开即显示已保存的老人档案（张阿姨的演示数据已内置在种子数据里）
  const profile = await loadElderProfile();
  return (
    <Suspense>
      <ProfileClient initialProfile={profile} />
    </Suspense>
  );
}
