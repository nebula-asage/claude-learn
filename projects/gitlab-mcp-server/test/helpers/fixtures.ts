/**
 * GitLab API レスポンスの最小フィクスチャ。
 * src/gitlab/types.ts の interface に型を合わせてあるので、GitLab 側の型定義を
 * 変更するとここがコンパイルエラーになる（＝型レベルの回帰検知も兼ねる）。
 */

import type {
  GitLabBranch,
  GitLabCommit,
  GitLabFile,
  GitLabIssue,
  GitLabJob,
  GitLabMergeRequest,
  GitLabMergeRequestDiff,
  GitLabNote,
  GitLabPipeline,
  GitLabProject,
  GitLabSearchBlob,
  GitLabTreeItem,
  GitLabUserRef,
} from "../../src/gitlab/types.js";

export const userFixture: GitLabUserRef = { id: 7, username: "alice", name: "Alice" };

export function projectFixture(overrides: Partial<GitLabProject> = {}): GitLabProject {
  return {
    id: 42,
    path_with_namespace: "grp/sub/proj",
    name: "proj",
    description: "説明文",
    default_branch: "main",
    web_url: "https://gitlab.example.com/grp/sub/proj",
    visibility: "private",
    ...overrides,
  };
}

export function treeItemFixture(overrides: Partial<GitLabTreeItem> = {}): GitLabTreeItem {
  return { id: "abc123", name: "index.ts", type: "blob", path: "src/index.ts", mode: "100644", ...overrides };
}

export function fileFixture(overrides: Partial<GitLabFile> = {}): GitLabFile {
  return {
    file_name: "index.ts",
    file_path: "src/index.ts",
    size: 11,
    encoding: "base64",
    content: Buffer.from("hello world", "utf8").toString("base64"),
    content_sha256: "sha256value",
    ref: "main",
    last_commit_id: "commit123",
    ...overrides,
  };
}

export function branchFixture(overrides: Partial<GitLabBranch> = {}): GitLabBranch {
  return {
    name: "main",
    default: true,
    protected: true,
    merged: false,
    web_url: "https://gitlab.example.com/grp/sub/proj/-/tree/main",
    commit: { id: "commit123", short_id: "commit1", title: "初回コミット", committed_date: "2026-01-01T00:00:00Z" },
    ...overrides,
  };
}

export function commitFixture(overrides: Partial<GitLabCommit> = {}): GitLabCommit {
  return {
    id: "commit123",
    short_id: "commit1",
    title: "初回コミット",
    message: "初回コミット\n\n詳細な本文",
    author_name: "Alice",
    committed_date: "2026-01-01T00:00:00Z",
    web_url: "https://gitlab.example.com/grp/sub/proj/-/commit/commit123",
    ...overrides,
  };
}

export function searchBlobFixture(overrides: Partial<GitLabSearchBlob> = {}): GitLabSearchBlob {
  return { path: "src/index.ts", filename: "index.ts", data: "const x = 1;", ref: "main", project_id: 42, ...overrides };
}

export function issueFixture(overrides: Partial<GitLabIssue> = {}): GitLabIssue {
  return {
    id: 1001,
    iid: 12,
    project_id: 42,
    title: "バグ報告",
    description: "再現手順",
    state: "opened",
    labels: ["bug"],
    author: userFixture,
    assignees: [userFixture, { id: 8, username: "bob", name: "Bob" }],
    milestone: { id: 5, title: "v1.0" },
    web_url: "https://gitlab.example.com/grp/sub/proj/-/issues/12",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

export function noteFixture(overrides: Partial<GitLabNote> = {}): GitLabNote {
  return {
    id: 2001,
    body: "コメント本文",
    author: userFixture,
    created_at: "2026-01-03T00:00:00Z",
    updated_at: "2026-01-03T00:00:00Z",
    system: false,
    ...overrides,
  };
}

export function mrFixture(overrides: Partial<GitLabMergeRequest> = {}): GitLabMergeRequest {
  return {
    id: 3001,
    iid: 34,
    project_id: 42,
    title: "機能追加",
    description: "変更内容の説明",
    state: "opened",
    source_branch: "feat/x",
    target_branch: "main",
    author: userFixture,
    merge_status: "can_be_merged",
    detailed_merge_status: "mergeable",
    draft: false,
    web_url: "https://gitlab.example.com/grp/sub/proj/-/merge_requests/34",
    created_at: "2026-01-04T00:00:00Z",
    updated_at: "2026-01-05T00:00:00Z",
    ...overrides,
  };
}

export function diffFixture(overrides: Partial<GitLabMergeRequestDiff> = {}): GitLabMergeRequestDiff {
  return {
    old_path: "src/a.ts",
    new_path: "src/a.ts",
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    diff: "@@ -1 +1 @@\n-old\n+new\n",
    ...overrides,
  };
}

export function pipelineFixture(overrides: Partial<GitLabPipeline> = {}): GitLabPipeline {
  return {
    id: 5001,
    iid: 9,
    project_id: 42,
    status: "success",
    ref: "main",
    sha: "sha123",
    web_url: "https://gitlab.example.com/grp/sub/proj/-/pipelines/5001",
    created_at: "2026-01-06T00:00:00Z",
    updated_at: "2026-01-06T01:00:00Z",
    ...overrides,
  };
}

export function jobFixture(overrides: Partial<GitLabJob> = {}): GitLabJob {
  return {
    id: 6001,
    name: "build",
    stage: "build",
    status: "success",
    ref: "main",
    created_at: "2026-01-06T00:00:00Z",
    started_at: "2026-01-06T00:00:10Z",
    finished_at: "2026-01-06T00:01:00Z",
    duration: 50,
    web_url: "https://gitlab.example.com/grp/sub/proj/-/jobs/6001",
    ...overrides,
  };
}
