/**
 * 小棉袄 · 语音桥（真人语音模式）
 *
 * 作用：在浏览器和千问 Realtime 模型之间保持一条长连接，
 *       双向转发音频（浏览器 ⇄ 桥 ⇄ 千问）。
 *       API Key 只存在本进程，浏览器拿不到。
 *
 * 协议（移植自 callinggrandma/src/realtime_voice.py + web/web_server.py）：
 *   浏览器 → 桥（JSON）：
 *     {t:"answer"}            接听：连千问 + 开场白
 *     {t:"audio", a:<b64>}    麦克风音频块（16kHz mono int16 PCM）
 *     {t:"hangup"}            挂断
 *   桥 → 浏览器（JSON）：
 *     {t:"ready"}             千问已连上，开场白已触发
 *     {t:"user_text", text}   老人说的话（识别结果）
 *     {t:"assistant_text", text} 小棉的回复文字
 *     {t:"qwen_audio", a:<b64>} 小棉的语音块（24kHz mono int16 PCM）
 *     {t:"speaking", on}      小棉开始/结束说话
 *     {t:"error", message}    出错
 *
 * 运行：node server.js   （环境变量 PORT/DASHSCOPE_API_KEY/DASHSCOPE_BASE_URL/REALTIME_MODEL/REALTIME_VOICE）
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { WebSocketServer, WebSocket } = require("ws");
const { CALL_PERSONA, OPENING_TRIGGER } = require("./persona");

/* ---------- 配置 ---------- */

const PORT = Number(process.env.PORT || 5100);
const KEY = process.env.DASHSCOPE_API_KEY || loadKeyFromRootEnv();
const MODEL = process.env.REALTIME_MODEL || "qwen-audio-3.0-realtime-plus";
const VOICE = process.env.REALTIME_VOICE || "longanqian";
const WS_BASE = (
  process.env.DASHSCOPE_BASE_URL || "https://token-plan.cn-beijing.maas.aliyuncs.com"
).replace(/^http/, "ws").replace(/\/compatible-mode\/v1\/?$/, "");
const QWEN_URL = `${WS_BASE}/api-ws/v1/realtime?model=${MODEL}`;

function loadKeyFromRootEnv() {
  // 本地运行：读项目根目录 .env（Railway 上走真正的环境变量）
  try {
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
      const m = fs.readFileSync(envPath, "utf-8").match(/^DASHSCOPE_API_KEY=(.+)$/m);
      if (m) return m[1].trim();
    }
  } catch {
    /* ignore */
  }
  return "";
}

function log(...args) {
  console.log(`[${new Date().toLocaleTimeString("zh-CN")}]`, ...args);
}

/* ---------- HTTP 健康检查 ---------- */

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, model: MODEL, key: KEY ? "configured" : "missing" }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (browserWs) => {
  log("浏览器已连接，等待接听…");
  let qwenWs = null;
  let qwenSpeaking = false; // 小棉说话时丢弃浏览器音频（防回声误触发，与原版一致）
  let heartbeat = null;
  let userStash = ""; // 千问的 transcript 字段可能是空的，真实文字在 stash 里

  const send = (obj) => {
    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.send(JSON.stringify(obj));
    }
  };

  browserWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    /* ---- 接听：建立千问连接 ---- */
    if (msg.t === "answer") {
      if (qwenWs) return;
      if (!KEY) {
        send({ t: "error", message: "桥未配置 DASHSCOPE_API_KEY" });
        return;
      }
      log("接听，正在连接千问 Realtime…");
      try {
        qwenWs = new WebSocket(QWEN_URL, {
          headers: { Authorization: `Bearer ${KEY}` },
        });
      } catch (e) {
        send({ t: "error", message: "连接千问失败：" + e.message });
        return;
      }

      qwenWs.on("open", () => {
        log("千问已连接，发送 session 配置…");
        qwenWs.send(
          JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["audio", "text"],
              voice: VOICE,
              instructions: CALL_PERSONA,
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                silence_duration_ms: 800,
              },
              input_audio_format: "pcm",
              output_audio_format: "pcm",
            },
          })
        );

        // 触发开场白：注入一条文本消息 + response.create
        qwenWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: OPENING_TRIGGER }],
            },
          })
        );
        qwenWs.send(JSON.stringify({ type: "response.create" }));

        // 心跳保活（每 60 秒，防 180 秒超时断开）
        heartbeat = setInterval(() => {
          if (qwenWs && qwenWs.readyState === WebSocket.OPEN && !qwenSpeaking) {
            try {
              qwenWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
            } catch {
              /* ignore */
            }
          }
        }, 60000);

        send({ t: "ready" });
      });

      qwenWs.on("message", (data) => {
        let event;
        try {
          event = JSON.parse(data.toString());
        } catch {
          return;
        }
        const type = event.type || "";

        if (type === "conversation.item.input_audio_transcription.delta") {
          // 千问的坑：真实文字在 stash 字段
          if (event.stash) userStash = event.stash;
        } else if (type === "conversation.item.input_audio_transcription.completed") {
          const text = event.transcript || userStash;
          userStash = "";
          if (text) send({ t: "user_text", text });
        } else if (type === "response.audio_transcript.done") {
          if (event.transcript) send({ t: "assistant_text", text: event.transcript });
        } else if (type === "response.audio.delta") {
          if (!qwenSpeaking) {
            qwenSpeaking = true;
            send({ t: "speaking", on: true });
          }
          send({ t: "qwen_audio", a: event.delta });
        } else if (type === "response.done") {
          if (qwenSpeaking) {
            qwenSpeaking = false;
            send({ t: "speaking", on: false });
          }
        } else if (type === "error") {
          const message = event.error?.message || JSON.stringify(event).slice(0, 200);
          log("千问报错：", message);
          send({ t: "error", message });
        }
      });

      qwenWs.on("close", () => {
        log("千问连接关闭");
        if (heartbeat) clearInterval(heartbeat);
        send({ t: "speaking", on: false });
      });

      qwenWs.on("error", (err) => {
        log("千问连接错误：", err.message);
        send({ t: "error", message: "连接千问出错：" + err.message });
      });
      return;
    }

    /* ---- 浏览器麦克风音频 → 千问 ---- */
    if (msg.t === "audio") {
      if (!qwenWs || qwenWs.readyState !== WebSocket.OPEN) return;
      if (qwenSpeaking) return; // 小棉说话时不收（防回声，与原版一致）
      try {
        qwenWs.send(
          JSON.stringify({ type: "input_audio_buffer.append", audio: msg.a })
        );
      } catch {
        /* ignore */
      }
      return;
    }

    /* ---- 挂断 ---- */
    if (msg.t === "hangup") {
      log("用户挂断");
      if (heartbeat) clearInterval(heartbeat);
      if (qwenWs) {
        try {
          qwenWs.close();
        } catch {
          /* ignore */
        }
        qwenWs = null;
      }
    }
  });

  browserWs.on("close", () => {
    log("浏览器断开，清理会话");
    if (heartbeat) clearInterval(heartbeat);
    if (qwenWs) {
      try {
        qwenWs.close();
      } catch {
        /* ignore */
      }
    }
  });
});

server.listen(PORT, () => {
  log(`🌸 小棉袄语音桥已启动：ws://localhost:${PORT}/ws`);
  log(`   千问端点：${QWEN_URL}`);
  log(`   API Key：${KEY ? "已配置 ✓" : "❌ 未配置（DASHSCOPE_API_KEY）"}`);
});
