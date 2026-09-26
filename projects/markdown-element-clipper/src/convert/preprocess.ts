import { MAX_DATA_URI_LENGTH, REMOVE_TAGS } from "./constants";

const REMOVE_TAG_SET = new Set(REMOVE_TAGS.map((tag) => tag.toUpperCase()));

/**
 * 選択された要素をMarkdown変換用に前処理し、変換に渡す独立したwrapper要素を返す。
 *
 * 重要な制約: getComputedStyle() はDOMツリーから切り離されたクローンには
 * 正しく効かない(多くのプロパティが空文字を返す)。そのため「クローンしてから
 * 不可視要素を判定する」のではなく、live(実DOM)側で判定しながらclone側を
 * 削っていく lockstep walk で実装する。cloneNode(true) 直後は両者の
 * childNodes が同順・同数であることを前提にしている。
 * @param live 選択された、DOMツリーに接続されたままの実要素。
 */
export function preprocessElement(live: Element): HTMLDivElement {
  const clone = live.cloneNode(true) as Element;

  // ルート要素自身がa/imgの場合(例: 画像だけを選択した場合)にもURL絶対化が
  // 効くよう、walk()に入る前にルート自身にも適用する。
  normalizeUrls(live, clone);
  stripHugeDataUri(clone);

  walk(live, clone);

  const normalized = wrapWithRequiredAncestors(live, clone);

  // turndownは渡されたルート要素自身を変換せず子孫だけを変換するため、
  // <pre>/<h1>/<img> 等を単体選択した場合に書式が消えてしまう。
  // 常に汎用的な<div>でラップしてから渡すことでこれを回避する。
  const wrapper = document.createElement("div");
  wrapper.appendChild(normalized);
  return wrapper;
}

function walk(liveParent: Node, cloneParent: Node): void {
  // 削除によるインデックスずれを避けるため、先に配列へスナップショットする。
  const liveChildren = Array.from(liveParent.childNodes);
  const cloneChildren = Array.from(cloneParent.childNodes);

  for (let i = 0; i < liveChildren.length; i++) {
    const liveChild = liveChildren[i];
    const cloneChild = cloneChildren[i];
    if (!cloneChild || liveChild.nodeType !== Node.ELEMENT_NODE) continue;

    const liveEl = liveChild as Element;
    const cloneEl = cloneChild as Element;

    if (shouldRemoveTag(liveEl)) {
      cloneEl.remove();
      continue;
    }
    if (isHiddenLive(liveEl)) {
      cloneEl.remove();
      continue;
    }

    normalizeUrls(liveEl, cloneEl);
    stripHugeDataUri(cloneEl);

    walk(liveEl, cloneEl);
  }
}

function shouldRemoveTag(liveEl: Element): boolean {
  if (liveEl.tagName === "INPUT") {
    // タスクリストのチェックボックスはGFMのtaskListItemsルールで
    // [x]/[ ]に変換されるため、それ以外のinputだけ除去する。
    return (liveEl as HTMLInputElement).type !== "checkbox";
  }
  return REMOVE_TAG_SET.has(liveEl.tagName);
}

function isHiddenLive(el: Element): boolean {
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;

  const style = getComputedStyle(el);
  // opacity:0 や width/height:0 は誤爆が多い(インライン要素やクリア
  // フィックスが消える)ため、display/visibilityのみを判定材料にする。
  if (style.display === "none") return true;
  if (style.visibility === "hidden" || style.visibility === "collapse") return true;

  return false;
}

/**
 * a.href / img.src は IDL プロパティとして読むと(<base>タグも考慮された)
 * 常に絶対URLを返す。getAttribute('href')は相対のままなので使わない。
 * @param liveEl 絶対URLを読み取る元となる、DOMツリーに接続されたままの実要素。
 * @param cloneEl 絶対化したURLを書き戻すクローン側の要素。
 */
function normalizeUrls(liveEl: Element, cloneEl: Element): void {
  if (liveEl.tagName === "A") {
    if (liveEl.hasAttribute("href")) {
      const absoluteHref = (liveEl as HTMLAnchorElement).href;
      cloneEl.setAttribute("href", absoluteHref);
    }
    return;
  }

  if (liveEl.tagName === "IMG") {
    const img = liveEl as HTMLImageElement;
    const resolved = img.currentSrc || img.src;
    if (resolved) {
      cloneEl.setAttribute("src", resolved);
    }
    // srcsetの絶対化は複雑なため削除する(srcが残るので実害はない)。
    cloneEl.removeAttribute("srcset");
  }
}

function stripHugeDataUri(cloneEl: Element): void {
  if (cloneEl.tagName !== "IMG") return;
  const src = cloneEl.getAttribute("src") ?? "";
  if (src.startsWith("data:") && src.length > MAX_DATA_URI_LENGTH) {
    cloneEl.remove();
  }
}

/**
 * li/tr/td/th/thead/tbody/tfoot を単体選択した場合、turndownのルールは
 * 直接の親要素(ol/ul, table)の有無で番号付け・ヘッダー行判定・GFMテーブル
 * 変換の可否を決めているため、そのままdivに包んでも書式が機能しない。
 * 最小限の親要素で包んでから返す。
 * @param live 元の親子関係(ol/ulの種別や兄弟インデックス等)を読み取るための実要素。
 * @param clone 親要素で包み直す対象のクローン側の要素。
 */
function wrapWithRequiredAncestors(live: Element, clone: Element): Element {
  const tag = clone.tagName;

  if (tag === "LI") {
    const liveParent = live.parentElement;
    const isOrdered = liveParent?.tagName === "OL";
    const list = document.createElement(isOrdered ? "ol" : "ul");
    if (isOrdered && liveParent) {
      // turndownのlistItemルールは (start属性 + 兄弟内インデックス) で
      // 番号を算出する。単体選択でインデックスが0になっても元の番号と
      // 一致するよう、start属性に補正した値を設定する。
      const index = Array.prototype.indexOf.call(liveParent.children, live);
      const start = liveParent.hasAttribute("start") ? Number(liveParent.getAttribute("start")) : 1;
      list.setAttribute("start", String(start + index));
    }
    list.appendChild(clone);
    return list;
  }

  if (tag === "TR") {
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    tbody.appendChild(clone);
    table.appendChild(tbody);
    return table;
  }

  if (tag === "TD" || tag === "TH") {
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    const tr = document.createElement("tr");
    tr.appendChild(clone);
    tbody.appendChild(tr);
    table.appendChild(tbody);
    return table;
  }

  if (tag === "THEAD" || tag === "TBODY" || tag === "TFOOT") {
    const table = document.createElement("table");
    table.appendChild(clone);
    return table;
  }

  return clone;
}
