import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import {
  GitLabApiError,
  GitLabClient,
  ToolInputError,
  truncateUtf8,
} from "../../src/gitlab/client.js";
import {
  installFetchMock,
  jsonResponse,
  pagedResponse,
  textResponse,
  timeoutError,
} from "../helpers/fetchMock.js";
import { baseConfig } from "../helpers/mcp.js";

function client(overrides: Partial<Config> = {}): GitLabClient {
  return new GitLabClient({ ...baseConfig, ...overrides });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitLabClient - パスのエンコード", () => {
  it("encodeId は名前空間付きパスの / をエンコードする", () => {
    expect(GitLabClient.encodeId("group/sub/repo")).toBe("group%2Fsub%2Frepo");
  });

  it("encodeId は数値IDを文字列化する", () => {
    expect(GitLabClient.encodeId(42)).toBe("42");
  });

  it("encodePathSegment は / とスペースをエンコードする", () => {
    expect(GitLabClient.encodePathSegment("src/a b.ts")).toBe("src%2Fa%20b.ts");
  });
});

describe("GitLabClient - resolveProject", () => {
  it("引数で渡したプロジェクトを最優先する", () => {
    expect(client().resolveProject("other/repo")).toBe("other/repo");
  });

  it("引数省略時は GITLAB_DEFAULT_PROJECT にフォールバックする", () => {
    expect(client().resolveProject(undefined)).toBe("grp/sub proj");
  });

  it("引数もデフォルトも無ければ ToolInputError を投げる", () => {
    expect(() => client({ gitlabDefaultProject: undefined }).resolveProject(undefined)).toThrow(
      ToolInputError,
    );
    expect(() => client({ gitlabDefaultProject: undefined }).resolveProject(undefined)).toThrow(
      /GITLAB_DEFAULT_PROJECT/,
    );
  });
});

describe("GitLabClient - URL構築", () => {
  it("パスの前に /api/v4 を付ける", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().get("/projects/x");
    expect(mock.last().url.toString()).toBe("https://gitlab.example.com/api/v4/projects/x");
  });

  it("ベースURLのポートを維持する", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client({ gitlabBaseUrl: "https://gitlab.example.com:8443" }).get("/projects/x");
    expect(mock.last().url.origin).toBe("https://gitlab.example.com:8443");
  });

  it("値が undefined のクエリはURLに現れない", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().get("/projects", { search: undefined, membership: undefined });
    expect(mock.last().url.search).toBe("");
  });

  it("boolean と number は文字列化してクエリに載せる", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().get("/projects", { simple: true, archived: false, count: 5 });
    expect(mock.lastQuery()).toEqual({ simple: "true", archived: "false", count: "5" });
  });

  it("パスに埋め込んだ %2F はクエリ付与後も維持される", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().get(`/projects/${GitLabClient.encodeId("grp/sub/proj")}/issues`, {
      state: "opened",
    });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/grp%2Fsub%2Fproj/issues");
    expect(mock.last().url.toString()).toContain("grp%2Fsub%2Fproj");
  });
});

describe("GitLabClient - ヘッダとリクエストボディ", () => {
  it("PRIVATE-TOKEN ヘッダに設定のトークンを載せる", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().get("/projects");
    expect(mock.last().headers.get("PRIVATE-TOKEN")).toBe("glpat-SUPER-SECRET-TOKEN");
  });

  it("ボディ無しのGETには Content-Type を付けない", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().get("/projects");
    expect(mock.last().headers.get("content-type")).toBeNull();
    expect(mock.last().method).toBe("GET");
  });

  it("POST には Content-Type: application/json を付ける", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().post("/projects/1/issues", { title: "t" });
    expect(mock.last().method).toBe("POST");
    expect(mock.last().headers.get("content-type")).toBe("application/json");
    expect(mock.last().body).toEqual({ title: "t" });
  });

  it("post/put はボディ省略時に空オブジェクトを送る", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().post("/a");
    expect(mock.last().body).toEqual({});
    await client().put("/b");
    expect(mock.last().method).toBe("PUT");
    expect(mock.last().body).toEqual({});
  });

  it("AbortSignal.timeout() の signal を渡している", async () => {
    const mock = installFetchMock(() => jsonResponse({}));
    await client().get("/projects");
    const signal = mock.last().signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });
});

describe("GitLabClient - エラー変換", () => {
  it("404 + message フィールドをメッセージに含める", async () => {
    installFetchMock(() =>
      jsonResponse({ message: "404 Project Not Found" }, { status: 404, statusText: "Not Found" }),
    );
    const err = await client()
      .get("/projects/x")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitLabApiError);
    const apiError = err as GitLabApiError;
    expect(apiError.status).toBe(404);
    expect(apiError.message).toContain("404 Project Not Found");
    expect(apiError.gitlabDetail).toEqual({ message: "404 Project Not Found" });
  });

  it("message が無ければ error フィールドを採用する", async () => {
    installFetchMock(() => jsonResponse({ error: "insufficient_scope" }, { status: 403 }));
    const err = (await client()
      .get("/projects/x")
      .catch((e: unknown) => e)) as GitLabApiError;
    expect(err.status).toBe(403);
    expect(err.message).toContain("insufficient_scope");
  });

  it("message がオブジェクトなら JSON 文字列化して含める", async () => {
    installFetchMock(() =>
      jsonResponse({ message: { title: ["can't be blank"] } }, { status: 400 }),
    );
    const err = (await client()
      .get("/projects/x")
      .catch((e: unknown) => e)) as GitLabApiError;
    expect(err.message).toContain('{"title":["can\'t be blank"]}');
  });

  it("JSONでない本文なら詳細部分を付けずステータスだけ返す", async () => {
    installFetchMock(() => textResponse("<html>502</html>", { status: 500 }));
    const err = (await client()
      .get("/projects/x")
      .catch((e: unknown) => e)) as GitLabApiError;
    expect(err.status).toBe(500);
    expect(err.gitlabDetail).toBeUndefined();
    expect(err.message).toContain("500");
  });

  it("statusText が空でもメッセージが壊れない", async () => {
    installFetchMock(() => jsonResponse({}, { status: 418, statusText: "" }));
    const err = (await client()
      .get("/projects/x")
      .catch((e: unknown) => e)) as GitLabApiError;
    expect(err.message).toContain("418");
  });

  it("fetch が一般例外で失敗したら status 0 の GitLabApiError にする", async () => {
    installFetchMock(() => {
      throw new Error("ECONNREFUSED");
    });
    const err = (await client()
      .get("/projects/x")
      .catch((e: unknown) => e)) as GitLabApiError;
    expect(err).toBeInstanceOf(GitLabApiError);
    expect(err.status).toBe(0);
    expect(err.message).toContain("ECONNREFUSED");
  });

  it("タイムアウトなら status 0 かつメッセージにタイムアウト値を含める", async () => {
    installFetchMock(() => {
      throw timeoutError();
    });
    const err = (await client()
      .get("/projects/x")
      .catch((e: unknown) => e)) as GitLabApiError;
    expect(err).toBeInstanceOf(GitLabApiError);
    expect(err.status).toBe(0);
    expect(err.message).toContain("30000ms");
    expect(err.message).toContain("タイムアウト");
  });

  // AGENTS.md の不変条件: GitLabApiError のメッセージにトークンを絶対に含めない。
  it.each([
    ["4xx（JSONボディあり）", () => jsonResponse({ message: "forbidden" }, { status: 403 })],
    ["5xx（非JSONボディ）", () => textResponse("boom", { status: 500 })],
    [
      "fetch の一般例外",
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
  ])("%s のエラーメッセージにトークンが混入しない", async (_label, responder) => {
    installFetchMock(responder as () => Response);
    const err = (await client()
      .get("/projects/x")
      .catch((e: unknown) => e)) as GitLabApiError;
    expect(err.message).not.toContain("glpat-SUPER-SECRET-TOKEN");
    expect(err.message).not.toMatch(/PRIVATE-TOKEN/i);
  });
});

describe("GitLabClient - getPaged", () => {
  it("page/per_page 未指定でも既定値をクエリに載せる", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    await client().getPaged("/projects");
    expect(mock.lastQuery()).toEqual({ page: "1", per_page: "20" });
  });

  it("page/per_page 指定時はその値を載せる", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    await client().getPaged("/projects", { page: 3, per_page: 50 });
    expect(mock.lastQuery()).toEqual({ page: "3", per_page: "50" });
  });

  it("ページングヘッダを PageInfo に反映する", async () => {
    installFetchMock(() =>
      pagedResponse([{ id: 1 }], {
        "x-page": "2",
        "x-per-page": "50",
        "x-total": "120",
        "x-total-pages": "3",
        "x-next-page": "3",
      }),
    );
    const { items, page } = await client().getPaged<{ id: number }>("/projects", {
      page: 2,
      per_page: 50,
    });
    expect(items).toEqual([{ id: 1 }]);
    expect(page).toEqual({ page: 2, perPage: 50, totalItems: 120, totalPages: 3, nextPage: 3 });
  });

  it("x-total が空文字なら totalItems は undefined になる", async () => {
    installFetchMock(() => pagedResponse([], { "x-page": "1", "x-per-page": "20", "x-total": "" }));
    const { page } = await client().getPaged("/projects");
    expect(page.totalItems).toBeUndefined();
  });

  it("x-next-page が空文字なら nextPage は undefined になる", async () => {
    installFetchMock(() => pagedResponse([], { "x-next-page": "" }));
    const { page } = await client().getPaged("/projects");
    expect(page.nextPage).toBeUndefined();
  });

  it("ページングヘッダが全く無ければリクエスト値にフォールバックする", async () => {
    installFetchMock(() => jsonResponse([]));
    const { page } = await client().getPaged("/projects", { page: 4, per_page: 7 });
    expect(page).toEqual({
      page: 4,
      perPage: 7,
      totalItems: undefined,
      totalPages: undefined,
      nextPage: undefined,
    });
  });
});

describe("GitLabClient - getText", () => {
  it("レスポンスをテキストとして返す", async () => {
    installFetchMock(() => textResponse("ジョブログ本文"));
    expect(await client().getText("/projects/1/jobs/2/trace")).toBe("ジョブログ本文");
  });
});

describe("truncateUtf8", () => {
  it("上限以下なら切り詰めずバイト数を返す", () => {
    expect(truncateUtf8("あいう", 100)).toEqual({
      text: "あいう",
      truncated: false,
      originalBytes: 9,
    });
  });

  it("head は先頭側を残す", () => {
    expect(truncateUtf8("abcdefghij", 4, "head")).toEqual({
      text: "abcd",
      truncated: true,
      originalBytes: 10,
    });
  });

  it("tail は末尾側を残す", () => {
    expect(truncateUtf8("abcdefghij", 4, "tail")).toEqual({
      text: "ghij",
      truncated: true,
      originalBytes: 10,
    });
  });

  it("既定の切り詰め方向は head", () => {
    expect(truncateUtf8("abcdefghij", 4).text).toBe(truncateUtf8("abcdefghij", 4, "head").text);
  });

  it("ASCIIのみなら残る文字数は maxBytes に一致する", () => {
    expect(truncateUtf8("a".repeat(100), 30).text.length).toBe(30);
  });

  // マルチバイト境界を跨いだ場合に U+FFFD が入るのは意図した割り切り（切り詰められた事実が
  // 分かれば十分という設計）。挙動を変える場合はこのテストを意図的に更新すること。
  it("マルチバイト境界を跨ぐと置換文字が入る（意図した割り切り）", () => {
    const result = truncateUtf8("あいうえお", 4, "head");
    expect(result.truncated).toBe(true);
    expect(result.originalBytes).toBe(15);
    expect(result.text).toBe("あ�");
  });
});
