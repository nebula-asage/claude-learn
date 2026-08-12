import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // test-env/ はDocker ComposeによるセルフホストGitLabの動作確認環境であり
    // テストコードではないため、対象を test/ 配下に限定する。
    include: ["test/**/*.test.ts"],
  },
});
