import { afterEach, describe, expect, it, vi } from "vitest";
import { installFetchMock, jsonResponse, pagedResponse } from "../helpers/fetchMock.js";
import {
  branchFixture,
  commitFixture,
  fileFixture,
  projectFixture,
  searchBlobFixture,
  treeItemFixture,
} from "../helpers/fixtures.js";
import { connect, okJson, type PagedPayload } from "../helpers/mcp.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gitlab_list_projects", () => {
  it("simple=true を固定で付け、search/membership をクエリに載せる", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    const harness = await connect();
    await harness.call("gitlab_list_projects", { search: "foo", membership: true });
    expect(mock.lastQuery()).toMatchObject({ simple: "true", search: "foo", membership: "true" });
    await harness.close();
  });

  it("6キーに整形し visibility 等は落ちる", async () => {
    installFetchMock(() => pagedResponse([projectFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<unknown>>(await harness.call("gitlab_list_projects", {}));
    expect(payload.items[0]).toEqual({
      id: 42,
      path_with_namespace: "grp/sub/proj",
      name: "proj",
      description: "説明文",
      default_branch: "main",
      web_url: "https://gitlab.example.com/grp/sub/proj",
    });
    await harness.close();
  });

  it("pageInfo は page/perPage/totalItems/totalPages/hasNextPage/nextPage の形", async () => {
    installFetchMock(() =>
      pagedResponse([], {
        "x-page": "1",
        "x-per-page": "20",
        "x-total": "1",
        "x-total-pages": "1",
      }),
    );
    const harness = await connect();
    const payload = okJson<PagedPayload<unknown>>(await harness.call("gitlab_list_projects", {}));
    expect(payload.pageInfo).toEqual({
      page: 1,
      perPage: 20,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
    });
    await harness.close();
  });
});

describe("gitlab_get_project", () => {
  it("/projects/{encoded} を叩く", async () => {
    const mock = installFetchMock(() => jsonResponse(projectFixture()));
    const harness = await connect();
    await harness.call("gitlab_get_project", { project: "grp/sub proj" });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/grp%2Fsub%20proj");
    await harness.close();
  });

  it("生レスポンスをそのまま返す唯一の非整形ツール", async () => {
    installFetchMock(() => jsonResponse(projectFixture({ visibility: "internal" })));
    const harness = await connect();
    const payload = okJson<{ visibility: string }>(
      await harness.call("gitlab_get_project", { project: "a/b" }),
    );
    expect(payload.visibility).toBe("internal");
    await harness.close();
  });
});

describe("gitlab_list_repository_tree", () => {
  it("path/ref/recursive がクエリに乗り items は無加工で返る", async () => {
    const mock = installFetchMock(() => pagedResponse([treeItemFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<unknown>>(
      await harness.call("gitlab_list_repository_tree", {
        project: "a/b",
        path: "src",
        ref: "main",
        recursive: true,
      }),
    );
    expect(mock.lastQuery()).toMatchObject({ path: "src", ref: "main", recursive: "true" });
    expect(payload.items[0]).toEqual(treeItemFixture());
    await harness.close();
  });
});

describe("gitlab_get_file_content", () => {
  it("ref 未指定時は ref=HEAD を送る", async () => {
    const mock = installFetchMock(() => jsonResponse(fileFixture()));
    const harness = await connect();
    await harness.call("gitlab_get_file_content", { project: "a/b", file_path: "src/index.ts" });
    expect(mock.lastQuery().ref).toBe("HEAD");
    await harness.close();
  });

  it("ref 指定時はその値を送る", async () => {
    const mock = installFetchMock(() => jsonResponse(fileFixture()));
    const harness = await connect();
    await harness.call("gitlab_get_file_content", {
      project: "a/b",
      file_path: "src/index.ts",
      ref: "feature",
    });
    expect(mock.lastQuery().ref).toBe("feature");
    await harness.close();
  });

  it("file_path はパスセグメントとしてエンコードされる", async () => {
    const mock = installFetchMock(() => jsonResponse(fileFixture()));
    const harness = await connect();
    await harness.call("gitlab_get_file_content", { project: "a/b", file_path: "src/a b.ts" });
    expect(mock.last().url.pathname).toContain("src%2Fa%20b.ts");
    await harness.close();
  });

  it("encoding=base64 ならデコードして content に入れる", async () => {
    installFetchMock(() =>
      jsonResponse(
        fileFixture({ encoding: "base64", content: Buffer.from("hello").toString("base64") }),
      ),
    );
    const harness = await connect();
    const payload = okJson<{ content: string }>(
      await harness.call("gitlab_get_file_content", { project: "a/b", file_path: "x" }),
    );
    expect(payload.content).toBe("hello");
    await harness.close();
  });

  it("encoding=text ならデコードせずそのまま返す", async () => {
    installFetchMock(() => jsonResponse(fileFixture({ encoding: "text", content: "raw text" })));
    const harness = await connect();
    const payload = okJson<{ content: string }>(
      await harness.call("gitlab_get_file_content", { project: "a/b", file_path: "x" }),
    );
    expect(payload.content).toBe("raw text");
    await harness.close();
  });

  it("max_bytes 超過時は notice を付ける", async () => {
    installFetchMock(() =>
      jsonResponse(fileFixture({ encoding: "text", content: "0123456789", size: 10 })),
    );
    const harness = await connect();
    const payload = okJson<{ content: string; notice?: string }>(
      await harness.call("gitlab_get_file_content", {
        project: "a/b",
        file_path: "x",
        max_bytes: 4,
      }),
    );
    expect(payload.content).toBe("0123");
    expect(payload.notice).toContain("10");
    expect(payload.notice).toContain("4");
    await harness.close();
  });

  it("max_bytes 未超過なら notice キー自体が無い", async () => {
    installFetchMock(() => jsonResponse(fileFixture({ encoding: "text", content: "abc" })));
    const harness = await connect();
    const payload = okJson<Record<string, unknown>>(
      await harness.call("gitlab_get_file_content", { project: "a/b", file_path: "x" }),
    );
    expect("notice" in payload).toBe(false);
    await harness.close();
  });
});

describe("gitlab_list_branches", () => {
  it("search がクエリに乗り、6キーに整形される", async () => {
    const mock = installFetchMock(() => pagedResponse([branchFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<unknown>>(
      await harness.call("gitlab_list_branches", { project: "a/b", search: "feat" }),
    );
    expect(mock.lastQuery().search).toBe("feat");
    expect(payload.items[0]).toEqual({
      name: "main",
      default: true,
      protected: true,
      merged: false,
      web_url: "https://gitlab.example.com/grp/sub/proj/-/tree/main",
      commit: { id: "commit123", title: "初回コミット", committed_date: "2026-01-01T00:00:00Z" },
    });
    await harness.close();
  });

  it("commit が null なら null のまま返る", async () => {
    installFetchMock(() => pagedResponse([branchFixture({ commit: null })]));
    const harness = await connect();
    const payload = okJson<PagedPayload<{ commit: unknown }>>(
      await harness.call("gitlab_list_branches", { project: "a/b" }),
    );
    expect(payload.items[0]?.commit).toBeNull();
    await harness.close();
  });
});

describe("gitlab_list_commits", () => {
  it("ref_name/since/until/path がクエリに乗り、message は落ちる", async () => {
    const mock = installFetchMock(() => pagedResponse([commitFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<Record<string, unknown>>>(
      await harness.call("gitlab_list_commits", {
        project: "a/b",
        ref_name: "main",
        since: "2026-01-01",
        until: "2026-02-01",
        path: "src",
      }),
    );
    expect(mock.lastQuery()).toMatchObject({
      ref_name: "main",
      since: "2026-01-01",
      until: "2026-02-01",
      path: "src",
    });
    expect(payload.items[0]).toEqual({
      id: "commit123",
      short_id: "commit1",
      title: "初回コミット",
      author_name: "Alice",
      committed_date: "2026-01-01T00:00:00Z",
      web_url: "https://gitlab.example.com/grp/sub/proj/-/commit/commit123",
    });
    expect("message" in (payload.items[0] as object)).toBe(false);
    await harness.close();
  });
});

describe("gitlab_search_code", () => {
  it("project 指定時は /projects/{encoded}/search + scope=blobs を叩く", async () => {
    const mock = installFetchMock(() => pagedResponse([searchBlobFixture()]));
    const harness = await connect();
    await harness.call("gitlab_search_code", { project: "grp/sub proj", search: "TODO" });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/grp%2Fsub%20proj/search");
    expect(mock.lastQuery().scope).toBe("blobs");
    await harness.close();
  });

  // このツールだけ resolveProject() を経由しないため、GITLAB_DEFAULT_PROJECT が
  // 設定されていても project 省略時はインスタンス全体検索にフォールバックする。
  it("project 省略時は defaultProject 設定済みでもインスタンス全体を検索する", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    const harness = await connect({ gitlabDefaultProject: "grp/sub proj" });
    await harness.call("gitlab_search_code", { search: "TODO" });
    expect(mock.last().url.pathname).toBe("/api/v4/search");
    await harness.close();
  });
});
