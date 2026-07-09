import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "node:path";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";

// 生产走 Turso(TURSO_DATABASE_URL + TURSO_AUTH_TOKEN);本地缺省用文件模式
const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.DATABASE_URL ??
  `file:${path.join(process.cwd(), "data", "app.db")}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

// dev 下 Next.js 会热重载模块,避免每次都新建连接
const globalForDb = globalThis as unknown as {
  __libsql?: Client;
  __db?: ReturnType<typeof drizzle<typeof schema>>;
};

function createConnection() {
  // 本地文件模式:确保目录存在
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    mkdirSync(path.dirname(filePath), { recursive: true });
  }
  return createClient({ url, authToken });
}

export const libsql =
  globalForDb.__libsql ?? (globalForDb.__libsql = createConnection());
export const db =
  globalForDb.__db ?? (globalForDb.__db = drizzle(libsql, { schema }));

export { schema };
