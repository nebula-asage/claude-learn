import overlayCss from "./overlay.css";

/** ハイライト枠・ラベル・トーストを描画するオーバーレイの操作用ハンドル。 */
export interface Overlay {
  /** ハイライト対象を切り替える。nullを渡すとハイライトを消す。 */
  setTarget(el: Element | null): void;
  /** トーストメッセージを表示する。 */
  showToast(message: string, kind?: "success" | "error"): void;
  /** オーバーレイのDOM・イベントリスナーをすべて破棄する。 */
  destroy(): void;
}

const CURSOR_STYLE_ID = "markdown-element-clipper-cursor-style";
const TOAST_VISIBLE_MS = 1600;

/** ページ最上位にShadow DOM製のオーバーレイを生成する。 */
export function createOverlay(): Overlay {
  // documentElementに付ける(bodyはtransformを持つことがあり、その場合
  // position:fixedの基準がbody自身になってずれてしまうため)。
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(host);

  // ページのCSS/JS双方から遮断する。pointer-events:noneと合わせて、
  // オーバーレイ自身がelementFromPoint/event.targetの対象にならない。
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = overlayCss;
  shadow.appendChild(style);

  const box = document.createElement("div");
  box.id = "box";
  shadow.appendChild(box);

  const label = document.createElement("div");
  label.id = "label";
  shadow.appendChild(label);

  const toast = document.createElement("div");
  toast.id = "toast";
  shadow.appendChild(toast);

  let currentTarget: Element | null = null;
  let lastRectKey = "";
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  injectCursorStyle();

  // スクロール/リサイズ/position:stickyの変化などを取りこぼさないよう、
  // scrollイベントではなく毎フレームrectを取り直すrAFループで追従する。
  let rafId = requestAnimationFrame(tick);
  function tick() {
    if (currentTarget) {
      const rect = currentTarget.getBoundingClientRect();
      const key = `${rect.top},${rect.left},${rect.width},${rect.height}`;
      if (key !== lastRectKey) {
        lastRectKey = key;
        applyRect(rect);
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function applyRect(rect: DOMRect): void {
    box.style.display = "block";
    box.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;

    label.style.display = "block";
    label.textContent = describeElement(currentTarget!, rect);
    positionLabel(rect);
  }

  function positionLabel(rect: DOMRect): void {
    const labelHeight = 22; // 概算(実測はレイアウトを強制させないため避ける)
    let top = rect.top - labelHeight - 2;
    if (top < 0) {
      // 上に入らない場合は要素の内側上端に反転する。
      top = rect.top + 2;
    }
    let left = rect.left;
    if (left < 0) left = 0;
    const maxLeft = window.innerWidth - 8;
    if (left > maxLeft) left = maxLeft;
    label.style.transform = `translate(${left}px, ${top}px)`;
  }

  return {
    setTarget(el) {
      currentTarget = el;
      if (!el) {
        box.style.display = "none";
        label.style.display = "none";
        lastRectKey = "";
      }
    },
    showToast(message, kind = "success") {
      toast.textContent = message;
      toast.className = kind === "error" ? "error visible" : "visible";
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.className = "";
      }, TOAST_VISIBLE_MS);
    },
    destroy() {
      cancelAnimationFrame(rafId);
      if (toastTimer) clearTimeout(toastTimer);
      removeCursorStyle();
      host.remove();
    },
  };
}

function describeElement(el: Element, rect: DOMRect): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes = Array.from(el.classList).slice(0, 2).join(".");
  const cls = classes ? `.${classes}` : "";
  const size = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  return `${tag}${id}${cls} ${size}`;
}

// カーソルはshadow内から変更できないため、document.headに1枚だけstyleを
// 挿入する。ページDOMを触る唯一の箇所なのでdestroy()で必ず除去する。
function injectCursorStyle(): void {
  if (document.getElementById(CURSOR_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CURSOR_STYLE_ID;
  style.textContent = `
    *, *::before, *::after {
      cursor: crosshair !important;
      user-select: none !important;
    }
  `;
  document.head.appendChild(style);
}

function removeCursorStyle(): void {
  document.getElementById(CURSOR_STYLE_ID)?.remove();
}
