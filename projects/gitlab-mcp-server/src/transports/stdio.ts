import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * stdio トランスポートで接続する。
 * 注意: stdout は JSON-RPC メッセージ専用のため、このモードでは console.log を絶対に使わない。
 * ログは全て console.error（stderr）へ出す。
 */
export async function runStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[gitlab-mcp-server] stdio トランスポートで起動しました。");
}
