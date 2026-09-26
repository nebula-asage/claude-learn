import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
import { LANGUAGE_CLASS_PATTERNS } from "./constants";

/** GFM(テーブル・タスクリスト・打ち消し線)とカスタムルールを組み込んだTurndownServiceを生成する。 */
export function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx", // setextはh3以降を表現できない
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "_", // 語中の*との衝突を避ける
    strongDelimiter: "**",
    linkStyle: "inlined",
    br: "  ",
    preformattedCode: true, // GFMテーブル内のコードで必要
  });

  service.use(gfm);

  // turndownのaddRuleは内部配列にunshiftするため、後から追加したルールほど
  // 優先される。gfm() を呼んだ後に自前ルールを追加することで、これらが
  // gfmのデフォルトルールより優先される。
  service.addRule("fencedCodeBlockWithLang", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => fencedCodeBlock(node),
  });

  service.addRule("safeLink", {
    filter: (node) => node.nodeName === "A" && !isSafeHref(node as HTMLAnchorElement),
    replacement: (content) => content,
  });

  service.addRule("imageWithoutSrc", {
    filter: (node) => node.nodeName === "IMG" && !(node as HTMLImageElement).getAttribute("src"),
    replacement: () => "",
  });

  return service;
}

function isSafeHref(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href");
  if (!href || href.trim() === "") return false;
  if (href.trim().toLowerCase().startsWith("javascript:")) return false;
  return true;
}

function detectLanguage(pre: HTMLElement): string {
  const code = pre.querySelector("code");
  const candidates = [
    code?.className,
    pre.className,
    code?.getAttribute("data-lang") ?? undefined,
    pre.getAttribute("data-lang") ?? undefined,
  ];

  for (const className of candidates) {
    if (!className) continue;
    for (const pattern of LANGUAGE_CLASS_PATTERNS) {
      const match = className.match(pattern);
      if (match) return match[1];
    }
  }
  return "";
}

function fencedCodeBlock(pre: HTMLElement): string {
  const code = pre.querySelector("code");
  const text = (code ?? pre).textContent ?? "";
  const language = detectLanguage(pre);

  // 本文中に```が含まれる場合に備え、フェンス文字数を伸ばす。
  const fenceMatches = text.match(/`{3,}/g);
  const longestFence = fenceMatches ? Math.max(...fenceMatches.map((f) => f.length)) : 2;
  const fence = "`".repeat(longestFence + 1);

  return `\n\n${fence}${language}\n${text.replace(/\n$/, "")}\n${fence}\n\n`;
}
