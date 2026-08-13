import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

/** 必須項目だけ埋めた env を作る。 */
function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    GITLAB_BASE_URL: "https://gitlab.example.com",
    GITLAB_TOKEN: "glpat-token",
    ...overrides,
  };
}

describe("loadConfig - 必須項目とベースURLの正規化", () => {
  it("GITLAB_BASE_URL が未設定なら ConfigError を投げる", () => {
    expect(() => loadConfig({ GITLAB_TOKEN: "glpat-token" })).toThrow(ConfigError);
  });

  it("GITLAB_BASE_URL が空白のみなら ConfigError を投げる", () => {
    expect(() => loadConfig(env({ GITLAB_BASE_URL: "   " }))).toThrow(ConfigError);
  });

  it("GITLAB_TOKEN が未設定なら ConfigError を投げる", () => {
    expect(() => loadConfig({ GITLAB_BASE_URL: "https://gitlab.example.com" })).toThrow(
      ConfigError,
    );
  });

  it("末尾スラッシュを除去して origin に正規化する", () => {
    expect(loadConfig(env({ GITLAB_BASE_URL: "https://gitlab.example.com/" })).gitlabBaseUrl).toBe(
      "https://gitlab.example.com",
    );
  });

  it("ポート番号は origin に残る", () => {
    expect(
      loadConfig(env({ GITLAB_BASE_URL: "https://gitlab.example.com:8443/" })).gitlabBaseUrl,
    ).toBe("https://gitlab.example.com:8443");
  });

  it("パス付きのベースURL（サブパス配置）は ConfigError で拒否する", () => {
    expect(() => loadConfig(env({ GITLAB_BASE_URL: "https://gitlab.example.com/gitlab" }))).toThrow(
      ConfigError,
    );
  });

  it("URLとしてパースできない値は ConfigError で拒否する", () => {
    expect(() => loadConfig(env({ GITLAB_BASE_URL: "not-a-url" }))).toThrow(ConfigError);
  });
});

describe("loadConfig - 既定値", () => {
  it("任意項目を全て省略したときの既定値を固定する", () => {
    expect(loadConfig(env())).toEqual({
      gitlabBaseUrl: "https://gitlab.example.com",
      gitlabToken: "glpat-token",
      gitlabDefaultProject: undefined,
      gitlabReadOnly: false,
      gitlabTimeoutMs: 30_000,
      mcpTransport: "stdio",
      mcpHttpHost: "127.0.0.1",
      mcpHttpPort: 3000,
      mcpHttpAuthToken: undefined,
      mcpHttpAllowedOrigins: [],
    });
  });
});

describe("loadConfig - 真偽値のパース", () => {
  it.each(["true", "1"])("GITLAB_READ_ONLY=%s は true になる", (raw) => {
    expect(loadConfig(env({ GITLAB_READ_ONLY: raw })).gitlabReadOnly).toBe(true);
  });

  it.each(["false", "0"])("GITLAB_READ_ONLY=%s は false になる", (raw) => {
    expect(loadConfig(env({ GITLAB_READ_ONLY: raw })).gitlabReadOnly).toBe(false);
  });

  it("空文字は未設定として扱い既定値になる", () => {
    expect(loadConfig(env({ GITLAB_READ_ONLY: "" })).gitlabReadOnly).toBe(false);
  });

  // 大文字は意図的に受け付けない（曖昧な設定値を早期に落とす方針）。
  it.each(["TRUE", "True", "yes", "on"])("GITLAB_READ_ONLY=%s は ConfigError になる", (raw) => {
    expect(() => loadConfig(env({ GITLAB_READ_ONLY: raw }))).toThrow(ConfigError);
  });
});

describe("loadConfig - 正の整数のパース", () => {
  it("GITLAB_TIMEOUT_MS を数値として読む", () => {
    expect(loadConfig(env({ GITLAB_TIMEOUT_MS: "5000" })).gitlabTimeoutMs).toBe(5000);
  });

  it.each(["0", "-1", "abc"])("GITLAB_TIMEOUT_MS=%s は ConfigError になる", (raw) => {
    expect(() => loadConfig(env({ GITLAB_TIMEOUT_MS: raw }))).toThrow(ConfigError);
  });

  // Number.parseInt の前方一致により単位付き文字列が通ってしまう。意図した仕様ではないが
  // 現状挙動として固定する。厳密化する場合はこのテストを意図的に更新すること。
  it("GITLAB_TIMEOUT_MS='30000ms' は 30000 として受理される（既知の緩さ）", () => {
    expect(loadConfig(env({ GITLAB_TIMEOUT_MS: "30000ms" })).gitlabTimeoutMs).toBe(30_000);
  });

  it("MCP_HTTP_PORT も同じパーサを通る", () => {
    expect(loadConfig(env({ MCP_HTTP_PORT: "8080" })).mcpHttpPort).toBe(8080);
    expect(() => loadConfig(env({ MCP_HTTP_PORT: "0" }))).toThrow(ConfigError);
  });
});

describe("loadConfig - その他の項目", () => {
  it("MCP_TRANSPORT=http を受理する", () => {
    expect(loadConfig(env({ MCP_TRANSPORT: "http" })).mcpTransport).toBe("http");
  });

  it("MCP_TRANSPORT=sse は ConfigError になる", () => {
    expect(() => loadConfig(env({ MCP_TRANSPORT: "sse" }))).toThrow(ConfigError);
  });

  it("GITLAB_DEFAULT_PROJECT が空文字なら undefined になる", () => {
    expect(loadConfig(env({ GITLAB_DEFAULT_PROJECT: "" })).gitlabDefaultProject).toBeUndefined();
    expect(loadConfig(env({ GITLAB_DEFAULT_PROJECT: "grp/repo" })).gitlabDefaultProject).toBe(
      "grp/repo",
    );
  });

  it("MCP_HTTP_AUTH_TOKEN が空文字なら undefined になる", () => {
    expect(loadConfig(env({ MCP_HTTP_AUTH_TOKEN: "" })).mcpHttpAuthToken).toBeUndefined();
  });

  it("MCP_HTTP_ALLOWED_ORIGINS はカンマ区切りで trim され、空要素は除去される", () => {
    expect(
      loadConfig(env({ MCP_HTTP_ALLOWED_ORIGINS: " https://a.example , , https://b.example " }))
        .mcpHttpAllowedOrigins,
    ).toEqual(["https://a.example", "https://b.example"]);
  });

  it("MCP_HTTP_ALLOWED_ORIGINS が空文字なら空配列になる", () => {
    expect(loadConfig(env({ MCP_HTTP_ALLOWED_ORIGINS: "" })).mcpHttpAllowedOrigins).toEqual([]);
  });

  it("引数で渡した env のみを参照し、process.env を変更しない", () => {
    const before = { ...process.env };
    const custom = env({
      GITLAB_BASE_URL: "https://other.example.com",
      GITLAB_TOKEN: "glpat-other",
    });
    const config = loadConfig(custom);
    expect(config.gitlabBaseUrl).toBe("https://other.example.com");
    expect(config.gitlabToken).toBe("glpat-other");
    expect(process.env).toEqual(before);
  });
});
