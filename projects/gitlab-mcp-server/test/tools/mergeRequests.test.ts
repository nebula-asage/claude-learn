import { afterEach, describe, expect, it, vi } from "vitest";
import { installFetchMock, jsonResponse, pagedResponse } from "../helpers/fetchMock.js";
import { diffFixture, mrFixture, noteFixture } from "../helpers/fixtures.js";
import { connect, errText, okJson, type PagedPayload } from "../helpers/mcp.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gitlab_list_merge_requests", () => {
  it("全フィルタ引数がクエリに乗る", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    const harness = await connect();
    await harness.call("gitlab_list_merge_requests", {
      project: "a/b",
      state: "opened",
      source_branch: "feat/x",
      target_branch: "main",
      author_username: "alice",
    });
    expect(mock.lastQuery()).toMatchObject({
      state: "opened",
      source_branch: "feat/x",
      target_branch: "main",
      author_username: "alice",
    });
    await harness.close();
  });

  it("mrSummary の11キーに整形する", async () => {
    installFetchMock(() => pagedResponse([mrFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<Record<string, unknown>>>(
      await harness.call("gitlab_list_merge_requests", { project: "a/b" }),
    );
    expect(payload.items[0]).toEqual({
      iid: 34,
      title: "機能追加",
      state: "opened",
      source_branch: "feat/x",
      target_branch: "main",
      author: "alice",
      draft: false,
      merge_status: "can_be_merged",
      web_url: "https://gitlab.example.com/grp/sub/proj/-/merge_requests/34",
      created_at: "2026-01-04T00:00:00Z",
      updated_at: "2026-01-05T00:00:00Z",
    });
    await harness.close();
  });
});

describe("gitlab_get_merge_request", () => {
  it("description を追加して返す", async () => {
    installFetchMock(() => jsonResponse(mrFixture({ description: "変更点" })));
    const harness = await connect();
    const payload = okJson<{ description: string }>(
      await harness.call("gitlab_get_merge_request", { project: "a/b", merge_request_iid: 34 }),
    );
    expect(payload.description).toBe("変更点");
    await harness.close();
  });
});

describe("gitlab_get_merge_request_diff", () => {
  it("/diffs エンドポイントを叩く", async () => {
    const mock = installFetchMock(() => jsonResponse([diffFixture()]));
    const harness = await connect();
    await harness.call("gitlab_get_merge_request_diff", { project: "a/b", merge_request_iid: 34 });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/merge_requests/34/diffs");
    await harness.close();
  });

  it("--- old +++ new diff を \\n 連結した形式で返す", async () => {
    installFetchMock(() =>
      jsonResponse([
        diffFixture({ old_path: "a.ts", new_path: "a.ts", diff: "diffA" }),
        diffFixture({ old_path: "b.ts", new_path: "b.ts", diff: "diffB" }),
      ]),
    );
    const harness = await connect();
    const payload = okJson<{ diff: string; file_count: number }>(
      await harness.call("gitlab_get_merge_request_diff", {
        project: "a/b",
        merge_request_iid: 34,
      }),
    );
    expect(payload.diff).toBe("--- a.ts\n+++ a.ts\ndiffA\n--- b.ts\n+++ b.ts\ndiffB");
    expect(payload.file_count).toBe(2);
    await harness.close();
  });

  it("files は5キーで diff 本文を含まない", async () => {
    installFetchMock(() => jsonResponse([diffFixture()]));
    const harness = await connect();
    const payload = okJson<{ files: Array<Record<string, unknown>> }>(
      await harness.call("gitlab_get_merge_request_diff", {
        project: "a/b",
        merge_request_iid: 34,
      }),
    );
    expect(Object.keys(payload.files[0] as object).sort()).toEqual([
      "deleted_file",
      "new_file",
      "new_path",
      "old_path",
      "renamed_file",
    ]);
    await harness.close();
  });

  // 超過分は先頭を残す（head 切り詰め）。description の「超過分は末尾を切り詰める」＝
  // 先頭を残す、と一致する現状仕様。修正する場合はこのテストを意図的に更新すること。
  it("max_bytes 超過時は先頭側が残る（head 切り詰め）", async () => {
    installFetchMock(() =>
      jsonResponse([diffFixture({ old_path: "a", new_path: "a", diff: "0123456789" })]),
    );
    const harness = await connect();
    const payload = okJson<{ diff: string; notice?: string }>(
      await harness.call("gitlab_get_merge_request_diff", {
        project: "a/b",
        merge_request_iid: 34,
        max_bytes: 10,
      }),
    );
    // 連結結果 "--- a\n+++ a\n0123456789" は22バイト。max_bytes=10 の head 切り詰めなので
    // 先頭10バイト分（ヘッダ行の途中まで）が残る。
    expect(payload.diff).toBe("--- a\n+++ ");
    expect(payload.notice).toBeDefined();
    await harness.close();
  });
});

describe("gitlab_list_merge_request_notes", () => {
  it("system:true のノートを除外する", async () => {
    installFetchMock(() =>
      pagedResponse([noteFixture({ id: 1, system: false }), noteFixture({ id: 2, system: true })]),
    );
    const harness = await connect();
    const payload = okJson<PagedPayload<{ id: number }>>(
      await harness.call("gitlab_list_merge_request_notes", {
        project: "a/b",
        merge_request_iid: 34,
      }),
    );
    expect(payload.items.map((n) => n.id)).toEqual([1]);
    await harness.close();
  });
});

describe("gitlab_create_merge_request", () => {
  it("POST /merge_requests を叩く", async () => {
    const mock = installFetchMock(() => jsonResponse(mrFixture()));
    const harness = await connect();
    await harness.call("gitlab_create_merge_request", {
      project: "a/b",
      source_branch: "feat/x",
      target_branch: "main",
      title: "新規MR",
    });
    expect(mock.last().method).toBe("POST");
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/merge_requests");
    await harness.close();
  });

  it("draft:true なら title に 'Draft: ' を前置し、draft フィールド自体は送らない", async () => {
    const mock = installFetchMock(() => jsonResponse(mrFixture()));
    const harness = await connect();
    await harness.call("gitlab_create_merge_request", {
      project: "a/b",
      source_branch: "feat/x",
      target_branch: "main",
      title: "新規MR",
      draft: true,
    });
    expect(mock.last().body).toEqual({
      source_branch: "feat/x",
      target_branch: "main",
      title: "Draft: 新規MR",
    });
    await harness.close();
  });

  it.each([
    ["draft:false", { draft: false }],
    ["draft未指定", {}],
  ])("%s なら title はそのまま送られる", async (_label, extra) => {
    const mock = installFetchMock(() => jsonResponse(mrFixture()));
    const harness = await connect();
    await harness.call("gitlab_create_merge_request", {
      project: "a/b",
      source_branch: "feat/x",
      target_branch: "main",
      title: "素のタイトル",
      ...extra,
    });
    expect((mock.last().body as { title: string }).title).toBe("素のタイトル");
    await harness.close();
  });
});

describe("gitlab_update_merge_request", () => {
  it("PUT で state_event を送る", async () => {
    const mock = installFetchMock(() => jsonResponse(mrFixture()));
    const harness = await connect();
    await harness.call("gitlab_update_merge_request", {
      project: "a/b",
      merge_request_iid: 34,
      state_event: "close",
    });
    expect(mock.last().method).toBe("PUT");
    expect(mock.last().body).toEqual({ state_event: "close" });
    await harness.close();
  });
});

describe("gitlab_create_merge_request_note", () => {
  it("POST /merge_requests/{iid}/notes を叩く", async () => {
    const mock = installFetchMock(() => jsonResponse(noteFixture()));
    const harness = await connect();
    await harness.call("gitlab_create_merge_request_note", {
      project: "a/b",
      merge_request_iid: 34,
      body: "コメント",
    });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/merge_requests/34/notes");
    expect(mock.last().body).toEqual({ body: "コメント" });
    await harness.close();
  });
});

describe("gitlab_read_only - mergeRequests", () => {
  it("readOnly=true では書込3ツールが消える（isError）", async () => {
    const harness = await connect({ gitlabReadOnly: true });
    for (const name of [
      "gitlab_create_merge_request",
      "gitlab_update_merge_request",
      "gitlab_create_merge_request_note",
    ]) {
      const result = await harness.call(name, {
        project: "a/b",
        source_branch: "x",
        target_branch: "main",
        title: "x",
        merge_request_iid: 1,
        body: "x",
      });
      expect(errText(result), name).toBeTruthy();
    }
    await harness.close();
  });
});
