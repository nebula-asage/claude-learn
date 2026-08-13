import type { Config } from "../config.js";
import type { PageInfo, PagedResult } from "./types.js";

/**
 * GitLab API が返したエラー。ステータスコードと GitLab 側のメッセージを保持する。
 * メッセージにはリクエストヘッダ（PRIVATE-TOKEN）を絶対に含めない。
 */
export class GitLabApiError extends Error {
  readonly status: number;
  readonly gitlabDetail: unknown;

  constructor(status: number, message: string, gitlabDetail?: unknown) {
    super(message);
    this.name = "GitLabApiError";
    this.status = status;
    this.gitlabDetail = gitlabDetail;
  }
}

/** ツール引数の指定不備など、GitLab に到達する前のエラー。 */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

type QueryValue = string | number | boolean | undefined;
type Query = Record<string, QueryValue>;

function extractGitLabErrorMessage(detail: unknown): string | undefined {
  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
    if (record.message !== undefined) {
      try {
        return JSON.stringify(record.message);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export class GitLabClient {
  constructor(private readonly config: Config) {}

  /** `group/subgroup/project` 形式・数値IDのどちらでも安全にパスへ埋め込めるようエンコードする。 */
  static encodeId(id: string | number): string {
    return encodeURIComponent(String(id));
  }

  /** ファイルパス等、パスセグメントに含める値をエンコードする（`/` も含めて確実にエンコードする）。 */
  static encodePathSegment(segment: string): string {
    return encodeURIComponent(segment);
  }

  /** `project` 引数省略時のデフォルトプロジェクトを解決する。どちらもなければ利用者向けエラーを投げる。 */
  resolveProject(project: string | undefined): string {
    const resolved = project ?? this.config.gitlabDefaultProject;
    if (!resolved) {
      throw new ToolInputError(
        "project が指定されておらず、GITLAB_DEFAULT_PROJECT も設定されていません。project 引数（例: 'group/repo' または数値ID）を指定してください。",
      );
    }
    return resolved;
  }

  private buildUrl(path: string, query?: Query): URL {
    const url = new URL(`/api/v4${path}`, this.config.gitlabBaseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  private async rawRequest(
    method: "GET" | "POST" | "PUT",
    path: string,
    opts: { query?: Query; body?: unknown } = {},
  ): Promise<Response> {
    const url = this.buildUrl(path, opts.query);
    const headers: Record<string, string> = {
      "PRIVATE-TOKEN": this.config.gitlabToken,
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(this.config.gitlabTimeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new GitLabApiError(
          0,
          `GitLab API へのリクエストがタイムアウトしました（${this.config.gitlabTimeoutMs}ms）: ${method} ${path}`,
        );
      }
      const detail = err instanceof Error ? err.message : String(err);
      throw new GitLabApiError(
        0,
        `GitLab API へのリクエストに失敗しました: ${method} ${path} (${detail})`,
      );
    }

    if (!res.ok) {
      let detail: unknown;
      try {
        detail = await res.clone().json();
      } catch {
        detail = undefined;
      }
      const detailMessage = extractGitLabErrorMessage(detail);
      throw new GitLabApiError(
        res.status,
        `GitLab API がエラーを返しました: ${method} ${path} -> ${res.status} ${res.statusText}${
          detailMessage ? `: ${detailMessage}` : ""
        }`,
        detail,
      );
    }

    return res;
  }

  async get<T>(path: string, query?: Query): Promise<T> {
    const res = await this.rawRequest("GET", path, { query });
    return (await res.json()) as T;
  }

  /** ページング付きの一覧系エンドポイント用。レスポンスヘッダから次ページの有無を読み取る。 */
  async getPaged<T>(path: string, query?: Query): Promise<PagedResult<T>> {
    const page = typeof query?.page === "number" ? query.page : 1;
    const perPage = typeof query?.per_page === "number" ? query.per_page : 20;
    const mergedQuery: Query = { ...query, page, per_page: perPage };

    const res = await this.rawRequest("GET", path, { query: mergedQuery });
    const items = (await res.json()) as T[];

    const headerInt = (name: string): number | undefined => {
      const raw = res.headers.get(name);
      if (raw === null || raw === "") return undefined;
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const pageInfo: PageInfo = {
      page: headerInt("x-page") ?? page,
      perPage: headerInt("x-per-page") ?? perPage,
      totalItems: headerInt("x-total"),
      totalPages: headerInt("x-total-pages"),
      nextPage: headerInt("x-next-page"),
    };

    return { items, page: pageInfo };
  }

  async post<T>(path: string, body?: unknown, query?: Query): Promise<T> {
    const res = await this.rawRequest("POST", path, { body: body ?? {}, query });
    return (await res.json()) as T;
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.rawRequest("PUT", path, { body: body ?? {} });
    return (await res.json()) as T;
  }

  /** ジョブログ・生ファイルなど、JSON ではなくテキストが返るエンドポイント用。 */
  async getText(path: string, query?: Query): Promise<string> {
    const res = await this.rawRequest("GET", path, { query });
    return await res.text();
  }
}

export interface TruncateResult {
  text: string;
  truncated: boolean;
  originalBytes: number;
}

/**
 * UTF-8 バイト数で文字列を切り詰める。マルチバイト文字の境界を跨いだ場合は
 * 置換文字（U+FFFD）が入り得るが、あくまで「切り詰められた」ことが分かれば十分とする。
 * @param from "head"（先頭からmaxBytes分を残す）または "tail"（末尾からmaxBytes分を残す）。
 *   ジョブログは失敗原因が末尾に出るため "tail" を既定にする。
 */
export function truncateUtf8(
  text: string,
  maxBytes: number,
  from: "head" | "tail" = "head",
): TruncateResult {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) {
    return { text, truncated: false, originalBytes: buf.byteLength };
  }
  const slice =
    from === "head" ? buf.subarray(0, maxBytes) : buf.subarray(buf.byteLength - maxBytes);
  return { text: slice.toString("utf8"), truncated: true, originalBytes: buf.byteLength };
}
