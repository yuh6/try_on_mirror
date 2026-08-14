// 测试千问 Realtime 端点是否支持浏览器式鉴权（无自定义请求头）
// Node 24 的原生 WebSocket 与浏览器行为一致：不能设置 Authorization 头
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf-8");
const key = env.match(/DASHSCOPE_API_KEY=(.+)/)?.[1]?.trim();
const base =
  "wss://token-plan.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen-audio-3.0-realtime-plus";

const variants = [
  ["无鉴权(预期失败)", base],
  ["URL查询参数 Authorization", `${base}&Authorization=${encodeURIComponent("Bearer " + key)}`],
  ["URL查询参数 apikey", `${base}&apikey=${key}`],
  ["子协议 bearer", { url: base, protocols: ["bearer", key] }],
  ["子协议 authorization", { url: base, protocols: ["authorization", key] }],
];

for (const [name, target] of variants) {
  const url = typeof target === "string" ? target : target.url;
  const protocols = typeof target === "string" ? undefined : target.protocols;
  await new Promise((resolve) => {
    let ws;
    const done = (result) => {
      console.log(`${name}: ${result}`);
      try { ws?.close(); } catch {}
      setTimeout(resolve, 500);
    };
    try {
      ws = new WebSocket(url, protocols);
    } catch (e) {
      return done("构造失败 " + e.message);
    }
    const timer = setTimeout(() => done("⏱ 超时(15s)"), 15000);
    ws.onopen = () => { clearTimeout(timer); done("✅✅✅ 握手成功！浏览器可直连"); };
    ws.onerror = () => {};
    ws.onclose = (ev) => { clearTimeout(timer); done(`❌ 被拒 (code=${ev.code})`); };
    ws.onmessage = (ev) => { clearTimeout(timer); done("✅✅✅ 连上并收到消息"); };
  });
}
console.log("测试完成");
