/**
 * 書込系8ツール（create/update/note追加/グループメンバー追加・更新）を、dist/index.js の
 * 実子プロセス経由で test-env/ の実GitLab CEに対して実行するE2Eテスト。
 *
 * 前提は test/e2e/stdio-process.test.ts と同じ（test-env起動済み・pnpm run build済み）。
 * グループメンバー系のテストは test-env/setup.sh が用意する mcp-e2e-member ユーザー
 * （GITLAB_TEST_MEMBER_USER_ID）を使う。
 *
 * gitlab-mcp-server は削除系ツールを意図的に持たない（README参照）ため、各テストが
 * 作った使い捨てデータ（Issue/MR/ブランチ/グループメンバー）は、MCPツールではなく
 * test/e2e/helpers/testEnv.ts の gitlabCleanup で直接GitLab APIを叩いて後始末する。
 * これにより、何度実行しても test-env/ にゴミが積み上がらない。
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
  gitlabApiRequest,
  gitlabCleanup,
  loadTestEnvConnection,
  type TestEnvConnection,
} from "./helpers/testEnv.js";

let conn: TestEnvConnection;
let groupPath: string;
let projectPathSegment: string;

beforeAll(() => {
  ensureServerBuilt();
  conn = loadTestEnvConnection();
  groupPath = conn.defaultProject.split("/")[0]!;
  projectPathSegment = encodeURIComponent(conn.defaultProject);
});

// 各テストで使い捨てるIID/ブランチ名を、実行のたびユニークにするための接尾辞。
const runId = (): string => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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

describe("書込系ツール × test-env実GitLab とのE2E疎通", () => {
  describe("Issue: create → note追加 → close", () => {
    let issueIid: number | undefined;

    afterEach(async () => {
      if (issueIid !== undefined) {
        await gitlabCleanup(conn, "DELETE", `/projects/${projectPathSegment}/issues/${issueIid}`);
        issueIid = undefined;
      }
    });

    it("gitlab_create_issue → gitlab_create_issue_note → gitlab_update_issue(close) が実GitLabに反映される", async () => {
      const client = await openClient();
      const title = `E2E書込テスト Issue ${runId()}`;

      const createResult = await callTool(client, "gitlab_create_issue", {
        title,
        description: "write-tools.test.ts が作成した使い捨てIssueです。",
      });
      expect(createResult.isError).toBeFalsy();
      const created = firstJson<{ iid: number; title: string; state: string }>(createResult);
      issueIid = created.iid;
      expect(created.title).toBe(title);
      expect(created.state).toBe("opened");

      const noteResult = await callTool(client, "gitlab_create_issue_note", {
        issue_iid: issueIid,
        body: "write-tools.test.ts からのコメントです。",
      });
      expect(noteResult.isError).toBeFalsy();
      const note = firstJson<{ body: string }>(noteResult);
      expect(note.body).toBe("write-tools.test.ts からのコメントです。");

      const closeResult = await callTool(client, "gitlab_update_issue", {
        issue_iid: issueIid,
        state_event: "close",
      });
      expect(closeResult.isError).toBeFalsy();
      const closed = firstJson<{ state: string }>(closeResult);
      expect(closed.state).toBe("closed");
    });
  });

  describe("マージリクエスト: 作業ブランチ作成 → create → note追加 → close", () => {
    let mergeRequestIid: number | undefined;
    let branchName: string | undefined;

    afterEach(async () => {
      if (mergeRequestIid !== undefined) {
        await gitlabCleanup(
          conn,
          "DELETE",
          `/projects/${projectPathSegment}/merge_requests/${mergeRequestIid}`,
        );
        mergeRequestIid = undefined;
      }
      if (branchName !== undefined) {
        await gitlabCleanup(
          conn,
          "DELETE",
          `/projects/${projectPathSegment}/repository/branches/${encodeURIComponent(branchName)}`,
        );
        branchName = undefined;
      }
    });

    it("gitlab_create_merge_request → gitlab_create_merge_request_note → gitlab_update_merge_request(close) が実GitLabに反映される", async () => {
      const id = runId();
      branchName = `e2e-write/${id}`;

      // MCPサーバにブランチ作成ツールは無いため、作業ブランチとその上のコミットは
      // 直接GitLab APIで用意する（start_branchでmainから新規ブランチを切りつつ1コミット積む）。
      const commitRes = await gitlabApiRequest(
        conn,
        "POST",
        `/projects/${projectPathSegment}/repository/commits`,
        {
          branch: branchName,
          start_branch: "main",
          commit_message: "E2E write-tools test commit",
          actions: [
            {
              action: "create",
              file_path: `e2e-write-${id}.md`,
              content: Buffer.from(`E2Eテスト用の使い捨てファイルです（${id}）。\n`).toString(
                "base64",
              ),
              encoding: "base64",
            },
          ],
        },
      );
      expect(commitRes.ok).toBe(true);

      const client = await openClient();
      const title = `E2E書込テスト MR ${id}`;

      const createResult = await callTool(client, "gitlab_create_merge_request", {
        source_branch: branchName,
        target_branch: "main",
        title,
        description: "write-tools.test.ts が作成した使い捨てMRです。",
      });
      expect(createResult.isError).toBeFalsy();
      const created = firstJson<{
        iid: number;
        title: string;
        state: string;
        source_branch: string;
        target_branch: string;
      }>(createResult);
      mergeRequestIid = created.iid;
      expect(created.title).toBe(title);
      expect(created.state).toBe("opened");
      expect(created.source_branch).toBe(branchName);
      expect(created.target_branch).toBe("main");

      const noteResult = await callTool(client, "gitlab_create_merge_request_note", {
        merge_request_iid: mergeRequestIid,
        body: "write-tools.test.ts からのコメントです。",
      });
      expect(noteResult.isError).toBeFalsy();
      const note = firstJson<{ body: string }>(noteResult);
      expect(note.body).toBe("write-tools.test.ts からのコメントです。");

      const closeResult = await callTool(client, "gitlab_update_merge_request", {
        merge_request_iid: mergeRequestIid,
        state_event: "close",
      });
      expect(closeResult.isError).toBeFalsy();
      const closed = firstJson<{ state: string }>(closeResult);
      expect(closed.state).toBe("closed");
    });
  });

  describe("グループメンバー: add → update", () => {
    afterEach(async () => {
      await gitlabCleanup(
        conn,
        "DELETE",
        `/groups/${encodeURIComponent(groupPath)}/members/${conn.testMemberUserId}`,
      );
    });

    it("gitlab_add_group_member → gitlab_update_group_member が実GitLabに反映される", async () => {
      const client = await openClient();

      const addResult = await callTool(client, "gitlab_add_group_member", {
        group: groupPath,
        user_id: conn.testMemberUserId,
        access_level: 30,
      });
      expect(addResult.isError).toBeFalsy();
      const added = firstJson<{ access_level: number; access_level_name: string }>(addResult);
      expect(added.access_level).toBe(30);
      expect(added.access_level_name).toBe("Developer");

      const updateResult = await callTool(client, "gitlab_update_group_member", {
        group: groupPath,
        user_id: conn.testMemberUserId,
        access_level: 40,
      });
      expect(updateResult.isError).toBeFalsy();
      const updated = firstJson<{ access_level: number; access_level_name: string }>(updateResult);
      expect(updated.access_level).toBe(40);
      expect(updated.access_level_name).toBe("Maintainer");
    });
  });
});
