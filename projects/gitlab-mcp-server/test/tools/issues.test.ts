import { afterEach, describe, expect, it, vi } from "vitest";
import { installFetchMock, jsonResponse, pagedResponse } from "../helpers/fetchMock.js";
import { issueFixture, noteFixture } from "../helpers/fixtures.js";
import { connect, errText, okJson, type PagedPayload } from "../helpers/mcp.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gitlab_list_issues", () => {
  it("全フィルタ引数がクエリに乗る", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    const harness = await connect();
    await harness.call("gitlab_list_issues", {
      project: "a/b",
      state: "opened",
      labels: "bug,urgent",
      assignee_username: "alice",
      milestone: "v1.0",
      search: "crash",
    });
    expect(mock.lastQuery()).toMatchObject({
      state: "opened",
      labels: "bug,urgent",
      assignee_username: "alice",
      milestone: "v1.0",
      search: "crash",
    });
    await harness.close();
  });

  it("issueSummary の10キーに整形する", async () => {
    installFetchMock(() => pagedResponse([issueFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<Record<string, unknown>>>(
      await harness.call("gitlab_list_issues", { project: "a/b" }),
    );
    expect(payload.items[0]).toEqual({
      iid: 12,
      title: "バグ報告",
      state: "opened",
      labels: ["bug"],
      author: "alice",
      assignees: ["alice", "bob"],
      milestone: "v1.0",
      web_url: "https://gitlab.example.com/grp/sub/proj/-/issues/12",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });
    await harness.close();
  });

  it("milestone が null なら null のまま返る", async () => {
    installFetchMock(() => pagedResponse([issueFixture({ milestone: null })]));
    const harness = await connect();
    const payload = okJson<PagedPayload<{ milestone: unknown }>>(
      await harness.call("gitlab_list_issues", { project: "a/b" }),
    );
    expect(payload.items[0]?.milestone).toBeNull();
    await harness.close();
  });
});

describe("gitlab_get_issue", () => {
  it("/issues/{iid} を叩き description を追加した11キーを返す", async () => {
    const mock = installFetchMock(() => jsonResponse(issueFixture({ description: "詳細本文" })));
    const harness = await connect();
    const payload = okJson<Record<string, unknown>>(
      await harness.call("gitlab_get_issue", { project: "a/b", issue_iid: 12 }),
    );
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/issues/12");
    expect(payload.description).toBe("詳細本文");
    expect(Object.keys(payload)).toHaveLength(11);
    await harness.close();
  });
});

describe("gitlab_list_issue_notes", () => {
  it("/issues/{iid}/notes を叩き system:true のノートを除外する", async () => {
    const mock = installFetchMock(() =>
      pagedResponse([
        noteFixture({ id: 1, system: false }),
        noteFixture({ id: 2, system: true }),
        noteFixture({ id: 3, system: false }),
      ]),
    );
    const harness = await connect();
    const payload = okJson<PagedPayload<{ id: number }>>(
      await harness.call("gitlab_list_issue_notes", { project: "a/b", issue_iid: 12 }),
    );
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/issues/12/notes");
    expect(payload.items.map((n) => n.id)).toEqual([1, 3]);
    await harness.close();
  });

  // system ノート除外はページング取得後に行われるため、items.length が
  // pageInfo.perPage と一致しなくなる。これは現状仕様として固定する。
  it("system 除外により items.length が perPage と不一致になり得る", async () => {
    installFetchMock(() =>
      pagedResponse(
        [
          noteFixture({ id: 1, system: true }),
          noteFixture({ id: 2, system: true }),
          noteFixture({ id: 3, system: false }),
        ],
        { "x-page": "1", "x-per-page": "20" },
      ),
    );
    const harness = await connect();
    const payload = okJson<PagedPayload<unknown>>(
      await harness.call("gitlab_list_issue_notes", { project: "a/b", issue_iid: 12 }),
    );
    expect(payload.items).toHaveLength(1);
    expect(payload.pageInfo.perPage).toBe(20);
    await harness.close();
  });

  it("ノートは4キー（id/author/body/created_at）に整形される", async () => {
    installFetchMock(() => pagedResponse([noteFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<Record<string, unknown>>>(
      await harness.call("gitlab_list_issue_notes", { project: "a/b", issue_iid: 12 }),
    );
    expect(Object.keys(payload.items[0] as object).sort()).toEqual([
      "author",
      "body",
      "created_at",
      "id",
    ]);
    await harness.close();
  });
});

describe("gitlab_create_issue", () => {
  it("POST /issues に title/description/labels/assignee_ids を送る", async () => {
    const mock = installFetchMock(() => jsonResponse(issueFixture()));
    const harness = await connect();
    await harness.call("gitlab_create_issue", {
      project: "a/b",
      title: "新規Issue",
      description: "本文",
      labels: "bug",
      assignee_ids: [1, 2],
    });
    expect(mock.last().method).toBe("POST");
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/issues");
    expect(mock.last().body).toEqual({
      title: "新規Issue",
      description: "本文",
      labels: "bug",
      assignee_ids: [1, 2],
    });
    await harness.close();
  });

  it("未指定フィールドは JSON.stringify によりボディから消える", async () => {
    const mock = installFetchMock(() => jsonResponse(issueFixture()));
    const harness = await connect();
    await harness.call("gitlab_create_issue", { project: "a/b", title: "最小構成" });
    expect(mock.last().body).toEqual({ title: "最小構成" });
    await harness.close();
  });
});

describe("gitlab_update_issue", () => {
  it("PUT /issues/{iid} で state_event のみ指定時はそれだけを送る", async () => {
    const mock = installFetchMock(() => jsonResponse(issueFixture()));
    const harness = await connect();
    await harness.call("gitlab_update_issue", {
      project: "a/b",
      issue_iid: 12,
      state_event: "close",
    });
    expect(mock.last().method).toBe("PUT");
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/issues/12");
    expect(mock.last().body).toEqual({ state_event: "close" });
    await harness.close();
  });
});

describe("gitlab_create_issue_note", () => {
  it("POST /issues/{iid}/notes にボディは body のみを送る", async () => {
    const mock = installFetchMock(() => jsonResponse(noteFixture()));
    const harness = await connect();
    await harness.call("gitlab_create_issue_note", {
      project: "a/b",
      issue_iid: 12,
      body: "コメント",
    });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/issues/12/notes");
    expect(mock.last().body).toEqual({ body: "コメント" });
    await harness.close();
  });
});

describe("gitlab_read_only", () => {
  it("readOnly=true では書込3ツールが isError（ツール未登録）になる", async () => {
    const harness = await connect({ gitlabReadOnly: true });
    for (const name of ["gitlab_create_issue", "gitlab_update_issue", "gitlab_create_issue_note"]) {
      const result = await harness.call(name, {
        project: "a/b",
        title: "x",
        issue_iid: 1,
        body: "x",
      });
      expect(errText(result), name).toBeTruthy();
    }
    await harness.close();
  });

  it("readOnly=true でも読取3ツールは動く", async () => {
    installFetchMock((call) =>
      call.url.pathname.endsWith("/issues/12")
        ? jsonResponse(issueFixture())
        : pagedResponse([issueFixture()]),
    );
    const harness = await connect({ gitlabReadOnly: true });
    for (const name of ["gitlab_list_issues", "gitlab_get_issue", "gitlab_list_issue_notes"]) {
      const result = await harness.call(name, { project: "a/b", issue_iid: 12 });
      expect(result.isError, name).not.toBe(true);
    }
    await harness.close();
  });
});

describe("gitlab_get_issue - 入力バリデーション", () => {
  it("issue_iid: 0 は isError になる", async () => {
    const harness = await connect();
    const result = await harness.call("gitlab_get_issue", { project: "a/b", issue_iid: 0 });
    expect(result.isError).toBe(true);
    await harness.close();
  });

  it("issue_iid: 1.5 は isError になる", async () => {
    const harness = await connect();
    const result = await harness.call("gitlab_get_issue", { project: "a/b", issue_iid: 1.5 });
    expect(result.isError).toBe(true);
    await harness.close();
  });
});
