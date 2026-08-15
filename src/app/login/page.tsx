"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "出错了，请重试");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "出错了，请重试");
      setBusy(false);
    }
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
        className="relative z-10 w-full max-w-[380px] mx-6 rounded-[6px] p-8"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(228,231,218,0.8)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div className="text-center mb-6">
          <div className="text-[28px] mb-1">🌸</div>
          <h1 className="text-[22px] text-[#2f3136] font-medium">
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="text-[13px] text-[#898989] mt-2 leading-[1.5]">
            {mode === "login"
              ? "登录后管理你家老人的专属档案"
              : "注册后可新建老人档案，数据独立保存"}
          </p>
        </div>

        {/* 登录/注册切换 */}
        <div className="flex rounded-[6px] overflow-hidden border border-[#e4e7da] mb-6">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`flex-1 py-2.5 text-[14px] transition-colors ${
                mode === m
                  ? "bg-[#192830] text-white"
                  : "bg-white text-[#535557] hover:bg-[#e4e7da]/50"
              }`}
            >
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="field-label">用户名</label>
            <input
              type="text"
              className="field-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="中英文/数字，至少2个字符"
              required
            />
          </div>
          <div>
            <label className="field-label">密码</label>
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位"
              required
            />
          </div>

          {error && <div className="text-[13px] text-[#c0392b]">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="bg-[#192830] text-white py-3 rounded-[6px] text-[15px] hover:opacity-85 transition-opacity disabled:opacity-50"
          >
            {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link href="/" className="text-[13px] text-[#898989] hover:text-[#2f3136]">
            ← 先逛逛演示模式（张阿姨）
          </Link>
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
        .field-input {
          width: 100%; background: #fff; border: 1px solid #e4e7da;
          padding: 12px 16px; font-size: 15px; color: #2f3136; border-radius: 6px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus { outline: none; border-color: #192830; box-shadow: 0 0 0 3px rgba(25,40,48,0.06); }
        .field-label {
          display: block; font-size: 12px; color: #535557; margin-bottom: 6px;
          letter-spacing: 0.06em; font-weight: 500;
        }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
