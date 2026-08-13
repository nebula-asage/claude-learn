import { afterEach, describe, expect, it, vi } from "vitest";
import { connect } from "../helpers/mcp.js";

const ALL_TOOL_NAMES = [
  "gitlab_list_projects",
  "gitlab_get_project",
  "gitlab_list_repository_tree",
  "gitlab_get_file_content",
  "gitlab_list_branches",
  "gitlab_list_commits",
  "gitlab_search_code",
  "gitlab_list_issues",
  "gitlab_get_issue",
  "gitlab_list_issue_notes",
  "gitlab_create_issue",
  "gitlab_update_issue",
  "gitlab_create_issue_note",
  "gitlab_list_merge_requests",
  "gitlab_get_merge_request",
  "gitlab_get_merge_request_diff",
  "gitlab_list_merge_request_notes",
  "gitlab_create_merge_request",
  "gitlab_update_merge_request",
  "gitlab_create_merge_request_note",
  "gitlab_list_pipelines",
  "gitlab_get_pipeline",
  "gitlab_list_pipeline_jobs",
  "gitlab_get_job_log",
];

const WRITE_TOOL_NAMES = [
  "gitlab_create_issue",
  "gitlab_update_issue",
  "gitlab_create_issue_note",
  "gitlab_create_merge_request",
  "gitlab_update_merge_request",
  "gitlab_create_merge_request_note",
];

const UPDATE_TOOL_NAMES = ["gitlab_update_issue", "gitlab_update_merge_request"];
const CREATE_TOOL_NAMES = WRITE_TOOL_NAMES.filter((n) => !UPDATE_TOOL_NAMES.includes(n));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tools/list - ツール表面", () => {
  it("全24ツールが名前完全一致で登録されている", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...ALL_TOOL_NAMES].sort());
    expect(tools).toHaveLength(24);
    await harness.close();
  });

  it("gitlabReadOnly=true では書込6ツールが登録されず18件になる", async () => {
    const harness = await connect({ gitlabReadOnly: true });
    const tools = await harness.listTools();
    const names = tools.map((t) => t.name);
    expect(tools).toHaveLength(18);
    for (const writeName of WRITE_TOOL_NAMES) {
      expect(names).not.toContain(writeName);
    }
    await harness.close();
  });

  it("全ツールに title・description・annotations が存在する", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.annotations, tool.name).toBeDefined();
    }
    await harness.close();
  });

  it("読取系18件は readOnlyHint === true", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    const readTools = tools.filter((t) => !WRITE_TOOL_NAMES.includes(t.name));
    expect(readTools).toHaveLength(18);
    for (const tool of readTools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    }
    await harness.close();
  });

  it("書込系6件は readOnlyHint === false かつ destructiveHint === false", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    for (const name of WRITE_TOOL_NAMES) {
      const tool = tools.find((t) => t.name === name);
      expect(tool?.annotations?.readOnlyHint, name).toBe(false);
      expect(tool?.annotations?.destructiveHint, name).toBe(false);
    }
    await harness.close();
  });

  it("update系は idempotentHint === true、create系は false", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    for (const name of UPDATE_TOOL_NAMES) {
      expect(tools.find((t) => t.name === name)?.annotations?.idempotentHint, name).toBe(true);
    }
    for (const name of CREATE_TOOL_NAMES) {
      expect(tools.find((t) => t.name === name)?.annotations?.idempotentHint, name).toBe(false);
    }
    await harness.close();
  });

  it("全ツール名が gitlab_ で始まる", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    for (const tool of tools) {
      expect(tool.name.startsWith("gitlab_")).toBe(true);
    }
    await harness.close();
  });

  it("全ツールの inputSchema は object 型で project は必須にならない", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    for (const tool of tools) {
      expect(tool.inputSchema.type, tool.name).toBe("object");
      expect(tool.inputSchema.required ?? [], tool.name).not.toContain("project");
    }
    await harness.close();
  });

  it("gitlab_get_issue の issue_iid は required に含まれる", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    const tool = tools.find((t) => t.name === "gitlab_get_issue");
    expect(tool?.inputSchema.required).toContain("issue_iid");
    await harness.close();
  });

  it("ページング系ツールの per_page には minimum:1 / maximum:100 が出る", async () => {
    const harness = await connect();
    const tools = await harness.listTools();
    const tool = tools.find((t) => t.name === "gitlab_list_issues");
    const perPage = tool?.inputSchema.properties?.per_page as
      { minimum?: number; maximum?: number } | undefined;
    expect(perPage?.minimum).toBe(1);
    expect(perPage?.maximum).toBe(100);
    await harness.close();
  });
});
