/**
 * ウィンドウ（予算画面などの重ね表示）の描画部品。
 * @packageDocumentation
 */
import type { BitmapFont } from "./font/font.js";
import { COLOR } from "./palette.js";
import type { Screen } from "./screen.js";

/** 画面上の矩形。 */
export interface Rect {
  /** 左端。 */
  x: number;
  /** 上端。 */
  y: number;
  /** 幅。 */
  width: number;
  /** 高さ。 */
  height: number;
}

/**
 * 点が矩形の中にあるか。
 * @param rect 判定する矩形。
 * @param x 点のX座標。
 * @param y 点のY座標。
 */
export function hitTest(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

/**
 * 画面全体を暗い網掛けで覆い、ウィンドウを目立たせる。
 * @param screen 描画先。
 */
export function dimScreen(screen: Screen): void {
  for (let y = 0; y < screen.height; y++) {
    for (let x = y & 1; x < screen.width; x += 2) {
      screen.setPixel(x, y, COLOR.black);
    }
  }
}

/**
 * ウィンドウの枠と見出しを描く。
 * @param screen 描画先。
 * @param font 使用するフォント。
 * @param rect ウィンドウの位置と大きさ。
 * @param title 見出し。
 */
export function drawWindowFrame(screen: Screen, font: BitmapFont, rect: Rect, title: string): void {
  screen.fillRect(rect.x + 2, rect.y + 2, rect.width, rect.height, COLOR.black);
  screen.fillRect(rect.x, rect.y, rect.width, rect.height, COLOR.panel);
  screen.fillRect(rect.x, rect.y, rect.width, 1, COLOR.panelLight);
  screen.fillRect(rect.x, rect.y, 1, rect.height, COLOR.panelLight);
  screen.fillRect(rect.x, rect.y + rect.height - 1, rect.width, 1, COLOR.panelShadow);
  screen.fillRect(rect.x + rect.width - 1, rect.y, 1, rect.height, COLOR.panelShadow);

  screen.fillRect(rect.x + 1, rect.y + 1, rect.width - 2, 11, COLOR.uiBlue);
  font.drawTextCentered(screen, title, rect.x + rect.width / 2, rect.y + 2, COLOR.white);
}

/**
 * 押せるボタンを描く。
 * @param screen 描画先。
 * @param font 使用するフォント。
 * @param rect ボタンの位置と大きさ。
 * @param label 文字。
 * @param highlighted 強調表示するか。
 */
export function drawButton(
  screen: Screen,
  font: BitmapFont,
  rect: Rect,
  label: string,
  highlighted: boolean = false,
): void {
  screen.fillRect(rect.x, rect.y, rect.width, rect.height, highlighted ? COLOR.uiBlue : COLOR.gray);
  screen.fillRect(rect.x, rect.y, rect.width, 1, COLOR.lightGray);
  screen.fillRect(rect.x, rect.y, 1, rect.height, COLOR.lightGray);
  screen.fillRect(rect.x, rect.y + rect.height - 1, rect.width, 1, COLOR.black);
  screen.fillRect(rect.x + rect.width - 1, rect.y, 1, rect.height, COLOR.black);
  font.drawTextCentered(
    screen,
    label,
    rect.x + rect.width / 2,
    rect.y + (rect.height - 8) / 2 + 1,
    COLOR.white,
  );
}

/**
 * 割合を表す横棒を描く。
 * @param screen 描画先。
 * @param x 左端。
 * @param y 上端。
 * @param width 幅。
 * @param ratio 0〜1の割合。
 * @param color 棒の色。
 */
export function drawGauge(
  screen: Screen,
  x: number,
  y: number,
  width: number,
  ratio: number,
  color: number,
): void {
  screen.fillRect(x, y, width, 5, COLOR.panelShadow);
  screen.strokeRect(x, y, width, 5, COLOR.black);
  const filled = Math.round((width - 2) * Math.max(0, Math.min(1, ratio)));
  if (filled > 0) screen.fillRect(x + 1, y + 1, filled, 3, color);
}

/**
 * 折れ線グラフを描く。値は自動で縦方向に収まるよう調整される。
 * @param screen 描画先。
 * @param x 左端。
 * @param y 上端。
 * @param width 幅。
 * @param height 高さ。
 * @param values 古い順に並んだ値。
 * @param color 線の色。
 */
export function drawLineGraph(
  screen: Screen,
  x: number,
  y: number,
  width: number,
  height: number,
  values: readonly number[],
  color: number,
): void {
  screen.fillRect(x, y, width, height, COLOR.panelShadow);
  screen.strokeRect(x, y, width, height, COLOR.black);
  if (values.length === 0) return;

  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  let previousX = -1;
  let previousY = -1;

  for (let i = 0; i < values.length; i++) {
    const px =
      values.length === 1
        ? x + width - 2
        : x + 1 + Math.round((i / (values.length - 1)) * (width - 3));
    const py = y + height - 2 - Math.round(((values[i] - min) / span) * (height - 4));
    if (previousX >= 0) {
      // 直前の点との間を直線で埋める。
      const steps = Math.max(Math.abs(px - previousX), Math.abs(py - previousY));
      for (let s = 1; s <= steps; s++) {
        screen.setPixel(
          previousX + Math.round(((px - previousX) * s) / steps),
          previousY + Math.round(((py - previousY) * s) / steps),
          color,
        );
      }
    }
    screen.setPixel(px, py, color);
    previousX = px;
    previousY = py;
  }
}
