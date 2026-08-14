/**
 * 起動エントリポイント。
 * 環境変数を読み込み（{@link loadConfig}）、`ConfigError` の場合はスタックを出さずに
 * 設定内容のメッセージだけを表示して終了する。それ以外の起動時エラー（transport 起動失敗等）は
 * `main().catch(...)` 側でスタック付きで表示する。設定が正しければ `config.mcpTransport` に応じて
 * stdio / HTTP のどちらかのトランスポートで待ち受ける。
 * @packageDocumentation
 */

import { loadConfig, ConfigError } from "./config.js";
import { createServer } from "./server.js";
import { runStdio } from "./transports/stdio.js";
import { runHttp } from "./transports/http.js";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[gitlab-mcp-server] 設定エラー: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  if (config.mcpTransport === "stdio") {
    const server = createServer(config);
    await runStdio(server);
  } else {
    await runHttp(config);
  }
}

main().catch((err) => {
  console.error(
    `[gitlab-mcp-server] 起動に失敗しました: ${err instanceof Error ? (err.stack ?? err.message) : err}`,
  );
  process.exit(1);
});
