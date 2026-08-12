import type { PickerToggleMessage } from "../shared/messages";

// activeTab は「actionのクリック」と「chrome.commandsのショートカット実行」の
// 両方で一時的なホスト権限を付与するため、この2経路だけで済む。
// host_permissionsや静的content_scripts宣言は不要。
chrome.action.onClicked.addListener((tab) => {
  void activate(tab);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "toggle-picker") return;
  void activate(tab);
});

async function activate(tab?: chrome.tabs.Tab): Promise<void> {
  const target = tab ?? (await queryActiveTab());
  if (!target?.id) return;

  if (!isInjectablePage(target.url)) {
    console.warn("[markdown-element-clipper] このページには注入できません:", target.url);
    return;
  }

  const message: PickerToggleMessage = { type: "PICKER_TOGGLE" };

  // 既に注入済みなら、まずメッセージ送信でトグルを試みる。
  try {
    await chrome.tabs.sendMessage(target.id, message);
    return;
  } catch {
    // "Could not establish connection" -> 未注入なのでscriptingで注入する。
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: target.id },
      files: ["content.js"],
    });
  } catch (err) {
    console.warn("[markdown-element-clipper] content scriptの注入に失敗しました:", err);
  }
}

async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  // chrome.commands.onCommandの第2引数tabが渡らない環境向けのフォールバック。
  // tabs権限が無くてもactive:true, currentWindow:trueのクエリではidが取れる。
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab;
}

function isInjectablePage(url: string | undefined): boolean {
  if (!url) return false;
  return /^(https?|file):/.test(url);
}
