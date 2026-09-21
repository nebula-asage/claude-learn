/**
 * 8x8ビットマップフォントの読み込みと描画。
 *
 * データは `scripts/build-font.mjs` が美咲フォント（BDF）から生成した `misaki8.bin`。
 * 半角文字は4ドット幅、全角文字は8ドット幅で、いずれも高さ8ドットのセルに収まっている。
 * @packageDocumentation
 */
import type { Screen } from "../screen.js";

const MAGIC = 0x384b534d; // "MSK8" をリトルエンディアンのuint32として読んだ値

/** 文字が見つからないときに描く豆腐の形。 */
const TOFU = new Uint8Array([0x00, 0x7c, 0x44, 0x44, 0x44, 0x44, 0x7c, 0x00]);

/** 8x8のビットマップフォント。 */
export class BitmapFont {
  private readonly index = new Map<number, number>();
  private readonly widths: Uint8Array;
  private readonly bitmaps: Uint8Array;

  /**
   * `misaki8.bin` の内容を解釈してフォントを作る。
   * @param buffer フォントデータ全体。
   */
  constructor(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== MAGIC) {
      throw new Error("フォントデータの形式が正しくありません");
    }
    const count = view.getUint32(4, true);
    const widthsOffset = 8 + count * 2;
    const bitmapsOffset = widthsOffset + count;
    for (let i = 0; i < count; i++) {
      this.index.set(view.getUint16(8 + i * 2, true), i);
    }
    this.widths = new Uint8Array(buffer, widthsOffset, count);
    this.bitmaps = new Uint8Array(buffer, bitmapsOffset, count * 8);
  }

  /** 文字の高さ（ドット）。 */
  get lineHeight(): number {
    return 8;
  }

  /**
   * 1文字の送り幅（ドット）を返す。
   * @param codePoint 対象文字のコードポイント。
   */
  charWidth(codePoint: number): number {
    const i = this.index.get(codePoint);
    return i === undefined ? 8 : this.widths[i];
  }

  /**
   * 文字列を描いたときの幅（ドット）を返す。
   * @param text 対象の文字列。
   */
  measure(text: string): number {
    let w = 0;
    for (const ch of text) w += this.charWidth(ch.codePointAt(0) ?? 32);
    return w;
  }

  /**
   * 文字列を描画し、描いた幅を返す。
   * @param screen 描画先。
   * @param text 描く文字列。
   * @param x 左端。
   * @param y 上端。
   * @param color パレット添字。
   */
  drawText(screen: Screen, text: string, x: number, y: number, color: number): number {
    let cx = x;
    for (const ch of text) {
      const codePoint = ch.codePointAt(0) ?? 32;
      const i = this.index.get(codePoint);
      if (i === undefined) {
        screen.drawBits(TOFU, 0, 8, 8, cx, y, color);
        cx += 8;
        continue;
      }
      const width = this.widths[i];
      screen.drawBits(this.bitmaps, i * 8, width, 8, cx, y, color);
      cx += width;
    }
    return cx - x;
  }

  /**
   * 影付きで文字列を描く。地図の上など、背景が一定でない場所で使う。
   * @param screen 描画先。
   * @param text 描く文字列。
   * @param x 左端。
   * @param y 上端。
   * @param color 文字色のパレット添字。
   * @param shadow 影色のパレット添字。
   */
  drawTextShadow(
    screen: Screen,
    text: string,
    x: number,
    y: number,
    color: number,
    shadow: number,
  ): number {
    this.drawText(screen, text, x + 1, y + 1, shadow);
    return this.drawText(screen, text, x, y, color);
  }

  /**
   * 指定した範囲の中央に文字列を描く。
   * @param screen 描画先。
   * @param text 描く文字列。
   * @param centerX 中心のX座標。
   * @param y 上端。
   * @param color パレット添字。
   */
  drawTextCentered(
    screen: Screen,
    text: string,
    centerX: number,
    y: number,
    color: number,
  ): number {
    return this.drawText(screen, text, centerX - (this.measure(text) >> 1), y, color);
  }

  /**
   * 右端を揃えて文字列を描く。数値表示に使う。
   * @param screen 描画先。
   * @param text 描く文字列。
   * @param rightX 右端のX座標。
   * @param y 上端。
   * @param color パレット添字。
   */
  drawTextRight(screen: Screen, text: string, rightX: number, y: number, color: number): number {
    return this.drawText(screen, text, rightX - this.measure(text), y, color);
  }
}

/** 同梱のフォントデータを読み込む。 */
export async function loadFont(): Promise<BitmapFont> {
  const url = new URL("./misaki8.bin", import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`フォントを読み込めません: ${response.status}`);
  return new BitmapFont(await response.arrayBuffer());
}
