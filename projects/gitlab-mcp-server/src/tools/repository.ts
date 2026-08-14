import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GitLabClient, truncateUtf8 } from "../gitlab/client.js";
import type {
  GitLabBranch,
  GitLabCommit,
  GitLabFile,
  GitLabProject,
  GitLabSearchBlob,
  GitLabTreeItem,
} from "../gitlab/types.js";
import {
  DEFAULT_MAX_BYTES,
  jsonResult,
  pagedJsonResult,
  pagingArgs,
  projectArg,
  truncationNotice,
  withErrorHandling,
} from "./shared.js";

/**
 * プロジェクト・ツリー・ファイル・ブランチ・コミット・コード検索の読み取り専用ツール群。
 * 各ツールの入出力仕様は `inputSchema` の `.describe()` と `description`（MCPクライアント向け）を参照。
 * このドメインに書込系ツールは無いため `config` は受け取らない。
 * @packageDocumentation
 */

/**
 * リポジトリ/ファイル参照系の読み取り専用ツールを登録する。
 * @param server ツールを登録する `McpServer`。
 * @param client GitLab APIクライアント。
 */
export function registerRepositoryTools(server: McpServer, client: GitLabClient): void {
  server.registerTool(
    "gitlab_list_projects",
    {
      title: "GitLabプロジェクト一覧",
      description: "アクセス可能なGitLabプロジェクトを検索・一覧する。",
      inputSchema: {
        search: z.string().optional().describe("プロジェクト名・パスの部分一致検索文字列。"),
        membership: z
          .boolean()
          .optional()
          .describe("trueの場合、自分がメンバーのプロジェクトのみに絞る。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ search, membership, page, per_page }) => {
      const { items, page: pageInfo } = await client.getPaged<GitLabProject>("/projects", {
        search,
        membership,
        simple: true,
        page,
        per_page,
      });
      return pagedJsonResult(
        items.map((p) => ({
          id: p.id,
          path_with_namespace: p.path_with_namespace,
          name: p.name,
          description: p.description,
          default_branch: p.default_branch,
          web_url: p.web_url,
        })),
        pageInfo,
      );
    }),
  );

  server.registerTool(
    "gitlab_get_project",
    {
      title: "GitLabプロジェクト詳細取得",
      description: "指定したプロジェクトの詳細情報を取得する。",
      inputSchema: { ...projectArg },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project }) => {
      const projectId = client.resolveProject(project);
      const result = await client.get<GitLabProject>(
        `/projects/${GitLabClient.encodeId(projectId)}`,
      );
      return jsonResult(result);
    }),
  );

  server.registerTool(
    "gitlab_list_repository_tree",
    {
      title: "リポジトリツリー一覧",
      description: "プロジェクト内のディレクトリ・ファイル一覧（ツリー）を取得する。",
      inputSchema: {
        ...projectArg,
        path: z.string().optional().describe("取得するディレクトリパス。省略時はルート。"),
        ref: z
          .string()
          .optional()
          .describe("ブランチ名・タグ名・コミットSHA。省略時はデフォルトブランチ。"),
        recursive: z
          .boolean()
          .optional()
          .describe("trueの場合、サブディレクトリを再帰的に取得する。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, path, ref, recursive, page, per_page }) => {
      const projectId = client.resolveProject(project);
      const { items, page: pageInfo } = await client.getPaged<GitLabTreeItem>(
        `/projects/${GitLabClient.encodeId(projectId)}/repository/tree`,
        { path, ref, recursive, page, per_page },
      );
      return pagedJsonResult(items, pageInfo);
    }),
  );

  server.registerTool(
    "gitlab_get_file_content",
    {
      title: "ファイル内容取得",
      description:
        "プロジェクト内の特定ファイルの内容を取得する（base64からデコード済みのテキストで返す）。",
      inputSchema: {
        ...projectArg,
        file_path: z
          .string()
          .describe("リポジトリルートからのファイルパス（例: 'src/index.ts'）。"),
        ref: z
          .string()
          .optional()
          .describe("ブランチ名・タグ名・コミットSHA。省略時はデフォルトブランチ。"),
        max_bytes: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            `返す内容の最大バイト数（デフォルト ${DEFAULT_MAX_BYTES}）。超過分は先頭から切り詰める。`,
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, file_path, ref, max_bytes }) => {
      const projectId = client.resolveProject(project);
      const maxBytes = max_bytes ?? DEFAULT_MAX_BYTES;
      // GitLab APIの当該エンドポイントはrefが必須（省略時にデフォルトブランチへ
      // フォールバックしない）ため、未指定時は明示的に"HEAD"（デフォルトブランチ）を使う。
      const file = await client.get<GitLabFile>(
        `/projects/${GitLabClient.encodeId(projectId)}/repository/files/${GitLabClient.encodePathSegment(file_path)}`,
        { ref: ref ?? "HEAD" },
      );
      const decoded =
        file.encoding === "base64"
          ? Buffer.from(file.content, "base64").toString("utf8")
          : file.content;
      const { text, truncated, originalBytes } = truncateUtf8(decoded, maxBytes, "head");
      return jsonResult({
        file_path: file.file_path,
        ref: file.ref,
        size: file.size,
        last_commit_id: file.last_commit_id,
        content: text,
        notice: truncationNotice(truncated, originalBytes, maxBytes),
      });
    }),
  );

  server.registerTool(
    "gitlab_list_branches",
    {
      title: "ブランチ一覧",
      description: "プロジェクトのブランチ一覧を取得する。",
      inputSchema: {
        ...projectArg,
        search: z.string().optional().describe("ブランチ名の部分一致検索文字列。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, search, page, per_page }) => {
      const projectId = client.resolveProject(project);
      const { items, page: pageInfo } = await client.getPaged<GitLabBranch>(
        `/projects/${GitLabClient.encodeId(projectId)}/repository/branches`,
        { search, page, per_page },
      );
      return pagedJsonResult(
        items.map((b) => ({
          name: b.name,
          default: b.default,
          protected: b.protected,
          merged: b.merged,
          web_url: b.web_url,
          commit: b.commit
            ? { id: b.commit.id, title: b.commit.title, committed_date: b.commit.committed_date }
            : null,
        })),
        pageInfo,
      );
    }),
  );

  server.registerTool(
    "gitlab_list_commits",
    {
      title: "コミット一覧",
      description: "プロジェクトのコミット履歴を取得する。",
      inputSchema: {
        ...projectArg,
        ref_name: z
          .string()
          .optional()
          .describe("対象のブランチ名・タグ名。省略時はデフォルトブランチ。"),
        since: z.string().optional().describe("ISO8601形式。この日時以降のコミットに絞る。"),
        until: z.string().optional().describe("ISO8601形式。この日時以前のコミットに絞る。"),
        path: z.string().optional().describe("特定ファイル・ディレクトリの変更に絞る。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, ref_name, since, until, path, page, per_page }) => {
      const projectId = client.resolveProject(project);
      const { items, page: pageInfo } = await client.getPaged<GitLabCommit>(
        `/projects/${GitLabClient.encodeId(projectId)}/repository/commits`,
        { ref_name, since, until, path, page, per_page },
      );
      return pagedJsonResult(
        items.map((c) => ({
          id: c.id,
          short_id: c.short_id,
          title: c.title,
          author_name: c.author_name,
          committed_date: c.committed_date,
          web_url: c.web_url,
        })),
        pageInfo,
      );
    }),
  );

  server.registerTool(
    "gitlab_search_code",
    {
      title: "コード検索",
      description:
        "プロジェクト内（projectを指定した場合）またはインスタンス全体（省略した場合）のコードをキーワード検索する。",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(
            "検索対象プロジェクト（'group/repo' または数値ID）。省略時はインスタンス全体を検索する。",
          ),
        search: z.string().describe("検索キーワード。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, search, page, per_page }) => {
      const path = project ? `/projects/${GitLabClient.encodeId(project)}/search` : "/search";
      const { items, page: pageInfo } = await client.getPaged<GitLabSearchBlob>(path, {
        scope: "blobs",
        search,
        page,
        per_page,
      });
      return pagedJsonResult(
        items.map((b) => ({ path: b.path, filename: b.filename, ref: b.ref, data: b.data })),
        pageInfo,
      );
    }),
  );
}
