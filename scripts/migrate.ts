import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../src/db/client";

migrate(db, { migrationsFolder: path.join(process.cwd(), "src", "db", "migrations") });
console.log("[migrate] 完成");
process.exit(0);
