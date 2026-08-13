/**
 * test-env/ の実GitLab CEに対して、dist/index.js を実子プロセスとして起動して疎通確認する
 * E2Eテスト群（test/e2e/*.test.ts）が共通で使うヘルパー。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ENTRY = path.resolve(__dirname, "../../../dist/index.js");
const TEST_ENV_FILE = path.resolve(__dirname, "../../../test-env/.env.test");

export interface TestEnvConnection {
  baseUrl: string;
  token: string;
  defaultProject: string;
  /** test-env/setup.sh が用意する、グループ未所属のメンバーテスト用ユーザーID。 */
  testMemberUserId: number;
}

/** dist/index.js が存在しない場合、ビルド漏れとして即座にエラーにする。 */
export function ensureServerBuilt(): void {
  if (!fs.existsSync(SERVER_ENTRY)) {
    throw new Error(
      `dist/index.js が見つかりません（${SERVER_ENTRY}）。先に \`pnpm run build\` を実行してください（\`pnpm run test:e2e\` は自動で実行する）。`,
    );
  }
}

/** test-env/.env.test から接続情報を読み込む。未起動の場合は明確なエラーで落とす（無言スキップはしない）。 */
export function loadTestEnvConnection(): TestEnvConnection {
  if (!fs.existsSync(TEST_ENV_FILE)) {
    throw new Error(
      "test-env/.env.test が見つかりません。先に `cd test-env && ./setup.sh` でセルフホストGitLabを起動してください（詳細は test-env/README.md）。",
    );
  }
  const values = Object.fromEntries(
    fs
      .readFileSync(TEST_ENV_FILE, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const eq = line.indexOf("=");
        return [line.slice(0, eq), line.slice(eq + 1)];
      }),
  );
  const baseUrl = values.GITLAB_BASE_URL;
  const token = values.GITLAB_TOKEN;
  const defaultProject = values.GITLAB_DEFAULT_PROJECT;
  const testMemberUserIdRaw = values.GITLAB_TEST_MEMBER_USER_ID;
  const testMemberUserId = testMemberUserIdRaw ? Number.parseInt(testMemberUserIdRaw, 10) : NaN;
  if (!baseUrl || !token || !defaultProject || !Number.isFinite(testMemberUserId)) {
    throw new Error(
      "test-env/.env.test の内容が不正です（GITLAB_BASE_URL / GITLAB_TOKEN / GITLAB_DEFAULT_PROJECT / GITLAB_TEST_MEMBER_USER_ID が必要）。`cd test-env && ./setup.sh` を再実行してください。",
    );
  }
  return { baseUrl, token, defaultProject, testMemberUserId };
}

/** dist/index.js を実子プロセスとして起動し、MCP Clientを接続する。 */
export async function connectRealProcess(
  conn: TestEnvConnection,
  envOverrides: Record<string, string> = {},
): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: {
      GITLAB_BASE_URL: conn.baseUrl,
      GITLAB_TOKEN: conn.token,
      GITLAB_DEFAULT_PROJECT: conn.defaultProject,
      ...envOverrides,
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "e2e-process-client", version: "0.0.0" });
  await client.connect(transport);
  return { client, transport };
}

// Client#callTool の戻り型は CallToolResult と旧仕様の { toolResult } との union になっており、
// そのままでは content に型が付かない。本サーバは常に CallToolResult 形式を返すので寄せる
// （test/helpers/mcp.ts の Harness#call と同じ扱い）。
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<CallToolResult> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

export function firstJson<T>(result: CallToolResult): T {
  const content = result.content as Array<{ type: string; text: string }>;
  return JSON.parse(content[0]!.text) as T;
}

export function firstText(result: CallToolResult): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0]!.text;
}

/**
 * MCPツール経由ではなく、実GitLabに直接投げるリクエスト。
 * gitlab-mcp-server は削除系ツールを意図的に持たないため（README参照）、書込系ツールの
 * E2Eテストで使い捨てのフィクスチャ（MR用の作業ブランチ等）を用意したり、テスト後に
 * 後始末（Issue/MR/ブランチ/グループメンバーの削除）したりするために直接GitLab APIを叩く。
 */
export async function gitlabApiRequest(
  conn: TestEnvConnection,
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<Response> {
  return fetch(new URL(`/api/v4${apiPath}`, conn.baseUrl), {
    method,
    headers: {
      "PRIVATE-TOKEN": conn.token,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** 後始末用。失敗してもテスト結果には影響させない（ベストエフォート）。 */
export async function gitlabCleanup(
  conn: TestEnvConnection,
  method: string,
  apiPath: string,
): Promise<void> {
  try {
    await gitlabApiRequest(conn, method, apiPath);
  } catch {
    // クリーンアップの失敗はテスト結果に影響させない。
  }
}
