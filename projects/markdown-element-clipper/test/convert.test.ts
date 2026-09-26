import { afterEach, describe, expect, it } from "vitest";
import { elementToMarkdown } from "../src/convert/index";
import { render } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("elementToMarkdown", () => {
  it("見出し・強調・引用を変換する", () => {
    const el = render(`
      <div>
        <h1>Title</h1>
        <h2>Subtitle</h2>
        <p>plain <strong>bold</strong> and <em>em</em> text.</p>
        <blockquote>quoted text</blockquote>
      </div>
    `);
    const md = elementToMarkdown(el);
    expect(md).toContain("# Title");
    expect(md).toContain("## Subtitle");
    expect(md).toContain("**bold**");
    expect(md).toContain("_em_");
    expect(md).toContain("> quoted text");
  });

  it("ネストしたリストを変換する", () => {
    const el = render(`
      <ul>
        <li>one
          <ul><li>nested</li></ul>
        </li>
        <li>two</li>
      </ul>
    `);
    const md = elementToMarkdown(el);
    // turndownのlistItemルールはマーカーの後ろに3スペースを挿入する
    // (マーカー幅を"1.  "等の番号付きリストと揃えるため)。
    expect(md).toMatch(/^-\s+one/m);
    expect(md).toMatch(/^\s+-\s+nested/m);
    expect(md).toMatch(/^-\s+two/m);
  });

  it("GFMテーブルを変換する", () => {
    const el = render(`
      <table>
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody>
          <tr><td>Alice</td><td>30</td></tr>
          <tr><td>Bob</td><td>25</td></tr>
        </tbody>
      </table>
    `);
    const md = elementToMarkdown(el);
    expect(md).toContain("| Name");
    expect(md).toContain("| Age");
    expect(md).toContain("Alice");
    expect(md).toContain("Bob");
    expect(md).toMatch(/\| :?-{3,}:? \|/);
  });

  it("打ち消し線とタスクリストを変換する", () => {
    const el = render(`
      <div>
        <p><del>removed</del></p>
        <ul>
          <li><input type="checkbox" checked disabled>done</li>
          <li><input type="checkbox" disabled>todo</li>
        </ul>
      </div>
    `);
    const md = elementToMarkdown(el);
    expect(md).toContain("~~removed~~");
    expect(md).toContain("[x]");
    expect(md).toContain("[ ]");
  });

  it("言語クラス付きコードブロックをフェンス+言語名で変換する", () => {
    const el = render(`<pre><code class="language-typescript">const x = 1;</code></pre>`);
    const md = elementToMarkdown(el);
    expect(md).toContain("```typescript");
    expect(md).toContain("const x = 1;");
  });

  it("相対URLを絶対URLに変換する(hrefとimg src)", () => {
    const el = render(`
      <div>
        <a href="./other.html">link</a>
        <img src="./img.png" alt="pic">
      </div>
    `);
    const md = elementToMarkdown(el);
    expect(md).toContain("https://example.com/dir/other.html");
    expect(md).toContain("https://example.com/dir/img.png");
  });

  it("display:noneとhidden属性の要素を除去する", () => {
    const el = render(`
      <div>
        <p>visible</p>
        <p style="display:none">invisible-style</p>
        <p hidden>invisible-hidden</p>
      </div>
    `);
    const md = elementToMarkdown(el);
    expect(md).toContain("visible");
    expect(md).not.toContain("invisible-style");
    expect(md).not.toContain("invisible-hidden");
  });

  it("script/style/noscriptの中身を含めない", () => {
    const el = render(`
      <div>
        <p>kept</p>
        <script>window.evil = true;</script>
        <style>.a{color:red}</style>
        <noscript>no js</noscript>
      </div>
    `);
    const md = elementToMarkdown(el);
    expect(md).toBe("kept");
  });

  it("<pre>を単体選択してもフェンスと言語名が保たれる(rootラップの回帰テスト)", () => {
    const el = render(`<pre><code class="language-python">print(1)</code></pre>`);
    // elが<pre>自身であることを確認(このテストの前提)
    expect(el.tagName).toBe("PRE");
    const md = elementToMarkdown(el);
    expect(md).toContain("```python");
    expect(md).toContain("print(1)");
  });

  it("<h1>を単体選択しても見出し書式が保たれる(rootラップの回帰テスト)", () => {
    const el = render(`<h1>Solo Heading</h1>`);
    expect(el.tagName).toBe("H1");
    const md = elementToMarkdown(el);
    expect(md).toBe("# Solo Heading");
  });

  it("<li>を単体選択してもリスト書式・番号が保たれる", () => {
    const el = render(`
      <ol start="3">
        <li>a</li>
        <li>b</li>
        <li id="target">c</li>
      </ol>
    `);
    const target = el.querySelector("#target");
    expect(target).not.toBeNull();
    const md = elementToMarkdown(target as Element);
    // start=3, index=2 -> 3+2=5
    expect(md).toBe("5.  c");
  });

  it("href属性の無いリンクはテキストのみ残す(safeLinkルール)", () => {
    const el = render(`<div><a>plain text</a></div>`);
    const md = elementToMarkdown(el);
    expect(md).toBe("plain text");
    expect(md).not.toContain("[");
  });

  it("javascript:リンクは無害化してテキストのみ残す", () => {
    const el = render(`<div><a href="javascript:alert(1)">bad</a></div>`);
    const md = elementToMarkdown(el);
    expect(md).toBe("bad");
    expect(md).not.toContain("javascript:");
  });

  it("src属性の無い画像はMarkdown中に出力されない", () => {
    const el = render(`<div><p>before</p><img alt="broken"><p>after</p></div>`);
    const md = elementToMarkdown(el);
    expect(md).not.toContain("![");
    expect(md).toContain("before");
    expect(md).toContain("after");
  });

  it("codeのクラス名が既知の言語パターンに一致しない場合は言語名無しのフェンスになる", () => {
    const el = render(`<pre><code class="foo-bar">plain</code></pre>`);
    const md = elementToMarkdown(el);
    expect(md).toContain("```\nplain");
    expect(md).not.toContain("```foo-bar");
  });

  it("<pre>にcode要素が無い場合はpre自身のtextContentを使う", () => {
    const el = render(`<pre>raw text</pre>`);
    const md = elementToMarkdown(el);
    expect(md).toContain("```");
    expect(md).toContain("raw text");
  });

  it("コードの中に```が含まれる場合はフェンス文字数を伸ばす", () => {
    const el = render("<pre><code>outer\n```inner```\nend</code></pre>");
    const md = elementToMarkdown(el);
    expect(md).toContain("````");
    expect(md).toContain("```inner```");
  });

  it("<tr>を単体選択してもテーブル書式が保たれる", () => {
    const el = render(`
      <table>
        <tbody>
          <tr><td>x</td><td>y</td></tr>
        </tbody>
      </table>
    `);
    const tr = el.querySelector("tr");
    expect(tr).not.toBeNull();
    const md = elementToMarkdown(tr as Element);
    expect(md).toContain("x");
    expect(md).toContain("y");
    expect(md).toContain("|");
  });
});
