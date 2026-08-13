/**
 * 実子プロセスE2Eテスト用の、最小限のGitLab APIモックHTTPサーバ。
 * test-env/（実GitLab CE、手動検証専用）とは別物で、こちらは自動テストから
 * 127.0.0.1の空きポートで起動する軽量スタブ。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  path: string;
  privateToken: string | undefined;
}

export interface MockGitLabServer {
  baseUrl: string;
  requests: RecordedRequest[];
  close(): Promise<void>;
}

export async function startMockGitLabServer(): Promise<MockGitLabServer> {
  const requests: RecordedRequest[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    requests.push({
      method: req.method ?? "GET",
      path: url.pathname,
      privateToken: req.headers["private-token"] as string | undefined,
    });

    if (url.pathname === "/api/v4/projects") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify([
          {
            id: 1,
            path_with_namespace: "mcp-test/demo",
            name: "demo",
            description: null,
            default_branch: "main",
            web_url: "http://mock-gitlab.invalid/mcp-test/demo",
          },
        ]),
      );
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "mock: unhandled path" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
