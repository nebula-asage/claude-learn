import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // src/sim 配下はDOM非依存に保つ設計のため、node環境のままテストできる。
    environment: "node",
    include: ["test/**/*.test.ts"],
    // coverage.include を明示しないと、テストから一度もimportされなかったsrc配下のファイルは
    // カバレッジレポートに一切現れない（0/0で「対象ファイル無し」に見えてしまう）。
    // include を指定すると、未テストのファイルも0%として一覧に出るため、
    // 「まだテストが無い」ことがレポート上で分かるようになる。
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
    },
  },
});
