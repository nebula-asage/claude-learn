// Markdown変換前に除去するタグ名(小文字)。
// script/style等の非表示要素に加え、フォーム系のインタラクティブ要素も
// Markdownとして意味を持たないため除去する。
// 注意: <input type="checkbox"> はGFMのタスクリスト([x]/[ ])に変換される
// ため、ここには含めずpreprocess.ts側で個別に判定している。
export const REMOVE_TAGS = [
  "script",
  "style",
  "noscript",
  "template",
  "link",
  "meta",
  "iframe",
  "object",
  "embed",
  "canvas",
  "svg",
  "video",
  "audio",
  "form",
  "button",
  "select",
  "textarea",
];

// data: URIの画像がこの文字数を超える場合は貼り付け先が壊れるため除去する。
export const MAX_DATA_URI_LENGTH = 512;

// コードブロックの言語名を読み取る際にチェックするクラス名パターン。
// 優先順に並んでいる。
export const LANGUAGE_CLASS_PATTERNS = [
  /(?:^|\s)language-([\w-]+)/,
  /(?:^|\s)lang-([\w-]+)/,
  /(?:^|\s)highlight-source-([\w-]+)/,
];
