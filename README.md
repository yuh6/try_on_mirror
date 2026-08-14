# 小棉袄 · 子女端网站

给独居老人的 AI 陪伴产品「小棉袄」的子女端网站。
小棉袄主动给老人打电话——聊天、提醒吃药、留意心情、紧急时联系家人；子女在这里看到老人今天过得好不好。

线上地址：https://try-on-mirror.vercel.app/

## 页面

| 路由 | 功能 |
|---|---|
| `/` | 产品落地页 |
| `/board` | 家庭看板：老人状态、通话总结、待办、留言板、关怀日历 |
| `/reports` | AI 通话汇报（每 10 秒自动刷新） |
| `/profile` | 老人档案表单（支持 AI 引导填表） |
| `/voice_setup` | 语音填表：和小棉聊几句，聊着天就把档案填好 |

## 技术栈

- Next.js 16（App Router）+ React 19 + Tailwind CSS v4
- Turso（libsql）+ Drizzle ORM（本地缺省回退 `./data/app.db` 文件库）
- 通义千问（DashScope OpenAI 兼容接口）
- AOS 滚动动画、Web Speech API（语音识别/合成）

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DASHSCOPE_API_KEY` | 是 | 阿里云百炼 API Key（语音填表用） |
| `DASHSCOPE_BASE_URL` | 否 | 默认官方 compatible-mode 端点 |
| `QWEN_MODEL` | 否 | 默认 `qwen-plus` |
| `TURSO_DATABASE_URL` | 生产 | Turso 数据库地址（本地省略则用文件库） |
| `TURSO_AUTH_TOKEN` | 生产 | Turso 访问令牌 |

## 本地开发

```bash
npm install
cp .env.example .env   # 填入 DASHSCOPE_API_KEY
npm run db:migrate     # 建表 + 初始演示数据（张阿姨）
npm run dev            # http://localhost:3000
```

## 部署

push 到 `main` 分支 → Vercel 自动构建部署（构建时自动执行数据库迁移）。
Vercel 项目需配置 `DASHSCOPE_API_KEY`、`TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`。

## 来源

由 Python Flask 版 `callinggrandma/family_web.py`（端口 5001）迁移而来，
原仓库：https://github.com/yuh6/try_on_mirror
