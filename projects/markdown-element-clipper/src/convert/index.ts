import { preprocessElement } from "./preprocess";
import { createTurndownService } from "./turndown";

/**
 * 選択された要素をMarkdownに変換する。
 * ノードを文字列化してから再パースするのではなく、前処理後のノードを
 * 直接turndownへ渡すことで余計な再パースを避けている。
 * @param el 変換対象のDOM要素。
 */
export function elementToMarkdown(el: Element): string {
  const wrapper = preprocessElement(el);
  const service = createTurndownService();
  const markdown = service.turndown(wrapper);
  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}
