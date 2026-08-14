"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ---------- Web Speech API 最小类型声明 ---------- */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((
        event: {
          resultIndex: number;
          results: ArrayLike<
            ArrayLike<{ transcript: string }> & { isFinal: boolean }
          >;
        }
      ) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface ChatBubble {
  role: "user" | "assistant";
  text: string;
}

type ScreenId = "locked" | "incoming" | "active";

/** 真人语音桥地址（本地 .env 或 Vercel 环境变量 NEXT_PUBLIC_VOICE_BRIDGE_URL） */
const BRIDGE_URL = process.env.NEXT_PUBLIC_VOICE_BRIDGE_URL || "";

/* ---------- PCM 工具：Int16 ⇄ base64 ---------- */
function int16ToBase64(i16: Int16Array): string {
  const bytes = new Uint8Array(i16.buffer);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

export default function PhonePage() {
  const router = useRouter();

  const [screen, setScreen] = useState<ScreenId>("locked");
  const [audioReady, setAudioReady] = useState(false);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [xiaomianSpeaking, setXiaomianSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [callClock, setCallClock] = useState("08:03");
  const [realtimeMode, setRealtimeMode] = useState(false); // 真人语音模式（走桥）

  /* ---------- 对话历史（发给服务端） ---------- */
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  /* ---------- 音频：铃声 + TTS ---------- */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const playTone = useCallback((freq: number, duration: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }, []);

  const startRingtone = useCallback(() => {
    if (ringRef.current) return;
    ringRef.current = setInterval(() => {
      playTone(440, 0.4);
      setTimeout(() => playTone(550, 0.4), 200);
    }, 1000);
  }, [playTone]);

  const stopRingtone = useCallback(() => {
    if (ringRef.current) {
      clearInterval(ringRef.current);
      ringRef.current = null;
    }
  }, []);

  function initAudio() {
    audioCtxRef.current = new AudioContext();
    // 载入中文女声（TTS 用）
    if ("speechSynthesis" in window) {
      const voices = speechSynthesis.getVoices();
      ttsVoiceRef.current =
        voices.find((v) => v.lang.startsWith("zh") && /female|女/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith("zh")) ||
        null;
    }
    setAudioReady(true);
    // 1.2 秒后来电
    setTimeout(() => {
      setScreen("incoming");
      startRingtone();
    }, 1200);
  }

  /* ---------- 小棉说话（TTS） ---------- */
  const speakingRef = useRef(false);
  const speakDoneRef = useRef<(() => void) | null>(null);

  function speak(text: string, onDone?: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone?.();
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.95;
    if (ttsVoiceRef.current) u.voice = ttsVoiceRef.current;
    speakingRef.current = true;
    setXiaomianSpeaking(true);
    speakDoneRef.current = onDone ?? null;
    u.onend = () => {
      speakingRef.current = false;
      setXiaomianSpeaking(false);
      const cb = speakDoneRef.current;
      speakDoneRef.current = null;
      cb?.();
    };
    u.onerror = () => {
      speakingRef.current = false;
      setXiaomianSpeaking(false);
      const cb = speakDoneRef.current;
      speakDoneRef.current = null;
      cb?.();
    };
    speechSynthesis.speak(u);
  }

  /* ---------- 语音识别（听张阿姨说话） ---------- */
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const listenActiveRef = useRef(false); // 通话中且没在小棉说话 → 应该在听
  const wantListenRef = useRef(false);

  function initRecognition(): boolean {
    if (typeof window === "undefined") return false;
    const SR = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!SR) return false;

    const rec = new SR();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = false; // 只要最终结果，说完一句发一句
    rec.onresult = (event) => {
      // 收集本轮新增的 final 结果
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) text += r[0].transcript;
      }
      const trimmed = text.trim();
      if (trimmed && !speakingRef.current) {
        sendToXiaomian(trimmed);
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("请允许使用麦克风权限（浏览器地址栏的麦克风图标）");
      } else if (event.error === "no-speech") {
        /* 正常：没听到话，忽略 */
      }
    };
    rec.onend = () => {
      // 通话进行中且不在小棉说话 → 自动重启保持聆听
      if (wantListenRef.current && !speakingRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    return true;
  }

  function startListening() {
    wantListenRef.current = true;
    if (!recRef.current && !initRecognition()) {
      setError("您的浏览器不支持语音识别，请用 Chrome 或 Edge");
      return;
    }
    try {
      recRef.current?.start();
      setListening(true);
    } catch {
      /* already running */
    }
  }

  function stopListening() {
    wantListenRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }

  /* ---------- 和小棉对话 ---------- */
  const inFlightRef = useRef(false);

  async function sendToXiaomian(text: string, opening = false) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    stopListening(); // 小棉思考/说话时先不听
    if (!opening) {
      setBubbles((b) => [...b, { role: "user", text }]);
      historyRef.current.push({ role: "user", content: text });
    }
    setThinking(true);

    try {
      const res = await fetch("/api/call/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: historyRef.current,
          opening,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      const reply = data.reply;
      if (!reply) throw new Error(data.error ?? "小棉没听清，再试一次？");
      setThinking(false);
      setBubbles((b) => [...b, { role: "assistant", text: reply }]);
      historyRef.current.push({ role: "assistant", content: reply });
      // 小棉说完再继续听
      speak(reply, () => {
        if (wantListenRef.current || screenActiveRef.current) startListening();
      });
    } catch (err) {
      setThinking(false);
      const msg = err instanceof Error ? err.message : "网络出了点问题";
      setError(msg);
      if (screenActiveRef.current) startListening();
    } finally {
      inFlightRef.current = false;
    }
  }

  const screenActiveRef = useRef(false);
  useEffect(() => {
    screenActiveRef.current = screen === "active";
  }, [screen]);

  /* ---------- 真人语音模式（桥 ⇄ 千问 Realtime） ---------- */
  const rtWsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcRef = useRef<ScriptProcessorNode | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playNextRef = useRef(0);
  const rtReadyRef = useRef(false);

  function rtCleanup() {
    try { micProcRef.current?.disconnect(); } catch {}
    micProcRef.current = null;
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    micStreamRef.current = null;
    try { micCtxRef.current?.close(); } catch {}
    micCtxRef.current = null;
    try { playCtxRef.current?.close(); } catch {}
    playCtxRef.current = null;
    try { rtWsRef.current?.close(); } catch {}
    rtWsRef.current = null;
    rtReadyRef.current = false;
    setListening(false);
    setXiaomianSpeaking(false);
    setRealtimeMode(false);
  }

  /** 播放小棉的语音块（24kHz mono int16 PCM base64） */
  function rtPlayChunk(b64: string) {
    let ctx = playCtxRef.current;
    if (!ctx) {
      ctx = new AudioContext({ sampleRate: 24000 });
      playCtxRef.current = ctx;
      playNextRef.current = 0;
    }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const i16 = new Int16Array(bytes.buffer);
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.connect(ctx.destination);
    const now = ctx.currentTime;
    if (playNextRef.current < now + 0.03) playNextRef.current = now + 0.03;
    node.start(playNextRef.current);
    playNextRef.current += buf.duration;
  }

  /** 浏览器麦克风 → 16kHz mono int16 → 发给桥 */
  async function rtStartMic(ws: WebSocket) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    micStreamRef.current = stream;
    const ctx = new AudioContext({ sampleRate: 16000 });
    micCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    micProcRef.current = proc;
    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        const s = Math.max(-1, Math.min(1, f32[i]));
        i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      try {
        ws.send(JSON.stringify({ t: "audio", a: int16ToBase64(i16) }));
      } catch {}
    };
    src.connect(proc);
    proc.connect(ctx.destination); // ScriptProcessor 需要接 destination 才回调
    setListening(true);
  }

  /** 尝试走真人语音模式；桥不可用时返回 false（降级标准模式） */
  function rtAnswer(): Promise<boolean> {
    if (!BRIDGE_URL || typeof window === "undefined") return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      let ws: WebSocket;
      try {
        ws = new WebSocket(BRIDGE_URL);
      } catch {
        done(false);
        return;
      }
      rtWsRef.current = ws;
      const timer = setTimeout(() => done(false), 8000); // 8 秒没就绪就降级

      ws.onopen = () => {
        ws.send(JSON.stringify({ t: "answer" }));
      };
      ws.onmessage = (ev) => {
        let msg: { t: string; text?: string; a?: string; on?: boolean; message?: string };
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg.t === "ready") {
          clearTimeout(timer);
          rtReadyRef.current = true;
          setRealtimeMode(true);
          rtStartMic(ws).catch((err) => {
            setError("麦克风权限失败：" + (err instanceof Error ? err.message : String(err)));
          });
          done(true);
        } else if (msg.t === "user_text" && msg.text) {
          setBubbles((b) => [...b, { role: "user", text: msg.text! }]);
        } else if (msg.t === "assistant_text" && msg.text) {
          setBubbles((b) => [...b, { role: "assistant", text: msg.text! }]);
        } else if (msg.t === "qwen_audio" && msg.a) {
          rtPlayChunk(msg.a);
        } else if (msg.t === "speaking") {
          setXiaomianSpeaking(Boolean(msg.on));
        } else if (msg.t === "error" && msg.message) {
          setError(msg.message);
        }
      };
      ws.onerror = () => {
        clearTimeout(timer);
        done(false);
      };
      ws.onclose = () => {
        // 通话中断开 → 清理；未就绪时视为降级
        if (!rtReadyRef.current) {
          clearTimeout(timer);
          done(false);
        } else {
          rtCleanup();
        }
      };
    });
  }

  /* ---------- 接听 / 挂断 ---------- */
  async function answer() {
    stopRingtone();
    setScreen("active");
    // 优先真人语音模式（桥）；失败降级标准模式（浏览器识别+TTS）
    const ok = await rtAnswer();
    if (!ok) {
      rtCleanup();
      startListening();
      sendToXiaomian("", true);
    }
  }

  function hangup() {
    stopRingtone();
    if (rtReadyRef.current) {
      try { rtWsRef.current?.send(JSON.stringify({ t: "hangup" })); } catch {}
      rtCleanup();
    } else {
      stopListening();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        speechSynthesis.cancel();
      }
      speakingRef.current = false;
      setXiaomianSpeaking(false);
    }
    setScreen("locked");
  }

  /* ---------- 通话计时（虚拟时间：15秒真实 = 1分钟虚拟，起点 8:03） ---------- */
  useEffect(() => {
    if (screen !== "active") {
      setCallClock("08:03");
      return;
    }
    const startedAt = Date.now();
    const startTotalMin = 8 * 60 + 3;
    const timer = setInterval(() => {
      const realSec = Math.floor((Date.now() - startedAt) / 1000);
      const total = startTotalMin + Math.floor(realSec / 15);
      setCallClock(
        `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  /* ---------- 字幕滚动 ---------- */
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles.length, thinking]);

  return (
    <main className="phone-page">
      <div className="stage">
        {/* ===== 手机 ===== */}
        <div className="phone">
          <div className="phone-inner">
            {/* 音频激活遮罩 */}
            {!audioReady && (
              <button className="audio-overlay" onClick={initAudio}>
                <div style={{ fontSize: 40 }}>🌸</div>
                <div className="audio-overlay-text">点击屏幕接通来电</div>
              </button>
            )}

            {/* 锁屏 */}
            <div className={`screen ${screen === "locked" ? "active" : ""}`}>
              <Aurora />
              <div className="status-bar" style={{ justifyContent: "center", gap: 6 }}>
                <span className="status-chip">语音 AI</span>
              </div>
              <div className="stage-content">
                <div className="lock-clock">08:03</div>
                <div className="lock-date">8月10日 星期一</div>
                <div style={{ marginTop: 48 }}>
                  <div className="lock-hint-text">
                    {screen === "locked" && bubbles.length > 0
                      ? "通话已结束"
                      : "等待 AI 来电…"}
                  </div>
                </div>
              </div>
            </div>

            {/* 来电 */}
            <div className={`screen ${screen === "incoming" ? "active" : ""}`}>
              <Aurora />
              <div className="status-bar">
                <span>08:03</span>
                <span className="status-chip">
                  <span className="status-dot"></span>语音 AI
                </span>
              </div>
              <div className="stage-content">
                <div className="eyebrow">来电</div>
                <div className="caller-name">小棉袄</div>
                <div className="call-state">正在呼叫…</div>
                <VoiceOrb dim />
              </div>
              <div className="call-actions">
                <button className="call-btn decline shake" onClick={hangup} aria-label="拒接">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48a.956.956 0 0 1-.71.29c-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                </button>
                <button className="call-btn answer" onClick={answer} aria-label="接听">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg>
                </button>
              </div>
            </div>

            {/* 通话中 */}
            <div className={`screen ${screen === "active" ? "active" : ""}`}>
              <Aurora />
              <div className="status-bar">
                <span>{callClock}</span>
                <span className="status-chip">
                  <span className="status-dot"></span>
                  {realtimeMode ? "真人语音" : "语音 AI"}
                </span>
              </div>
              <div className="stage-content">
                <div className="eyebrow">{realtimeMode ? "真人语音" : "语音 AI"}</div>
                <div className="caller-name">小棉袄</div>
                <div className="call-state">
                  {xiaomianSpeaking
                    ? "小棉正在说…"
                    : thinking
                      ? "小棉正在想…"
                      : listening
                        ? "正在听您说…"
                        : "通话中"}
                </div>
                <VoiceOrb active={listening || xiaomianSpeaking || thinking} />
                <div className="hint">
                  直接开口说话就行，说完停顿一下，小棉会回应您
                </div>
              </div>
              <div className="controls">
                <Control icon={<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />} icon2={<path d="M19 10v2a7 7 0 0 1-14 0v-2" />} label="静音" />
                <Control icon={<rect x="2" y="6" width="14" height="12" rx="2" />} icon2={<path d="m22 8-6 4 6 4V8Z" />} label="FaceTime" />
                <Control icon={<rect width="18" height="18" x="3" y="3" rx="2" />} icon2={<path d="M3 9h18" />} label="键盘" />
                <Control icon={<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" /></>} label="录音" />
                <Control icon={<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>} label="免提" />
              </div>
              <div className="call-actions">
                <button className="call-btn decline" onClick={hangup} aria-label="挂断">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48a.956.956 0 0 1-.71.29c-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                </button>
              </div>
            </div>

            {/* Home 条：点一下回到首页 */}
            <button
              className="home-bar"
              onClick={() => {
                hangup();
                router.push("/");
              }}
              aria-label="回到首页"
              title="回到首页"
            >
              <span className="home-bar-label">
                {screen === "locked" ? "回到首页" : "退出"}
              </span>
              <span className="home-bar-pill"></span>
            </button>
          </div>
        </div>

        {/* ===== 字幕面板 ===== */}
        <div className="chat-panel">
          <div className="chat-header">💬 实时对话</div>
          <div className="chat-messages" ref={chatRef}>
            {bubbles.length === 0 && !thinking && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", padding: 40, fontSize: 13 }}>
                接听后对话内容显示在这里
              </div>
            )}
            {bubbles.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div className="chat-speaker">{m.role === "user" ? "张阿姨" : "小棉"}</div>
                {m.text}
              </div>
            ))}
            {thinking && (
              <div className="chat-msg ai">
                <div className="typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>
          {error && (
            <div className="error-banner" onClick={() => setError("")}>
              {error}（点击关闭）
            </div>
          )}
          <div className="chat-footer">
            <button
              className="chat-link"
              onClick={() =>
                screen === "locked" ? router.push("/") : hangup()
              }
            >
              {screen === "locked" ? "← 返回首页" : "■ 结束通话"}
            </button>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              {realtimeMode
                ? "🌸 真人语音模式 · 千问 longanqian 音色"
                : "标准模式 · 建议用 Chrome/Edge · 需要麦克风权限"}
            </span>
          </div>
        </div>
      </div>

      {/* ===== 样式（phone.html 移植） ===== */}
      <style>{`
        * { box-sizing: border-box; }
        .phone-page {
          min-height: 100vh;
          background: #05070f;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stage { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; justify-content: center; padding: 24px; }
        .phone {
          position: relative;
          width: 380px; height: 800px;
          border-radius: 52px;
          background: #0E1430;
          overflow: hidden;
          box-shadow: 0 0 0 11px #1a1d28, 0 0 0 13px #2a2d3a, 0 40px 90px rgba(0,0,0,0.6);
          flex-shrink: 0;
        }
        .phone-inner { position: absolute; inset: 0; overflow: hidden; border-radius: 42px; }
        .screen {
          position: absolute; inset: 0;
          display: none;
          flex-direction: column;
          overflow: hidden;
          padding-top: 56px;
          padding-bottom: 34px;
        }
        .screen.active { display: flex; }
        .aurora-bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
        .aurora-css {
          position: absolute; inset: 0;
          background:
            radial-gradient(48% 38% at 54% 41%, rgba(58,107,255,.86), rgba(16,42,135,.62) 39%, transparent 72%),
            radial-gradient(60% 50% at 53% 2%, rgba(27,194,194,.74), rgba(14,20,48,.05) 58%, transparent 78%),
            radial-gradient(64% 38% at 8% 92%, rgba(255,122,60,.72), rgba(122,77,255,.24) 48%, transparent 76%),
            radial-gradient(70% 44% at 92% 88%, rgba(123,45,255,.44), transparent 68%);
          mix-blend-mode: screen;
          filter: blur(10px);
          transform: scale(1.08);
          animation: aurora-float 9s ease-in-out infinite alternate;
        }
        .call-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(4,8,25,.22), rgba(4,8,25,.1) 45%, rgba(4,8,25,.4));
        }
        .status-bar {
          position: relative; z-index: 2;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px; font-size: 12px; color: rgba(255,255,255,0.65);
        }
        .status-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 999px;
          background: rgba(255,255,255,.08);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,.14);
        }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #1BC2C2; box-shadow: 0 0 12px #1BC2C2; }
        .stage-content {
          position: relative; z-index: 2; flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 0 24px; text-align: center;
        }
        .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.3em; color: rgba(255,255,255,0.45); margin-bottom: 4px; }
        .caller-name {
          font-family: var(--font-playfair), "Space Grotesk", "Inter", "Noto Sans SC", sans-serif;
          font-size: 44px; line-height: 1.05;
          letter-spacing: -0.02em; color: #fff;
          text-shadow: 0 12px 48px rgba(0,0,0,0.35);
        }
        .call-state { margin-top: 8px; font-size: 14px; color: rgba(255,255,255,0.7); }
        .voice-orb { position: relative; width: 240px; height: 240px; margin-top: 20px; display: grid; place-items: center; }
        .orb-halo { position: absolute; border-radius: 50%; inset: 10%; background: radial-gradient(circle, rgba(27,194,194,.34), rgba(58,107,255,.18) 38%, transparent 68%); filter: blur(14px); animation: orb-pulse 2.8s ease-in-out infinite; }
        .voice-core {
          position: relative; width: 58%; aspect-ratio: 1; overflow: hidden;
          border-radius: 48% 52% 55% 45% / 46% 40% 60% 54%;
          background:
            radial-gradient(44% 25% at 54% 57%, rgba(0,0,0,.45), transparent 64%),
            radial-gradient(76% 64% at 50% 20%, rgba(27,194,194,.9), rgba(58,107,255,.78) 42%, rgba(14,20,48,.8) 72%),
            radial-gradient(90% 62% at 22% 100%, rgba(255,122,60,.75), transparent 68%);
          filter: blur(.2px) saturate(1.15);
          box-shadow: 0 0 80px rgba(27,194,194,.45), 0 42px 90px rgba(0,0,0,.36);
          animation: orb-morph 4.4s ease-in-out infinite alternate;
        }
        .voice-bars { position: absolute; inset: 31% 18%; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .voice-bars span { width: 5px; border-radius: 999px; background: rgba(255,255,255,0.85); animation: voice-bar 0.7s ease-in-out infinite; }
        .voice-bars span:nth-child(2) { animation-delay: 0.11s; }
        .voice-bars span:nth-child(3) { animation-delay: 0.22s; }
        .voice-bars span:nth-child(4) { animation-delay: 0.33s; }
        .voice-bars span:nth-child(5) { animation-delay: 0.44s; }
        .voice-orb.paused .voice-core, .voice-orb.paused .orb-halo { animation-play-state: paused; opacity: 0.5; }
        .hint { margin-top: 20px; min-height: 32px; font-size: 12px; color: rgba(255,255,255,0.45); }
        .controls { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 16px; padding: 0 12px; margin-bottom: 8px; }
        .control { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .control-circle {
          width: 52px; height: 52px; border-radius: 50%;
          display: grid; place-items: center; color: #fff;
          background: rgba(255,255,255,.08);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,.14);
        }
        .control-label { font-size: 10px; color: rgba(255,255,255,0.6); }
        .call-actions { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 64px; padding: 0 24px 16px; }
        .call-btn {
          width: 72px; height: 72px; border-radius: 50%;
          display: grid; place-items: center; color: #fff; border: none; cursor: pointer;
          box-shadow: 0 18px 46px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.22);
          backdrop-filter: blur(16px); transition: transform .12s;
        }
        .call-btn:hover { transform: scale(0.92); }
        .call-btn.answer { background: radial-gradient(circle at 35% 25%, #65F5A0, #2FDB78); }
        .call-btn.decline { background: radial-gradient(circle at 35% 25%, #FF858B, #FF4D56); }
        .call-btn svg { width: 28px; height: 28px; }
        .lock-clock { font-family: var(--font-playfair), "Space Grotesk", sans-serif; font-size: 80px; font-weight: 600; line-height: 1; color: #fff; text-shadow: 0 12px 48px rgba(0,0,0,0.4); }
        .lock-date { margin-top: 10px; font-size: 15px; color: rgba(255,255,255,0.7); }
        .lock-hint-text { margin-top: 14px; font-size: 14px; color: rgba(255,255,255,0.55); }
        .chat-panel { width: 320px; max-height: 800px; display: flex; flex-direction: column; gap: 8px; }
        .chat-header { font-family: var(--font-playfair), sans-serif; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.5); padding: 0 4px; }
        .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 4px; min-height: 400px; }
        .chat-msg { padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; max-width: 85%; white-space: pre-wrap; }
        .chat-msg.user { background: rgba(27,194,194,0.15); border: 1px solid rgba(27,194,194,0.25); color: rgba(255,255,255,0.9); align-self: flex-end; }
        .chat-msg.ai { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); align-self: flex-start; }
        .chat-speaker { font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 2px; }
        .chat-footer { display: flex; flex-direction: column; gap: 6px; padding: 0 4px; }
        .chat-link { background: none; border: none; cursor: pointer; text-align: left; color: rgba(255,255,255,0.6); font-size: 13px; padding: 0; }
        .chat-link:hover { color: #fff; }
        .error-banner {
          background: rgba(192,57,43,0.25); border: 1px solid rgba(255,77,86,0.4);
          color: #ffb3b8; padding: 10px 14px; border-radius: 8px; font-size: 13px; cursor: pointer;
        }
        .typing { display: inline-flex; gap: 5px; align-items: center; }
        .typing span {
          width: 7px; height: 7px;
          background: rgba(255,255,255,0.6);
          border-radius: 50%;
          animation: bounce 1.4s infinite;
        }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        .audio-overlay {
          position: absolute; inset: 0; z-index: 100;
          background: rgba(5,7,15,0.9);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          cursor: pointer; gap: 12px; border: none; color: #fff;
        }
        .audio-overlay-text { font-size: 16px; color: rgba(255,255,255,0.7); }
        .home-bar {
          position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
          z-index: 50; background: none; border: none; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          padding: 6px 28px;
        }
        .home-bar-pill {
          width: 120px; height: 5px; border-radius: 999px;
          background: rgba(255,255,255,0.9); box-shadow: 0 1px 6px rgba(0,0,0,0.35);
        }
        .home-bar-label { font-size: 11px; color: rgba(255,255,255,0.75); }
        @keyframes aurora-float { from { transform: scale(1.06) translateY(-1%); opacity: 0.82; } to { transform: scale(1.14) translateY(2%); opacity: 1; } }
        @keyframes orb-pulse { 0%,100% { transform: scale(0.92); opacity: 0.56; } 50% { transform: scale(1.12); opacity: 0.9; } }
        @keyframes orb-morph { from { border-radius: 48% 52% 55% 45% / 46% 40% 60% 54%; transform: scale(0.98); } to { border-radius: 42% 58% 44% 56% / 58% 42% 58% 42%; transform: scale(1.04) rotate(1deg); } }
        @keyframes voice-bar { 0%,100% { height: 18px; opacity: 0.55; } 50% { height: 48px; opacity: 1; } }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
        @keyframes shake { 0%,100% { transform: scale(1) rotate(0deg); } 25% { transform: scale(1.04) rotate(-4deg); } 75% { transform: scale(1.04) rotate(4deg); } }
        .shake { animation: shake 1.2s ease-in-out infinite; }
      `}</style>
    </main>
  );
}

function Aurora() {
  return (
    <div className="aurora-bg">
      <div className="aurora-css"></div>
      <div className="call-scrim"></div>
    </div>
  );
}

function VoiceOrb({ dim = false, active = true }: { dim?: boolean; active?: boolean }) {
  return (
    <div className={`voice-orb ${active ? "" : "paused"}`}>
      <div className="orb-halo"></div>
      <div className="voice-core">
        <div className="voice-bars">
          {dim
            ? [0, 1, 2, 3, 4].map((i) => (
                <span key={i} style={{ animationDuration: "1s", opacity: 0.6 }} />
              ))
            : [0, 1, 2, 3, 4].map((i) => <span key={i} />)}
        </div>
      </div>
    </div>
  );
}

function Control({
  icon,
  icon2,
  label,
}: {
  icon: React.ReactNode;
  icon2?: React.ReactNode;
  label: string;
}) {
  return (
    <div className="control">
      <div className="control-circle">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {icon}
          {icon2}
        </svg>
      </div>
      <span className="control-label">{label}</span>
    </div>
  );
}
