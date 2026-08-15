"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfileClient } from "../profile-client";
import { EMPTY_ELDER_PROFILE } from "@/lib/elder-profile";

/**
 * 重新填写档案：
 * 0. 未登录 → 提示需要注册/登录（新账号内一切都是空白的）
 * 1. 已登录 → 警告框：新建档案会覆盖自己账号的原档案
 * 2. 确定 → AI 对话引导 + 空白表格（数据存进自己账号）
 * 3. 取消 → 回首页
 */
export default function ProfileNewPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "guest" | "user">("checking");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { loggedIn?: boolean }) =>
        setAuthState(d.loggedIn ? "user" : "guest")
      )
      .catch(() => setAuthState("guest"));
  }, []);

  if (authState === "checking") {
    return (
      <main
        className="font-zh min-h-screen flex items-center justify-center text-[#898989]"
        style={{ background: "#f5f5ee" }}
      >
        正在检查登录状态…
      </main>
    );
  }

  if (authState === "guest") {
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
          <div className="text-[36px] mb-3">🔐</div>
          <h1 className="text-[22px] text-[#2f3136] font-medium leading-snug mb-3">
            新建老人档案需要先注册账号
          </h1>
          <p className="text-[15px] text-[#535557] leading-[1.6] mb-8">
            注册登录后，你会得到一个全新的空白空间，
            <br />
            可以为你家老人（朱阿姨、李叔叔…）建立专属档案。
            <br />
            <span className="text-[13px] text-[#898989]">
              现在看到的张阿姨数据是演示模式，不会受影响。
            </span>
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="px-6 py-3 rounded-[6px] text-[15px] border border-[#192830] text-[#192830] bg-white hover:bg-[#e4e7da] transition-colors"
            >
              回首页
            </Link>
            <Link
              href="/login?next=/profile/new"
              className="px-6 py-3 rounded-[6px] text-[15px] bg-[#192830] text-white hover:opacity-85 transition-opacity"
            >
              去注册 / 登录
            </Link>
          </div>
        </div>
        <MeshStyle />
      </main>
    );
  }

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
          新建档案将覆盖你账号内的原档案
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

      <MeshStyle />
    </main>
  );
}

function MeshStyle() {
  return (
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
  );
}

