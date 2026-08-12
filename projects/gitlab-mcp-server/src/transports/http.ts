import { randomUUID } from "node:crypto";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../config.js";
import { createServer } from "../server.js";

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB。JSON-RPCリクエストとして十分大きく、かつ無制限読み込みを防ぐ上限。

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

function jsonRpcError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

async function readJsonBody(req: IncomingMessage, res: ServerResponse): Promise<unknown | undefined> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > MAX_BODY_BYTES) {
      jsonRpcError(res, 413, "リクエストボディが大きすぎます。");
      return undefined;
    }
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    jsonRpcError(res, 400, "リクエストボディが正しいJSONではありません。");
    return undefined;
  }
}

/**
 * DNS リバインディング対策。Origin ヘッダが付いているリクエストは、
 * 許可リスト（MCP_HTTP_ALLOWED_ORIGINS）に含まれる場合のみ通す。
 * 許可リストが空の場合、Origin 付きリクエスト（＝ブラウザ経由の可能性がある）は拒否する。
 * curl 等の非ブラウザクライアント（Originヘッダなし）は許可リストの影響を受けない。
 */
function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (origin === undefined) return true;
  return allowedOrigins.includes(origin);
}

function isAuthorized(req: IncomingMessage, authToken: string | undefined): boolean {
  if (!authToken) return true;
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  return token === authToken;
}

/** Streamable HTTP トランスポートでMCPサーバをリッスンする。セッションごとに独立したMcpServerインスタンスを持つ。 */
export async function runHttp(config: Config): Promise<http.Server> {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/healthz") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (url.pathname !== "/mcp") {
      sendJson(res, 404, { error: "not found" });
      return;
    }

    const origin = req.headers.origin;
    if (!isOriginAllowed(origin, config.mcpHttpAllowedOrigins)) {
      jsonRpcError(res, 403, `許可されていないOriginです: ${origin}`);
      return;
    }

    if (!isAuthorized(req, config.mcpHttpAuthToken)) {
      res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    const sessionIdHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

    try {
      if (req.method === "POST") {
        const body = await readJsonBody(req, res);
        if (res.writableEnded) return; // readJsonBody 内でエラー応答済み

        let transport = sessionId ? transports.get(sessionId) : undefined;

        if (!transport) {
          if (sessionId) {
            jsonRpcError(res, 404, `セッションが見つかりません: ${sessionId}`);
            return;
          }
          if (!isInitializeRequest(body)) {
            jsonRpcError(res, 400, "セッションIDが無く、initializeリクエストでもありません。");
            return;
          }

          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (initializedId) => {
              transports.set(initializedId, transport as StreamableHTTPServerTransport);
              console.error(`[gitlab-mcp-server] HTTPセッションを開始しました: ${initializedId}`);
            },
          });
          transport.onclose = () => {
            const closedId = transport?.sessionId;
            if (closedId && transports.has(closedId)) {
              transports.delete(closedId);
              console.error(`[gitlab-mcp-server] HTTPセッションを終了しました: ${closedId}`);
            }
          };

          const mcpServer = createServer(config);
          await mcpServer.connect(transport);
        }

        await transport.handleRequest(req, res, body);
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        if (!sessionId) {
          jsonRpcError(res, 400, "mcp-session-id ヘッダが必要です。");
          return;
        }
        const transport = transports.get(sessionId);
        if (!transport) {
          jsonRpcError(res, 404, `セッションが見つかりません: ${sessionId}`);
          return;
        }
        await transport.handleRequest(req, res);
        return;
      }

      sendJson(res, 405, { error: "method not allowed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[gitlab-mcp-server] HTTPリクエスト処理中にエラー: ${message}`);
      if (!res.headersSent) {
        jsonRpcError(res, 500, "サーバ内部エラーが発生しました。");
      }
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(config.mcpHttpPort, config.mcpHttpHost, resolve);
  });
  console.error(
    `[gitlab-mcp-server] HTTPトランスポートで起動しました: http://${config.mcpHttpHost}:${config.mcpHttpPort}/mcp`,
  );

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  async function shutdown(): Promise<void> {
    console.error("[gitlab-mcp-server] シャットダウンしています...");
    for (const [id, transport] of transports) {
      try {
        await transport.close();
      } catch (err) {
        console.error(`[gitlab-mcp-server] セッション ${id} のクローズに失敗: ${err}`);
      }
    }
    httpServer.close(() => process.exit(0));
  }

  return httpServer;
}
