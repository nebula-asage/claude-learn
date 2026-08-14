/**
 * HTTPトランスポートの検証。ここだけは実HTTPサーバーに対して本物の fetch でリクエストを送るため、
 * test/helpers/fetchMock.ts の installFetchMock は絶対に使わない
 * （このファイルでグローバル fetch をスタブすると自己矛盾になる）。
 *
 * runHttp() は SIGINT/SIGTERM リスナーを登録するため、1ファイルあたりの起動数は
 * 最小限（認証なし用・認証あり用の2インスタンス）に留める。シグナルを送らない限り
 * process.exit は発火しないので、テストからは到達しない。
 *
 * handleRequest 内の catch節（想定外エラー時の500応答）も意図的に対象外にしている。
 * 到達させるにはリクエスト読み取り中にソケットを強制破壊するような黒箱テストが必要だが、
 * vitest プロセス自体を巻き込みかねない不安定な手段になるため、費用対効果が見合わない。
 */
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runHttp } from "../../src/transports/http.js";
import { baseConfig } from "../helpers/mcp.js";

let serverNoAuth: http.Server;
let baseUrlNoAuth: string;
let serverWithAuth: http.Server;
let baseUrlWithAuth: string;

function addressToUrl(server: http.Server): string {
  const addr = server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

beforeAll(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  serverNoAuth = await runHttp({
    ...baseConfig,
    mcpTransport: "http",
    mcpHttpHost: "127.0.0.1",
    mcpHttpPort: 0,
    mcpHttpAuthToken: undefined,
    mcpHttpAllowedOrigins: [],
  });
  baseUrlNoAuth = addressToUrl(serverNoAuth);

  serverWithAuth = await runHttp({
    ...baseConfig,
    mcpTransport: "http",
    mcpHttpHost: "127.0.0.1",
    mcpHttpPort: 0,
    mcpHttpAuthToken: "secret",
    mcpHttpAllowedOrigins: ["https://allowed.example"],
  });
  baseUrlWithAuth = addressToUrl(serverWithAuth);
});

afterAll(async () => {
  await new Promise<void>((resolve) => serverNoAuth.close(() => resolve()));
  await new Promise<void>((resolve) => serverWithAuth.close(() => resolve()));
  vi.restoreAllMocks();
});

describe("GET /healthz", () => {
  it("200 で {status:'ok'} を返す", async () => {
    const res = await fetch(`${baseUrlNoAuth}/healthz`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("未知のパス", () => {
  it("404 を返す", async () => {
    const res = await fetch(`${baseUrlNoAuth}/unknown`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });
});

describe("許可されていないHTTPメソッド", () => {
  it("PATCH /mcp は 405", async () => {
    const res = await fetch(`${baseUrlNoAuth}/mcp`, { method: "PATCH" });
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: "method not allowed" });
  });
});

describe("Origin検証（DNSリバインディング対策）", () => {
  it("Originヘッダが無ければ許可リストが空でも通る", async () => {
    // Origin無しはブラウザ経由でないとみなし常に許可される。PATCHで405が返ること自体が
    // 403で弾かれていない証拠になる。
    const res = await fetch(`${baseUrlNoAuth}/mcp`, { method: "PATCH" });
    expect(res.status).not.toBe(403);
  });

  it("Originヘッダがあり許可リストが空なら403", async () => {
    const res = await fetch(`${baseUrlNoAuth}/mcp`, {
      method: "GET",
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ jsonrpc: "2.0", error: { code: -32000 }, id: null });
  });

  it("許可リストに無いOriginは403（認証ありサーバ）", async () => {
    const res = await fetch(`${baseUrlWithAuth}/mcp`, {
      method: "GET",
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });

  it("許可リストにあるOriginは403にならない（認証ありサーバ）", async () => {
    const res = await fetch(`${baseUrlWithAuth}/mcp`, {
      method: "GET",
      headers: { Origin: "https://allowed.example" },
    });
    expect(res.status).not.toBe(403);
  });
});

describe("Bearer認証", () => {
  it("トークン未設定なら Authorization ヘッダが無くても通る", async () => {
    const res = await fetch(`${baseUrlNoAuth}/mcp`, { method: "GET" });
    expect(res.status).not.toBe(401);
  });

  it("トークン設定時、Authorizationヘッダが無ければ401とWWW-Authenticateを返す", async () => {
    const res = await fetch(`${baseUrlWithAuth}/mcp`, { method: "GET" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("トークンが誤っていれば401", async () => {
    const res = await fetch(`${baseUrlWithAuth}/mcp`, {
      method: "GET",
      headers: { Authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("プレフィックスが Bearer でなければ401（例: Token）", async () => {
    const res = await fetch(`${baseUrlWithAuth}/mcp`, {
      method: "GET",
      headers: { Authorization: "Token secret" },
    });
    expect(res.status).toBe(401);
  });

  // startsWith("Bearer ") は大小文字を区別する。現状仕様として固定する。
  it("プレフィックスの大小文字違いは401（例: bearer）", async () => {
    const res = await fetch(`${baseUrlWithAuth}/mcp`, {
      method: "GET",
      headers: { Authorization: "bearer secret" },
    });
    expect(res.status).toBe(401);
  });

  it("正しいBearerトークンなら401にならない", async () => {
    const res = await fetch(`${baseUrlWithAuth}/mcp`, {
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    });
    expect(res.status).not.toBe(401);
  });
});

describe("リクエストボディ・セッションIDの検証", () => {
  it("POSTボディが不正なJSONなら400", async () => {
    const res = await fetch(`${baseUrlNoAuth}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("リクエストボディが正しいJSONではありません。");
  });

  it("未知の mcp-session-id を指定したPOSTは404", async () => {
    const res = await fetch(`${baseUrlNoAuth}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "mcp-session-id": "unknown-id" },
      body: "{}",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toBe("セッションが見つかりません: unknown-id");
  });

  it("GET /mcp に mcp-session-id が無ければ400", async () => {
    const res = await fetch(`${baseUrlNoAuth}/mcp`, { method: "GET" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("mcp-session-id ヘッダが必要です。");
  });

  it("DELETE /mcp に mcp-session-id が無ければ400", async () => {
    const res = await fetch(`${baseUrlNoAuth}/mcp`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("セッションIDが無く initialize リクエストでもないPOSTは400", async () => {
    const res = await fetch(`${baseUrlNoAuth}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("セッションIDが無く、initializeリクエストでもありません。");
  });

  it("ボディが上限（10MB）を超えるPOSTは413", async () => {
    const oversized = "a".repeat(10 * 1024 * 1024 + 1);
    const res = await fetch(`${baseUrlNoAuth}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversized,
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.message).toBe("リクエストボディが大きすぎます。");
  });
});

describe("セッションのライフサイクル（initialize→利用→終了）", () => {
  it("initializeで新規セッションが張られ、以降のPOST/GET/DELETEをそのセッションIDで処理できる", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrlNoAuth}/mcp`));
    const client = new Client({ name: "coverage-test-client", version: "0.0.0" });

    await client.connect(transport);
    const sessionId = transport.sessionId;
    expect(sessionId).toBeDefined();

    // 既存セッションIDでの通常のPOST（tools/list）が通ること。
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);

    // DELETE によるセッション終了（transport.handleRequest の GET/DELETE 経路）。
    await transport.terminateSession();

    // セッションが消えているので、同じセッションIDでの以降の呼び出しは404になる。
    const res = await fetch(`${baseUrlNoAuth}/mcp`, {
      method: "GET",
      headers: { "mcp-session-id": sessionId ?? "" },
    });
    expect(res.status).toBe(404);

    await client.close();
  });
});
