// @joplin/turndown-plugin-gfm は型定義を同梱していないため、
// 使用する関数の最小限の型シムを用意する。
declare module "@joplin/turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  export function gfm(service: TurndownService): void;
  export function tables(service: TurndownService): void;
  export function strikethrough(service: TurndownService): void;
  export function taskListItems(service: TurndownService): void;
}
