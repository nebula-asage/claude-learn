import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GitLabClient } from "../gitlab/client.js";
import type { GitLabIssue, GitLabNote } from "../gitlab/types.js";
import type { Config } from "../config.js";
import {
  jsonResult,
  pagedJsonResult,
  pagingArgs,
  projectArg,
  withErrorHandling,
} from "./shared.js";

/**
 * Issueの一覧・詳細取得・コメント参照（読取系）と、作成・更新・コメント追加（書込系）を提供する。
 * 書込系は `config.gitlabReadOnly` が true の場合、登録関数内で早期returnして一切登録されない
 * （`tools/list` にも現れない）。ファイル内の並び順は常に「読取系 → readOnlyチェック → 書込系」。
 * @packageDocumentation
 */

const issueSummary = (issue: GitLabIssue) => ({
  iid: issue.iid,
  title: issue.title,
  state: issue.state,
  labels: issue.labels,
  author: issue.author.username,
  assignees: issue.assignees.map((a) => a.username),
  milestone: issue.milestone?.title ?? null,
  web_url: issue.web_url,
  created_at: issue.created_at,
  updated_at: issue.updated_at,
});

/**
 * Issue操作系ツールを登録する。config.gitlabReadOnly が true の場合、書き込み系は登録しない。
 * @param server ツールを登録する `McpServer`。
 * @param client GitLab APIクライアント。
 * @param config 起動設定。`gitlabReadOnly` が書込系ツールの登録可否を決める。
 */
export function registerIssueTools(server: McpServer, client: GitLabClient, config: Config): void {
  server.registerTool(
    "gitlab_list_issues",
    {
      title: "Issue一覧",
      description: "プロジェクトのIssueを検索・一覧する。",
      inputSchema: {
        ...projectArg,
        state: z
          .enum(["opened", "closed", "all"])
          .optional()
          .describe("Issueの状態で絞り込む。省略時は全件。"),
        labels: z
          .string()
          .optional()
          .describe("カンマ区切りのラベル名で絞り込む（例: 'bug,urgent'）。"),
        assignee_username: z.string().optional().describe("担当者のユーザー名で絞り込む。"),
        milestone: z.string().optional().describe("マイルストーン名で絞り込む。"),
        search: z.string().optional().describe("タイトル・説明文の部分一致検索文字列。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(
      async ({ project, state, labels, assignee_username, milestone, search, page, per_page }) => {
        const projectId = client.resolveProject(project);
        const { items, page: pageInfo } = await client.getPaged<GitLabIssue>(
          `/projects/${GitLabClient.encodeId(projectId)}/issues`,
          { state, labels, assignee_username, milestone, search, page, per_page },
        );
        return pagedJsonResult(items.map(issueSummary), pageInfo);
      },
    ),
  );

  server.registerTool(
    "gitlab_get_issue",
    {
      title: "Issue詳細取得",
      description: "指定したIssueの詳細（説明文含む）を取得する。",
      inputSchema: {
        ...projectArg,
        issue_iid: z.number().int().positive().describe("Issueのプロジェクト内番号（IID）。"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, issue_iid }) => {
      const projectId = client.resolveProject(project);
      const issue = await client.get<GitLabIssue>(
        `/projects/${GitLabClient.encodeId(projectId)}/issues/${issue_iid}`,
      );
      return jsonResult({ ...issueSummary(issue), description: issue.description });
    }),
  );

  server.registerTool(
    "gitlab_list_issue_notes",
    {
      title: "Issueコメント一覧",
      description: "指定したIssueに付いたコメント（ノート）を取得する。",
      inputSchema: {
        ...projectArg,
        issue_iid: z.number().int().positive().describe("Issueのプロジェクト内番号（IID）。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, issue_iid, page, per_page }) => {
      const projectId = client.resolveProject(project);
      const { items, page: pageInfo } = await client.getPaged<GitLabNote>(
        `/projects/${GitLabClient.encodeId(projectId)}/issues/${issue_iid}/notes`,
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
    "gitlab_create_issue",
    {
      title: "Issue作成",
      description: "新しいIssueを作成する。",
      inputSchema: {
        ...projectArg,
        title: z.string().min(1).describe("Issueのタイトル。"),
        description: z.string().optional().describe("Issueの説明文（Markdown）。"),
        labels: z.string().optional().describe("カンマ区切りのラベル名。"),
        assignee_ids: z.array(z.number().int()).optional().describe("担当者のユーザーID配列。"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ project, title, description, labels, assignee_ids }) => {
      const projectId = client.resolveProject(project);
      const issue = await client.post<GitLabIssue>(
        `/projects/${GitLabClient.encodeId(projectId)}/issues`,
        {
          title,
          description,
          labels,
          assignee_ids,
        },
      );
      return jsonResult(issueSummary(issue));
    }),
  );

  server.registerTool(
    "gitlab_update_issue",
    {
      title: "Issue更新",
      description: "既存Issueのタイトル・説明・ラベル更新、またはclose/reopenを行う。",
      inputSchema: {
        ...projectArg,
        issue_iid: z.number().int().positive().describe("Issueのプロジェクト内番号（IID）。"),
        title: z.string().optional().describe("新しいタイトル。"),
        description: z.string().optional().describe("新しい説明文（Markdown）。"),
        labels: z.string().optional().describe("カンマ区切りのラベル名（既存を置き換える）。"),
        state_event: z
          .enum(["close", "reopen"])
          .optional()
          .describe("Issueをclose/reopenする場合に指定。"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ project, issue_iid, title, description, labels, state_event }) => {
      const projectId = client.resolveProject(project);
      const issue = await client.put<GitLabIssue>(
        `/projects/${GitLabClient.encodeId(projectId)}/issues/${issue_iid}`,
        { title, description, labels, state_event },
      );
      return jsonResult(issueSummary(issue));
    }),
  );

  server.registerTool(
    "gitlab_create_issue_note",
    {
      title: "Issueコメント追加",
      description: "指定したIssueにコメント（ノート）を追加する。",
      inputSchema: {
        ...projectArg,
        issue_iid: z.number().int().positive().describe("Issueのプロジェクト内番号（IID）。"),
        body: z.string().min(1).describe("コメント本文（Markdown）。"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ project, issue_iid, body }) => {
      const projectId = client.resolveProject(project);
      const note = await client.post<GitLabNote>(
        `/projects/${GitLabClient.encodeId(projectId)}/issues/${issue_iid}/notes`,
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
