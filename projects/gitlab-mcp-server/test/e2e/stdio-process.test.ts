/**
 * dist/index.js を実子プロセスとして起動し、test-env/ の実GitLab CEに対して
 * 実stdio JSON-RPC + 実HTTPで疎通確認する（読取系ツール中心）。書込系ツールの検証は
 * test/e2e/write-tools.test.ts を参照。
 *
 * test/helpers/mcp.ts の InMemoryTransport ハーネスは createServer() を同一プロセス内で
 * 直接呼び出し、GitLab側も test/helpers/fetchMock.ts でモックするため、プロセス境界も
 * 実GitLab APIとの疎通も検証しない。このファイルはその両方を実際に跨ぐ。
 *
 * 前提: test-env/setup.sh で起動したセルフホストGitLab（test-env/.env.test の接続情報）が
 * 必要。未起動の場合は明確なエラーメッセージで失敗する（詳細は test-env/README.md）。
 * 実行前に `pnpm run build` で dist/index.js が生成されている必要がある。
 * `pnpm run test:e2e` がビルドしてから実行するため、通常はそちらを使う。
 *
 * ここでのアサーションは test-env/setup.sh が投入するseedデータ（グループ mcp-test /
 * プロジェクト mcp-test/demo、Issue 3件、feature/demo からmainへのMR）に依存する。
 * seedデータの内容を変えた場合はこのファイルも合わせて更新すること。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import { beforeAll, describe, expect, it } from "vitest";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  callTool,
  connectRealProcess,
  ensureServerBuilt,
  firstJson,
  loadTestEnvConnection,
  SERVER_ENTRY,
  type TestEnvConnection,
} from "./helpers/testEnv.js";

let conn: TestEnvConnection;

beforeAll(() => {
  ensureServerBuilt();
  conn = loadTestEnvConnection();
});

describe("実子プロセス（stdio）× test-env実GitLab とのE2E疎通", () => {
  it("dist/index.js を子プロセスとして起動し、tools/list に29ツールが並ぶ", async () => {
    const { client, transport } = await connectRealProcess(conn);
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(29);
      expect(tools.map((t) => t.name)).toContain("gitlab_list_projects");
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("gitlab_get_project がGITLAB_DEFAULT_PROJECT（引数省略）で実GitLabのseedプロジェクトを返す", async () => {
    const { client, transport } = await connectRealProcess(conn);
    try {
      const result = await callTool(client, "gitlab_get_project");
      expect(result.isError).toBeFalsy();
      const project = firstJson<{ path_with_namespace: string; default_branch: string }>(result);
      expect(project.path_with_namespace).toBe(conn.defaultProject);
      expect(project.default_branch).toBe("main");
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("gitlab_list_issues と gitlab_list_issue_notes が test-env/setup.sh のseedデータと一致する", async () => {
    const { client, transport } = await connectRealProcess(conn);
    try {
      const issuesResult = await callTool(client, "gitlab_list_issues", { state: "opened" });
      const issuesPayload = firstJson<{
        items: Array<{ iid: number; title: string; labels: string[] }>;
      }>(issuesResult);
      const bugIssue = issuesPayload.items.find((i) => i.labels.includes("bug"));
      expect(bugIssue?.title).toBe("サンプルIssue: バグ報告");

      const notesResult = await callTool(client, "gitlab_list_issue_notes", {
        issue_iid: bugIssue!.iid,
      });
      const notesPayload = firstJson<{ items: Array<{ body: string }> }>(notesResult);
      expect(notesPayload.items.some((n) => n.body === "検証用コメントです。")).toBe(true);
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("gitlab_list_merge_requests が test-env/setup.sh のseed MRを返す", async () => {
    const { client, transport } = await connectRealProcess(conn);
    try {
      const result = await callTool(client, "gitlab_list_merge_requests", { state: "opened" });
      const payload = firstJson<{
        items: Array<{ title: string; source_branch: string; target_branch: string }>;
      }>(result);
      const demoMr = payload.items.find((mr) => mr.source_branch === "feature/demo");
      expect(demoMr?.target_branch).toBe("main");
      expect(demoMr?.title).toBe("Demo MR: READMEを更新");
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("GITLAB_TOKENが誤っていると実GitLabが401を返し、ツール呼び出しがisErrorになる（トークンは含まれない）", async () => {
    const { client, transport } = await connectRealProcess(conn, {
      GITLAB_TOKEN: "glpat-wrong-token",
    });
    try {
      const result = await callTool(client, "gitlab_get_project");
      expect(result.isError).toBe(true);
      const content = result.content as Array<{ text: string }>;
      expect(content[0]!.text).not.toContain("glpat-wrong-token");
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("GITLAB_TOKEN未設定だと実プロセスは設定エラーで即終了し、接続確立に失敗する", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_ENTRY],
      env: { GITLAB_BASE_URL: conn.baseUrl },
      stderr: "pipe",
    });
    const client = new Client({ name: "e2e-process-client", version: "0.0.0" });

    await expect(client.connect(transport)).rejects.toThrow();
    await transport.close().catch(() => undefined);
  });
});
