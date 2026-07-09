/**
 * 单个测试文件的公用 setup —— 通过 setupFiles 加载。
 *
 * 关键设计：
 * 1. 在 `@/db/client` 被 import 之前，注入一个 libSQL `:memory:` 实例到
 *    `globalThis.__libsql` / `globalThis.__db`。`@/db/client` 采用
 *    `globalForDb.__libsql ?? createConnection()` 的单例模式，恰好可以
 *    通过 global 变量覆盖，避免打开真实 data/app.db 或去连 Turso。
 * 2. `process.chdir()` 到 os.tmpdir 下的独立目录，让 wardrobe.service.ts
 *    的 `WARDROBE_DIR = path.join(process.cwd(), "public", "wardrobe")`
 *    落到临时目录，测试之间互不影响。
 * 3. `beforeEach` 清空表（迁移只跑一次，避免重建 db 的开销）。
 *
 * 每个测试文件由 vitest 独立 worker fork 运行，chdir 只影响本 worker。
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeEach } from "vitest";
import * as schema from "../../src/db/schema";

// 记录原始 cwd 以便 afterAll 恢复 + 找到 migrations 目录
const ORIGINAL_CWD = process.cwd();
const MIGRATIONS_DIR = path.join(ORIGINAL_CWD, "src", "db", "migrations");

// 每个 test file 一个独立 tmp cwd
const testCwd = path.join(
  tmpdir(),
  `ai-yijing-test-${process.pid}-${randomBytes(4).toString("hex")}`
);
mkdirSync(path.join(testCwd, "public", "wardrobe"), { recursive: true });
mkdirSync(path.join(testCwd, "data"), { recursive: true });
process.chdir(testCwd);

// 创建 libSQL 连接：走临时文件，不用 :memory:
// 原因：某些 libsql/vitest 组合下多次 execute 会走到不同的 in-memory 库，
// 表创建后 service 查询 "no such table"。文件模式下所有连接共享同一 db。
const dbFile = path.join(testCwd, "data", "test.db");
const libsql = createClient({ url: `file:${dbFile}` });
await libsql.execute("PRAGMA foreign_keys = ON");
const db = drizzle(libsql, { schema });

// 顺序 apply 迁移 SQL
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const f of migrationFiles) {
  const sqlContent = readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
  // drizzle-kit 用 '--> statement-breakpoint' 分割
  const stmts = sqlContent.split("--> statement-breakpoint");
  for (const stmt of stmts) {
    const s = stmt.trim();
    if (s) await libsql.execute(s);
  }
}

// 把测试 db 注入到全局 —— `@/db/client` 会读到它，跳过 createConnection
type DbGlobal = {
  __libsql?: Client;
  __db?: ReturnType<typeof drizzle<typeof schema>>;
};
(globalThis as unknown as DbGlobal).__libsql = libsql;
(globalThis as unknown as DbGlobal).__db = db;

// 每个 test 前清空（保留表结构，只清行）
beforeEach(async () => {
  await libsql.execute("DELETE FROM wardrobe_item_tags");
  await libsql.execute("DELETE FROM generations");
  await libsql.execute("DELETE FROM wardrobe_items");
  await libsql.execute("DELETE FROM tags");
  await libsql.execute("DELETE FROM categories");
});

afterAll(() => {
  try {
    libsql.close();
  } catch {
    // 忽略：可能被其他 hook 关过
  }
  try {
    process.chdir(ORIGINAL_CWD);
  } catch {
    // ignore
  }
  try {
    rmSync(testCwd, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

export { db, libsql, testCwd };
