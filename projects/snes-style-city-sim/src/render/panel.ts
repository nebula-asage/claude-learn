/**
 * 画面下部の操作パネル。
 *
 * SNES期の都市開発シムに倣い、マップ表示部の下に固定の帯を置いて、
 * 道具のアイコン列と、日付・資金などの常時表示情報をまとめる。
 * @packageDocumentation
 */
import { TILE_SIZE, type TilePos } from "../sim/tiles.js";
import type { BitmapFont } from "./font/font.js";
import { VIEW_HEIGHT } from "./mapview.js";
import { COLOR } from "./palette.js";
import type { Screen } from "./screen.js";
import type { Tileset } from "./tileset.js";

/** パネルの上端（画面座標）。 */
export const PANEL_Y = VIEW_HEIGHT;

/** パネルの高さ（ドット）。 */
export const PANEL_HEIGHT = 48;

/** 道具アイコン列の上端（画面座標）。 */
export const TOOLBAR_Y = PANEL_Y + 2;

/** パネルに表示する情報。 */
export interface PanelInfo {
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
  /** 選んでいる道具の名前。 */
  toolName: string;
  /** 選んでいる道具の費用。0なら表示しない。 */
  toolCost: number;
  /** 一時的に出す通知。空文字なら出さない。 */
  message: string;
  /** カーソルが指しているタイル座標。マップ外なら `null`。 */
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
 * へこんだ枠を描く。
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
 * 画面座標が道具アイコン列のどこを指しているかを返す。列の外なら `null`。
 * @param screenX 画面上のX座標。
 * @param screenY 画面上のY座標。
 * @param toolCount 道具の数。
 */
export function toolIndexAt(screenX: number, screenY: number, toolCount: number): number | null {
  if (screenY < TOOLBAR_Y || screenY >= TOOLBAR_Y + TILE_SIZE) return null;
  const index = Math.floor(screenX / TILE_SIZE);
  return index >= 0 && index < toolCount ? index : null;
}

/**
 * 操作パネルを描く。
 * @param screen 描画先。
 * @param font 使用するフォント。
 * @param icons 道具アイコンのアトラス。
 * @param toolCount 道具の数。
 * @param selected 選択中の道具の番号。
 * @param info 表示する情報。
 */
export function drawPanel(
  screen: Screen,
  font: BitmapFont,
  icons: Tileset,
  toolCount: number,
  selected: number,
  info: PanelInfo,
): void {
  screen.fillRect(0, PANEL_Y, screen.width, PANEL_HEIGHT, COLOR.panel);
  screen.fillRect(0, PANEL_Y, screen.width, 1, COLOR.panelLight);
  screen.fillRect(0, PANEL_Y + 1, screen.width, 1, COLOR.panelShadow);

  // 道具アイコン列。
  for (let i = 0; i < toolCount; i++) {
    const x = i * TILE_SIZE;
    screen.blit(icons.pixels, TILE_SIZE, 0, i * TILE_SIZE, TILE_SIZE, TILE_SIZE, x, TOOLBAR_Y);
    if (i === selected) {
      screen.strokeRect(x, TOOLBAR_Y, TILE_SIZE, TILE_SIZE, COLOR.uiYellow);
    } else {
      screen.fillRect(x + TILE_SIZE - 1, TOOLBAR_Y, 1, TILE_SIZE, COLOR.panelShadow);
    }
  }

  const infoY = TOOLBAR_Y + TILE_SIZE + 2;
  drawInsetBox(screen, 2, infoY, 252, PANEL_Y + PANEL_HEIGHT - infoY - 2);

  font.drawText(screen, info.cityName, 5, infoY + 3, COLOR.white);
  font.drawText(
    screen,
    `${info.year}年${String(info.month).padStart(2, " ")}月`,
    5,
    infoY + 14,
    COLOR.lightGray,
  );
  font.drawText(screen, `$${formatNumber(info.funds)}`, 62, infoY + 14, COLOR.uiYellow);
  font.drawText(screen, `人口 ${formatNumber(info.population)}`, 118, infoY + 14, COLOR.white);

  // 右側は、通知があればそれを、なければ選択中の道具を出す。
  if (info.message) {
    font.drawTextRight(screen, info.message, 251, infoY + 3, COLOR.red);
  } else {
    font.drawTextRight(screen, info.toolName, 251, infoY + 3, COLOR.white);
  }
  if (info.toolCost > 0) {
    font.drawTextRight(screen, `$${formatNumber(info.toolCost)}`, 251, infoY + 14, COLOR.uiYellow);
  } else if (info.cursor) {
    font.drawTextRight(
      screen,
      `(${info.cursor.x}, ${info.cursor.y})`,
      251,
      infoY + 14,
      COLOR.lightGray,
    );
  }
}
