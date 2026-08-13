/**
 * グローバル `fetch` を差し替えるテスト用ヘルパー。
 *
 * src/gitlab/client.ts は Node 組み込みの `fetch(url, init)` を直接呼ぶため dispatcher の
 * 注入点が無い。undici の MockAgent は内部シンボル経由でグローバルに介入するため Node の
 * マイナー更新で壊れうる上、本テストの主目的である「PRIVATE-TOKEN ヘッダに何が入ったか」
 * 「URLパスが %2F エンコードされたか」の検証には init を直接捕まえる方が素直なので、
 * vi.stubGlobal を使う。
 *
 * 注意: test/transports/http.test.ts は実HTTPサーバへ本物の fetch で叩くため、
 * このヘルパーを使ってはいけない。
 *
 * 注意: このプロジェクトは module: NodeNext のため、相対importは必ず `.js` 拡張子を付ける。
 */

import { vi } from "vitest";

export interface RecordedCall {
  url: URL;
  method: string;
  /** ヘッダ名の大小を問わず `get()` で参照できる。 */
  headers: Headers;
  /** リクエストボディ。JSON としてパース済み。ボディ無しは undefined。 */
  body: unknown;
  signal: AbortSignal | undefined;
}

export type Responder = (call: RecordedCall, index: number) => Response | Promise<Response>;

export interface FetchMock {
  /** これまでに記録されたリクエスト。 */
  calls: RecordedCall[];
  /** 最後のリクエスト。1件も無ければ例外を投げる。 */
  last(): RecordedCall;
  /** 最後のリクエストのクエリ文字列を素のオブジェクトに変換したもの。 */
  lastQuery(): Record<string, string>;
}

/** グローバル fetch を差し替える。後片付けは各テストの `afterEach(() => vi.unstubAllGlobals())` で行う。 */
export function installFetchMock(responder: Responder): FetchMock {
  const calls: RecordedCall[] = [];

  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const call: RecordedCall = {
      url: input instanceof URL ? input : new URL(String(input)),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      signal: init?.signal ?? undefined,
    };
    calls.push(call);
    return await responder(call, calls.length - 1);
  };

  vi.stubGlobal("fetch", vi.fn(impl));

  return {
    calls,
    last(): RecordedCall {
      const call = calls.at(-1);
      if (!call) throw new Error("fetch が一度も呼ばれていません。");
      return call;
    },
    lastQuery(): Record<string, string> {
      return Object.fromEntries(this.last().url.searchParams.entries());
    },
  };
}

/** 常に同じレスポンスを返す fetch モックを仕込むショートハンド。 */
export function installFixedFetchMock(response: () => Response): FetchMock {
  return installFetchMock(() => response());
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? "",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

export function textResponse(
  text: string,
  init: { status?: number; statusText?: string; headers?: Record<string, string> } = {},
): Response {
  return new Response(text, {
    status: init.status ?? 200,
    statusText: init.statusText ?? "",
    headers: { "Content-Type": "text/plain", ...init.headers },
  });
}

/**
 * GitLab のページングヘッダを付けた JSON レスポンス。
 * 値に undefined を渡したヘッダは付与しない（GitLab がキーセットページング時に
 * x-total を返さないケースを再現するため）。
 */
export function pagedResponse(
  items: unknown[],
  headers: Partial<
    Record<"x-page" | "x-per-page" | "x-total" | "x-total-pages" | "x-next-page", string>
  > = {},
): Response {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) merged[key] = value;
  }
  return jsonResponse(items, { headers: merged });
}

/**
 * `AbortSignal.timeout()` が発火したときに fetch が reject する値と同等のもの。
 * Vitest の fake timers は Node 内部タイマー（かつ unref 済み）を制御できないため、
 * タイムアウト分岐は実タイマーを使わずこの例外を throw させて到達させる。
 */
export function timeoutError(): DOMException {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError");
}
