"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileClient } from "../profile-client";
import { EMPTY_ELDER_PROFILE } from "@/lib/elder-profile";

/**
 * 重新填写档案：
 * 1. 先弹警告框——新建档案会清除原档案，只是修改请去「档案」页
 * 2. 确定 → 进入 AI 对话引导 + 空白表格
 * 3. 取消 → 回首页
 */
export default function ProfileNewPage() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return <ProfileClient initialProfile={{ ...EMPTY_ELDER_PROFILE }} showChat />;
  }

  return (
    <main
      className="font-zh min-h-screen flex items-center justify-center"
      style={{ background: "#f5f5ee" }}
    >
      <div className="mesh-bg">
        <div className="mesh-blob"></div>
        <div className="mesh-blob"></div>
        <div className="mesh-blob"></div>
        <div className="mesh-blob"></div>
      </div>

      <div
        className="relative z-10 max-w-[420px] mx-6 rounded-[6px] p-8 text-center"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(228,231,218,0.8)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div className="text-[36px] mb-3">⚠️</div>
        <h1 className="text-[22px] text-[#2f3136] font-medium leading-snug mb-3">
          新建档案将清除原有的老人档案
        </h1>
        <p className="text-[15px] text-[#535557] leading-[1.6] mb-8">
          如果只是想修改档案内容，请到「档案」页直接编辑保存。
          <br />
          确定要重新填写吗？
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-6 py-3 rounded-[6px] text-[15px] border border-[#192830] text-[#192830] bg-white hover:bg-[#e4e7da] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            className="px-6 py-3 rounded-[6px] text-[15px] bg-[#192830] text-white hover:opacity-85 transition-opacity"
          >
            确定，重新填写
          </button>
        </div>
      </div>

      <style>{`
        .mesh-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
        .mesh-blob {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.5;
          animation: meshFloat 20s ease-in-out infinite;
        }
        .mesh-blob:nth-child(1) { width: 500px; height: 500px; background: #FFD85F; top: -10%; left: -5%; }
        .mesh-blob:nth-child(2) { width: 450px; height: 450px; background: #b3c4cd; top: 30%; right: -10%; animation-delay: -5s; }
        .mesh-blob:nth-child(3) { width: 400px; height: 400px; background: #d7d7cb; bottom: -10%; left: 20%; animation-delay: -10s; }
        .mesh-blob:nth-child(4) { width: 350px; height: 350px; background: #CFB7FC; top: 50%; left: 40%; opacity: 0.3; animation-delay: -15s; }
        @keyframes meshFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -40px) scale(1.1); }
          50% { transform: translate(-40px, 60px) scale(0.95); }
          75% { transform: translate(30px, 30px) scale(1.05); }
        }
      `}</style>
    </main>
  );
}
