// e2e用のPlaywrightフィクスチャ。
//
// この拡張は「ツールバーのアイコンのクリック」と「Alt+Shift+Mのコマンド」でしか
// 起動せず、Playwrightはそのどちらも発火できない(ブラウザUIとchrome.commandsは
// CDPの操作対象外)。さらに activeTab はそのユーザー操作でしか付与されないため、
// Service Workerから chrome.scripting.executeScript を呼んでも権限不足で失敗する。
//
// そこで、
//   1. dist/ をコピーして host_permissions だけを足したテスト専用の拡張
//      (dist-e2e/)を作る
//   2. 起動は startPicker() が background の activate() と同じAPI呼び出しを
//      Service Worker上で再現する
// という形にしている。1.で足しているのはfixtureのオリジンに限定した権限で、
// content script / background の実コードには一切手を入れない。

import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FIXTURE_ORIGIN, SAMPLE_URL } from "./constants";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, "dist");
const e2eDistDir = path.join(rootDir, "dist-e2e");

interface ExtensionFixtures {
  context: BrowserContext;
  page: Page;
  serviceWorker: Worker;
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const extensionDir = await buildTestExtension();
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "mdclip-e2e-"));

    const context = await chromium.launchPersistentContext(userDataDir, {
      // headless shellは拡張を読み込めない。"chromium"チャンネル(=フルビルド)の
      // new headlessなら読み込めるので、CIでも画面なしで動かせる。
      // 目視したいときは HEADED=1 を付ける。
      channel: "chromium",
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    });

    // navigator.clipboard.writeText / readText の両方に必要。
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: FIXTURE_ORIGIN,
    });

    await use(context);

    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },

  // 永続コンテキストには最初からタブが1枚ある。新しくタブを開くと元のタブが
  // hiddenになり、picker側の visibilitychange → stop() が走ってしまうため、
  // 常にこの1枚だけを使い回す。
  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(SAMPLE_URL);
    await use(page);
  },

  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await use(worker);
  },
});

export const expect = test.expect;

/**
 * dist/ に host_permissions を足したテスト専用の拡張を dist-e2e/ に用意する。
 */
async function buildTestExtension(): Promise<string> {
  if (!existsSync(path.join(distDir, "manifest.json"))) {
    throw new Error("dist/ が見つかりません。先に `pnpm build` を実行してください。");
  }

  await rm(e2eDistDir, { recursive: true, force: true });
  await cp(distDir, e2eDistDir, { recursive: true });

  const manifestPath = path.join(e2eDistDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.host_permissions = [`${FIXTURE_ORIGIN}/*`];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return e2eDistDir;
}

/**
 * ピッカーを起動(2回目以降はトグル)する。
 * background/index.ts の activate() と同じ手順を Service Worker 上で再現する:
 * まず sendMessage でトグルを試し、未注入なら executeScript で注入する。
 */
export async function togglePicker(serviceWorker: Worker, page: Page): Promise<void> {
  await page.bringToFront();

  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("アクティブなタブが取得できませんでした");

    try {
      await chrome.tabs.sendMessage(tab.id, { type: "PICKER_TOGGLE" });
      return;
    } catch {
      // 未注入なので下のexecuteScriptに進む。
    }

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  });

  // 注入/トグルの反映を待つ。
  await page.waitForTimeout(100);
}

/**
 * ピッカーが動作中かどうか。
 *
 * オーバーレイは closed shadow DOM の中にあり、content scriptはisolated world
 * で動くのでテストから中身を覗けない。代わりに、overlay.ts が document.head へ
 * 挿入する唯一のページDOM(カーソル用style)の有無で判定する。
 */
export async function isPickerActive(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.getElementById("markdown-element-clipper-cursor-style") !== null,
  );
}

/**
 * 要素の中心にマウスを移動して、ピッカーのハイライト対象にする。
 *
 * boundingBox()はビューポート基準の座標を返すため、画面外の要素は先に
 * スクロールして入れておかないとmouse.moveが別の場所に当たってしまう。
 */
export async function hoverElement(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`要素の位置が取得できませんでした: ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** クリップボードを空にする(テスト間の持ち越し防止)。 */
export async function clearClipboard(page: Page): Promise<void> {
  await page.evaluate(() => navigator.clipboard.writeText(""));
}

/**
 * クリップボードの中身が空でなくなるまで待って、その内容を返す。
 *
 * page.waitForFunction は非同期の判定関数が返すPromiseオブジェクト自体を
 * truthyとみなして即座に解決してしまうため、expect.pollで待つ。
 */
export async function readClipboard(page: Page): Promise<string> {
  const read = () => page.evaluate(() => navigator.clipboard.readText());
  await expect.poll(read, { message: "クリップボードにコピーされませんでした" }).not.toBe("");
  return read();
}
