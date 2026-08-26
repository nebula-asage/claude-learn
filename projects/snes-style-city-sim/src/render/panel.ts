/**
 * 画面下部の情報パネル。
 *
 * SNES期の都市開発シムに倣い、マップ表示部の下に固定の帯を置いて
 * 日付・資金・人口などの常時表示情報をまとめる。
 * @packageDocumentation
 */
import type { TilePos } from "../sim/tiles.js";
import type { BitmapFont } from "./font/font.js";
import { COLOR } from "./palette.js";
import type { Screen } from "./screen.js";
import { VIEW_HEIGHT } from "./mapview.js";

/** パネルの上端（画面座標）。 */
export const PANEL_Y = VIEW_HEIGHT;

/** パネルの高さ（ドット）。 */
export const PANEL_HEIGHT = 48;

/** パネルに表示する情報。 */
export interface StatusInfo {
  /** 都市の名前。 */
  cityName: string;
  /** 年。 */
  year: number;
  /** 月（1〜12）。 */
  month: number;
  /** 所持金。 */
  funds: number;
  /** 人口。 */
  population: number;
  /** カーソルが指しているタイル座標。画面外なら `null`。 */
  cursor: TilePos | null;
}

/**
 * 数値を3桁区切りにする。
 * @param value 変換する数値。
 */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * パネルの下地（へこんだ帯）を描く。
 * @param screen 描画先。
 * @param x 左端。
 * @param y 上端。
 * @param w 幅。
 * @param h 高さ。
 */
export function drawInsetBox(screen: Screen, x: number, y: number, w: number, h: number): void {
  screen.fillRect(x, y, w, h, COLOR.panelShadow);
  screen.fillRect(x, y, w, 1, COLOR.black);
  screen.fillRect(x, y, 1, h, COLOR.black);
  screen.fillRect(x, y + h - 1, w, 1, COLOR.panelLight);
  screen.fillRect(x + w - 1, y, 1, h, COLOR.panelLight);
}

/**
 * 情報パネルを描く。
 * @param screen 描画先。
 * @param font 使用するフォント。
 * @param info 表示する情報。
 */
export function drawStatusPanel(screen: Screen, font: BitmapFont, info: StatusInfo): void {
  screen.fillRect(0, PANEL_Y, screen.width, PANEL_HEIGHT, COLOR.panel);
  screen.fillRect(0, PANEL_Y, screen.width, 1, COLOR.panelLight);
  screen.fillRect(0, PANEL_Y + 1, screen.width, 1, COLOR.panelShadow);

  drawInsetBox(screen, 4, PANEL_Y + 5, 152, 38);

  font.drawText(screen, info.cityName, 8, PANEL_Y + 8, COLOR.white);
  font.drawText(
    screen,
    `${info.year}年 ${String(info.month).padStart(2, " ")}月`,
    8,
    PANEL_Y + 20,
    COLOR.lightGray,
  );
  font.drawText(screen, `資金 $${formatNumber(info.funds)}`, 8, PANEL_Y + 32, COLOR.uiYellow);

  font.drawTextRight(
    screen,
    `人口 ${formatNumber(info.population)}`,
    250,
    PANEL_Y + 8,
    COLOR.white,
  );
  if (info.cursor) {
    font.drawTextRight(
      screen,
      `(${info.cursor.x}, ${info.cursor.y})`,
      250,
      PANEL_Y + 32,
      COLOR.lightGray,
    );
  }
}
