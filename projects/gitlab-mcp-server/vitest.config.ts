import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // test-env/ はDocker ComposeによるセルフホストGitLabの動作確認環境であり
    // テストコードではないため、対象を test/ 配下に限定する。
    include: ["test/**/*.test.ts"],
    // test/e2e/ は dist/index.js を実子プロセスとして起動するE2Eテスト。
    // 事前の `pnpm run build` が必須なため `pnpm test` からは除外し、
    // `pnpm run test:e2e`（vitest.e2e.config.ts）で別途実行する。
    exclude: [...configDefaults.exclude, "test/e2e/**"],
  },
});
