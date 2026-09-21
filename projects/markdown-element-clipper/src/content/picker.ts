import { elementToMarkdown } from "../convert/index";
import { copyToClipboard } from "./clipboard";
import { createOverlay, type Overlay } from "./overlay";

export interface Picker {
  start(): void;
  stop(): void;
  toggle(): void;
}

// クリック確定後、トーストのフェードアウト(overlay.ts側で1.6秒)が完了する
// まで少し余裕を持たせてからオーバーレイを破棄する。
const OVERLAY_DESTROY_DELAY_MS = 1800;

// clickだけを潰しても不十分(多くのサイトはmousedown/pointerdownで
// ナビゲーションやモーダルを開く)。keydownも潰さないとページ側の
// ショートカット(例: GitHubの"s")が誤爆する。
const BLOCKED_EVENT_TYPES = [
  "click",
  "auxclick",
  "dblclick",
  "mousedown",
  "mouseup",
  "pointerdown",
  "pointerup",
  "contextmenu",
  "submit",
  "keydown",
  "keyup",
  "touchstart",
] as const;

export function createPicker(): Picker {
  let active = false;
  let overlay: Overlay | null = null;
  let abortController: AbortController | null = null;
  let currentTarget: Element | null = null;
  // ↓で降りるための「直前に↑で上がってきた子」を覚えるスタック。
  let descendStack: Element[] = [];

  function start(): void {
    if (active) return;
    active = true;
    overlay = createOverlay();
    abortController = new AbortController();
    const { signal } = abortController;

    window.addEventListener("mousemove", onMouseMove, { capture: true, passive: true, signal });
    window.addEventListener("blur", stop, { signal });
    document.addEventListener("visibilitychange", onVisibilityChange, { signal });

    for (const type of BLOCKED_EVENT_TYPES) {
      window.addEventListener(type, onBlockableEvent as EventListener, {
        capture: true,
        passive: false,
        signal,
      });
    }
  }

  // イベント購読の解除とpicking状態のリセットのみ行い、overlayには触れない。
  // confirmSelection()がトースト表示のためoverlayの寿命を個別に管理する。
  function teardownListeners(): void {
    active = false;
    abortController?.abort();
    abortController = null;
    currentTarget = null;
    descendStack = [];
  }

  function stop(): void {
    if (!active) return;
    teardownListeners();
    overlay?.destroy();
    overlay = null;
  }

  function toggle(): void {
    if (active) {
      stop();
    } else {
      start();
    }
  }

  function onMouseMove(e: MouseEvent): void {
    const el = (e.target as Element | null) ?? document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === currentTarget) return;
    setTarget(el);
    descendStack = [];
  }

  function setTarget(el: Element | null): void {
    currentTarget = el;
    overlay?.setTarget(el);
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === "hidden") stop();
  }

  function onBlockableEvent(e: Event): void {
    if (e.type === "keydown") {
      handleKeydown(e as KeyboardEvent);
    } else if (e.type === "click") {
      confirmSelection();
    }
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function handleKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case "Escape":
        stop();
        break;
      case "Enter":
        confirmSelection();
        break;
      case "ArrowUp":
        moveToParent();
        break;
      case "ArrowDown":
        moveToChild();
        break;
    }
  }

  function moveToParent(): void {
    if (!currentTarget || currentTarget === document.documentElement) return;
    const parent = currentTarget.parentElement;
    if (!parent) return;
    descendStack.push(currentTarget);
    setTarget(parent);
  }

  function moveToChild(): void {
    if (!currentTarget) return;

    const remembered = descendStack.pop();
    if (remembered && remembered.parentElement === currentTarget) {
      setTarget(remembered);
      return;
    }

    // 覚えている子が無ければ、面積が0でない最初の子要素を選ぶ。
    const child = Array.from(currentTarget.children).find((c) => {
      const rect = c.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (child) setTarget(child);
  }

  function confirmSelection(): void {
    if (!currentTarget) return;
    const target = currentTarget;
    // このpickingセッションのoverlayをローカルに保持しておく。teardown後も
    // 変換結果のトーストを表示するため、破棄はscheduleOverlayDestroyまで遅らせる。
    const activeOverlay = overlay;

    let markdown: string;
    try {
      markdown = elementToMarkdown(target);
    } catch (err) {
      console.error("[markdown-element-clipper] Markdown変換に失敗しました", err);
      teardownListeners();
      overlay = null;
      activeOverlay?.setTarget(null);
      activeOverlay?.showToast("Markdown変換に失敗しました", "error");
      scheduleOverlayDestroy(activeOverlay);
      return;
    }

    teardownListeners();
    overlay = null;
    activeOverlay?.setTarget(null);

    // awaitを挟むとtransient user activationが切れexecCommandフォールバックが
    // 失敗しうるため、ここまでは同期的に(clickハンドラと同一タスクで)実行している。
    void copyToClipboard(markdown).then((result) => {
      if (result.ok) {
        activeOverlay?.showToast(`Markdownをコピーしました(${markdown.length.toLocaleString()}文字)`);
      } else {
        activeOverlay?.showToast("コピーに失敗しました。手動でコピーしてください", "error");
      }
      scheduleOverlayDestroy(activeOverlay);
    });
  }

  function scheduleOverlayDestroy(ov: Overlay | null): void {
    if (!ov) return;
    setTimeout(() => ov.destroy(), OVERLAY_DESTROY_DELAY_MS);
  }

  return { start, stop, toggle };
}
