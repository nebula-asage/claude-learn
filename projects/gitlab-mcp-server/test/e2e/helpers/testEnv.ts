/**
 * test-env/ の実GitLab CEに対して、dist/index.js を実子プロセスとして起動して疎通確認する
 * E2Eテスト群（test/e2e/*.test.ts）が共通で使うヘルパー。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
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

/**
 * 空きポートを1つ確保する。
 *
 * MCP_HTTP_PORT は src/config.ts の parsePositiveIntEnv が 0 以下を弾くため、
 * test/transports/http.test.ts のように `port: 0` でOSに任せることができない。
 * 一時的にエフェメラルポートをlistenして番号だけ取り、閉じてから子プロセスに渡す。
 */
export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("空きポートの取得に失敗しました。")));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export interface HttpServerProcess {
  child: ChildProcess;
  baseUrl: string;
  /** SIGTERM を送って終了を待つ（src/transports/http.ts の graceful shutdown が応答する）。 */
  stop(): Promise<void>;
}

/**
 * MCP_TRANSPORT=http で dist/index.js を実子プロセスとして起動し、
 * /healthz が応答するまで待つ。stdio と違いJSON-RPCがstdoutを流れないので、
 * StdioClientTransport ではなく素の spawn を使う。
 */
export async function startRealHttpProcess(
  conn: TestEnvConnection,
  envOverrides: Record<string, string> = {},
): Promise<HttpServerProcess> {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      GITLAB_BASE_URL: conn.baseUrl,
      GITLAB_TOKEN: conn.token,
      GITLAB_DEFAULT_PROJECT: conn.defaultProject,
      MCP_TRANSPORT: "http",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: String(port),
      ...envOverrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // 起動に失敗した場合（設定エラー等）に原因が分かるよう、stderrを溜めておく。
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const stop = async (): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
    });
  };

  // 固定sleepではなく /healthz のポーリングで起動完了を待つ。
  const deadline = Date.now() + 15_000;
  for (;;) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`HTTPモードの子プロセスが起動直後に終了しました。stderr:\n${stderr}`);
    }
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) break;
    } catch {
      // まだlisten前。リトライする。
    }
    if (Date.now() >= deadline) {
      await stop();
      throw new Error(
        `HTTPモードの子プロセスが起動しませんでした（${baseUrl}）。stderr:\n${stderr}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { child, baseUrl, stop };
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

/**
 * 指定した ref に紐づくパイプライン記録を削除する。
 *
 * コミットメッセージに `[skip ci]` を付けてもGitLabは status="skipped" のパイプライン記録を
 * 作るため、ブランチやMRを消してもこれだけが test-env に残り続ける。
 * 一覧APIの `ref` フィルタはブランチ名には効くが `refs/merge-requests/<iid>/head` には
 * 効かないので、一覧を取ってから自前で絞り込む。
 */
export async function cleanupPipelinesForRefs(
  conn: TestEnvConnection,
  projectPathSegment: string,
  refs: string[],
): Promise<void> {
  if (refs.length === 0) return;
  try {
    const res = await gitlabApiRequest(
      conn,
      "GET",
      `/projects/${projectPathSegment}/pipelines?per_page=100`,
    );
    if (!res.ok) return;
    const pipelines = (await res.json()) as Array<{ id: number; ref: string }>;
    for (const pipeline of pipelines) {
      if (!refs.includes(pipeline.ref)) continue;
      await gitlabCleanup(
        conn,
        "DELETE",
        `/projects/${projectPathSegment}/pipelines/${pipeline.id}`,
      );
    }
  } catch {
    // クリーンアップの失敗はテスト結果に影響させない。
  }
}
