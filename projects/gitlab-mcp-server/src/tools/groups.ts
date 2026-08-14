import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GitLabClient } from "../gitlab/client.js";
import type { GitLabGroup, GitLabGroupMember } from "../gitlab/types.js";
import type { Config } from "../config.js";
import { groupArg, jsonResult, pagedJsonResult, pagingArgs, withErrorHandling } from "./shared.js";

/**
 * グループの一覧・詳細・メンバー参照（読取系）と、メンバー追加・更新（書込系）を提供する。
 * メンバー削除は意図的にスコープ外。書込系は `config.gitlabReadOnly` が true の場合、
 * 登録関数内で早期returnして一切登録されない（`tools/list` にも現れない）。
 * @packageDocumentation
 */

const ACCESS_LEVEL_NAMES: Record<number, string> = {
  10: "Guest",
  20: "Reporter",
  30: "Developer",
  40: "Maintainer",
  50: "Owner",
};

const ACCESS_LEVEL_DESCRIPTION =
  "アクセスレベル（10: Guest, 20: Reporter, 30: Developer, 40: Maintainer, 50: Owner）。";

const accessLevelArg = z
  .union([z.literal(10), z.literal(20), z.literal(30), z.literal(40), z.literal(50)])
  .describe(ACCESS_LEVEL_DESCRIPTION);

const groupSummary = (group: GitLabGroup) => ({
  id: group.id,
  name: group.name,
  path: group.path,
  full_path: group.full_path,
  description: group.description,
  visibility: group.visibility,
  web_url: group.web_url,
  parent_id: group.parent_id,
});

const memberSummary = (member: GitLabGroupMember) => ({
  id: member.id,
  username: member.username,
  name: member.name,
  state: member.state,
  access_level: member.access_level,
  access_level_name: ACCESS_LEVEL_NAMES[member.access_level] ?? "Unknown",
  expires_at: member.expires_at,
  web_url: member.web_url,
});

/**
 * グループ・メンバー操作系ツールを登録する。config.gitlabReadOnly が true の場合、書き込み系は登録しない。
 * @param server ツールを登録する `McpServer`。
 * @param client GitLab APIクライアント。
 * @param config 起動設定。`gitlabReadOnly` が書込系ツールの登録可否を決める。
 */
export function registerGroupTools(server: McpServer, client: GitLabClient, config: Config): void {
  server.registerTool(
    "gitlab_list_groups",
    {
      title: "GitLabグループ一覧",
      description: "アクセス可能なGitLabグループを検索・一覧する。",
      inputSchema: {
        search: z.string().optional().describe("グループ名・パスの部分一致検索文字列。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ search, page, per_page }) => {
      const { items, page: pageInfo } = await client.getPaged<GitLabGroup>("/groups", {
        search,
        page,
        per_page,
      });
      return pagedJsonResult(items.map(groupSummary), pageInfo);
    }),
  );

  server.registerTool(
    "gitlab_get_group",
    {
      title: "GitLabグループ詳細取得",
      description: "指定したグループの詳細情報を取得する。",
      inputSchema: { ...groupArg },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ group }) => {
      const result = await client.get<GitLabGroup>(`/groups/${GitLabClient.encodeId(group)}`);
      return jsonResult(groupSummary(result));
    }),
  );

  server.registerTool(
    "gitlab_list_group_members",
    {
      title: "グループメンバー一覧",
      description: "指定したグループのメンバーを検索・一覧する。",
      inputSchema: {
        ...groupArg,
        query: z.string().optional().describe("ユーザー名・表示名の部分一致検索文字列。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ group, query, page, per_page }) => {
      const { items, page: pageInfo } = await client.getPaged<GitLabGroupMember>(
        `/groups/${GitLabClient.encodeId(group)}/members`,
        { query, page, per_page },
      );
      return pagedJsonResult(items.map(memberSummary), pageInfo);
    }),
  );

  if (config.gitlabReadOnly) {
    return;
  }

  server.registerTool(
    "gitlab_add_group_member",
    {
      title: "グループメンバー追加",
      description: "指定したユーザーをグループのメンバーとして追加する。",
      inputSchema: {
        ...groupArg,
        user_id: z.number().int().positive().describe("追加するユーザーのID。"),
        access_level: accessLevelArg,
        expires_at: z
          .string()
          .optional()
          .describe("メンバーシップの有効期限（YYYY-MM-DD形式）。省略時は無期限。"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ group, user_id, access_level, expires_at }) => {
      const member = await client.post<GitLabGroupMember>(
        `/groups/${GitLabClient.encodeId(group)}/members`,
        { user_id, access_level, expires_at },
      );
      return jsonResult(memberSummary(member));
    }),
  );

  server.registerTool(
    "gitlab_update_group_member",
    {
      title: "グループメンバー更新",
      description: "既存グループメンバーのアクセスレベル・有効期限を更新する。",
      inputSchema: {
        ...groupArg,
        user_id: z.number().int().positive().describe("更新するユーザーのID。"),
        access_level: accessLevelArg,
        expires_at: z
          .string()
          .optional()
          .describe("メンバーシップの有効期限（YYYY-MM-DD形式）。省略時は変更しない。"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ group, user_id, access_level, expires_at }) => {
      const member = await client.put<GitLabGroupMember>(
        `/groups/${GitLabClient.encodeId(group)}/members/${user_id}`,
        { access_level, expires_at },
      );
      return jsonResult(memberSummary(member));
    }),
  );
}
