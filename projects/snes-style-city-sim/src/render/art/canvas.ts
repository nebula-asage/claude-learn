/**
 * パレット添字を並べた小さな描画面。タイル絵の生成に使う。
 * @packageDocumentation
 */
import { ART_CHARS } from "./chars.js";

/** パレット添字を書き込める矩形のバッファ。 */
export class ArtCanvas {
  /** 横幅（ドット）。 */
  readonly width: number;
  /** 高さ（ドット）。 */
  readonly height: number;
  /** パレット添字の並び。0は透明。 */
  readonly data: Uint8Array;

  /**
   * @param width 横幅（ドット）。
   * @param height 高さ（ドット）。
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
  }

  /**
   * 1ドット打つ。範囲外は無視する。
   * @param x X座標。
   * @param y Y座標。
   * @param color パレット添字。
   */
  px(x: number, y: number, color: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[y * this.width + x] = color;
  }

  /**
   * 面全体を塗る。
   * @param color パレット添字。
   */
  fill(color: number): void {
    this.data.fill(color);
  }

  /**
   * 矩形を塗る。
   * @param x 左端。
   * @param y 上端。
   * @param w 幅。
   * @param h 高さ。
   * @param color パレット添字。
   */
  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) this.px(px, py, color);
    }
  }

  /**
   * 矩形の枠を描く。
   * @param x 左端。
   * @param y 上端。
   * @param w 幅。
   * @param h 高さ。
   * @param color パレット添字。
   */
  frame(x: number, y: number, w: number, h: number, color: number): void {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
  }

  /**
   * 文字列で書いたドット絵を貼り付ける。`.` と空白は透明として飛ばす。
   * @param x 左端。
   * @param y 上端。
   * @param rows 1行1文字列のドット絵。
   */
  stamp(x: number, y: number, rows: readonly string[]): void {
    for (let row = 0; row < rows.length; row++) {
      const line = rows[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        const color = ART_CHARS[ch];
        if (color === undefined) {
          throw new Error(`ドット絵に未定義の文字があります: "${ch}"`);
        }
        if (color === 0) continue;
        this.px(x + col, y + row, color);
      }
    }
  }

  /**
   * 別の描画面の内容を貼り付ける。0（透明）の画素は転送しない。
   * @param x 左端。
   * @param y 上端。
   * @param source 転送元。
   */
  stampCanvas(x: number, y: number, source: ArtCanvas): void {
    for (let row = 0; row < source.height; row++) {
      for (let col = 0; col < source.width; col++) {
        const color = source.data[row * source.width + col];
        if (color !== 0) this.px(x + col, y + row, color);
      }
    }
  }

  /**
   * 指定した矩形を16x16のタイルとして切り出す。
   * @param x 切り出す左端。
   * @param y 切り出す上端。
   * @param size 一辺の長さ。
   */
  extract(x: number, y: number, size: number): Uint8Array {
    const out = new Uint8Array(size * size);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const sx = x + col;
        const sy = y + row;
        if (sx < 0 || sy < 0 || sx >= this.width || sy >= this.height) continue;
        out[row * size + col] = this.data[sy * this.width + sx];
      }
    }
    return out;
  }
}

/**
 * 文字列で書いたドット絵から描画面を作る。
 * @param rows 1行1文字列のドット絵。全行が同じ長さである必要がある。
 */
export function artFromStrings(rows: readonly string[]): ArtCanvas {
  const height = rows.length;
  const width = height === 0 ? 0 : rows[0].length;
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`ドット絵の行の長さが揃っていません: 期待 ${width}, 実際 ${row.length}`);
    }
  }
  const canvas = new ArtCanvas(width, height);
  canvas.stamp(0, 0, rows);
  return canvas;
}
