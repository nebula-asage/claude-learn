import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.js";
import { GitLabClient } from "./gitlab/client.js";
import { registerRepositoryTools } from "./tools/repository.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerMergeRequestTools } from "./tools/mergeRequests.js";
import { registerPipelineTools } from "./tools/pipelines.js";
import { registerGroupTools } from "./tools/groups.js";

/**
 * MCPサーバを構築し、GitLab操作ツールを全て登録する。
 * @param config 起動設定。`gitlabReadOnly` が true の場合、Issue/MR/グループメンバーの
 *   書込系ツールは各 `register*Tools` 内で早期returnし、登録自体が行われない。
 * @returns ツール登録済みの `McpServer`。呼び出し側がトランスポートに `connect()` する。
 */
export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: "gitlab-mcp-server",
    version: "0.1.0",
  });

  const client = new GitLabClient(config);

  registerRepositoryTools(server, client);
  registerIssueTools(server, client, config);
  registerMergeRequestTools(server, client, config);
  registerPipelineTools(server, client);
  registerGroupTools(server, client, config);

  return server;
}
