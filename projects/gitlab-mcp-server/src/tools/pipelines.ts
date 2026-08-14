import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GitLabClient, truncateUtf8 } from "../gitlab/client.js";
import type { GitLabJob, GitLabPipeline } from "../gitlab/types.js";
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
 * CI/CDパイプラインとジョブの読み取り専用ツール群。パイプラインの実行・再試行・キャンセルは
 * 意図的にスコープ外。このドメインに書込系ツールは無いため `config` は受け取らない。
 * @packageDocumentation
 */

const pipelineSummary = (p: GitLabPipeline) => ({
  id: p.id,
  status: p.status,
  ref: p.ref,
  sha: p.sha,
  web_url: p.web_url,
  created_at: p.created_at,
  updated_at: p.updated_at,
});

const jobSummary = (j: GitLabJob) => ({
  id: j.id,
  name: j.name,
  stage: j.stage,
  status: j.status,
  ref: j.ref,
  started_at: j.started_at,
  finished_at: j.finished_at,
  duration: j.duration,
  web_url: j.web_url,
});

/**
 * CI/パイプライン系の読み取り専用ツールを登録する。パイプライン実行・キャンセル等は今回のスコープに含めない。
 * @param server ツールを登録する `McpServer`。
 * @param client GitLab APIクライアント。
 */
export function registerPipelineTools(server: McpServer, client: GitLabClient): void {
  server.registerTool(
    "gitlab_list_pipelines",
    {
      title: "パイプライン一覧",
      description: "プロジェクトのCI/CDパイプラインを検索・一覧する。",
      inputSchema: {
        ...projectArg,
        ref: z.string().optional().describe("対象ブランチ・タグ名で絞り込む。"),
        status: z
          .enum([
            "created",
            "waiting_for_resource",
            "preparing",
            "pending",
            "running",
            "success",
            "failed",
            "canceled",
            "skipped",
            "manual",
            "scheduled",
          ])
          .optional()
          .describe("ステータスで絞り込む。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, ref, status, page, per_page }) => {
      const projectId = client.resolveProject(project);
      const { items, page: pageInfo } = await client.getPaged<GitLabPipeline>(
        `/projects/${GitLabClient.encodeId(projectId)}/pipelines`,
        { ref, status, page, per_page },
      );
      return pagedJsonResult(items.map(pipelineSummary), pageInfo);
    }),
  );

  server.registerTool(
    "gitlab_get_pipeline",
    {
      title: "パイプライン詳細取得",
      description: "指定したパイプラインの詳細を取得する。",
      inputSchema: {
        ...projectArg,
        pipeline_id: z.number().int().positive().describe("パイプラインID。"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, pipeline_id }) => {
      const projectId = client.resolveProject(project);
      const pipeline = await client.get<GitLabPipeline>(
        `/projects/${GitLabClient.encodeId(projectId)}/pipelines/${pipeline_id}`,
      );
      return jsonResult(pipelineSummary(pipeline));
    }),
  );

  server.registerTool(
    "gitlab_list_pipeline_jobs",
    {
      title: "パイプラインのジョブ一覧",
      description: "指定したパイプラインに含まれるジョブ一覧を取得する。",
      inputSchema: {
        ...projectArg,
        pipeline_id: z.number().int().positive().describe("パイプラインID。"),
        ...pagingArgs,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, pipeline_id, page, per_page }) => {
      const projectId = client.resolveProject(project);
      const { items, page: pageInfo } = await client.getPaged<GitLabJob>(
        `/projects/${GitLabClient.encodeId(projectId)}/pipelines/${pipeline_id}/jobs`,
        { page, per_page },
      );
      return pagedJsonResult(items.map(jobSummary), pageInfo);
    }),
  );

  server.registerTool(
    "gitlab_get_job_log",
    {
      title: "ジョブログ取得",
      description:
        "指定したCIジョブの実行ログ（trace）を取得する。失敗原因はログ末尾に出ることが多いため、既定では末尾から切り詰める。",
      inputSchema: {
        ...projectArg,
        job_id: z.number().int().positive().describe("ジョブID。"),
        max_bytes: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            `返すログの最大バイト数（デフォルト ${DEFAULT_MAX_BYTES}）。超過分は先頭を切り詰め、末尾を残す。`,
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withErrorHandling(async ({ project, job_id, max_bytes }) => {
      const projectId = client.resolveProject(project);
      const maxBytes = max_bytes ?? DEFAULT_MAX_BYTES;
      const log = await client.getText(
        `/projects/${GitLabClient.encodeId(projectId)}/jobs/${job_id}/trace`,
      );
      const { text, truncated, originalBytes } = truncateUtf8(log, maxBytes, "tail");
      return jsonResult({
        job_id,
        log: text,
        notice: truncationNotice(truncated, originalBytes, maxBytes),
      });
    }),
  );
}
