// 模拟浏览器：连接桥 → 接听 → 收开场白语音/文字 → 挂断
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:5100/ws");
let audioChunks = 0;
let audioBytes = 0;

ws.on("open", () => {
  console.log("✓ 已连接桥，发送 answer…");
  ws.send(JSON.stringify({ t: "answer" }));
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.t === "ready") console.log("✓✓ 桥已就绪（千问连上，开场白已触发）");
  else if (msg.t === "qwen_audio") {
    audioChunks++;
    audioBytes += (msg.a.length * 3) / 4;
  } else if (msg.t === "assistant_text") {
    console.log(`🌸 小棉说：${msg.text.slice(0, 80)}`);
  } else if (msg.t === "user_text") {
    console.log(`🎤 老人说：${msg.text.slice(0, 80)}`);
  } else if (msg.t === "speaking") {
    console.log(msg.on ? "🔊 小棉开始说话" : "🔇 小棉说完");
  } else if (msg.t === "error") {
    console.log("❌ 错误：", msg.message);
  }
});

ws.on("error", (e) => console.log("❌ 连接失败：", e.message));

// 15 秒后收尾挂断
setTimeout(() => {
  console.log(`\n=== 结果：收到 ${audioChunks} 个语音块，共 ${(audioBytes / 1024).toFixed(1)} KB 音频 ===`);
  ws.send(JSON.stringify({ t: "hangup" }));
  setTimeout(() => process.exit(0), 500);
}, 15000);
