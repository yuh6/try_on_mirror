"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** 留言表单：提交到 /api/messages 后刷新看板（替代 Flask 的表单 POST + 重定向）。 */
export function MessageForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, from: "子女" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "发送失败，请重试");
      }
      setText("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请重试");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="px-5 pb-3 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="写一句话，小棉会转告老人..."
          required
          maxLength={500}
          className="flex-1 pill px-4 py-2 text-sm text-[#303030] placeholder-[#898989] focus:outline-none focus:ring-1 focus:ring-[#303030]/30"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="pill-active rounded-full px-5 py-2 text-sm disabled:opacity-50"
        >
          {sending ? "发送中…" : "发送"}
        </button>
      </form>
      {error && (
        <div className="px-5 pb-3 text-xs text-[#c0392b]">{error}</div>
      )}
    </>
  );
}
