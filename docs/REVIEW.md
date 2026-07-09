# MirrorMag / AI·衣境 —— 最后一轮代码审查报告

> 审查人: reviewer agent
> 审查依据: `.claude/skills/ai-yijing-meta/SKILL.md`（产品身份校准） + `docs/DESIGN.md`（技术契约）
> 审查范围: backend / frontend / qa 三位前置 agent 的产出
> 审查基准: 只读不改；每处 finding 标注严重级别与具体修法

---

## 严重级别说明

- **[BLOCKER]** 上线前必修 — skill 身份校准违规 / 安全漏洞 / 契约不一致 / 数据正确性 bug
- **[MAJOR]** 强烈建议修 — 正确性 bug / 可维护性硬伤
- **[MINOR]** 建议修 — 代码质量 / 可读性
- **[NIT]** 可选风格

---

## 组 A · 产品身份校准违规（SKILL §一 强制）

> SKILL 明确产品**不是**「AI 试衣镜 / 虚拟换衣工具 / 换衣效果」。所有下列文案、类名、注释、变量名、alt 文本、下载文件名、meta 标签都必须按 §一 规则表修正。
>
> 本组是当前项目**最严重**的问题——通篇代码把产品定位成了 SKILL 明确否决的「AI 试衣镜/换装魔镜」，与「专属门店审美的 AI 造型顾问」几乎正相反。

### [BLOCKER] `src/app/layout.tsx:12-13` — 站点标题与 meta 描述整段用「换装魔镜」「一键生成试穿大片」
- 证据：
  ```ts
  title: "换装魔镜 MirrorMag",
  description: "上传全身照与衣服图，AI 一键生成试穿大片",
  ```
- 建议：改为「AI·衣境 · 门店造型顾问」+「上传全身照，为你呈现门店专属的搭配造型」。删除「MirrorMag / 换装魔镜」品牌名（这是被 skill §一 明令否决的定位）。

### [BLOCKER] `src/app/page.tsx:148` — 主页顶部品牌 chip 直接标注「MirrorMag · 换装魔镜」
- 证据：`MirrorMag · 换装魔镜`（在 `<Camera />` icon 旁的胶囊里）
- 建议：删除，替换为「AI·衣境 · 造型顾问」或门店 DNA 相关短语。

### [BLOCKER] `src/app/page.tsx:151-155` — 主标题「换一件，换个自己」纯效率工具口吻
- 证据：
  ```tsx
  <h1>换一件<span>，换个自己</span></h1>
  ```
- 建议：改为「看到最美的自己」或「为你呈现门店的专属造型」——回归 SKILL §二.差异化二「提气算法」的核心话术，而不是效率工具口号。

### [BLOCKER] `src/app/page.tsx:157` — 副文案「AI 生成试穿大片」踩两个 skill 禁词
- 证据：`上传一张全身照 · 挑一件衣服 · AI 生成试穿大片`
- 建议：改为「上传全身照 · 选择心仪单品 · 呈现属于你的造型」。「试穿」→「造型呈现」，「大片」保留可作视觉气氛词。

### [BLOCKER] `src/app/page.tsx:261` — 生成中按钮文案「AI 冲印中…」
- 证据：`AI 冲印中…`
- 建议：改为「造型呈现中…」或「AI 造型师工作中…」。「冲印」把产品拉回相册工具定位。

### [BLOCKER] `src/app/page.tsx:266` — 主 CTA 按钮「生成试穿大片」
- 证据：`<Sparkles /> 生成试穿大片`
- 建议：改为「呈现造型」或「让我看看效果」。skill §一 明确「试穿」→「造型呈现」。

### [BLOCKER] `src/app/history/page.tsx:36-40` — 历史页标题「试穿档案」「所有生成过的试穿大片」
- 证据：
  ```tsx
  <h1>你的<span>试穿档案</span></h1>
  <p>所有生成过的试穿大片都在这里</p>
  ```
- 建议：「造型档案」/「你的历次造型都在这里」。「试穿」×2 需全部替换。

### [BLOCKER] `src/components/ResultCard.tsx:49` — 结果图 `alt="试穿效果"`
- 证据：`<img alt="试穿效果" ... />`
- 建议：`alt="AI 造型效果"` 或 `alt="造型呈现结果"`。这是 SKILL §一 规则表明确条目：「换衣效果」→「造型效果」。

### [BLOCKER] `src/components/ResultCard.tsx:22` — 默认下载文件名 `mirrormag-tryon.png`
- 证据：`downloadFilename = "mirrormag-tryon.png"`
- 建议：改为 `ai-yijing-style.png` 或 `styling-result.png`。`tryon` 是「试穿」的英文直译，同违规。

### [BLOCKER] `src/lib/services/generation.service.ts:90` — 服务函数 JSDoc「触发一次换衣生成」
- 证据：`* 触发一次换衣生成。`
- 建议：改为「触发一次造型生成」。「换衣」是 skill §一 明令禁词。

### [BLOCKER] `src/lib/services/generation.service.ts:10-11` — Prompt 常量把语义写成「穿上图2中的衣服」
- 证据：
  ```ts
  export const DEFAULT_PROMPT =
    "将图1中的人物穿上图2中的衣服，保持人物脸部和体型不变，全身照，专业时尚摄影，高清写真，自然光线，干净背景";
  ```
- 建议：Prompt 本身是给模型看的可以更自由，但应体现产品定位——建议改为「为图1中的人物呈现图2的服饰造型，保留脸部与体型特征；专业时尚大片风格，柔和光线，简洁背景，突显气质与整体造型」。同时预留 SKILL §二.差异化二「提气算法」的话术钩子（如「肤色通透、比例修长」）为未来接入留位。

### [BLOCKER] `src/app/globals.css:3` — CSS 顶部注释仍以 `MirrorMag Retro Film Palette` 品牌
- 证据：`/* MirrorMag Retro Film Palette */`
- 建议：删「MirrorMag」品牌名，保留调色板描述即可。

### [BLOCKER] `src/lib/api-client.ts:1` — 客户端顶部注释 `Type-safe fetch client for MirrorMag API`
- 证据：`// Type-safe fetch client for MirrorMag API.`
- 建议：改为 `Type-safe fetch client for AI·衣境 API.` 品牌命名要在代码里保持一致。

### [BLOCKER] `docs/DESIGN.md:1,3` — 设计文档标题本身即「MirrorMag / 换装魔镜」
- 证据：`# MirrorMag / 换装魔镜 —— 系统设计文档`
- 建议：文档要与 AGENTS.md 声明的产品名 AI·衣境保持一致，改为 `# AI·衣境 —— 系统设计文档`。此处虽是 architect 遗留，但既在本轮上线前必修集里。

### [MAJOR] `src/app/page.tsx:272` — 提示文案「大约需要 20–60 秒，请勿关闭页面」正确无违规
- 备注：此条本身不违规，仅记录不需要改。

### [MAJOR] `AGENTS.md` 与 `layout.tsx` / `page.tsx` 品牌名分歧
- 证据：AGENTS.md 明确产品名 AI·衣境；layout/page 却用 MirrorMag/换装魔镜。
- 建议：以 AGENTS.md 为准，全域替换。作为验收准入卡，任何 UI/meta/文档不再出现 MirrorMag / 换装魔镜。

### [MINOR] `src/lib/utils.ts:1` — 注释「压缩图片：缩放到最大指定尺寸并转为 JPEG」中性无违规
- 备注：跳过。

### [MINOR] `src/data/wardrobe.json:9` — 单品命名含品牌 `LV 云朵印花T恤`
- 证据：`{ "name": "LV 云朵印花T恤", ... }`
- 建议：SKILL §二.差异化一强调「门店专属选品」——用真实商标名会带法律风险且暴露非真实门店 DNA。建议改为泛化描述如「云朵印花白 T」。

### [NIT] `src/db/migrations/0001_optimal_ikaris.sql` — drizzle-kit 自动命名保留
- 证据：文件名 `0001_optimal_ikaris.sql` 由 drizzle-kit 随机生成。
- 建议：可 rename 为 `0001_add_generations_tags.sql`，语义更清晰。非必修。

---

## 组 B · Backend 契约、安全、正确性

（待填写）

---

## 组 C · Frontend & Next.js 16 / React 19 惯用法

（待填写）

---

## 组 D · 测试真实性与覆盖

（待填写）

---

## 总评

（待填写）
