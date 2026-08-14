/**
 * GitLab REST API (v4) のレスポンスのうち、本サーバが使う最小限の型のみを定義する。
 * GitLab 側で追加されるフィールドは多いため、あえて厳密な網羅は行わず必要なものだけ拾う。
 * @packageDocumentation
 */

/** `GET /projects` および `GET /projects/:id` のレスポンス要素（`tools/repository.ts`）。 */
export interface GitLabProject {
  /** GitLab内部のプロジェクトID。 */
  id: number;
  /** `namespace/repo` 形式のフルパス。ツール引数 `project` にはこの値か数値IDを指定する。 */
  path_with_namespace: string;
  /** プロジェクト名（表示名）。 */
  name: string;
  /** プロジェクトの説明文。未設定の場合は `null`。 */
  description: string | null;
  /** 未設定（空リポジトリ等）の場合は `null`。 */
  default_branch: string | null;
  /** GitLab上のプロジェクトページURL。 */
  web_url: string;
  /** `private` / `internal` / `public` のいずれか。 */
  visibility: string;
}

/** `GET /projects/:id/repository/tree` のレスポンス要素（`tools/repository.ts`）。 */
export interface GitLabTreeItem {
  /** GitLabのblob/tree SHA（コミットIDではない）。 */
  id: string;
  /** ファイル名またはディレクトリ名（パスの末尾部分）。 */
  name: string;
  /** ディレクトリなら `tree`、ファイルなら `blob`。 */
  type: "tree" | "blob";
  /** リポジトリルートからの相対パス。 */
  path: string;
  /** Gitのファイルモード（例: `100644`）。 */
  mode: string;
}

/** `GET /projects/:id/repository/files/:file_path` のレスポンス（`tools/repository.ts`）。 */
export interface GitLabFile {
  /** ファイル名（パスの末尾部分）。 */
  file_name: string;
  /** リポジトリルートからのファイルパス。 */
  file_path: string;
  /** バイト数。`encoding` に関わらずデコード前の元ファイルサイズ。 */
  size: number;
  /** `base64` の場合、`content` はbase64エンコードされている（`repository.ts` がデコードする）。 */
  encoding: string;
  /** `encoding` に応じてbase64またはプレーンテキスト。 */
  content: string;
  /** ファイル内容のSHA256ハッシュ。 */
  content_sha256: string;
  /** 実際に解決されたref（ブランチ名・タグ名・SHA）。 */
  ref: string;
  /** このファイルに対する最終コミットのSHA。 */
  last_commit_id: string;
}

/** `GET /projects/:id/repository/branches` のレスポンス要素（`tools/repository.ts`）。 */
export interface GitLabBranch {
  /** ブランチ名。 */
  name: string;
  /** プロジェクトのデフォルトブランチかどうか。 */
  default: boolean;
  /** 保護ブランチかどうか。 */
  protected: boolean;
  /** デフォルトブランチへマージ済みかどうか。 */
  merged: boolean;
  /** GitLab上のブランチ比較ページURL。 */
  web_url: string;
  /** 空リポジトリ等でブランチにコミットが無い場合は `null`。 */
  commit: {
    /** コミットのフルSHA。 */
    id: string;
    /** コミットの短縮SHA。 */
    short_id: string;
    /** コミットメッセージの1行目。 */
    title: string;
    /** ISO8601形式。 */
    committed_date: string;
  } | null;
}

/** `GET /projects/:id/repository/commits` のレスポンス要素（`tools/repository.ts`）。 */
export interface GitLabCommit {
  /** コミットのフルSHA。 */
  id: string;
  /** コミットの短縮SHA。 */
  short_id: string;
  /** コミットメッセージの1行目。 */
  title: string;
  /** コミットメッセージ全文。 */
  message: string;
  /** 著者名（Gitの `author.name`）。 */
  author_name: string;
  /** ISO8601形式。 */
  committed_date: string;
  /** GitLab上のコミット詳細ページURL。 */
  web_url: string;
}

/** `GET /projects/:id/search` または `GET /search`（scope=blobs）のレスポンス要素（`tools/repository.ts`）。 */
export interface GitLabSearchBlob {
  /** ヒットしたファイルのリポジトリ内パス。 */
  path: string;
  /** ヒットしたファイル名（パスの末尾部分）。 */
  filename: string;
  /** マッチ箇所周辺のコードスニペット（ファイル全文ではない）。 */
  data: string;
  /** 検索対象のブランチ名・タグ名。 */
  ref: string;
  /** インスタンス全体検索（`project` 省略時）の場合のみ含まれる。 */
  project_id?: number;
}

/** Issue/MR/ノートの `author`・`assignees` 等に埋め込まれる、最小限のユーザー参照。 */
export interface GitLabUserRef {
  /** GitLab内部のユーザーID。 */
  id: number;
  /** ログインユーザー名（`@` 抜き）。 */
  username: string;
  /** 表示名（フルネーム）。 */
  name: string;
}

/** `GET /projects/:id/issues` および個別取得のレスポンス要素（`tools/issues.ts`）。 */
export interface GitLabIssue {
  /** GitLab内部のIssue ID（インスタンス全体で一意）。 */
  id: number;
  /** プロジェクト内の連番。本サーバのツール引数 `issue_iid` はこちらを指す（`id` ではない）。 */
  iid: number;
  /** このIssueが属するプロジェクトのID。 */
  project_id: number;
  /** Issueのタイトル。 */
  title: string;
  /** Issueの説明文（Markdown）。未設定の場合は `null`。 */
  description: string | null;
  /** `opened` または `closed`。 */
  state: string;
  /** 付与されているラベル名の配列。 */
  labels: string[];
  /** 作成者。 */
  author: GitLabUserRef;
  /** 担当者の配列（0人以上）。 */
  assignees: GitLabUserRef[];
  /** マイルストーン未設定の場合は `null`。 */
  milestone: {
    /** マイルストーンID。 */
    id: number;
    /** マイルストーン名。 */
    title: string;
  } | null;
  /** GitLab上のIssue詳細ページURL。 */
  web_url: string;
  /** ISO8601形式。 */
  created_at: string;
  /** ISO8601形式。 */
  updated_at: string;
}

/** Issue/MRの `GET .../notes` のレスポンス要素（`tools/issues.ts`, `tools/mergeRequests.ts`）。 */
export interface GitLabNote {
  /** ノートID。 */
  id: number;
  /** コメント本文（Markdown）。 */
  body: string;
  /** 投稿者。 */
  author: GitLabUserRef;
  /** ISO8601形式。 */
  created_at: string;
  /** ISO8601形式。 */
  updated_at: string;
  /**
   * true の場合、GitLabが自動生成したシステムノート（例: "changed the description"）。
   * `tools/issues.ts`・`tools/mergeRequests.ts` は一覧取得時にこれを除外する。
   */
  system: boolean;
}

/** `GET /projects/:id/merge_requests` および個別取得のレスポンス要素（`tools/mergeRequests.ts`）。 */
export interface GitLabMergeRequest {
  /** GitLab内部のMR ID（インスタンス全体で一意）。 */
  id: number;
  /** プロジェクト内の連番。本サーバのツール引数 `merge_request_iid` はこちらを指す。 */
  iid: number;
  /** このMRが属するプロジェクトのID。 */
  project_id: number;
  /** マージリクエストのタイトル。 */
  title: string;
  /** 説明文（Markdown）。未設定の場合は `null`。 */
  description: string | null;
  /** `opened` / `closed` / `merged` のいずれか。 */
  state: string;
  /** マージ元ブランチ名。 */
  source_branch: string;
  /** マージ先ブランチ名。 */
  target_branch: string;
  /** 作成者。 */
  author: GitLabUserRef;
  /** マージ可否のおおまかな状態（例: `can_be_merged`, `cannot_be_merged`）。 */
  merge_status: string;
  /** GitLabのバージョン・スコープによっては含まれない場合がある、より詳細なマージ可否状態。 */
  detailed_merge_status?: string;
  /** ドラフトMRかどうか。 */
  draft: boolean;
  /** GitLab上のMR詳細ページURL。 */
  web_url: string;
  /** ISO8601形式。 */
  created_at: string;
  /** ISO8601形式。 */
  updated_at: string;
}

/** `GET /projects/:id/merge_requests/:iid/diffs` のレスポンス要素（`tools/mergeRequests.ts`）。 */
export interface GitLabMergeRequestDiff {
  /** マージ前のファイルパス。新規ファイルの場合も旧パスとして使われる。 */
  old_path: string;
  /** マージ後のファイルパス。 */
  new_path: string;
  /** 新規追加されたファイルかどうか。 */
  new_file: boolean;
  /** リネームされたファイルかどうか。 */
  renamed_file: boolean;
  /** 削除されたファイルかどうか。 */
  deleted_file: boolean;
  /** unified diff形式の差分本文。 */
  diff: string;
}

/** `GET /projects/:id/pipelines` および個別取得のレスポンス要素（`tools/pipelines.ts`）。 */
export interface GitLabPipeline {
  /** パイプラインID。 */
  id: number;
  /** プロジェクト内の連番。 */
  iid: number;
  /** このパイプラインが属するプロジェクトのID。 */
  project_id: number;
  /** 例: `created` / `pending` / `running` / `success` / `failed` / `canceled` / `skipped`。 */
  status: string;
  /** パイプラインが実行されたブランチ名・タグ名。 */
  ref: string;
  /** パイプラインの対象コミットSHA。 */
  sha: string;
  /** GitLab上のパイプライン詳細ページURL。 */
  web_url: string;
  /** ISO8601形式。 */
  created_at: string;
  /** ISO8601形式。 */
  updated_at: string;
}

/** `GET /projects/:id/pipelines/:id/jobs` のレスポンス要素（`tools/pipelines.ts`）。 */
export interface GitLabJob {
  /** ジョブID。`gitlab_get_job_log` の `job_id` 引数に渡す値。 */
  id: number;
  /** ジョブ名（`.gitlab-ci.yml` 上で定義した名前）。 */
  name: string;
  /** `.gitlab-ci.yml` 上のステージ名。 */
  stage: string;
  /** 例: `success` / `failed` / `skipped` / `running` 等。 */
  status: string;
  /** 実行対象のブランチ名・タグ名。 */
  ref: string;
  /** ISO8601形式。 */
  created_at: string;
  /** まだ開始していない場合は `null`。ISO8601形式。 */
  started_at: string | null;
  /** まだ終了していない場合は `null`。ISO8601形式。 */
  finished_at: string | null;
  /** 実行時間（秒）。開始前は `null`。 */
  duration: number | null;
  /** GitLab上のジョブ詳細ページURL。 */
  web_url: string;
}

/** `GET /groups` および個別取得のレスポンス要素（`tools/groups.ts`）。 */
export interface GitLabGroup {
  /** GitLab内部のグループID。 */
  id: number;
  /** グループ名（表示名）。 */
  name: string;
  /** グループパス（サブグループを含まない末端部分）。 */
  path: string;
  /** `parent/child` 形式のフルパス。ツール引数 `group` にはこの値か数値IDを指定する。 */
  full_path: string;
  /** グループの説明文。未設定の場合は `null`。 */
  description: string | null;
  /** `private` / `internal` / `public` のいずれか。 */
  visibility: string;
  /** GitLab上のグループページURL。 */
  web_url: string;
  /** トップレベルグループの場合は `null`。 */
  parent_id: number | null;
}

/** `GET /groups/:id/members` のレスポンス要素（`tools/groups.ts`）。 */
export interface GitLabGroupMember {
  /** GitLab内部のユーザーID。 */
  id: number;
  /** ログインユーザー名（`@` 抜き）。 */
  username: string;
  /** 表示名（フルネーム）。 */
  name: string;
  /** 例: `active` / `awaiting` 等（招待中メンバー等の状態）。 */
  state: string;
  /** 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner（`tools/groups.ts` の `ACCESS_LEVEL_NAMES` 参照）。 */
  access_level: number;
  /** メンバーシップの有効期限（YYYY-MM-DD）。無期限の場合は `null`。 */
  expires_at: string | null;
  /** GitLab上のユーザープロフィールページURL。 */
  web_url: string;
}

/** ページング情報。GitLab のレスポンスヘッダから抽出する。 */
export interface PageInfo {
  /** 現在のページ番号（1始まり）。 */
  page: number;
  /** 1ページあたりの件数。 */
  perPage: number;
  /** 全件数。GitLab側がヘッダを返さない場合は `undefined`。 */
  totalItems: number | undefined;
  /** 全ページ数。GitLab側がヘッダを返さない場合は `undefined`。 */
  totalPages: number | undefined;
  /** 次ページ番号。次ページが無い場合は `undefined`（`pagedJsonResult` の `hasNextPage` の根拠）。 */
  nextPage: number | undefined;
}

/** `GitLabClient.getPaged` の戻り値。一覧本体とページ情報の組。 */
export interface PagedResult<T> {
  /** このページに含まれる要素。 */
  items: T[];
  /** ページング情報。 */
  page: PageInfo;
}
