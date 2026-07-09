import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.db");

// dev 下 Next.js 会热重载模块,避免每次都新建 sqlite 连接导致文件句柄泄漏
const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
  __db?: ReturnType<typeof drizzle<typeof schema>>;
};

function createConnection() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export const sqlite = globalForDb.__sqlite ?? (globalForDb.__sqlite = createConnection());
export const db = globalForDb.__db ?? (globalForDb.__db = drizzle(sqlite, { schema }));

export { schema };
