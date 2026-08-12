/**
 * GitLab REST API (v4) のレスポンスのうち、本サーバが使う最小限の型のみを定義する。
 * GitLab 側で追加されるフィールドは多いため、あえて厳密な網羅は行わず必要なものだけ拾う。
 */

export interface GitLabProject {
  id: number;
  path_with_namespace: string;
  name: string;
  description: string | null;
  default_branch: string | null;
  web_url: string;
  visibility: string;
}

export interface GitLabTreeItem {
  id: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode: string;
}

export interface GitLabFile {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  last_commit_id: string;
}

export interface GitLabBranch {
  name: string;
  default: boolean;
  protected: boolean;
  merged: boolean;
  web_url: string;
  commit: {
    id: string;
    short_id: string;
    title: string;
    committed_date: string;
  } | null;
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  committed_date: string;
  web_url: string;
}

export interface GitLabSearchBlob {
  path: string;
  filename: string;
  data: string;
  ref: string;
  project_id?: number;
}

export interface GitLabUserRef {
  id: number;
  username: string;
  name: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: string;
  labels: string[];
  author: GitLabUserRef;
  assignees: GitLabUserRef[];
  milestone: { id: number; title: string } | null;
  web_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author: GitLabUserRef;
  created_at: string;
  updated_at: string;
  system: boolean;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: string;
  source_branch: string;
  target_branch: string;
  author: GitLabUserRef;
  merge_status: string;
  detailed_merge_status?: string;
  draft: boolean;
  web_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitLabMergeRequestDiff {
  old_path: string;
  new_path: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  diff: string;
}

export interface GitLabPipeline {
  id: number;
  iid: number;
  project_id: number;
  status: string;
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  ref: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
  web_url: string;
}

/** ページング情報。GitLab のレスポンスヘッダから抽出する。 */
export interface PageInfo {
  page: number;
  perPage: number;
  totalItems: number | undefined;
  totalPages: number | undefined;
  nextPage: number | undefined;
}

export interface PagedResult<T> {
  items: T[];
  page: PageInfo;
}
