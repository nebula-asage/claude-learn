/** コピー処理の結果。 */
export interface CopyResult {
  /** コピーに成功したかどうか。 */
  ok: boolean;
  /** 成功/失敗した経路。 */
  method: "clipboard-api" | "exec-command" | "failed";
}

/**
 * Markdown文字列をクリップボードへコピーする。3段のフォールバックを持つ:
 * 1. navigator.clipboard.writeText (secure contextかつdocumentがフォーカス
 *    されている場合のみ)
 * 2. document.execCommand('copy') (textareaを介する)
 * 3. どちらも失敗したら呼び出し元でユーザーに手動コピーを促す
 * @param text コピーするMarkdown文字列。
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  if (canUseClipboardApi()) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard-api" };
    } catch {
      // execCommandへフォールスルーする。
    }
  }

  if (copyWithExecCommand(text)) {
    return { ok: true, method: "exec-command" };
  }

  return { ok: false, method: "failed" };
}

function canUseClipboardApi(): boolean {
  // navigator.clipboardはsecure context(https/localhost)でしか存在しない。
  // writeTextはdocumentがフォーカスされている必要があり、開発中にDevTools
  // にフォーカスがあると NotAllowedError: Document is not focused で失敗する。
  return (
    typeof navigator.clipboard?.writeText === "function" &&
    window.isSecureContext &&
    document.hasFocus()
  );
}

function copyWithExecCommand(text: string): boolean {
  // Shadow DOM内にtextareaを置くとSelection APIがシャドウ境界をまたげず
  // 失敗するため、必ず最上位のdocument.bodyに置く。
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  // display:noneは選択できないため使わない。
  textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";

  const previousActiveElement = document.activeElement as HTMLElement | null;
  const previousRange = captureSelectionRange();

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let succeeded = false;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  }

  textarea.remove();
  previousActiveElement?.focus?.();
  restoreSelectionRange(previousRange);

  return succeeded;
}

function captureSelectionRange(): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return selection.getRangeAt(0).cloneRange();
}

function restoreSelectionRange(range: Range | null): void {
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  if (range) selection.addRange(range);
}
