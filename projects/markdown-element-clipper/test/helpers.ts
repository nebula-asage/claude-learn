/**
 * HTML文字列をdocument.bodyに挿入し、最初の要素を返す。
 * getComputedStyle はdisconnectedな要素では正しく解決されないため、
 * 必ずdocument.bodyへ接続してから返す。
 */
export function render(html: string): Element {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const el = container.firstElementChild;
  if (!el) throw new Error("render: htmlから要素を生成できませんでした");
  return el;
}
