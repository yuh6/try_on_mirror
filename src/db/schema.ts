import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/* ============================================================
 * 小棉袄 —— 子女端数据表
 * owner 归属：'' = 演示数据（张阿姨）；其他 = 对应 userId 的私有数据
 * ============================================================ */

/** 注册用户 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** 老人档案：每个 owner 一行 JSON 文档 */
export const elderProfiles = sqliteTable("elder_profiles", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull().default(""),
  data: text("data").notNull(), // elder_profile JSON 字符串
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** 子女留言（小棉在通话时传话给老人） */
export const boardMessages = sqliteTable(
  "board_messages",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull().default(""),
    fromWho: text("from_who").notNull(),
    text: text("text").notNull(),
    time: text("time").notNull(), // "YYYY-MM-DD HH:mm:ss"
    delivered: integer("delivered", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [index("idx_board_messages_owner").on(t.owner)]
);

/** AI 通话汇报 */
export const boardReports = sqliteTable(
  "board_reports",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull().default(""),
    time: text("time").notNull(),
    summary: text("summary").notNull(),
    mood: text("mood").notNull().default(""),
    details: text("details").notNull().default(""),
  },
  (t) => [index("idx_board_reports_owner").on(t.owner)]
);

/** 待办（小棉建议子女做的事） */
export const boardTodos = sqliteTable(
  "board_todos",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull().default(""),
    text: text("text").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    time: text("time").notNull(),
  },
  (t) => [index("idx_board_todos_owner").on(t.owner)]
);

/** 心情记录（同一 owner 同一天只保留最新一条） */
export const boardMoods = sqliteTable(
  "board_moods",
  {
    date: text("date").notNull(), // "YYYY-MM-DD"
    owner: text("owner").notNull().default(""),
    mood: text("mood").notNull(),
    note: text("note").notNull().default(""),
    time: text("time").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.date] })]
);

export type ElderProfileRow = typeof elderProfiles.$inferSelect;
export type BoardMessageRow = typeof boardMessages.$inferSelect;
export type BoardReportRow = typeof boardReports.$inferSelect;
export type BoardTodoRow = typeof boardTodos.$inferSelect;
export type BoardMoodRow = typeof boardMoods.$inferSelect;

/* ============================================================
 * 以下为旧「换装魔镜」遗留表定义。
 * 线上 Turso 里仍有这些表，保留定义是为了让 drizzle-kit
 * 不在后续迁移中生成 DROP 语句（不主动删生产数据）。
 * 新代码请勿使用。
 * ============================================================ */

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const wardrobeItems = sqliteTable("wardrobe_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  file: text("file").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const generations = sqliteTable(
  "generations",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    personImageHash: text("person_image_hash").notNull(),
    clothingSource: text("clothing_source", {
      enum: ["uploaded", "wardrobe"],
    }).notNull(),
    clothingRef: text("clothing_ref").notNull(),
    outputUrl: text("output_url"),
    prompt: text("prompt").notNull(),
    status: text("status", { enum: ["success", "failed"] }).notNull(),
    errorMessage: text("error_message"),
    latencyMs: integer("latency_ms").notNull(),
  },
  (t) => [
    index("idx_generations_created_at").on(t.createdAt),
    index("idx_generations_status_created").on(t.status, t.createdAt),
    check(
      "generations_clothing_source_check",
      sql`${t.clothingSource} IN ('uploaded','wardrobe')`
    ),
    check(
      "generations_status_check",
      sql`${t.status} IN ('success','failed')`
    ),
  ]
);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const wardrobeItemTags = sqliteTable(
  "wardrobe_item_tags",
  {
    wardrobeItemId: text("wardrobe_item_id")
      .notNull()
      .references(() => wardrobeItems.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.wardrobeItemId, t.tagId] }),
    index("idx_wit_tag").on(t.tagId),
  ]
);
