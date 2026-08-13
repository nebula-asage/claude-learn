import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/e2e/**/*.test.ts"],
    // 子プロセスの起動・実GitLab（test-env/）への実HTTPリクエストを伴うため、
    // 通常のユニットテストより余裕を持たせる。
    testTimeout: 30_000,
  },
});
