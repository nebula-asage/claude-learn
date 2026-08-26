/**
 * タイル絵の置き場。全タイルを「幅16ドットの縦長の1枚絵」として持つ。
 *
 * こう持っておくと、描画側は `Screen.blit` に `srcY = tileId * 16` を渡すだけで
 * 任意のタイルを転送できる。
 * @packageDocumentation
 */
import type { ArtCanvas } from "./art/canvas.js";
import { TILE_SIZE } from "../sim/tiles.js";

/** タイル絵をまとめて保持するアトラス。 */
export class Tileset {
  /** 収容できるタイル数。 */
  readonly capacity: number;
  /** 幅16ドットの縦長の画像として並んだパレット添字。 */
  readonly pixels: Uint8Array;

  /**
   * @param capacity 収容するタイル数。
   */
  constructor(capacity: number) {
    this.capacity = capacity;
    this.pixels = new Uint8Array(capacity * TILE_SIZE * TILE_SIZE);
  }

  /**
   * 1枚のタイル絵を書き込む。
   * @param tileId 書き込む位置のタイルID。
   * @param art 16x16のパレット添字（`ArtCanvas.extract` の戻り値など）。
   */
  set(tileId: number, art: Uint8Array): void {
    if (tileId < 0 || tileId >= this.capacity) {
      throw new Error(`タイルIDが範囲外です: ${tileId}`);
    }
    if (art.length !== TILE_SIZE * TILE_SIZE) {
      throw new Error(`タイル絵の大きさが16x16ではありません: ${art.length}`);
    }
    this.pixels.set(art, tileId * TILE_SIZE * TILE_SIZE);
  }

  /**
   * `ArtCanvas` の内容を1枚のタイルとして書き込む。
   * @param tileId 書き込む位置のタイルID。
   * @param canvas 16x16の描画面。
   */
  setCanvas(tileId: number, canvas: ArtCanvas): void {
    this.set(tileId, canvas.extract(0, 0, TILE_SIZE));
  }

  /**
   * 大きな絵を16x16に切り分けて、連続したタイルIDへ書き込む。
   * 建物のように複数タイルにまたがる絵をそのまま描くために使う。
   * @param baseTileId 左上のタイルに割り当てるID。
   * @param canvas 切り分ける描画面。
   * @param tilesX 横のタイル数。
   * @param tilesY 縦のタイル数。
   */
  setGrid(baseTileId: number, canvas: ArtCanvas, tilesX: number, tilesY: number): void {
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        this.set(
          baseTileId + ty * tilesX + tx,
          canvas.extract(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE),
        );
      }
    }
  }
}
