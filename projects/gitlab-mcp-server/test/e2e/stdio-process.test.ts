/**
 * dist/index.js を実子プロセスとして起動し、実stdioパイプ越しにMCPプロトコルで疎通確認する。
 *
 * test/helpers/mcp.ts の InMemoryTransport ハーネスは createServer() を同一プロセス内で
 * 直接呼び出すため、config.ts の環境変数読込・index.ts の起動シーケンス・OSパイプ越しの
 * JSON-RPCフレーミングは一切検証されない。このファイルはそのプロセス境界を実際に跨ぐことで、
 * それらを検証する（GitLab API側はモック。実GitLabに対する検証は test-env/ 参照）。
 *
 * 実行前に `pnpm run build` で dist/index.js が生成されている必要がある。
 * `pnpm run test:e2e` がビルドしてから実行するため、通常はそちらを使う。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startMockGitLabServer, type MockGitLabServer } from "./helpers/mockGitLabServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(__dirname, "../../dist/index.js");

let mockGitLab: MockGitLabServer;

beforeAll(async () => {
  if (!fs.existsSync(SERVER_ENTRY)) {
    throw new Error(
      `dist/index.js が見つかりません（${SERVER_ENTRY}）。先に \`pnpm run build\` を実行してください（\`pnpm run test:e2e\` は自動で実行する）。`,
    );
  }
  mockGitLab = await startMockGitLabServer();
});

afterAll(async () => {
  await mockGitLab.close();
});

afterEach(() => {
  mockGitLab.requests.length = 0;
});

async function connectRealProcess(
  env: Record<string, string>,
): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "e2e-process-client", version: "0.0.0" });
  await client.connect(transport);
  return { client, transport };
}

describe("実子プロセス（stdio）とのE2E疎通", () => {
  it("dist/index.js を子プロセスとして起動し、tools/list に29ツールが並ぶ", async () => {
    const { client, transport } = await connectRealProcess({
      GITLAB_BASE_URL: mockGitLab.baseUrl,
      GITLAB_TOKEN: "e2e-test-token",
    });
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(29);
      expect(tools.map((t) => t.name)).toContain("gitlab_list_projects");
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("gitlab_list_projects が 実プロセス→実HTTP→モックGitLab まで貫通し、PRIVATE-TOKENヘッダが実際に送られる", async () => {
    const { client, transport } = await connectRealProcess({
      GITLAB_BASE_URL: mockGitLab.baseUrl,
      GITLAB_TOKEN: "e2e-test-token",
    });
    try {
      const result = await client.callTool({ name: "gitlab_list_projects", arguments: {} });
      expect(result.isError).toBeFalsy();

      const content = result.content as Array<{ type: string; text: string }>;
      const payload = JSON.parse(content[0]!.text) as {
        items: Array<{ path_with_namespace: string }>;
      };
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0]?.path_with_namespace).toBe("mcp-test/demo");

      expect(mockGitLab.requests).toHaveLength(1);
      expect(mockGitLab.requests[0]?.path).toBe("/api/v4/projects");
      expect(mockGitLab.requests[0]?.privateToken).toBe("e2e-test-token");
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("GITLAB_TOKEN未設定だと実プロセスは設定エラーで即終了し、接続確立に失敗する", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_ENTRY],
      env: { GITLAB_BASE_URL: mockGitLab.baseUrl },
      stderr: "pipe",
    });
    const client = new Client({ name: "e2e-process-client", version: "0.0.0" });

    await expect(client.connect(transport)).rejects.toThrow();
    await transport.close().catch(() => undefined);
  });
});
