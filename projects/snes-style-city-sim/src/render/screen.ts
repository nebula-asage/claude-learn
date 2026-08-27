/**
 * 256x224 のソフトウェアフレームバッファ。
 *
 * SNES風の見た目を保つため、タイル・文字・UIをすべて画素単位でこのバッファに書き込み、
 * 1フレームにつき一度だけ `putImageData` でcanvasへ転送する。canvasは内部解像度のまま置き、
 * 表示上の拡大はCSSの整数倍＋ニアレストネイバー（`image-rendering: pixelated`）に任せる。
 * @packageDocumentation
 */
import { PALETTE } from "./palette.js";

/** 画面の内部解像度（横）。 */
export const SCREEN_WIDTH = 256;

/** 画面の内部解像度（縦）。 */
export const SCREEN_HEIGHT = 224;

/** パレット添字を画素として書き込めるフレームバッファ。 */
export class Screen {
  /** 画面の横幅（画素）。 */
  readonly width: number;
  /** 画面の高さ（画素）。 */
  readonly height: number;
  /** 0xAABBGGRR 形式の画素配列。直接読み書きしてもよい。 */
  readonly pixels: Uint32Array;

  private readonly imageData: ImageData;
  private clipX0 = 0;
  private clipY0 = 0;
  private clipX1: number;
  private clipY1: number;

  /**
   * @param width 内部解像度の横幅。
   * @param height 内部解像度の高さ。
   */
  constructor(width: number = SCREEN_WIDTH, height: number = SCREEN_HEIGHT) {
    this.width = width;
    this.height = height;
    const buffer = new ArrayBuffer(width * height * 4);
    this.pixels = new Uint32Array(buffer);
    this.imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
    this.clipX1 = width;
    this.clipY1 = height;
  }

  /**
   * 以降の描画を指定矩形の内側に限定する。矩形は画面内へ丸められる。
   * @param x 左端。
   * @param y 上端。
   * @param w 幅。
   * @param h 高さ。
   */
  setClip(x: number, y: number, w: number, h: number): void {
    this.clipX0 = Math.max(0, x);
    this.clipY0 = Math.max(0, y);
    this.clipX1 = Math.min(this.width, x + w);
    this.clipY1 = Math.min(this.height, y + h);
  }

  /** クリップ範囲を画面全体に戻す。 */
  resetClip(): void {
    this.clipX0 = 0;
    this.clipY0 = 0;
    this.clipX1 = this.width;
    this.clipY1 = this.height;
  }

  /**
   * 画面全体を単色で塗りつぶす。クリップの影響を受けない。
   * @param color パレット添字。
   */
  clear(color: number): void {
    this.pixels.fill(PALETTE[color]);
  }

  /**
   * 1画素を書き込む。クリップ範囲外・透明色は無視される。
   * @param x X座標。
   * @param y Y座標。
   * @param color パレット添字（0は透明）。
   */
  setPixel(x: number, y: number, color: number): void {
    if (color === 0) return;
    // 座標に小数が混ざると添字が行をまたいでずれるため、必ず整数に丸めてから書く。
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < this.clipX0 || px >= this.clipX1 || py < this.clipY0 || py >= this.clipY1) return;
    this.pixels[py * this.width + px] = PALETTE[color];
  }

  /**
   * 矩形を塗りつぶす。
   * @param x 左端。
   * @param y 上端。
   * @param w 幅。
   * @param h 高さ。
   * @param color パレット添字（0は透明で何も描かない）。
   */
  fillRect(x: number, y: number, w: number, h: number, color: number): void {
    if (color === 0) return;
    const x0 = Math.max(Math.round(x), this.clipX0);
    const y0 = Math.max(Math.round(y), this.clipY0);
    const x1 = Math.min(Math.round(x + w), this.clipX1);
    const y1 = Math.min(Math.round(y + h), this.clipY1);
    if (x0 >= x1 || y0 >= y1) return;
    const value = PALETTE[color];
    for (let py = y0; py < y1; py++) {
      this.pixels.fill(value, py * this.width + x0, py * this.width + x1);
    }
  }

  /**
   * 矩形の枠線を描く。
   * @param x 左端。
   * @param y 上端。
   * @param w 幅。
   * @param h 高さ。
   * @param color パレット添字。
   */
  strokeRect(x: number, y: number, w: number, h: number, color: number): void {
    this.fillRect(x, y, w, 1, color);
    this.fillRect(x, y + h - 1, w, 1, color);
    this.fillRect(x, y + 1, 1, h - 2, color);
    this.fillRect(x + w - 1, y + 1, 1, h - 2, color);
  }

  /**
   * パレット添字の並んだ画像片を転送する。値0の画素は透明として飛ばす。
   * @param src パレット添字の配列。
   * @param srcStride `src` の1行あたりの要素数。
   * @param srcX 転送元の左端。
   * @param srcY 転送元の上端。
   * @param w 転送する幅。
   * @param h 転送する高さ。
   * @param dstX 転送先の左端。
   * @param dstY 転送先の上端。
   */
  blit(
    src: Uint8Array,
    srcStride: number,
    srcX: number,
    srcY: number,
    w: number,
    h: number,
    dstX: number,
    dstY: number,
  ): void {
    dstX = Math.round(dstX);
    dstY = Math.round(dstY);
    // クリップにかかる分だけ転送元の読み出し位置もずらす。
    const clipLeft = Math.max(0, this.clipX0 - dstX);
    const clipTop = Math.max(0, this.clipY0 - dstY);
    const clipRight = Math.max(0, dstX + w - this.clipX1);
    const clipBottom = Math.max(0, dstY + h - this.clipY1);
    const cw = w - clipLeft - clipRight;
    const ch = h - clipTop - clipBottom;
    if (cw <= 0 || ch <= 0) return;

    for (let row = 0; row < ch; row++) {
      let sp = (srcY + clipTop + row) * srcStride + srcX + clipLeft;
      let dp = (dstY + clipTop + row) * this.width + dstX + clipLeft;
      for (let col = 0; col < cw; col++, sp++, dp++) {
        const c = src[sp];
        if (c !== 0) this.pixels[dp] = PALETTE[c];
      }
    }
  }

  /**
   * 1ビットのビットマップ（各バイトが1行、最上位ビットが左端）を単色で描く。
   * 8x8のビットマップフォントやアイコンの描画に使う。
   * @param rows 行ごとのビットパターン。
   * @param rowOffset `rows` の読み出し開始位置。
   * @param width 描く幅（1〜8）。
   * @param height 描く高さ。
   * @param dstX 描画先の左端。
   * @param dstY 描画先の上端。
   * @param color パレット添字。
   */
  drawBits(
    rows: Uint8Array,
    rowOffset: number,
    width: number,
    height: number,
    dstX: number,
    dstY: number,
    color: number,
  ): void {
    if (color === 0) return;
    dstX = Math.round(dstX);
    dstY = Math.round(dstY);
    const value = PALETTE[color];
    for (let row = 0; row < height; row++) {
      const y = dstY + row;
      if (y < this.clipY0 || y >= this.clipY1) continue;
      const bits = rows[rowOffset + row];
      if (bits === 0) continue;
      const base = y * this.width;
      for (let col = 0; col < width; col++) {
        if ((bits & (0x80 >> col)) === 0) continue;
        const x = dstX + col;
        if (x < this.clipX0 || x >= this.clipX1) continue;
        this.pixels[base + x] = value;
      }
    }
  }

  /**
   * フレームバッファの内容をcanvasへ転送する。
   * @param ctx 転送先canvasの2Dコンテキスト。
   */
  present(ctx: CanvasRenderingContext2D): void {
    ctx.putImageData(this.imageData, 0, 0);
  }
}
