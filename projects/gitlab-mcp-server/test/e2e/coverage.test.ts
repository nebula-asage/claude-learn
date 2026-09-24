/**
 * E2Eの網羅性ガード。`tools/list` に登録されている全ツールが、いずれかのE2Eテストで
 * 実際に呼び出されていることを機械的に保証する。
 *
 * このプロジェクトは「新規ツールを追加したときテストが自動的に失敗する」設計を方針にしており
 * （`test/invariants.test.ts` の MINIMAL_ARGS、`test/tools/surface.test.ts` のツール名一覧）、
 * E2Eにも同じガードを置く。AGENTS.mdに書いた手動 grep 手順の代わりになる。
 *
 * 実装は `test/invariants.test.ts` が `node:fs` で `src/` を走査しているのと同じ流儀で、
 * テストソースそのものを読んで静的に呼び出しを数える。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { connectRealProcess, ensureServerBuilt, loadTestEnvConnection } from "./helpers/testEnv.js";

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2Eテストソースから、実際に呼ばれているツール名を集める。
 *
 * 文字列リテラル `"gitlab_xxx"` の単純一致ではなく呼び出し形で拾うのは、コメントや
 * 説明文に書いただけのツール名でガードが通ってしまうのを防ぐため。`\s*` は改行にも
 * マッチするので、Prettierが引数を折り返しても検出できる。
 */
function collectCalledToolNames(): Set<string> {
  const files = fs.readdirSync(E2E_DIR).filter((name) => name.endsWith(".test.ts"));
  const called = new Set<string>();
  for (const file of files) {
    const source = fs.readFileSync(path.join(E2E_DIR, file), "utf8");
    for (const match of source.matchAll(/callTool\(\s*\w+\s*,\s*"(gitlab_\w+)"/g)) {
      called.add(match[1]!);
    }
  }
  return called;
}

let registeredToolNames: string[];
let connection: { client: Client; transport: StdioClientTransport };

beforeAll(async () => {
  ensureServerBuilt();
  connection = await connectRealProcess(loadTestEnvConnection());
  const { tools } = await connection.client.listTools();
  registeredToolNames = tools.map((t) => t.name);
});

afterAll(async () => {
  await connection.client.close().catch(() => undefined);
  await connection.transport.close().catch(() => undefined);
});

describe("E2Eの網羅性ガード", () => {
  it("tools/list の全ツールが、いずれかのE2Eテストで実際に呼ばれている", () => {
    const called = collectCalledToolNames();
    const notCovered = registeredToolNames.filter((name) => !called.has(name)).sort();
    expect(
      notCovered,
      `E2E未カバーのツールがあります。test/e2e/ のいずれかに正常系の呼び出しを追加してください: ${notCovered.join(", ")}`,
    ).toEqual([]);
  });

  it("E2Eテストが、登録されていないツール名を呼んでいない", () => {
    const registered = new Set(registeredToolNames);
    const unknown = [...collectCalledToolNames()].filter((name) => !registered.has(name)).sort();
    expect(
      unknown,
      `存在しないツール名を呼んでいます（改名・削除の追従漏れの可能性）: ${unknown.join(", ")}`,
    ).toEqual([]);
  });
});
