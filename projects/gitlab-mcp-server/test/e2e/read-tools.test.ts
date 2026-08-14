/**
 * test/e2e/stdio-process.test.ts で未カバーの読取専用ツールを、test-env/ の実GitLab CEに
 * 対して実子プロセス経由で検証する。書込系ツールは test/e2e/write-tools.test.ts を参照。
 *
 * 前提は test/e2e/stdio-process.test.ts と同じ（test-env起動済み・pnpm run build済み）。
 * アサーションは test-env/setup.sh が投入するseedデータ（プロジェクト mcp-test/demo、
 * Issue「サンプルIssue: バグ報告」、feature/demoからmainへのMR、.gitlab-ci.ymlによる
 * パイプライン、グループ mcp-test）に依存する。seedデータを変えたらこのファイルも
 * 合わせて更新すること。
 *
 * 注意: gitlab_search_code は project を省略するとインスタンス全体検索になり、
 * Elasticsearchを使わないGitLab CEでは400になる（"scope does not have a valid value"）。
 * そのため、このファイルでは project を明示的に渡す。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  callTool,
  connectRealProcess,
  ensureServerBuilt,
  firstJson,
  loadTestEnvConnection,
  type TestEnvConnection,
} from "./helpers/testEnv.js";

let conn: TestEnvConnection;
let groupPath: string;

beforeAll(() => {
  ensureServerBuilt();
  conn = loadTestEnvConnection();
  groupPath = conn.defaultProject.split("/")[0]!;
});

let openClients: Array<{ client: Client; transport: StdioClientTransport }> = [];

afterEach(async () => {
  for (const { client, transport } of openClients) {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
  openClients = [];
});

async function openClient(): Promise<Client> {
  const pair = await connectRealProcess(conn);
  openClients.push(pair);
  return pair.client;
}

describe("読取系ツール（未カバー分） × test-env実GitLab とのE2E疎通", () => {
  describe("リポジトリ / ファイル参照", () => {
    it("gitlab_list_projects がseedプロジェクトを含む一覧を返す", async () => {
      const client = await openClient();
      const result = await callTool(client, "gitlab_list_projects", { search: "demo" });
      expect(result.isError).toBeFalsy();
      const payload = firstJson<{ items: Array<{ path_with_namespace: string }> }>(result);
      expect(payload.items.some((p) => p.path_with_namespace === conn.defaultProject)).toBe(true);
    });

    it("gitlab_list_repository_tree がmainのファイル一覧を返す", async () => {
      const client = await openClient();
      const result = await callTool(client, "gitlab_list_repository_tree");
      expect(result.isError).toBeFalsy();
      const payload = firstJson<{ items: Array<{ path: string }> }>(result);
      const paths = payload.items.map((i) => i.path);
      expect(paths).toContain("README.md");
      expect(paths).toContain(".gitlab-ci.yml");
    });

    it("gitlab_get_file_content がREADME.mdの内容をデコード済みで返す", async () => {
      const client = await openClient();
      const result = await callTool(client, "gitlab_get_file_content", {
        file_path: "README.md",
      });
      expect(result.isError).toBeFalsy();
      const payload = firstJson<{ file_path: string; content: string }>(result);
      expect(payload.file_path).toBe("README.md");
      expect(payload.content).toContain("demo");
    });

    it("gitlab_list_branches がmainとfeature/demoを返す", async () => {
      const client = await openClient();
      const result = await callTool(client, "gitlab_list_branches");
      expect(result.isError).toBeFalsy();
      const payload = firstJson<{ items: Array<{ name: string }> }>(result);
      const names = payload.items.map((b) => b.name);
      expect(names).toContain("main");
      expect(names).toContain("feature/demo");
    });

    it("gitlab_list_commits がmainのコミット履歴を返す", async () => {
      const client = await openClient();
      const result = await callTool(client, "gitlab_list_commits");
      expect(result.isError).toBeFalsy();
      const payload = firstJson<{ items: Array<{ title: string }> }>(result);
      expect(payload.items.some((c) => c.title === "Add .gitlab-ci.yml for testing")).toBe(true);
    });

    it("gitlab_search_code がプロジェクト内のキーワード一致を返す（projectを明示指定）", async () => {
      const client = await openClient();
      const result = await callTool(client, "gitlab_search_code", {
        project: conn.defaultProject,
        search: "demo",
      });
      expect(result.isError).toBeFalsy();
      const payload = firstJson<{ items: Array<{ path: string }> }>(result);
      expect(payload.items.length).toBeGreaterThan(0);
    });
  });

  describe("Issue", () => {
    it("gitlab_get_issue がseed Issueの詳細を返す", async () => {
      const client = await openClient();
      const listResult = await callTool(client, "gitlab_list_issues", { state: "opened" });
      const listPayload = firstJson<{ items: Array<{ iid: number; labels: string[] }> }>(
        listResult,
      );
      const bugIssue = listPayload.items.find((i) => i.labels.includes("bug"));

      const result = await callTool(client, "gitlab_get_issue", { issue_iid: bugIssue!.iid });
      expect(result.isError).toBeFalsy();
      const issue = firstJson<{ title: string }>(result);
      expect(issue.title).toBe("サンプルIssue: バグ報告");
    });
  });

  describe("マージリクエスト", () => {
    it("gitlab_get_merge_request / gitlab_get_merge_request_diff / gitlab_list_merge_request_notes がseed MRに対して成功する", async () => {
      const client = await openClient();
      const listResult = await callTool(client, "gitlab_list_merge_requests", {
        state: "opened",
      });
      const listPayload = firstJson<{ items: Array<{ iid: number; source_branch: string }> }>(
        listResult,
      );
      const demoMr = listPayload.items.find((mr) => mr.source_branch === "feature/demo");

      const getResult = await callTool(client, "gitlab_get_merge_request", {
        merge_request_iid: demoMr!.iid,
      });
      expect(getResult.isError).toBeFalsy();
      const mr = firstJson<{ title: string }>(getResult);
      expect(mr.title).toBe("Demo MR: READMEを更新");

      const diffResult = await callTool(client, "gitlab_get_merge_request_diff", {
        merge_request_iid: demoMr!.iid,
      });
      expect(diffResult.isError).toBeFalsy();
      const diff = firstJson<{ file_count: number; files: Array<{ new_path: string }> }>(
        diffResult,
      );
      expect(diff.file_count).toBeGreaterThan(0);
      expect(diff.files.some((f) => f.new_path === "README.md")).toBe(true);

      const notesResult = await callTool(client, "gitlab_list_merge_request_notes", {
        merge_request_iid: demoMr!.iid,
      });
      expect(notesResult.isError).toBeFalsy();
      const notes = firstJson<{ items: unknown[] }>(notesResult);
      expect(Array.isArray(notes.items)).toBe(true);
    });
  });

  describe("CI / パイプライン", () => {
    it("gitlab_list_pipelines → gitlab_get_pipeline → gitlab_list_pipeline_jobs → gitlab_get_job_log が一連で成功する", async () => {
      const client = await openClient();

      const listResult = await callTool(client, "gitlab_list_pipelines", { ref: "main" });
      expect(listResult.isError).toBeFalsy();
      const listPayload = firstJson<{ items: Array<{ id: number }> }>(listResult);
      expect(listPayload.items.length).toBeGreaterThan(0);
      const pipelineId = listPayload.items[0]!.id;

      const getResult = await callTool(client, "gitlab_get_pipeline", {
        pipeline_id: pipelineId,
      });
      expect(getResult.isError).toBeFalsy();
      const pipeline = firstJson<{ id: number }>(getResult);
      expect(pipeline.id).toBe(pipelineId);

      const jobsResult = await callTool(client, "gitlab_list_pipeline_jobs", {
        pipeline_id: pipelineId,
      });
      expect(jobsResult.isError).toBeFalsy();
      const jobsPayload = firstJson<{ items: Array<{ id: number; name: string }> }>(jobsResult);
      const failJob = jobsPayload.items.find((j) => j.name === "test_job_fail");
      expect(failJob).toBeDefined();

      const logResult = await callTool(client, "gitlab_get_job_log", { job_id: failJob!.id });
      expect(logResult.isError).toBeFalsy();
      const log = firstJson<{ log: string }>(logResult);
      expect(log.log).toContain("intentional failure");
    });
  });

  describe("グループ", () => {
    it("gitlab_list_groups → gitlab_get_group → gitlab_list_group_members が一連で成功する", async () => {
      const client = await openClient();

      const listResult = await callTool(client, "gitlab_list_groups", { search: groupPath });
      expect(listResult.isError).toBeFalsy();
      const listPayload = firstJson<{ items: Array<{ full_path: string }> }>(listResult);
      expect(listPayload.items.some((g) => g.full_path === groupPath)).toBe(true);

      const getResult = await callTool(client, "gitlab_get_group", { group: groupPath });
      expect(getResult.isError).toBeFalsy();
      const group = firstJson<{ full_path: string }>(getResult);
      expect(group.full_path).toBe(groupPath);

      const membersResult = await callTool(client, "gitlab_list_group_members", {
        group: groupPath,
      });
      expect(membersResult.isError).toBeFalsy();
      const members = firstJson<{ items: Array<{ username: string }> }>(membersResult);
      expect(members.items.some((m) => m.username === "root")).toBe(true);
    });
  });
});
