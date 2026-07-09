import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { db } from "../src/db/client";
import { categories, wardrobeItems } from "../src/db/schema";

const WardrobeSchema = z.object({
  categories: z.array(
    z.object({ id: z.string().min(1), name: z.string().min(1) })
  ),
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      file: z.string().min(1),
    })
  ),
});

const jsonPath = path.join(process.cwd(), "src", "data", "wardrobe.json");
const raw = readFileSync(jsonPath, "utf8");
const manifest = WardrobeSchema.parse(JSON.parse(raw));

const categoryIds = new Set(manifest.categories.map((c) => c.id));
for (const it of manifest.items) {
  if (!categoryIds.has(it.category)) {
    throw new Error(`条目 ${it.id} 引用了未定义的分类: ${it.category}`);
  }
}

// upsert：JSON 是权威源；DB 里同 id 覆盖，缺席的 id 不动
(async () => {
  await db.transaction(async (tx) => {
    for (let i = 0; i < manifest.categories.length; i++) {
      const c = manifest.categories[i];
      await tx
        .insert(categories)
        .values({ id: c.id, name: c.name, sortOrder: i })
        .onConflictDoUpdate({
          target: categories.id,
          set: { name: c.name, sortOrder: i },
        });
    }
    for (const it of manifest.items) {
      await tx
        .insert(wardrobeItems)
        .values({
          id: it.id,
          name: it.name,
          categoryId: it.category,
          file: it.file,
        })
        .onConflictDoUpdate({
          target: wardrobeItems.id,
          set: { name: it.name, categoryId: it.category, file: it.file },
        });
    }
  });

  console.log(
    `[seed] 完成: ${manifest.categories.length} 个分类, ${manifest.items.length} 件衣服`
  );
  process.exit(0);
})();
