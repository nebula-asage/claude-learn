/**
 * AGENTS.md が明記する不変条件を実行可能な形で固定する。
 * 新規ツールを追加した際は MINIMAL_ARGS を更新しないと「網羅している」テストが落ちる
 * ため、新ツールにも自動的にこれらの不変条件が適用される。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFetchMock, jsonResponse, textResponse, timeoutError } from "./helpers/fetchMock.js";
import { connect, errText } from "./helpers/mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "../src");

/** 全29ツールを最小限の引数で1回ずつ呼べるようにするテーブル。project/group は encodeId 検証を兼ねて / とスペースを含む値にする。 */
const MINIMAL_ARGS: Record<string, Record<string, unknown>> = {
  gitlab_list_projects: {},
  gitlab_get_project: { project: "grp/sub proj" },
  gitlab_list_repository_tree: { project: "grp/sub proj" },
  gitlab_get_file_content: { project: "grp/sub proj", file_path: "src/a b.ts" },
  gitlab_list_branches: { project: "grp/sub proj" },
  gitlab_list_commits: { project: "grp/sub proj" },
  gitlab_search_code: { project: "grp/sub proj", search: "TODO" },
  gitlab_list_issues: { project: "grp/sub proj" },
  gitlab_get_issue: { project: "grp/sub proj", issue_iid: 12 },
  gitlab_list_issue_notes: { project: "grp/sub proj", issue_iid: 12 },
  gitlab_create_issue: { project: "grp/sub proj", title: "t" },
  gitlab_update_issue: { project: "grp/sub proj", issue_iid: 12 },
  gitlab_create_issue_note: { project: "grp/sub proj", issue_iid: 12, body: "b" },
  gitlab_list_merge_requests: { project: "grp/sub proj" },
  gitlab_get_merge_request: { project: "grp/sub proj", merge_request_iid: 34 },
  gitlab_get_merge_request_diff: { project: "grp/sub proj", merge_request_iid: 34 },
  gitlab_list_merge_request_notes: { project: "grp/sub proj", merge_request_iid: 34 },
  gitlab_create_merge_request: {
    project: "grp/sub proj",
    source_branch: "feat/x",
    target_branch: "main",
    title: "t",
  },
  gitlab_update_merge_request: { project: "grp/sub proj", merge_request_iid: 34 },
  gitlab_create_merge_request_note: { project: "grp/sub proj", merge_request_iid: 34, body: "b" },
  gitlab_list_pipelines: { project: "grp/sub proj" },
  gitlab_get_pipeline: { project: "grp/sub proj", pipeline_id: 5001 },
  gitlab_list_pipeline_jobs: { project: "grp/sub proj", pipeline_id: 5001 },
  gitlab_get_job_log: { project: "grp/sub proj", job_id: 6001 },
  gitlab_list_groups: {},
  gitlab_get_group: { group: "top/sub grp" },
  gitlab_list_group_members: { group: "top/sub grp" },
  gitlab_add_group_member: { group: "top/sub grp", user_id: 7, access_level: 30 },
  gitlab_update_group_member: { group: "top/sub grp", user_id: 7, access_level: 30 },
};

/** /projects/{id} または /groups/{id} セグメントのエンコード検証から除外するツール（project/group 引数自体を持たない）。 */
const ENCODE_CHECK_EXCLUDED = new Set(["gitlab_list_projects", "gitlab_list_groups"]);

afterEach(() => {
  vi.unstubAllGlobals();
});

it("引数テーブルが tools/list の全ツールを網羅している", async () => {
  const harness = await connect();
  const tools = await harness.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual(Object.keys(MINIMAL_ARGS).sort());
  await harness.close();
});

describe("不変条件1: GitLabApiError のメッセージにトークンを含めない", () => {
  it.each([
    ["500 + 非JSON本文", () => textResponse("internal error", { status: 500 })],
    [
      "fetchの一般例外",
      () => {
        throw new Error("ECONNREFUSED");
      },
    ],
    [
      "タイムアウト",
      () => {
        throw timeoutError();
      },
    ],
  ])("%s のとき、全29ツールの出力にトークンが混入しない", async (_label, responder) => {
    installFetchMock(responder as () => Response);
    const harness = await connect();
    for (const [name, args] of Object.entries(MINIMAL_ARGS)) {
      const result = await harness.call(name, args);
      const text = errText(result);
      expect(text, name).not.toContain("glpat-SUPER-SECRET-TOKEN");
      expect(text, name).not.toMatch(/PRIVATE-TOKEN/i);
    }
    await harness.close();
  });
});

describe("不変条件3: URLパスへの埋め込みは必ずエンコードを通す", () => {
  it("project/group引数を持つ全ツールで /projects/ または /groups/ 直後のセグメントが正しくエンコードされる", async () => {
    // レスポンス形状の正しさは他のテストで検証済み。ここでは fetch に渡された URL だけを見るため、
    // 常に空配列を返す寛容なレスポンダで十分（後続の整形処理が失敗しても記録済みのURLは変わらない）。
    const mock = installFetchMock(() => jsonResponse([]));
    const harness = await connect();
    for (const [name, args] of Object.entries(MINIMAL_ARGS)) {
      await harness.call(name, args);
    }
    await harness.close();

    const names = Object.keys(MINIMAL_ARGS);
    expect(mock.calls).toHaveLength(names.length);

    for (let i = 0; i < names.length; i++) {
      const name = names[i]!;
      if (ENCODE_CHECK_EXCLUDED.has(name)) continue;
      const pathname = mock.calls[i]!.url.pathname;
      const match = /^\/api\/v4\/(projects|groups)\/([^/]+)/.exec(pathname);
      expect(match, `${name}: ${pathname}`).not.toBeNull();
      const [, resource, segment] = match!;
      const expected = resource === "groups" ? "top%2Fsub%20grp" : "grp%2Fsub%20proj";
      expect(segment, name).toBe(expected);
      expect(segment, name).not.toContain("/");
      expect(segment, name).not.toContain(" ");
    }
  });
});

describe("不変条件2: stdioモードで console.log を使わない", () => {
  it("静的チェック: src配下のソースに console.log 呼び出しが無い", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
          // コメント中の「console.log を使わない」といった説明文を誤検知しないよう、
          // ブロックコメント・行コメントを除去してから検査する。
          const content = fs
            .readFileSync(full, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");
          if (/console\s*\.\s*log\s*\(/.test(content)) {
            offenders.push(full);
          }
        }
      }
    };
    walk(SRC_DIR);
    expect(offenders).toEqual([]);
  });

  it("動的チェック: tools/list や tools/call を実行しても process.stdout.write が呼ばれない", async () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      installFetchMock(() => jsonResponse([]));
      const harness = await connect();
      await harness.listTools();
      await harness.call("gitlab_list_projects", {});
      await harness.call("gitlab_get_issue", { project: "a/b", issue_iid: 1 }); // 失敗するケースも含める
      await harness.close();
    } finally {
      spy.mockRestore();
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("不変条件5: 破壊的操作（マージ・削除）はスコープ外", () => {
  it("ツール名に delete/destroy/merge実行/accept を含むものが無い", async () => {
    const harness = await connect();
    const names = (await harness.listTools()).map((t) => t.name);
    for (const name of names) {
      expect(name).not.toMatch(/delete|destroy|_merge$|accept/i);
    }
    await harness.close();
  });

  it("全29ツール実行時、fetchのHTTPメソッドは GET/POST/PUT のみで DELETE/PATCH は発生しない", async () => {
    const mock = installFetchMock(() => jsonResponse([]));
    const harness = await connect();
    for (const [name, args] of Object.entries(MINIMAL_ARGS)) {
      await harness.call(name, args);
    }
    await harness.close();

    const methods = new Set(mock.calls.map((c) => c.method));
    for (const method of methods) {
      expect(["GET", "POST", "PUT"]).toContain(method);
    }
  });
});
