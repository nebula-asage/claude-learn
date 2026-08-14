import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GitLabApiError, ToolInputError } from "../gitlab/client.js";
import type { PageInfo } from "../gitlab/types.js";

/**
 * `tools/*.ts` の全ツールハンドラが共有するレスポンス整形・エラーハンドリング・
 * 引数スキーマ断片を置く場所。ドメイン別ファイル間でのロジック重複を避ける。
 * @packageDocumentation
 */

/** 既定の切り詰めサイズ（バイト）。ファイル内容・差分・ジョブログなど肥大化しやすい応答に使う。 */
export const DEFAULT_MAX_BYTES = 100_000;

/**
 * 任意のデータをJSON文字列化してMCPのテキストコンテンツとして返す。
 * @param data レスポンスボディにする値。`JSON.stringify` でシリアライズする。
 */
export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * 既にテキスト化済みの文字列をそのままMCPのテキストコンテンツとして返す。
 * @param text レスポンス本文。
 */
export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

function errorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

/**
 * ツールハンドラを共通のエラーハンドリングでラップする。
 * GitLabApiError / ToolInputError はメッセージをそのまま（トークンを含まない形で）利用者に返し、
 * それ以外の想定外エラーはスタックを出さず一般的なメッセージに変換する。
 * @remarks 全ツールハンドラがこの関数を経由することで、`PRIVATE-TOKEN` を含む値が
 *   誤って利用者向けレスポンスに漏れないことを一元的に保証している。
 * @param handler 実際のツール処理。例外を投げてよい。
 */
export function withErrorHandling<Args extends Record<string, unknown> | undefined>(
  handler: (args: Args) => Promise<CallToolResult>,
): (args: Args) => Promise<CallToolResult> {
  return async (args: Args) => {
    try {
      return await handler(args);
    } catch (err) {
      if (err instanceof ToolInputError) {
        return errorResult(`入力エラー: ${err.message}`);
      }
      if (err instanceof GitLabApiError) {
        return errorResult(err.message);
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[gitlab-mcp-server] 予期しないエラー: ${message}`);
      return errorResult(`予期しないエラーが発生しました: ${message}`);
    }
  };
}

/** `project` 引数の共通スキーマ断片。 */
export const projectArg = {
  /** 'group/repo' 形式のパス、または数値ID。省略時はサーバの GITLAB_DEFAULT_PROJECT を使う。 */
  project: z
    .string()
    .optional()
    .describe(
      "対象プロジェクト（'group/repo' 形式のパス、または数値ID）。省略時はサーバの GITLAB_DEFAULT_PROJECT を使う。",
    ),
};

/** `group` 引数の共通スキーマ断片。プロジェクトと異なり既定値が無いため必須にする。 */
export const groupArg = {
  /** 'group' または 'group/subgroup' 形式のパス、または数値ID。 */
  group: z
    .string()
    .describe("対象グループ（'group' または 'group/subgroup' 形式のパス、または数値ID）。"),
};

/** 一覧系ツール共通のページング引数スキーマ断片。 */
export const pagingArgs = {
  /** 取得するページ番号（1始まり）。省略時は1。 */
  page: z.number().int().min(1).optional().describe("取得するページ番号（1始まり）。省略時は1。"),
  /** 1ページあたりの件数（最大100）。省略時は20。 */
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("1ページあたりの件数（最大100）。省略時は20。"),
};

/**
 * 一覧系ツールの結果を items + pageInfo の形にまとめる。
 * @param items 現在ページの要素。
 * @param page `GitLabClient.getPaged` が返したページ情報。
 * @returns `items` と `pageInfo`（`hasNextPage` を含む）を持つJSONレスポンス。
 */
export function pagedJsonResult<T>(items: T[], page: PageInfo): CallToolResult {
  return jsonResult({
    items,
    pageInfo: {
      page: page.page,
      perPage: page.perPage,
      totalItems: page.totalItems,
      totalPages: page.totalPages,
      hasNextPage: page.nextPage !== undefined,
      nextPage: page.nextPage,
    },
  });
}

/**
 * 切り詰め結果を本文と一緒に返す共通フォーマット。
 * @param truncated `truncateUtf8` の切り詰め有無。
 * @param originalBytes 切り詰め前の元テキストのバイト数。
 * @param maxBytes 適用した上限バイト数。
 * @returns 切り詰めが発生した場合のみ、利用者向けの注記文字列。発生していなければ `undefined`。
 */
export function truncationNotice(
  truncated: boolean,
  originalBytes: number,
  maxBytes: number,
): string | undefined {
  if (!truncated) return undefined;
  return `(注: 応答が ${originalBytes} バイトあったため ${maxBytes} バイトに切り詰めています)`;
}
