<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 小棉袄 · 子女端网站

给独居老人的 AI 陪伴产品「小棉袄」的子女端网站（从 Python Flask 版 callinggrandma 迁移而来）。

## 结构

- `src/app/page.tsx` — 产品落地页
- `src/app/board/` — 家庭看板（服务端组件直查 DB + 留言表单）
- `src/app/reports/` — AI 通话汇报（10 秒轮询刷新）
- `src/app/profile/` — 老人档案表单（含纯前端模拟 AI 引导填表）
- `src/app/voice_setup/` — 语音填表（Web Speech API + 千问对话）
- `src/app/api/` — 路由处理器（messages / profile / parse_profile / voice / data / stats）
- `src/lib/qwen.ts` — 通义千问客户端（DashScope OpenAI 兼容接口）
- `src/lib/profile-collector.ts` — 语音档案收集（无状态，客户端持有会话）
- `src/lib/family-board.ts` — 留言板数据层
- `src/lib/elder-profile.ts` — 纯类型与常量（客户端可安全引入）
- `src/db/` — Drizzle schema + migrations（Turso/libsql）

## 约定

- API 路由沿用 `handleApiRoute(scope, fn)` + Zod 校验 + `AppError` 模式
- 线上旧「换装魔镜」表仍留在 schema.ts 尾部（防止 drizzle-kit 生成 DROP 语句），勿使用
- 语音会话状态由客户端持有（serverless 无内存单例），API 保持无状态
