import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";

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

export type Category = typeof categories.$inferSelect;
export type CategoryInsert = typeof categories.$inferInsert;
export type WardrobeItemRow = typeof wardrobeItems.$inferSelect;
export type WardrobeItemInsert = typeof wardrobeItems.$inferInsert;
export type GenerationRow = typeof generations.$inferSelect;
export type GenerationInsert = typeof generations.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;
export type WardrobeItemTagRow = typeof wardrobeItemTags.$inferSelect;
export type WardrobeItemTagInsert = typeof wardrobeItemTags.$inferInsert;
