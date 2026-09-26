// @joplin/turndown-plugin-gfm は型定義を同梱していないため、
// 使用する関数の最小限の型シムを用意する。
declare module "@joplin/turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  /**
   * GFMテーブル・打ち消し線・タスクリストの全ルールをまとめて登録する。
   * @param service ルールを登録する対象のTurndownService。
   */
  export function gfm(service: TurndownService): void;
  /**
   * GFMテーブル変換ルールを登録する。
   * @param service ルールを登録する対象のTurndownService。
   */
  export function tables(service: TurndownService): void;
  /**
   * 打ち消し線(~~text~~)変換ルールを登録する。
   * @param service ルールを登録する対象のTurndownService。
   */
  export function strikethrough(service: TurndownService): void;
  /**
   * タスクリスト([x]/[ ])変換ルールを登録する。
   * @param service ルールを登録する対象のTurndownService。
   */
  export function taskListItems(service: TurndownService): void;
}
