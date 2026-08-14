/**
 * MCP_TRANSPORT=http で dist/index.js を実子プロセスとして起動し、Streamable HTTP 経由で
 * test-env/ の実GitLab CEに疎通するE2Eテスト。stdio版は test/e2e/stdio-process.test.ts。
 *
 * test/transports/http.test.ts は runHttp() を同一プロセス内で呼び、GitLab側もモックするため、
 * 「実プロセスが MCP_TRANSPORT / MCP_HTTP_* を読んでHTTPで起動し、その先で実GitLabを叩く」
 * という経路は検証していない。このファイルがその経路を通す。
 *
 * 前提は test/e2e/stdio-process.test.ts と同じ（test-env起動済み・pnpm run build済み）。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  callTool,
  ensureServerBuilt,
  firstJson,
  gitlabCleanup,
  loadTestEnvConnection,
  startRealHttpProcess,
  type HttpServerProcess,
  type TestEnvConnection,
} from "./helpers/testEnv.js";

let conn: TestEnvConnection;
let server: HttpServerProcess;
let projectPathSegment: string;

// 子プロセスの起動は重いので、認証なしのサーバーは1つだけ立てて全テストで使い回す。
beforeAll(async () => {
  ensureServerBuilt();
  conn = loadTestEnvConnection();
  projectPathSegment = encodeURIComponent(conn.defaultProject);
  server = await startRealHttpProcess(conn);
});

afterAll(async () => {
  await server.stop();
});

let openClients: Client[] = [];

afterEach(async () => {
  for (const client of openClients) {
    await client.close().catch(() => undefined);
  }
  openClients = [];
});

async function openClient(): Promise<Client> {
  const client = new Client({ name: "e2e-http-client", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${server.baseUrl}/mcp`)));
  openClients.push(client);
  return client;
}

describe("実子プロセス（Streamable HTTP）× test-env実GitLab とのE2E疎通", () => {
  it("/healthz が 200 で {status:'ok'} を返す", async () => {
    const res = await fetch(`${server.baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("HTTP経由の tools/list がツール一覧を返す", async () => {
    const client = await openClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("gitlab_list_projects");
    expect(names).toContain("gitlab_create_issue");
  });

  it("読取: gitlab_get_project がGITLAB_DEFAULT_PROJECT（引数省略）で実GitLabのseedプロジェクトを返す", async () => {
    const client = await openClient();
    const result = await callTool(client, "gitlab_get_project");
    expect(result.isError).toBeFalsy();
    const project = firstJson<{ path_with_namespace: string; default_branch: string }>(result);
    expect(project.path_with_namespace).toBe(conn.defaultProject);
    expect(project.default_branch).toBe("main");
  });

  describe("書込", () => {
    let issueIid: number | undefined;

    afterEach(async () => {
      if (issueIid !== undefined) {
        await gitlabCleanup(conn, "DELETE", `/projects/${projectPathSegment}/issues/${issueIid}`);
        issueIid = undefined;
      }
    });

    it("gitlab_create_issue → gitlab_update_issue(close) がHTTP経路でも実GitLabに反映される", async () => {
      const client = await openClient();
      const title = `E2E HTTP書込テスト Issue ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const createResult = await callTool(client, "gitlab_create_issue", {
        title,
        description: "http-process.test.ts が作成した使い捨てIssueです。",
      });
      expect(createResult.isError).toBeFalsy();
      const created = firstJson<{ iid: number; title: string; state: string }>(createResult);
      issueIid = created.iid;
      expect(created.title).toBe(title);
      expect(created.state).toBe("opened");

      const closeResult = await callTool(client, "gitlab_update_issue", {
        issue_iid: issueIid,
        state_event: "close",
      });
      expect(closeResult.isError).toBeFalsy();
      expect(firstJson<{ state: string }>(closeResult).state).toBe("closed");
    });
  });

  it("MCP_HTTP_AUTH_TOKEN を設定した実プロセスは、Bearer無しの POST /mcp を401で拒否する", async () => {
    const authServer = await startRealHttpProcess(conn, { MCP_HTTP_AUTH_TOKEN: "e2e-secret" });
    try {
      const res = await fetch(`${authServer.baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe("Bearer");
    } finally {
      await authServer.stop();
    }
  });
});
