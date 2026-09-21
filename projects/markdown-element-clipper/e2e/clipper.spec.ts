// 実ブラウザに拡張を読み込んで、ピッカー操作からクリップボードへのコピーまでを
// 通しで検証する。Markdown変換ロジックそのものの網羅的なテストは test/ 配下の
// vitest(jsdom)側にあるので、ここでは「実ブラウザでしか確認できないこと」
// (注入・イベント抑止・キー操作・クリップボード)に絞っている。

import {
  clearClipboard,
  expect,
  hoverElement,
  isPickerActive,
  readClipboard,
  test,
  togglePicker,
} from "./fixtures";

test("ショートカット相当の操作でcontent scriptが注入され、ピッカーが始まる", async ({
  page,
  serviceWorker,
}) => {
  expect(await isPickerActive(page)).toBe(false);

  await togglePicker(serviceWorker, page);

  expect(await isPickerActive(page)).toBe(true);
});

test("もう一度呼ぶとトグルで終了する(二重注入されない)", async ({ page, serviceWorker }) => {
  await togglePicker(serviceWorker, page);
  await togglePicker(serviceWorker, page);

  expect(await isPickerActive(page)).toBe(false);
});

test("Escでキャンセルするとコピーされない", async ({ page, serviceWorker }) => {
  await clearClipboard(page);
  await togglePicker(serviceWorker, page);
  await hoverElement(page, "h1");

  await page.keyboard.press("Escape");

  expect(await isPickerActive(page)).toBe(false);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("");
});

test("要素をクリックで確定するとMarkdownがクリップボードに入る", async ({ page, serviceWorker }) => {
  await clearClipboard(page);
  await togglePicker(serviceWorker, page);
  await hoverElement(page, "h1");

  await page.mouse.down();
  await page.mouse.up();

  expect(await readClipboard(page)).toBe("# Markdown Element Clipper 確認用記事");
});

test("↑で親要素へ移動してEnterで確定できる", async ({ page, serviceWorker }) => {
  await clearClipboard(page);
  await togglePicker(serviceWorker, page);
  await hoverElement(page, "h1");

  // h1 -> main#article
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");

  const markdown = await readClipboard(page);
  expect(markdown).toContain("# Markdown Element Clipper 確認用記事");
  expect(markdown).toContain("これは引用文です。");
});

test("↑の後に↓で元の要素へ戻れる", async ({ page, serviceWorker }) => {
  await clearClipboard(page);
  await togglePicker(serviceWorker, page);
  await hoverElement(page, "h1");

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  expect(await readClipboard(page)).toBe("# Markdown Element Clipper 確認用記事");
});

test("確定のクリックでページ側のリンク遷移が起きない", async ({ page, serviceWorker }) => {
  const urlBefore = page.url();
  await togglePicker(serviceWorker, page);
  await hoverElement(page, 'a[href="https://example.com/should-not-navigate"]');

  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);

  expect(page.url()).toBe(urlBefore);
  expect(await readClipboard(page)).toContain("[このリンクをクリックしても遷移しないこと]");
});

test.describe("ページ全体(main)を変換したときのMarkdown", () => {
  test.beforeEach(async ({ page, serviceWorker }) => {
    await clearClipboard(page);
    await togglePicker(serviceWorker, page);
    await hoverElement(page, "h1");
    await page.keyboard.press("ArrowUp"); // h1 -> main#article
    await page.keyboard.press("Enter");
  });

  test("GFMのテーブル・タスクリスト・コードフェンスが出力される", async ({ page }) => {
    const markdown = await readClipboard(page);

    // 箇条書きマーカー周りの空白幅はturndownの既定に任せているため、
    // 桁数に依存しない正規表現で確認する。
    expect(markdown).toMatch(/\|\s*項目\s*\|\s*値\s*\|\s*備考\s*\|/);
    expect(markdown).toMatch(/-\s+\[x\]\s+完了したタスク/);
    expect(markdown).toMatch(/-\s+\[ \]\s+未完了のタスク/);
    expect(markdown).toContain("```typescript");
    expect(markdown).toContain("```python");
  });

  test("相対URLが絶対URLに変換される", async ({ page }) => {
    const markdown = await readClipboard(page);

    expect(markdown).toContain("(http://localhost:8123/other.html)");
    expect(markdown).toContain("(http://localhost:8123/profile.html)");
    expect(markdown).toContain("![サンプル画像](http://localhost:8123/img/sample.png)");
  });

  test("非表示要素とscript/noscriptの中身は含まれない", async ({ page }) => {
    const markdown = await readClipboard(page);

    expect(markdown).not.toContain("display:noneで非表示");
    expect(markdown).not.toContain("hidden属性で非表示");
    expect(markdown).not.toContain("このscriptの中身はMarkdownに含まれない");
    expect(markdown).not.toContain("noscriptの中身も含まれない");
  });
});
