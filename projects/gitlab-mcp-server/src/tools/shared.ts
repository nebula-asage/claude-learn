import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GitLabApiError, ToolInputError } from "../gitlab/client.js";
import type { PageInfo } from "../gitlab/types.js";

/** 既定の切り詰めサイズ（バイト）。ファイル内容・差分・ジョブログなど肥大化しやすい応答に使う。 */
export const DEFAULT_MAX_BYTES = 100_000;

export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

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
  project: z
    .string()
    .optional()
    .describe(
      "対象プロジェクト（'group/repo' 形式のパス、または数値ID）。省略時はサーバの GITLAB_DEFAULT_PROJECT を使う。",
    ),
};

/** 一覧系ツール共通のページング引数スキーマ断片。 */
export const pagingArgs = {
  page: z.number().int().min(1).optional().describe("取得するページ番号（1始まり）。省略時は1。"),
  per_page: z.number().int().min(1).max(100).optional().describe("1ページあたりの件数（最大100）。省略時は20。"),
};

/** 一覧系ツールの結果を items + pageInfo の形にまとめる。 */
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

/** 切り詰め結果を本文と一緒に返す共通フォーマット。 */
export function truncationNotice(truncated: boolean, originalBytes: number, maxBytes: number): string | undefined {
  if (!truncated) return undefined;
  return `(注: 応答が ${originalBytes} バイトあったため ${maxBytes} バイトに切り詰めています)`;
}
