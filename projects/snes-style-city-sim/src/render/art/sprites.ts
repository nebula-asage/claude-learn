/**
 * 地図の上を動く災害（竜巻・怪獣）と、アドバイザーの顔のドット絵。
 * @packageDocumentation
 */
import { COLOR } from "../palette.js";
import { ArtCanvas } from "./canvas.js";

/** 1枚のスプライト画像。 */
export interface SpriteImage {
  /** 横幅（ドット）。 */
  width: number;
  /** 高さ（ドット）。 */
  height: number;
  /** パレット添字の並び。0は透明。 */
  pixels: Uint8Array;
}

/** スプライトの名前。 */
export type SpriteName = "tornado" | "monster" | "advisor";

/**
 * 竜巻を描く。
 * @param frame アニメーションのコマ番号。
 */
function tornado(frame: number): ArtCanvas {
  const canvas = new ArtCanvas(16, 32);
  for (let y = 0; y < 32; y++) {
    // 上ほど太く、下へ向かって細くなる漏斗の形。
    const half = Math.max(1, Math.round(7 - (y / 32) * 6));
    const sway = Math.round(Math.sin((y / 5 + frame) * 0.9) * 2);
    const center = 8 + sway;
    const shade = (y + frame) % 4 < 2 ? COLOR.lightGray : COLOR.gray;
    canvas.rect(center - half, y, half * 2, 1, shade);
    canvas.px(center - half, y, COLOR.darkGray);
    canvas.px(center + half - 1, y, COLOR.white);
  }
  // 巻き上げられた土埃。
  canvas.rect(2, 30, 12, 2, COLOR.dirt);
  canvas.px(1, 29, COLOR.dirt);
  canvas.px(14, 31, COLOR.dirt);
  return canvas;
}

/**
 * 怪獣を描く。
 * @param frame アニメーションのコマ番号。
 */
function monster(frame: number): ArtCanvas {
  const canvas = new ArtCanvas(32, 32);
  const step = frame % 2 === 0 ? 0 : 1;
  const body = COLOR.forest;
  const belly = COLOR.green;

  // 尻尾。
  canvas.rect(0, 22 - step, 10, 3, body);
  canvas.rect(2, 20 - step, 6, 2, body);
  // 胴。
  canvas.rect(8, 12, 14, 14, body);
  canvas.frame(8, 12, 14, 14, COLOR.black);
  canvas.rect(12, 17, 7, 8, belly);
  // 脚。
  canvas.rect(9, 25, 5, 6 - step, body);
  canvas.rect(16, 25, 5, 5 + step, body);
  canvas.rect(9, 30, 6, 2, COLOR.darkForest);
  canvas.rect(16, 29 + step, 6, 2, COLOR.darkForest);
  // 腕。
  canvas.rect(20, 15, 6, 4, body);
  canvas.rect(24, 13 + step, 4, 4, body);
  // 首と頭。
  canvas.rect(18, 6, 6, 8, body);
  canvas.rect(18, 2, 12, 8, body);
  canvas.frame(18, 2, 12, 8, COLOR.black);
  canvas.rect(26, 5, 3, 2, COLOR.red); // 目
  canvas.rect(22, 9, 8, 2, COLOR.white); // 牙
  // 背びれ。
  for (let i = 0; i < 4; i++) {
    canvas.rect(9 + i * 3, 9 - (i % 2), 2, 4, COLOR.darkForest);
  }
  return canvas;
}

/** アドバイザーの顔を描く。 */
function advisor(): ArtCanvas {
  const canvas = new ArtCanvas(24, 24);
  // 肩とスーツ。
  canvas.rect(2, 18, 20, 6, COLOR.uiBlue);
  canvas.rect(10, 18, 4, 6, COLOR.white);
  canvas.rect(11, 19, 2, 3, COLOR.red);
  // 顔。
  canvas.rect(5, 4, 14, 15, COLOR.wall);
  canvas.frame(5, 4, 14, 15, COLOR.black);
  // ヘルメット。
  canvas.rect(4, 1, 16, 5, COLOR.uiYellow);
  canvas.rect(3, 5, 18, 2, COLOR.uiYellow);
  canvas.frame(4, 1, 16, 5, COLOR.black);
  // 目と眼鏡。
  canvas.rect(7, 10, 4, 3, COLOR.white);
  canvas.rect(13, 10, 4, 3, COLOR.white);
  canvas.px(9, 11, COLOR.black);
  canvas.px(15, 11, COLOR.black);
  canvas.rect(11, 11, 2, 1, COLOR.darkGray);
  // 口。
  canvas.rect(10, 15, 4, 1, COLOR.darkRed);
  return canvas;
}

/**
 * `ArtCanvas` をスプライト画像に変換する。
 * @param canvas 変換元。
 */
function toSprite(canvas: ArtCanvas): SpriteImage {
  return { width: canvas.width, height: canvas.height, pixels: canvas.data };
}

/** スプライトの絵を全種類作る。値はアニメーションのコマの並び。 */
export function buildSprites(): Record<SpriteName, SpriteImage[]> {
  return {
    tornado: [0, 1, 2, 3].map((frame) => toSprite(tornado(frame))),
    monster: [0, 1].map((frame) => toSprite(monster(frame))),
    advisor: [toSprite(advisor())],
  };
}
