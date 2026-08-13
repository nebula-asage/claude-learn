/**
 * InMemoryTransport で createServer() に接続し、tools/list・tools/call を実行するためのハーネス。
 *
 * 非exportの整形ヘルパー（issueSummary / mrSummary / pipelineSummary / jobSummary）や
 * ツールハンドラは、整形後のJSONそのものが公開契約なのでここ経由で検証する。
 * テストのためだけにプロダクションコードをexport化することはしない。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../../src/config.js";
import { createServer } from "../../src/server.js";

/**
 * テスト全体で使う基準の Config。
 * - gitlabToken: 漏洩検査で grep しやすいよう、特徴的な値にしてある。
 * - gitlabDefaultProject: encodeId の検証を兼ねて `/` とスペースを含める。
 */
export const baseConfig: Config = {
  gitlabBaseUrl: "https://gitlab.example.com",
  gitlabToken: "glpat-SUPER-SECRET-TOKEN",
  gitlabDefaultProject: "grp/sub proj",
  gitlabReadOnly: false,
  gitlabTimeoutMs: 30_000,
  mcpTransport: "stdio",
  mcpHttpHost: "127.0.0.1",
  mcpHttpPort: 3000,
  mcpHttpAuthToken: undefined,
  mcpHttpAllowedOrigins: [],
};

// Client#callTool の戻り型は CallToolResult と旧仕様の { toolResult } との union になっており、
// そのままでは content に型が付かない。本サーバは常に CallToolResult 形式を返すので、
// ハーネス側で CallToolResult に寄せて扱う。
export type ToolCallResult = CallToolResult;
export type ToolListResult = Awaited<ReturnType<Client["listTools"]>>;
export type ToolDescriptor = ToolListResult["tools"][number];

export interface Harness {
  client: Client;
  /** tools/call のショートハンド。 */
  call(name: string, args?: Record<string, unknown>): Promise<ToolCallResult>;
  /** tools/list のショートハンド。 */
  listTools(): Promise<ToolDescriptor[]>;
  close(): Promise<void>;
}

export async function connect(overrides: Partial<Config> = {}): Promise<Harness> {
  const server = createServer({ ...baseConfig, ...overrides });
  const client = new Client({ name: "regression-test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  // initialize ハンドシェイクは双方向のやり取りになるため、片方ずつ await するとデッドロックする。
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  return {
    client,
    call: async (name, args = {}) =>
      (await client.callTool({ name, arguments: args })) as ToolCallResult,
    listTools: async () => (await client.listTools()).tools,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/** 先頭コンテンツを text として取り出す。 */
export function firstText(result: ToolCallResult): string {
  const first = result.content[0];
  if (!first || first.type !== "text") {
    throw new Error(`先頭コンテンツが text ではありません: ${JSON.stringify(result.content)}`);
  }
  return first.text;
}

/** 正常系。isError でないことを確認したうえで本文JSONをパースする。 */
export function okJson<T = unknown>(result: ToolCallResult): T {
  if (result.isError) throw new Error(`ツールが isError で返りました: ${firstText(result)}`);
  return JSON.parse(firstText(result)) as T;
}

/** 異常系。isError であることを確認したうえでメッセージ本文を返す。 */
export function errText(result: ToolCallResult): string {
  if (!result.isError) throw new Error(`ツールが isError ではありません: ${firstText(result)}`);
  return firstText(result);
}

/** ページング付き一覧ツールの戻り値の形。 */
export interface PagedPayload<T> {
  items: T[];
  pageInfo: {
    page: number;
    perPage: number;
    totalItems?: number;
    totalPages?: number;
    hasNextPage: boolean;
    nextPage?: number;
  };
}
