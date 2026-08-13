import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GitLabApiError, ToolInputError } from "../../src/gitlab/client.js";
import type { PageInfo } from "../../src/gitlab/types.js";
import {
  DEFAULT_MAX_BYTES,
  jsonResult,
  pagedJsonResult,
  pagingArgs,
  projectArg,
  textResult,
  truncationNotice,
  withErrorHandling,
} from "../../src/tools/shared.js";

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  if (!first || first.type !== "text" || first.text === undefined) {
    throw new Error("先頭コンテンツが text ではありません。");
  }
  return first.text;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shared - 定数と結果フォーマット", () => {
  it("DEFAULT_MAX_BYTES は 100000", () => {
    expect(DEFAULT_MAX_BYTES).toBe(100_000);
  });

  it("jsonResult は2スペースインデントのJSONを1件のtextで返し、isError を付けない", () => {
    const result = jsonResult({ a: 1, b: "x" });
    expect(result).toEqual({ content: [{ type: "text", text: '{\n  "a": 1,\n  "b": "x"\n}' }] });
    expect(result.isError).toBeUndefined();
  });

  it("textResult は文字列をそのまま1件のtextで返す", () => {
    expect(textResult("そのまま")).toEqual({ content: [{ type: "text", text: "そのまま" }] });
  });
});

describe("shared - withErrorHandling", () => {
  it("正常時はハンドラの戻り値をそのまま返す", async () => {
    const wrapped = withErrorHandling(async () => jsonResult({ ok: true }));
    expect(await wrapped({})).toEqual(jsonResult({ ok: true }));
  });

  it("ToolInputError は「入力エラー: 」を前置して isError で返す", async () => {
    const wrapped = withErrorHandling(async () => {
      throw new ToolInputError("project が必要です");
    });
    const result = await wrapped({});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("入力エラー: project が必要です");
  });

  it("GitLabApiError はメッセージをそのまま isError で返す（前置なし）", async () => {
    const wrapped = withErrorHandling(async () => {
      throw new GitLabApiError(404, "GitLab API がエラーを返しました: 404");
    });
    const result = await wrapped({});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("GitLab API がエラーを返しました: 404");
  });

  it("想定外の Error は一般化したメッセージに変換し console.error に出す", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapped = withErrorHandling(async () => {
      throw new TypeError("Cannot read properties of undefined");
    });
    const result = await wrapped({});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "予期しないエラーが発生しました: Cannot read properties of undefined",
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toContain("[gitlab-mcp-server]");
  });

  it("Error でない値が throw された場合は String() で文字列化する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapped = withErrorHandling(async () => {
      throw "文字列エラー";
    });
    expect(textOf(await wrapped({}))).toBe("予期しないエラーが発生しました: 文字列エラー");
  });

  it("エラー応答は throw ではなく isError 付きの CallToolResult として返る", async () => {
    const wrapped = withErrorHandling(async () => {
      throw new ToolInputError("x");
    });
    await expect(wrapped({})).resolves.toBeDefined();
  });
});

describe("shared - pagedJsonResult", () => {
  const pageInfo = (overrides: Partial<PageInfo> = {}): PageInfo => ({
    page: 1,
    perPage: 20,
    totalItems: 100,
    totalPages: 5,
    nextPage: undefined,
    ...overrides,
  });

  it("nextPage が無ければ hasNextPage は false", () => {
    const payload = JSON.parse(textOf(pagedJsonResult([{ id: 1 }], pageInfo())));
    expect(payload).toEqual({
      items: [{ id: 1 }],
      pageInfo: { page: 1, perPage: 20, totalItems: 100, totalPages: 5, hasNextPage: false },
    });
  });

  it("nextPage があれば hasNextPage は true になり nextPage も含む", () => {
    const payload = JSON.parse(textOf(pagedJsonResult([], pageInfo({ nextPage: 3 }))));
    expect(payload.pageInfo.hasNextPage).toBe(true);
    expect(payload.pageInfo.nextPage).toBe(3);
  });
});

describe("shared - truncationNotice", () => {
  it("切り詰めていなければ undefined", () => {
    expect(truncationNotice(false, 1000, 100)).toBeUndefined();
  });

  it("切り詰めた場合は元のバイト数と上限の両方を含む文言を返す", () => {
    const notice = truncationNotice(true, 1000, 100);
    expect(notice).toContain("1000");
    expect(notice).toContain("100");
  });
});

describe("shared - 引数スキーマ", () => {
  const paging = z.object(pagingArgs);
  const project = z.object(projectArg);

  it("project は省略可能な文字列", () => {
    expect(project.safeParse({}).success).toBe(true);
    expect(project.safeParse({ project: "grp/repo" }).success).toBe(true);
    expect(project.safeParse({ project: 1 }).success).toBe(false);
  });

  it("page/per_page は省略可能", () => {
    expect(paging.safeParse({}).success).toBe(true);
  });

  it.each([
    ["page が 0", { page: 0 }],
    ["page が小数", { page: 1.5 }],
    ["per_page が 0", { per_page: 0 }],
    ["per_page が 101", { per_page: 101 }],
  ])("%s なら reject する", (_label, input) => {
    expect(paging.safeParse(input).success).toBe(false);
  });

  it("per_page の上限 100 は受理する", () => {
    expect(paging.safeParse({ page: 1, per_page: 100 }).success).toBe(true);
  });
});
