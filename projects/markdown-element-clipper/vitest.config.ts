import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // 相対URLの絶対化テストのため、既定のドキュメントURLを固定する。
    environmentOptions: {
      jsdom: {
        url: "https://example.com/dir/page.html",
      },
    },
  },
  // Vite/Vitestのresolveは既定でブラウザ条件にならないため明示しないと、
  // turndownのNodeビルド(@mixmark-io/domino依存)が読み込まれてしまう。
  resolve: {
    mainFields: ["browser", "module", "main"],
    conditions: ["browser"],
  },
});
