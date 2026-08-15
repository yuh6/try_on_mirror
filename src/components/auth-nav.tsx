"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * 导航栏右侧的登录状态：
 * 未登录 → 「登录 / 注册」链接
 * 已登录 → 「你好，xxx」+ 退出按钮
 */
export function AuthNav({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<{ loggedIn: boolean; username: string | null } | null>(
    null
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d))
      .catch(() => setMe({ loggedIn: false, username: null }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMe({ loggedIn: false, username: null });
    router.refresh();
    router.push("/");
  }

  if (me === null) return null;

  if (!me.loggedIn) {
    return (
      <Link
        href="/login"
        className={`text-[15px] transition-colors ${
          dark ? "text-white/80 hover:text-white" : "text-[#535557] hover:text-[#2f3136]"
        }`}
      >
        登录 / 注册
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <span className={`text-[14px] ${dark ? "text-white/90" : "text-[#535557]"}`}>
        你好，{me.username}
      </span>
      <button
        type="button"
        onClick={logout}
        className={`text-[13px] transition-colors ${
          dark ? "text-white/60 hover:text-white" : "text-[#898989] hover:text-[#2f3136]"
        }`}
      >
        退出
      </button>
    </span>
  );
}
