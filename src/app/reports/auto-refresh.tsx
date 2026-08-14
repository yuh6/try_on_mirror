"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 每 10 秒静默刷新（原 reports.html 的 location.reload() 改为
 * router.refresh()，只重新拉取服务端数据，不整页重载）。
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
