import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GitLabClient, truncateUtf8 } from "../gitlab/client.js";
import type { GitLabMergeRequest, GitLabMergeRequestDiff, GitLabNote } from "../gitlab/types.js";
import type { Config } from "../config.js";
import {
  DEFAULT_MAX_BYTES,
  jsonResult,
  pagedJsonResult,
  pagingArgs,
  projectArg,
  truncationNotice,
  withErrorHandling,
} from "./shared.js";

const mrSummary = (mr: GitLabMergeRequest) => ({
  iid: mr.iid,
  title: mr.title,
  state: mr.state,
  source_branch: mr.source_branch,
  target_branch: mr.target_branch,
  author: mr.author.username,
  draft: mr.draft,
  merge_status: mr.merge_status,
  web_url: mr.web_url,
  created_at: mr.created_at,
  updated_at: mr.updated_at,
});

/** マージリクエスト操作系ツールを登録する。config.gitlabReadOnly が true の場合、書き込み系は登録しない。 */
export function registerMergeRequestTools(
  server: McpServer,
  client: GitLabClient,
  config: Config,
): void {
  server.registerTool(
    "gitlab_list_merge_requests",
    {
      title: "マージリクエスト一覧",
      description: "プロジェクトのマージリクエストを検索・一覧する。",
      inputSchema: {
        ...projectArg,
        state: z
          .enum(["opened", "closed", "merged", "all"])
          .optional()
          .describe("状態で絞り込む。省略時は全件。"),
        source_branch: z.string().optional().describe("ソースブランチ名で絞り込む。"),
        target_branch: z.string().optional().describe("ターゲットブランチ名で絞り込む。"),
        author_username: z.string().optional().describe("作成者のユーザー名で絞り込む。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(
      async ({ project, state, source_branch, target_branch, author_username, page, per_page }) => {
        const projectId = client.resolveProject(project);
        const { items, page: pageInfo } = await client.getPaged<GitLabMergeRequest>(
          `/projects/${GitLabClient.encodeId(projectId)}/merge_requests`,
          { state, source_branch, target_branch, author_username, page, per_page },
        );
        return pagedJsonResult(items.map(mrSummary), pageInfo);
      },
    ),
  );

  server.registerTool(
    "gitlab_get_merge_request",
    {
      title: "マージリクエスト詳細取得",
      description: "指定したマージリクエストの詳細（説明文含む）を取得する。",
      inputSchema: {
        ...projectArg,
        merge_request_iid: z
          .number()
          .int()
          .positive()
          .describe("マージリクエストのプロジェクト内番号（IID）。"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, merge_request_iid }) => {
      const projectId = client.resolveProject(project);
      const mr = await client.get<GitLabMergeRequest>(
        `/projects/${GitLabClient.encodeId(projectId)}/merge_requests/${merge_request_iid}`,
      );
      return jsonResult({ ...mrSummary(mr), description: mr.description });
    }),
  );

  server.registerTool(
    "gitlab_get_merge_request_diff",
    {
      title: "マージリクエスト差分取得",
      description: "指定したマージリクエストのファイル差分（diff）一覧を取得する。",
      inputSchema: {
        ...projectArg,
        merge_request_iid: z
          .number()
          .int()
          .positive()
          .describe("マージリクエストのプロジェクト内番号（IID）。"),
        max_bytes: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            `差分全体の最大バイト数（デフォルト ${DEFAULT_MAX_BYTES}）。超過分は末尾を切り詰める。`,
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, merge_request_iid, max_bytes }) => {
      const projectId = client.resolveProject(project);
      const maxBytes = max_bytes ?? DEFAULT_MAX_BYTES;
      const diffs = await client.get<GitLabMergeRequestDiff[]>(
        `/projects/${GitLabClient.encodeId(projectId)}/merge_requests/${merge_request_iid}/diffs`,
      );
      const combined = diffs
        .map((d) => `--- ${d.old_path}\n+++ ${d.new_path}\n${d.diff}`)
        .join("\n");
      const { text, truncated, originalBytes } = truncateUtf8(combined, maxBytes, "head");
      return jsonResult({
        file_count: diffs.length,
        files: diffs.map((d) => ({
          old_path: d.old_path,
          new_path: d.new_path,
          new_file: d.new_file,
          renamed_file: d.renamed_file,
          deleted_file: d.deleted_file,
        })),
        diff: text,
        notice: truncationNotice(truncated, originalBytes, maxBytes),
      });
    }),
  );

  server.registerTool(
    "gitlab_list_merge_request_notes",
    {
      title: "マージリクエストコメント一覧",
      description: "指定したマージリクエストに付いたコメント（ノート）を取得する。",
      inputSchema: {
        ...projectArg,
        merge_request_iid: z
          .number()
          .int()
          .positive()
          .describe("マージリクエストのプロジェクト内番号（IID）。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, merge_request_iid, page, per_page }) => {
      const projectId = client.resolveProject(project);
      const { items, page: pageInfo } = await client.getPaged<GitLabNote>(
        `/projects/${GitLabClient.encodeId(projectId)}/merge_requests/${merge_request_iid}/notes`,
        { page, per_page },
      );
      return pagedJsonResult(
        items
          .filter((n) => !n.system)
          .map((n) => ({
            id: n.id,
            author: n.author.username,
            body: n.body,
            created_at: n.created_at,
          })),
        pageInfo,
      );
    }),
  );

  if (config.gitlabReadOnly) {
    return;
  }

  server.registerTool(
    "gitlab_create_merge_request",
    {
      title: "マージリクエスト作成",
      description: "新しいマージリクエストを作成する。",
      inputSchema: {
        ...projectArg,
        source_branch: z.string().min(1).describe("マージ元ブランチ名。"),
        target_branch: z.string().min(1).describe("マージ先ブランチ名。"),
        title: z.string().min(1).describe("マージリクエストのタイトル。"),
        description: z.string().optional().describe("説明文（Markdown）。"),
        draft: z.boolean().optional().describe("trueの場合、ドラフトMRとして作成する。"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    withErrorHandling(
      async ({ project, source_branch, target_branch, title, description, draft }) => {
        const projectId = client.resolveProject(project);
        const mr = await client.post<GitLabMergeRequest>(
          `/projects/${GitLabClient.encodeId(projectId)}/merge_requests`,
          {
            source_branch,
            target_branch,
            title: draft ? `Draft: ${title}` : title,
            description,
          },
        );
        return jsonResult(mrSummary(mr));
      },
    ),
  );

  server.registerTool(
    "gitlab_update_merge_request",
    {
      title: "マージリクエスト更新",
      description:
        "既存マージリクエストのタイトル・説明更新、またはclose/reopenを行う（マージ自体は行わない）。",
      inputSchema: {
        ...projectArg,
        merge_request_iid: z
          .number()
          .int()
          .positive()
          .describe("マージリクエストのプロジェクト内番号（IID）。"),
        title: z.string().optional().describe("新しいタイトル。"),
        description: z.string().optional().describe("新しい説明文（Markdown）。"),
        state_event: z
          .enum(["close", "reopen"])
          .optional()
          .describe("MRをclose/reopenする場合に指定。"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ project, merge_request_iid, title, description, state_event }) => {
      const projectId = client.resolveProject(project);
      const mr = await client.put<GitLabMergeRequest>(
        `/projects/${GitLabClient.encodeId(projectId)}/merge_requests/${merge_request_iid}`,
        { title, description, state_event },
      );
      return jsonResult(mrSummary(mr));
    }),
  );

  server.registerTool(
    "gitlab_create_merge_request_note",
    {
      title: "マージリクエストコメント追加",
      description: "指定したマージリクエストにコメント（ノート）を追加する。",
      inputSchema: {
        ...projectArg,
        merge_request_iid: z
          .number()
          .int()
          .positive()
          .describe("マージリクエストのプロジェクト内番号（IID）。"),
        body: z.string().min(1).describe("コメント本文（Markdown）。"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ project, merge_request_iid, body }) => {
      const projectId = client.resolveProject(project);
      const note = await client.post<GitLabNote>(
        `/projects/${GitLabClient.encodeId(projectId)}/merge_requests/${merge_request_iid}/notes`,
        { body },
      );
      return jsonResult({
        id: note.id,
        author: note.author.username,
        body: note.body,
        created_at: note.created_at,
      });
    }),
  );
}
