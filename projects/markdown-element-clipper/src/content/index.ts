import type { ExtensionMessage } from "../shared/messages";
import { createPicker, type Picker } from "./picker";

// content scriptは複数回注入されうる(chrome.scripting.executeScriptの
// 都度注入 + 既存タブへの再度のショートカット操作等)。同一フレーム内の
// isolated worldはグローバルを共有するため、globalThisでガードする。
declare global {
  // eslint-disable-next-line no-var
  var __MD_CLIPPER__: Picker | undefined;
}

if (!globalThis.__MD_CLIPPER__) {
  const picker = createPicker();
  globalThis.__MD_CLIPPER__ = picker;

  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message?.type === "PICKER_TOGGLE") {
      picker.toggle();
    }
  });

  // 初回注入時(chrome.scripting.executeScript経由)はメッセージを送らず
  // 即座にピッカーを開始する。
  picker.start();
} else {
  // 再注入された場合の安全弁として、既存のpickerをトグルする。
  globalThis.__MD_CLIPPER__.toggle();
}
