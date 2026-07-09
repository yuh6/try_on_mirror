# MirrorMag / 换装魔镜 —— 系统设计文档

> 版本: v1.0（架构基线）
> 适用范围: Next.js 16 (App Router) + React 19 + Drizzle ORM + better-sqlite3
> 编写人: architect · 供 backend / frontend / qa / reviewer 后续 agent 共同遵循

---

## 1. 现状分析

当前仓库已经跑通了 **单次换衣主流程**：前端 `src/app/page.tsx` 收集用户上传的「人物图 + 衣服图」，压缩到 1024px 后以 base64 打到 `POST /api/generate`；服务端读取 `personImage` 和 `clothingImage`（或按 `clothingId` 从 `wardrobe_items` 表中反查磁盘图片、组装成 data URI），拼装固定 prompt 调用火山方舟 Seedream 5.0（`src/lib/seedream.ts`），把返回的图片 URL 透传给前端。数据库层已用 Drizzle 定义 `categories` / `wardrobe_items` 两张表并配好 WAL + 外键，`scripts/seed-wardrobe.ts` 从 `src/data/wardrobe.json` 幂等灌数据。**缺失能力**主要有三块：(1) 没有生成历史持久化，用户刷新即失去结果；(2) 衣橱只有「读」没有「增/删」，无法把自定义单品长期沉淀到 SQLite；(3) 无标签体系与分页历史 API，未来扩展筛选、瀑布流受阻。本设计围绕这三块补齐 DB + API + 目录结构 + 关键约束。

---

## 2. 数据库设计

### 2.1 现有表（保留，不做破坏性改动）

#### `categories` — 衣橱分类
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | 业务 id，如 `top` / `dress` |
| `name` | TEXT | NOT NULL | 中文显示名 |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | 前端 tabs 排序键 |

#### `wardrobe_items` — 衣橱单品
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | 业务 id，seed 用 `w001`，用户新增用 `wu_<nanoid>` |
| `name` | TEXT | NOT NULL | 单品名称 |
| `category_id` | TEXT | NOT NULL, FK → `categories.id` | 分类外键 |
| `file` | TEXT | NOT NULL | 相对 `public/wardrobe/` 的文件名（禁含路径分隔符） |
| `created_at` | INTEGER (unix ts) | NOT NULL | Drizzle `timestamp` 模式，默认 `new Date()` |

### 2.2 新增表

#### `generations` — 每次生成的结果记录
用于历史页、失败排障、后续统计。

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | `gen_<nanoid>` |
| `created_at` | INTEGER (unix ts) | NOT NULL, DEFAULT `now()` | 生成完成时间戳 |
| `person_image_hash` | TEXT | NOT NULL | 上传人物图 base64 的 SHA-256，做去重/追踪；**不落盘原图**以省磁盘 |
| `clothing_source` | TEXT | NOT NULL, CHECK IN (`'uploaded'`,`'wardrobe'`) | 衣服来源枚举 |
| `clothing_ref` | TEXT | NOT NULL | `clothing_source='wardrobe'` 时是 `wardrobe_items.id`；`'uploaded'` 时是 SHA-256 |
| `output_url` | TEXT |  | 火山方舟返回的图片 URL（成功时非空） |
| `prompt` | TEXT | NOT NULL | 实际下发给 Seedream 的 prompt 全文（便于回溯） |
| `status` | TEXT | NOT NULL, CHECK IN (`'success'`,`'failed'`) | 结果状态 |
| `error_message` | TEXT |  | 失败原因（`status='failed'` 时必填） |
| `latency_ms` | INTEGER | NOT NULL | 从请求进入到 Seedream 返回的耗时（毫秒） |

**索引**
- `idx_generations_created_at` on `generations(created_at DESC)` — 历史列表按时间倒序 + cursor 分页主用。
- `idx_generations_status_created` on `generations(status, created_at DESC)` — 后续按成功/失败过滤。

#### `tags` — 标签字典
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | `tag_<slug>` |
| `name` | TEXT | NOT NULL, UNIQUE | 中文显示名，如「显瘦」「通勤」 |
| `created_at` | INTEGER | NOT NULL |  |

#### `wardrobe_item_tags` — 单品 ↔ 标签 多对多关联
| 列 | 类型 | 约束 |
|---|---|---|
| `wardrobe_item_id` | TEXT | NOT NULL, FK → `wardrobe_items.id` ON DELETE CASCADE |
| `tag_id` | TEXT | NOT NULL, FK → `tags.id` ON DELETE CASCADE |
| **PRIMARY KEY** | | `(wardrobe_item_id, tag_id)` — 联合主键，天然去重 |

**索引**
- 联合主键自带前缀索引（按 `wardrobe_item_id` 查询高效）。
- 额外 `idx_wit_tag` on `wardrobe_item_tags(tag_id)` — 支持「按标签反查单品」。

### 2.3 迁移策略

1. 在 `src/db/schema.ts` 中追加 `generations` / `tags` / `wardrobeItemTags` 三个 `sqliteTable` 定义（**不动**已有两表的列，保证向后兼容）。
2. 跑 `npm run db:generate`（drizzle-kit），生成新的 `NNNN_xxx.sql` 到 `src/db/migrations/`。人工检查生成的 SQL 只包含 `CREATE TABLE` 与 `CREATE INDEX`，**不含**对旧表的 ALTER。
3. 部署脚本按顺序执行 `npm run db:migrate` → `npm run db:seed`。migrate 使用 drizzle 官方 `migrate()`，天然幂等；seed 已用 `onConflictDoUpdate` 幂等。
4. 生产 SQLite 保持 WAL 模式 + `foreign_keys = ON`（已由 `client.ts` 处理）。**禁止**在迁移中 DROP 已有表；如需清理测试数据，走 `data/*.db.test` 独立库。

---

## 3. API 接口契约

所有端点均在 `src/app/api/**/route.ts` 中实现，`runtime = "nodejs"`（sqlite / fs 需要）。约定：
- 请求体使用 JSON，图片以 `data:image/*;base64,...` 传输。
- 成功统一返回 `{ ...payload }`；失败统一返回 `{ error: string }` + 对应 HTTP 状态码。
- 所有 body 用 `zod` 校验，校验失败 → 400。

### 3.1 `GET /api/wardrobe`

**Query**
| 名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | string | 否 | 分类 id，缺省返回全部 |

**200 Response**
```ts
{
  categories: { id: string; name: string }[];   // 按 sort_order 升序
  items: {
    id: string; name: string; category: string; file: string;
    url: string;                                 // "/wardrobe/<file>"
    tags?: { id: string; name: string }[];      // 若关联了 tags 表则返回
  }[];
}
```

**错误** — 500: 数据库读取失败。

---

### 3.2 `POST /api/wardrobe`

新增一件用户自定义单品；把 base64 图落到 `public/wardrobe/`，同步写 `wardrobe_items` 行。

**Request Body**
```ts
{
  name: string;                    // 1..64
  categoryId: string;              // 必须已存在于 categories 表
  fileBase64: string;              // "data:image/{jpeg|png|webp};base64,..."
  tagIds?: string[];               // 可选，关联已存在的 tag
}
```

**200 Response**
```ts
{ item: WardrobeListItem }        // 与 3.1 中 items 元素同结构
```

**错误**
- 400: zod 校验失败 / MIME 非图片 / categoryId 不存在。
- 413: 解码后图片 > 5 MB（防止把 SQLite/磁盘打爆）。
- 500: 落盘或 DB 写入失败。

**服务端处理关键点**
- 生成文件名: `wu_<nanoid(10)>.<ext>`，`ext` 由 MIME 严格映射（避免 `../` 逃逸）。
- 落盘前 `mkdirSync(WARDROBE_DIR, { recursive: true })`。
- DB 写入用 `sqlite.transaction`：先 `insert wardrobe_items`；若有 `tagIds` 再 `insert wardrobe_item_tags`（`ON CONFLICT DO NOTHING`）。
- 写入失败需 `unlink` 已落盘文件回滚。

---

### 3.3 `DELETE /api/wardrobe/[id]`

**Path Param** — `id`: 单品 id（禁止删除 seed 数据可通过 id 前缀 `wu_` 校验，或加 `is_seed` 位；本版直接允许删除任意行）。

**200 Response** — `{ ok: true }`。

**错误**
- 404: id 不存在。
- 500: 磁盘 unlink 失败或 DB 删除失败（事务回滚）。

**处理关键点**
- 事务：SELECT 拿 `file` → DELETE 行（`wardrobe_item_tags` 因 CASCADE 自动清理）→ `unlink(WARDROBE_DIR/file)`。
- `unlink` 失败但文件不存在（ENOENT）视为成功（幂等）。

---

### 3.4 `POST /api/generate`

**Request Body**
```ts
{
  personImage: string;                  // 必填，data URI
  clothingImage?: string;               // clothingImage 与 clothingId 二选一
  clothingId?: string;
}
```

**200 Response**
```ts
{
  outputUrl: string;                    // Seedream 返回的图片 URL
  generationId: string;                 // generations.id，供前端展示/删除
}
```

**错误**
- 400: 缺 personImage / 两个 clothing 参数都缺 / data URI 非法。
- 404: `clothingId` 不在衣橱中。
- 502: Seedream 上游返回错误（透传其 message）。
- 504: Seedream 超时（服务端 90s 超时，前端 120s）。
- 500: 其他内部错误。

**处理关键点**
- 无论成功/失败都 **写一行 `generations`**（失败时 `status='failed'`, `output_url=null`, `error_message` 填）。
- `person_image_hash` = SHA-256(personImage 的 base64 主体)；`clothing_ref` 同理（`wardrobe` 来源时直接存 id）。
- prompt 常量化到 `src/lib/services/generation.service.ts`，便于以后按 category 变体（如「泳装 → 沙滩背景」）。

---

### 3.5 `GET /api/generations`

游标分页读取历史。

**Query**
| 名 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `limit` | int | 20 | 上限 50 |
| `cursor` | string? | — | 上一页返回的 `nextCursor`（本质是 `created_at:id` 的 base64） |
| `status` | `success` \| `failed`? | — | 可选过滤 |

**200 Response**
```ts
{
  items: {
    id: string; createdAt: number;
    clothingSource: "uploaded" | "wardrobe";
    clothingRef: string;
    outputUrl: string | null;
    status: "success" | "failed";
    errorMessage: string | null;
    latencyMs: number;
  }[];
  nextCursor: string | null;             // null = 无下一页
}
```

**错误** — 400: cursor 解码失败；500: DB 错误。

**索引使用** — `idx_generations_created_at`（或 status 复合索引）配合 `WHERE (created_at,id) < (cursor)` 的键集分页，避免 OFFSET 全表扫。

---

### 3.6 `DELETE /api/generations/[id]`

**200 Response** — `{ ok: true }`。

**错误** — 404: 不存在；500: DB 错误。

> 注意：`output_url` 是上游 Seedream 的临时 URL，我们不负责删除源文件，本接口只清 DB 行。

---

## 4. 目录结构建议

按「App Router 页面 / 服务端 API / 纯 UI 组件 / 前端 hook / 领域 service / 基础 lib / db」分层，避免 route.ts 内塞业务逻辑。

```
D:\ai-makeup\
├─ docs\
│  └─ DESIGN.md                        # 本文件
├─ public\
│  └─ wardrobe\                        # seed 图 + 用户上传单品 (wu_*.jpg/png/webp)
├─ scripts\
│  ├─ migrate.ts                       # 已有
│  └─ seed-wardrobe.ts                 # 已有
└─ src\
   ├─ app\
   │  ├─ page.tsx                      # 现有主页（改为消费 hooks）
   │  ├─ history\page.tsx              # 新增：生成历史页
   │  └─ api\
   │     ├─ wardrobe\
   │     │  ├─ route.ts                # GET (list) / POST (add)
   │     │  └─ [id]\route.ts           # DELETE
   │     ├─ generate\
   │     │  └─ route.ts                # POST (改造：写入 generations)
   │     └─ generations\
   │        ├─ route.ts                # GET (list + cursor)
   │        └─ [id]\route.ts           # DELETE
   ├─ components\                      # 纯 UI（不含 fetch）
   │  ├─ UploadSlot.tsx                # 从 page.tsx 抽出
   │  ├─ WardrobeGrid.tsx              # 分类 tabs + 网格
   │  ├─ CategoryTabs.tsx
   │  ├─ ResultCard.tsx                # 结果图 + 下载/重来
   │  └─ HistoryDrawer.tsx             # 侧滑抽屉展示 generations
   ├─ hooks\                           # 前端数据 hook（内部走 api-client）
   │  ├─ useWardrobe.ts
   │  ├─ useGenerate.ts
   │  └─ useGenerations.ts             # 含 cursor 分页
   ├─ lib\
   │  ├─ api-client.ts                 # 前端类型安全 fetch（每个端点一个函数，接受/返回上文声明的 TS 类型）
   │  ├─ utils.ts                      # 已有 compressImage
   │  ├─ seedream.ts                   # 已有
   │  ├─ glm.ts                        # 已有（暂未主用，保留）
   │  └─ services\
   │     ├─ wardrobe.service.ts        # listWardrobe / addWardrobeItem / deleteWardrobeItem / getAsDataUri
   │     └─ generation.service.ts      # createGeneration (含写库) / listGenerations / deleteGeneration
   └─ db\
      ├─ client.ts                     # 已有
      ├─ schema.ts                     # 追加 generations / tags / wardrobeItemTags
      └─ migrations\                   # drizzle-kit 生成
```

**分层规则**
- `app/api/**/route.ts` 只负责：入参 zod 校验 → 调 service → 组装 HTTP 响应。**禁止**直接 `db.select()`。
- `services/*` 是唯一操作 `db` 的层，函数纯 Node，可被 route + 脚本 + 未来 tests 复用。
- `components/*` 全部 **无副作用**（不 fetch），数据由 hook 传入。
- `hooks/*` 唯一持有 loading/error/data 状态，内部调 `api-client`。
- `api-client.ts` 输入输出类型与 route 契约共享（可用 `zod.infer` 或独立 `types.ts`）。

---

## 5. 关键约束与后续 Owner 分工

### 5.1 安全
- **路径穿越**：所有涉及 `public/wardrobe/` 的文件名一律 `path.basename()` 校验 + MIME 白名单映射扩展名。禁止把请求体里的 filename 直接拼接。
- **API Key**：`ARK_API_KEY` / `GLM_API_KEY` 仅在服务端读取，`route.ts` **禁止**通过 response 泄漏。前端 `.env.local` 不放任何 `NEXT_PUBLIC_*` 密钥。
- **上传大小**：`next.config.ts` 已设 `bodySizeLimit: "10mb"`；服务端二次校验解码后字节数 ≤ 5 MB 单张。
- **CSRF**：仅同源 fetch + 不使用 Cookie 会话，本版本免；未来加登录时再引 CSRF token。

### 5.2 性能
- 前端 `compressImage` 已把长边压到 1024，保留。
- SQLite **保持** WAL + `foreign_keys=ON`（`client.ts` 现有实现），全局单连接。
- `generations` 列表用键集分页而非 `LIMIT/OFFSET`，避免大表回表。
- Seedream 调用支持 `AbortController`（服务端 90s，前端 120s），失败要落盘 `latency_ms` 便于排障。

### 5.3 错误处理
- Service 层抛错用自定义 `AppError extends Error { code: 'NOT_FOUND' | 'BAD_REQUEST' | 'UPSTREAM' | 'INTERNAL' }`，route 层统一转换为 HTTP status。
- 前端 `api-client` 收到非 2xx 抛 `ApiError`，hook 捕获后暴露 `error` 字符串。
- `POST /api/generate` 无论成功失败都要写 `generations` 行，便于 QA 复现问题。

### 5.4 测试策略概览
- **Unit**：`services/*.ts` 用临时 sqlite 文件（`data/test-<pid>.db`）跑 drizzle migrate，断言 CRUD 行为。
- **Integration**：Next 的 route handler 用 `NextRequest`/`NextResponse` mock 直接调用 `POST(request)`，覆盖 400/404/500 分支；Seedream 上游用 `vi.mock` 或 nock 断网跑本地桩。
- **E2E（可选）**：跑 `next dev` + Playwright，覆盖「上传两图 → 生成 → 结果显示 → 历史抽屉可见新行」。
- CI 前置：`npm run db:generate` 与 `npm run db:migrate` 必须都是干净退出。

### 5.5 Owner 分工

| 任务 | 负责人 | 交付物 |
|---|---|---|
| **Backend** | backend agent | `src/db/schema.ts` 追加三表；`src/db/migrations/` 新 SQL；`src/lib/services/*.service.ts`；`src/app/api/wardrobe/route.ts` 增 POST、新增 `[id]/route.ts`；改造 `src/app/api/generate/route.ts` 写库；新增 `src/app/api/generations/route.ts` + `[id]/route.ts`；`AppError` 类；确保 `npm run db:migrate` 通过 |
| **Frontend** | frontend agent | `src/lib/api-client.ts`；`src/hooks/useWardrobe.ts` / `useGenerate.ts` / `useGenerations.ts`；`src/components/*` 抽出 5 个组件；改造 `src/app/page.tsx` 消费 hook + 加「从衣橱选」；新增 `src/app/history/page.tsx` + 抽屉；上传单品的对话框 UI |
| **QA** | qa agent | Vitest 配置；`services/*.test.ts` 单测（覆盖率 ≥ 70%）；每个 route 的集成测试（含 400/404/500 分支）；Seedream mock；`npm test` 一键跑通；一份「手工回归清单」md 交付 reviewer |
| **Reviewer** | reviewer agent | 阅读 backend + frontend + qa 的 diff，对照本文档检查：契约一致、无 SQL 注入、无路径穿越、hook 无内存泄漏（AbortController 清理）、无 API Key 泄漏、生成失败仍写库；出具 findings 清单 |

---

**变更纪律**：任何对 DB schema / API 契约 / 目录分层的偏离，必须先回来更新本文档再落码。
