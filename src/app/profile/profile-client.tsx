"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ElderProfile, CollectedProfile } from "@/lib/elder-profile";
import { EMPTY_ELDER_PROFILE } from "@/lib/elder-profile";

/* ---------- Web Speech API 最小类型声明 ---------- */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface ChatBubble {
  role: "ai" | "user";
  text: string;
}

export function ProfileClient({
  initialProfile,
  showChat = false,
}: {
  initialProfile: ElderProfile;
  /** true = 重新填写模式（带AI对话引导）；false = 纯档案编辑 */
  showChat?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<ElderProfile>({
    ...EMPTY_ELDER_PROFILE,
    ...initialProfile,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /* ---------- 和小棉聊聊（真 AI 对话式填表） ---------- */
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ role: "user" | "assistant"; text: string }[]>([]);
  const collectedRef = useRef<CollectedProfile>({});

  // 开场白（仅重新填写模式）
  useEffect(() => {
    if (!showChat) return;
    let cancelled = false;
    fetch("/api/voice/start", { method: "POST" })
      .then((r) => r.json())
      .then((d: { reply?: string }) => {
        if (!cancelled && d.reply) {
          setBubbles([{ role: "ai", text: d.reply }]);
          historyRef.current.push({ role: "assistant", text: d.reply });
        }
      })
      .catch(() => {
        if (!cancelled)
          setBubbles([{ role: "ai", text: "您好，我是小棉袄。请问您是老人的什么人呀？" }]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 气泡变化时滚动到底部
  useEffect(() => {
    const el = chatAreaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles.length, thinking]);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || thinking || chatDone) return;

    setBubbles((b) => [...b, { role: "user", text }]);
    setChatInput("");
    historyRef.current.push({ role: "user", text });
    setThinking(true);

    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          history: historyRef.current.slice(0, -1),
          collected: collectedRef.current,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        profile?: CollectedProfile;
        complete?: boolean;
      };
      setThinking(false);
      const reply =
        data.reply ?? "网络出了点问题，咱们继续？";
      setBubbles((b) => [...b, { role: "ai", text: reply }]);
      historyRef.current.push({ role: "assistant", text: reply });
      if (data.profile) collectedRef.current = data.profile;

      if (data.complete) {
        // 收集完成 → 后端已自动保存档案 → 刷新页面显示新档案
        setChatDone(true);
        setTimeout(() => {
          window.location.href = "/profile?voice=1";
        }, 1800);
      }
    } catch {
      setThinking(false);
      setBubbles((b) => [...b, { role: "ai", text: "网络出了点问题，咱们继续？" }]);
    }
  }

  /* ---------- 麦克风（可选语音输入） ---------- */
  const [micActive, setMicActive] = useState(false);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const micActiveRef = useRef(false);

  function initSpeech(): boolean {
    if (typeof window === "undefined") return false;
    const SR = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!SR) return false;
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setChatInput(transcript);
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed") alert("请允许使用麦克风权限");
      stopMic();
    };
    rec.onend = () => {
      if (micActiveRef.current) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    speechRef.current = rec;
    return true;
  }

  function toggleMic() {
    if (micActive) stopMic();
    else startMic();
  }

  function startMic() {
    if (!speechRef.current && !initSpeech()) {
      alert("您的浏览器不支持语音识别，请用 Chrome 或 Edge（或直接打字）");
      return;
    }
    micActiveRef.current = true;
    setMicActive(true);
    setChatInput("");
    try {
      speechRef.current?.start();
    } catch {
      /* already started */
    }
  }

  function stopMic() {
    micActiveRef.current = false;
    setMicActive(false);
    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }
  }

  const inputDisabled = chatDone;

  // 保存徽章（?voice=1 来自语音填表完成跳转；保存成功后本地置位）
  const voiceSaved = searchParams.get("voice") === "1";
  const [justSaved, setJustSaved] = useState(false);

  function setField<K extends keyof ElderProfile>(key: K, value: ElderProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  /* ---------- 表单提交 ---------- */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "保存失败，请重试");
      }
      setJustSaved(true);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="font-zh min-h-screen" style={{ background: "#f5f5ee" }}>
      {/* 流动渐变背景 */}
      <div className="mesh-bg">
        <div className="mesh-blob"></div>
        <div className="mesh-blob"></div>
        <div className="mesh-blob"></div>
        <div className="mesh-blob"></div>
      </div>

      <div className="content-layer">
        {/* 导航 */}
        <nav
          className="flex items-center justify-between px-8 py-5 border-b border-[#e4e7da]/50"
          style={{ backdropFilter: "blur(12px)", background: "rgba(245,245,238,0.6)" }}
        >
          <Link href="/" className="font-serif-display text-[22px] text-[#2f3136] tracking-[-0.02em]">
            小棉袄
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/board" className="text-[15px] text-[#535557] hover:text-[#2f3136] transition-colors">
              看板
            </Link>
            <Link href="/reports" className="text-[15px] text-[#535557] hover:text-[#2f3136] transition-colors">
              汇报
            </Link>
          </div>
        </nav>

        {/* 页头 */}
        <div className="max-w-[760px] mx-auto px-6 pt-16 pb-10 text-center">
          <div className="text-[13px] text-[#535557] uppercase tracking-[0.08em] mb-3">
            老人档案
          </div>
          <h1 className="font-serif-display text-[42px] text-[#2f3136] leading-[1.1] tracking-[-0.02em] mb-4">
            让小棉更懂 <em className="italic text-[#535557]">Ta</em>
          </h1>
          <p className="text-[17px] text-[#535557] max-w-[440px] mx-auto leading-[1.5]">
            信息越完整，小棉的关怀就越贴心。
          </p>
        </div>

        <div className="max-w-[760px] mx-auto px-6 pb-20">
          {/* 保存徽章 */}
          {(justSaved || voiceSaved) && (
            <div className="saved-badge">
              {voiceSaved && !justSaved ? "✓ 语音录入完成，档案已保存" : "✓ 档案已保存"}
            </div>
          )}

          {/* AI 对话式填表（仅"重新填写档案"模式显示） */}
          {showChat && (
          <div
            className="rounded-[6px] p-6 mb-10"
            style={{
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(228,231,218,0.6)",
              boxShadow: "0 2px 20px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[20px]">🌸</span>
              <span className="text-[18px] text-[#2f3136] font-medium">和小棉聊聊老人</span>
            </div>

            {/* 对话区 */}
            <div
              ref={chatAreaRef}
              className="flex flex-col gap-3 mb-4 min-h-[120px] max-h-[320px] overflow-y-auto"
            >
              {bubbles.map((b, i) => (
                <div
                  key={i}
                  className={`flex ${b.role === "ai" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-[16px] ${
                      b.role === "ai" ? "rounded-tl-[4px]" : "rounded-tr-[4px]"
                    } px-4 py-2.5 text-[14px] leading-[1.5]`}
                    style={
                      b.role === "ai"
                        ? { background: "#e4e7da", color: "#2f3136" }
                        : { background: "#192830", color: "white" }
                    }
                  >
                    {b.role === "ai" ? `🌸 ${b.text}` : b.text}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div
                    className="rounded-[16px] rounded-tl-[4px] px-4 py-3 text-[14px]"
                    style={{ background: "#e4e7da", color: "#2f3136" }}
                  >
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#898989] typing-dot" />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[#898989] typing-dot"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[#898989] typing-dot"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 输入区 */}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                disabled={inputDisabled}
                className="field-input flex-1"
                style={{
                  background: "rgba(255,255,255,0.9)",
                  opacity: inputDisabled ? 0.4 : undefined,
                }}
                placeholder={micActive ? "正在聆听..." : ""}
              />
              <button
                type="button"
                onClick={toggleMic}
                className="w-[42px] h-[42px] rounded-[6px] flex items-center justify-center transition-all flex-shrink-0"
                style={{
                  background: micActive ? "#c0392b" : "rgba(255,255,255,0.9)",
                  border: micActive ? "1px solid #c0392b" : "1px solid #e4e7da",
                }}
                title="语音输入（可选）"
              >
                {micActive ? "■" : "🎤"}
              </button>
              <button
                type="button"
                onClick={sendChat}
                disabled={inputDisabled}
                className="bg-[#192830] text-white px-5 py-2.5 rounded-[6px] text-[14px] hover:opacity-85 transition-opacity whitespace-nowrap h-[42px] disabled:opacity-50"
              >
                发送
              </button>
            </div>
            <p className="text-[12px] text-[#898989] mt-2">
              {chatDone
                ? "✓ 聊完了，档案已自动保存，正在刷新…"
                : "回车发送 · 点🎤可语音说 · 小棉会一步步引导你，聊完自动填好下面的档案"}
            </p>
          </div>
          )}

          {/* 档案表单 */}
          <form onSubmit={onSubmit}>
            {/* 01 基本信息 */}
            <div className="mb-12">
              <div className="flex items-baseline gap-3 mb-6 pb-3 border-b border-[#e4e7da]">
                <span className="section-num">01</span>
                <span className="font-serif-display text-[22px] text-[#2f3136]">基本信息</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="field-label">姓名</label>
                  <input
                    type="text"
                    className="field-input"
                    value={profile.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">年龄</label>
                  <input
                    type="number"
                    className="field-input"
                    value={profile.age}
                    onChange={(e) => setField("age", e.target.value)}
                  />
                </div>
              </div>

              {/* 性别选择 */}
              <div className="mb-4">
                <label className="field-label">性别</label>
                <div className="gender-toggle">
                  {(["女", "男"] as const).map((g) => (
                    <label
                      key={g}
                      className={`gender-option ${profile.gender === g ? "selected" : ""}`}
                      onClick={() => setField("gender", g)}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={profile.gender === g}
                        onChange={() => setField("gender", g)}
                      />
                      <span>{g === "女" ? "👩 女" : "👨 男"}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="field-label">称呼</label>
                <div className="field-hint">小棉日常怎么称呼老人</div>
                <input
                  type="text"
                  className="field-input"
                  value={profile.title}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="field-label">所在城市</label>
                  <input
                    type="text"
                    className="field-input"
                    value={profile.living}
                    onChange={(e) => setField("living", e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">婚姻状况</label>
                  <input
                    type="text"
                    className="field-input"
                    value={profile.marriage}
                    onChange={(e) => setField("marriage", e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">居住情况</label>
                  <input
                    type="text"
                    className="field-input"
                    value={profile.living_status}
                    onChange={(e) => setField("living_status", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 02 健康档案 */}
            <div className="mb-12">
              <div className="flex items-baseline gap-3 mb-6 pb-3 border-b border-[#e4e7da]">
                <span className="section-num">02</span>
                <span className="font-serif-display text-[22px] text-[#2f3136]">健康档案</span>
              </div>

              {profile.health_items.map((item, i) => (
                <div key={i} className="health-row">
                  <input
                    type="text"
                    className="field-input"
                    placeholder="疾病/状况"
                    value={item.name}
                    onChange={(e) =>
                      setField(
                        "health_items",
                        profile.health_items.map((it, j) =>
                          j === i ? { ...it, name: e.target.value } : it
                        )
                      )
                    }
                  />
                  <input
                    type="text"
                    className="field-input"
                    placeholder="用药"
                    value={item.medicine}
                    onChange={(e) =>
                      setField(
                        "health_items",
                        profile.health_items.map((it, j) =>
                          j === i ? { ...it, medicine: e.target.value } : it
                        )
                      )
                    }
                  />
                  <input
                    type="text"
                    className="field-input"
                    placeholder="备注"
                    value={item.notes}
                    onChange={(e) =>
                      setField(
                        "health_items",
                        profile.health_items.map((it, j) =>
                          j === i ? { ...it, notes: e.target.value } : it
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() =>
                      setField(
                        "health_items",
                        profile.health_items.filter((_, j) => j !== i)
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="add-link"
                onClick={() =>
                  setField("health_items", [
                    ...profile.health_items,
                    { name: "", medicine: "", notes: "" },
                  ])
                }
              >
                + 添加健康项
              </button>
            </div>

            {/* 03 家人信息 */}
            <div className="mb-12">
              <div className="flex items-baseline gap-3 mb-6 pb-3 border-b border-[#e4e7da]">
                <span className="section-num">03</span>
                <span className="font-serif-display text-[22px] text-[#2f3136]">家人信息</span>
              </div>

              {profile.family.map((m, i) => {
                const setMember = (key: keyof typeof m, value: string) =>
                  setField(
                    "family",
                    profile.family.map((mm, j) =>
                      j === i ? { ...mm, [key]: value } : mm
                    )
                  );
                return (
                  <div key={i} className="family-card">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[15px] text-[#2f3136]">
                        {m.relation} {m.name}
                      </span>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() =>
                          setField("family", profile.family.filter((_, j) => j !== i))
                        }
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input type="text" className="field-input" placeholder="姓名" value={m.name} onChange={(e) => setMember("name", e.target.value)} />
                      <input type="text" className="field-input" placeholder="关系" value={m.relation} onChange={(e) => setMember("relation", e.target.value)} />
                      <input type="text" className="field-input" placeholder="电话" value={m.phone} onChange={(e) => setMember("phone", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                      <input type="text" className="field-input" placeholder="职业" value={m.job} onChange={(e) => setMember("job", e.target.value)} />
                      <input type="text" className="field-input" placeholder="所在地" value={m.location} onChange={(e) => setMember("location", e.target.value)} />
                      <input type="text" className="field-input" placeholder="备注" value={m.note} onChange={(e) => setMember("note", e.target.value)} />
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="add-link"
                onClick={() =>
                  setField("family", [
                    ...profile.family,
                    { name: "", relation: "", age: "", job: "", location: "", phone: "", note: "" },
                  ])
                }
              >
                + 添加家人
              </button>
            </div>

            {/* 04 日常与性格 */}
            <div className="mb-12">
              <div className="flex items-baseline gap-3 mb-6 pb-3 border-b border-[#e4e7da]">
                <span className="section-num">04</span>
                <span className="font-serif-display text-[22px] text-[#2f3136]">日常与性格</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="field-label">日常作息</label>
                  <input
                    type="text"
                    className="field-input"
                    value={profile.routine}
                    onChange={(e) => setField("routine", e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">兴趣爱好</label>
                  <input
                    type="text"
                    className="field-input"
                    value={profile.hobbies}
                    onChange={(e) => setField("hobbies", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">性格特点</label>
                <div className="field-hint">帮助小棉用合适的方式和老人交流</div>
                <input
                  type="text"
                  className="field-input"
                  value={profile.personality}
                  onChange={(e) => setField("personality", e.target.value)}
                />
              </div>
            </div>

            {/* 05 AI人设 */}
            <div className="mb-12">
              <div className="flex items-baseline gap-3 mb-6 pb-3 border-b border-[#e4e7da]">
                <span className="section-num">05</span>
                <span className="font-serif-display text-[22px] text-[#2f3136]">AI 人设</span>
              </div>

              <div className="mb-4">
                <label className="field-label">通话风格</label>
                <div className="field-hint">小棉和老人通话时的语气和方式</div>
                <input
                  type="text"
                  className="field-input"
                  value={profile.call_ai}
                  onChange={(e) => setField("call_ai", e.target.value)}
                />
              </div>

              <div>
                <label className="field-label">陪伴原则</label>
                <div className="field-hint">小棉遵循的关键约束（本项目核心）</div>
                <textarea
                  className="field-input"
                  rows={4}
                  style={{ minHeight: 90, resize: "vertical", lineHeight: 1.6 }}
                  value={profile.emotion_style}
                  onChange={(e) => setField("emotion_style", e.target.value)}
                />
              </div>
            </div>

            {/* 提交 */}
            <div className="text-center pt-8 border-t border-[#e4e7da]">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#192830] text-white px-8 py-3.5 rounded-[6px] text-[16px] hover:opacity-85 transition-opacity tracking-[0.01em] disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存档案"}
              </button>
              {saveError && (
                <div className="text-sm text-[#c0392b] mt-3">{saveError}</div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* 档案页专属样式 */}
      <style>{`
        .mesh-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
        .mesh-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.5;
          animation: meshFloat 20s ease-in-out infinite;
        }
        .mesh-blob:nth-child(1) { width: 500px; height: 500px; background: #FFD85F; top: -10%; left: -5%; animation-delay: 0s; }
        .mesh-blob:nth-child(2) { width: 450px; height: 450px; background: #b3c4cd; top: 30%; right: -10%; animation-delay: -5s; }
        .mesh-blob:nth-child(3) { width: 400px; height: 400px; background: #d7d7cb; bottom: -10%; left: 20%; animation-delay: -10s; }
        .mesh-blob:nth-child(4) { width: 350px; height: 350px; background: #CFB7FC; top: 50%; left: 40%; opacity: 0.3; animation-delay: -15s; }
        @keyframes meshFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -40px) scale(1.1); }
          50% { transform: translate(-40px, 60px) scale(0.95); }
          75% { transform: translate(30px, 30px) scale(1.05); }
        }
        .content-layer { position: relative; z-index: 1; }
        .font-serif-display {
          font-family: var(--font-playfair), 'Noto Serif SC', Georgia, serif;
          font-weight: 400;
        }
        .field-input {
          width: 100%;
          background: #fff;
          border: 1px solid #e4e7da;
          padding: 12px 16px;
          font-size: 16px;
          color: #2f3136;
          border-radius: 6px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus {
          outline: none;
          border-color: #192830;
          box-shadow: 0 0 0 3px rgba(25,40,48,0.06);
        }
        .field-input::placeholder { color: #aaa; }
        .field-label {
          display: block;
          font-size: 12px;
          color: #535557;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 500;
        }
        .field-hint { font-size: 13px; color: #424e52; margin-bottom: 6px; }
        .section-num {
          font-family: var(--font-playfair), Georgia, serif;
          font-size: 14px;
          color: #d7d7cb;
          font-style: italic;
        }
        .gender-toggle { display: flex; gap: 8px; }
        .gender-option {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border: 1px solid #e4e7da;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          background: #fff;
          font-size: 15px;
          color: #535557;
        }
        .gender-option:hover { border-color: #d7d7cb; }
        .gender-option input { display: none; }
        .gender-option.selected {
          background: #192830;
          color: #fff;
          border-color: #192830;
        }
        .health-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1.5fr auto;
          gap: 10px;
          margin-bottom: 10px;
          align-items: center;
        }
        .health-row .field-input { padding: 8px 12px; font-size: 14px; }
        @media (max-width: 600px) { .health-row { grid-template-columns: 1fr; } }
        .family-card {
          background: #fff;
          padding: 20px;
          border: 1px solid #e4e7da;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .add-link {
          background: none; border: none;
          color: #192830;
          font-size: 14px;
          cursor: pointer; padding: 8px 0;
          text-decoration: underline; text-underline-offset: 3px;
        }
        .delete-btn {
          background: none; border: none;
          color: #424e52; cursor: pointer;
          font-size: 16px; padding: 4px 8px;
        }
        .delete-btn:hover { color: #c0392b; }
        .saved-badge {
          background: #e4e7da;
          color: #2f3136;
          padding: 12px 20px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 20px;
          text-align: center;
        }
        @keyframes blink {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
        .typing-dot { animation: blink 1.4s infinite; }
      `}</style>
    </main>
  );
}
