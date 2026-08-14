/**
 * 環境変数の読込・検証。
 * 不足・不正がある場合は起動時にエラーを投げて即座に落とす（実行途中で気づかせない）。
 * @packageDocumentation
 */

/** {@link loadConfig} が返す、検証済みの起動設定。 */
export interface Config {
  /** GitLab インスタンスのオリジン（例: `https://gitlab.example.com`）。パスは含まない。 */
  gitlabBaseUrl: string;
  /** GitLab パーソナルアクセストークン。`PRIVATE-TOKEN` ヘッダで送信する。 */
  gitlabToken: string;
  /** `project` 引数省略時のデフォルトプロジェクト。未設定なら `undefined`（`resolveProject` が必須化する）。 */
  gitlabDefaultProject: string | undefined;
  /** true の場合、書込系ツールを一切登録しない（`tools/list` にも現れない）。 */
  gitlabReadOnly: boolean;
  /** GitLab APIリクエストのタイムアウト（ミリ秒）。 */
  gitlabTimeoutMs: number;
  /** MCPサーバの待ち受けトランスポート。 */
  mcpTransport: "stdio" | "http";
  /** HTTPモードのバインドアドレス。 */
  mcpHttpHost: string;
  /** HTTPモードのポート番号。 */
  mcpHttpPort: number;
  /** 設定時、HTTPモードで `Authorization: Bearer <token>` を必須にする。未設定なら認証なし。 */
  mcpHttpAuthToken: string | undefined;
  /**
   * DNSリバインディング対策の許可Originリスト。空配列の場合、Originヘッダ付きリクエスト
   * （＝ブラウザ経由の可能性がある）は全て拒否される（`transports/http.ts` の `isOriginAllowed`）。
   */
  mcpHttpAllowedOrigins: string[];
}

/** 環境変数の欠落・不正など、起動を継続できない設定エラー。`main()` はこれをスタック無しで表示して終了する。 */
export class ConfigError extends Error {}

function requireEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name];
  if (!value || value.trim() === "") {
    throw new ConfigError(`環境変数 ${name} が設定されていません。`);
  }
  return value;
}

function parseBooleanEnv(name: string, defaultValue: boolean, env: NodeJS.ProcessEnv): boolean {
  const raw = env[name];
  if (raw === undefined || raw === "") return defaultValue;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new ConfigError(`環境変数 ${name} は true/false で指定してください（値: ${raw}）。`);
}

function parsePositiveIntEnv(name: string, defaultValue: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(`環境変数 ${name} は正の整数で指定してください（値: ${raw}）。`);
  }
  return parsed;
}

function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`GITLAB_BASE_URL が不正なURLです（値: ${raw}）。`);
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new ConfigError(
      `GITLAB_BASE_URL にはパスを含めないでください（例: https://gitlab.example.com）。値: ${raw}`,
    );
  }
  // 末尾スラッシュ等を除去し、origin だけに正規化する
  return url.origin;
}

/**
 * 環境変数から起動設定を読み込み、検証する。
 * @param env 読み込み元の環境変数。既定は `process.env`（テストでは差し替え可能）。
 * @returns 検証済みの {@link Config}。
 * @throws ConfigError 必須の環境変数が欠落している、または値の形式が不正な場合。
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const gitlabBaseUrl = normalizeBaseUrl(requireEnv("GITLAB_BASE_URL", env));
  const gitlabToken = requireEnv("GITLAB_TOKEN", env);

  const transportRaw = env.MCP_TRANSPORT ?? "stdio";
  if (transportRaw !== "stdio" && transportRaw !== "http") {
    throw new ConfigError(
      `MCP_TRANSPORT は stdio か http を指定してください（値: ${transportRaw}）。`,
    );
  }

  const mcpHttpAllowedOrigins = (env.MCP_HTTP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return {
    gitlabBaseUrl,
    gitlabToken,
    gitlabDefaultProject: env.GITLAB_DEFAULT_PROJECT || undefined,
    gitlabReadOnly: parseBooleanEnv("GITLAB_READ_ONLY", false, env),
    gitlabTimeoutMs: parsePositiveIntEnv("GITLAB_TIMEOUT_MS", 30_000, env),
    mcpTransport: transportRaw,
    mcpHttpHost: env.MCP_HTTP_HOST || "127.0.0.1",
    mcpHttpPort: parsePositiveIntEnv("MCP_HTTP_PORT", 3000, env),
    mcpHttpAuthToken: env.MCP_HTTP_AUTH_TOKEN || undefined,
    mcpHttpAllowedOrigins,
  };
}
