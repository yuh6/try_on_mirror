import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    setupFiles: ["tests/helpers/db.ts"],
    // 每个测试文件独立 fork —— chdir/内存 sqlite/vi.mock 的隔离前提
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: [
        "src/lib/services/**/*.ts",
        "src/lib/errors.ts",
        "src/lib/api-helpers.ts",
        "src/app/api/**/route.ts",
      ],
      exclude: ["src/lib/glm.ts", "src/lib/seedream.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
