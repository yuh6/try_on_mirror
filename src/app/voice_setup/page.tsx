"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CollectedProfile } from "@/lib/elder-profile";

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

const PROGRESS_FIELDS: { key: keyof CollectedProfile; label: string }[] = [
  { key: "relation", label: "关系" },
  { key: "title", label: "称呼" },
  { key: "age", label: "年龄" },
  { key: "living", label: "城市" },
  { key: "health", label: "健康" },
  { key: "family", label: "家人" },
];

interface Bubble {
  role: "ai" | "user";
  text: string;
}

export default function VoiceSetupPage() {
  const router = useRouter();

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(false);
  const [collected, setCollected] = useState<CollectedProfile>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const recordingRef = useRef(false);
  const processingRef = useRef(false);
  const collectedRef = useRef<CollectedProfile>({});
  const historyRef = useRef<{ role: "user" | "assistant"; text: string }[]>([]);
  const ttsVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const scrollChat = useCallback(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const addBubble = useCallback(
    (role: "ai" | "user", text: string) => {
      setBubbles((b) => [...b, { role, text }]);
      requestAnimationFrame(scrollChat);
    },
    [scrollChat]
  );

  /* ---------- TTS 播报 ---------- */
  const loadVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    ttsVoiceRef.current =
      voices.find((v) => v.lang.startsWith("zh") && /female|女/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith("zh")) ||
      null;
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSynthesis.onvoiceschanged = loadVoice;
      loadVoice();
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [loadVoice]);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.95;
    if (ttsVoiceRef.current) u.voice = ttsVoiceRef.current;
    speechSynthesis.speak(u);
  }

  /* ---------- 开场白 ---------- */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/voice/start", { method: "POST" })
      .then((r) => r.json())
      .then((data: { reply?: string }) => {
        if (cancelled || !data.reply) return;
        addBubble("ai", data.reply);
        speak(data.reply);
      })
      .catch(() => {
        if (!cancelled) addBubble("ai", "您好，我是小棉袄。请问您是老人的什么人？");
      });
    return () => {
      cancelled = true;
    };
  }, [addBubble]);

  /* ---------- 发送给后端 ---------- */
  async function sendToBackend(text: string) {
    processingRef.current = true;
    setIsProcessing(true);
    addBubble("user", text);
    setTyping(true);

    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          history: historyRef.current,
          collected: collectedRef.current,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        profile?: CollectedProfile;
        complete?: boolean;
        error?: string;
      };
      setTyping(false);
      const reply = data.reply ?? "网络出了点问题，咱们继续？";
      addBubble("ai", reply);
      speak(reply);

      historyRef.current = [
        ...historyRef.current,
        { role: "user", text },
        { role: "assistant", text: reply },
      ];

      if (data.profile) {
        collectedRef.current = data.profile;
        setCollected(data.profile);
      }

      if (data.complete) {
        processingRef.current = false;
        setIsProcessing(false);
        setTimeout(() => {
          setComplete(true);
          setTimeout(() => router.push("/profile?voice=1"), 1500);
        }, 800);
        return;
      }
    } catch {
      setTyping(false);
      addBubble("ai", "网络出了点问题，咱们继续？");
    }
    processingRef.current = false;
    setIsProcessing(false);
  }

  /* ---------- 麦克风 ---------- */
  function initRecognition(): boolean {
    if (typeof window === "undefined") return false;
    const SR = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!SR) {
      setError("您的浏览器不支持语音识别，请用 Chrome 或 Edge。");
      return false;
    }

    const rec = new SR();
    rec.lang = "zh-CN";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let t = "";
      for (let i = 0; i < event.results.length; i++) {
        t += event.results[i][0].transcript;
      }
      transcriptRef.current = t;
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed") setError("请允许使用麦克风权限。");
      stopRecording();
    };
    rec.onend = () => {
      if (recordingRef.current) {
        recordingRef.current = false;
        setIsRecording(false);
        const text = transcriptRef.current.trim();
        if (text) sendToBackend(text);
      }
    };
    recognitionRef.current = rec;
    return true;
  }

  function toggleMic() {
    if (processingRef.current) return;
    if (!recordingRef.current) {
      startRecording();
    } else {
      stopRecording();
      const text = transcriptRef.current.trim();
      if (text) sendToBackend(text);
    }
  }

  function startRecording() {
    if (!recognitionRef.current && !initRecognition()) return;
    transcriptRef.current = "";
    recordingRef.current = true;
    setIsRecording(true);
    try {
      recognitionRef.current?.start();
    } catch {
      recordingRef.current = false;
      setIsRecording(false);
    }
  }

  function stopRecording() {
    recordingRef.current = false;
    setIsRecording(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="voice-page">
      <div className="nav">
        <div className="brand">小棉袄</div>
        <Link href="/profile">手动填写</Link>
        <Link href="/board">留言板</Link>
      </div>

      <div className="main">
        <div className="page-header">
          <div className="page-eyebrow">语音录入</div>
          <h1 className="page-title">和小棉聊几句</h1>
          <p className="page-desc">聊着天就把档案填好了，不用一个一个填框</p>
        </div>

        <div className="progress-section">
          <div className="progress-tags">
            {PROGRESS_FIELDS.map(({ key, label }) => {
              const value = collected[key];
              const done = Array.isArray(value)
                ? value.length > 0
                : Boolean(value);
              return (
                <span key={key} className={`tag ${done ? "done" : ""}`}>
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="chat-area" ref={chatRef}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              {b.text}
            </div>
          ))}
          {typing && (
            <div className="bubble ai">
              <div className="typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>

        <div className="mic-section">
          <button
            className={`mic-btn ${isRecording ? "recording" : ""}`}
            onClick={toggleMic}
            disabled={isProcessing}
          >
            {isRecording ? "■" : isProcessing ? "⋯" : "🎤"}
          </button>
          <div className="mic-label">
            {isRecording ? "正在听... 再点结束" : isProcessing ? "小棉正在想..." : "点击开始说话"}
          </div>
        </div>
      </div>

      {complete && (
        <div className="complete-overlay">
          <div className="complete-icon">✓</div>
          <div className="complete-text">信息收集完成</div>
          <div className="complete-sub">正在保存...</div>
        </div>
      )}

      <style>{`
        .voice-page {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #f5f5ee;
          color: #2f3136;
          font-size: 16px;
          line-height: 1.5;
          letter-spacing: -0.01em;
        }
        .nav {
          padding: 20px 32px;
          display: flex;
          align-items: center;
          gap: 32px;
          border-bottom: 1px solid #e4e7da;
        }
        .nav .brand {
          font-family: var(--font-playfair), Georgia, serif;
          font-size: 22px;
          color: #2f3136;
          letter-spacing: -0.02em;
          margin-right: auto;
        }
        .nav a {
          text-decoration: none;
          color: #535557;
          font-size: 15px;
        }
        .nav a:hover { color: #2f3136; }
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 24px;
          max-width: 580px;
          margin: 0 auto;
          width: 100%;
        }
        .page-header { text-align: center; margin-bottom: 32px; }
        .page-eyebrow {
          font-size: 13px;
          color: #535557;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }
        .page-title {
          font-family: var(--font-playfair), Georgia, serif;
          font-size: 36px;
          font-weight: 400;
          color: #2f3136;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin-bottom: 12px;
        }
        .page-desc {
          font-size: 15px;
          color: #535557;
          max-width: 400px;
          margin: 0 auto;
        }
        .progress-section { width: 100%; margin-bottom: 28px; }
        .progress-tags { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
        .tag {
          padding: 4px 14px;
          border-radius: 9999px;
          font-size: 13px;
          background: #e4e7da;
          color: #424e52;
          transition: all 0.3s;
        }
        .tag.done { background: #192830; color: #fff; }
        .tag.done::before { content: "✓ "; }
        .chat-area {
          flex: 1;
          width: 100%;
          overflow-y: auto;
          margin-bottom: 24px;
          min-height: 200px;
          max-height: 400px;
          display: flex;
          flex-direction: column;
        }
        .bubble {
          max-width: 85%;
          padding: 14px 20px;
          border-radius: 6px;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 14px;
          animation: fadeIn 0.3s ease;
        }
        .bubble.ai {
          background: #fff;
          border: 1px solid #e4e7da;
          align-self: flex-start;
        }
        .bubble.user {
          background: #192830;
          color: #fff;
          margin-left: auto;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .typing { display: inline-flex; gap: 5px; align-items: center; }
        .typing span {
          width: 7px; height: 7px;
          background: #535557;
          border-radius: 50%;
          animation: bounce 1.4s infinite;
        }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        .mic-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding-bottom: 16px;
        }
        .mic-btn {
          width: 72px; height: 72px;
          border-radius: 50%;
          border: 1px solid #192830;
          background: #fff;
          color: #192830;
          font-size: 28px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .mic-btn:hover { background: #e4e7da; }
        .mic-btn.recording {
          background: #c0392b;
          color: white;
          border-color: #c0392b;
          animation: pulse 1.5s infinite;
        }
        .mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(192,57,43,0.3); }
          70% { box-shadow: 0 0 0 16px rgba(192,57,43,0); }
          100% { box-shadow: 0 0 0 0 rgba(192,57,43,0); }
        }
        .mic-label { font-size: 14px; color: #535557; }
        .complete-overlay {
          position: fixed; inset: 0;
          background: #f5f5ee;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 999;
        }
        .complete-icon { font-size: 56px; margin-bottom: 20px; }
        .complete-text {
          font-family: var(--font-playfair), Georgia, serif;
          font-size: 28px;
          font-weight: 400;
          color: #2f3136;
          margin-bottom: 8px;
          letter-spacing: -0.01em;
        }
        .complete-sub { font-size: 15px; color: #535557; }
        .error-banner {
          background: #e4e7da;
          color: #2f3136;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 16px;
          text-align: center;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
