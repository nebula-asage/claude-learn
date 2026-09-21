/**
 * マップ表示部（画面上部）のスクロールと描画。
 * @packageDocumentation
 */
import type { CityMap } from "../sim/map.js";
import {
  FIRE_FRAMES,
  FLOOD_FRAMES,
  TILE_SIZE,
  TileId,
  type TilePos,
  isFire,
  isFlood,
} from "../sim/tiles.js";
import type { Screen } from "./screen.js";
import { SCREEN_WIDTH } from "./screen.js";
import type { Tileset } from "./tileset.js";

/** マップ表示部の横幅（ドット）。 */
export const VIEW_WIDTH = SCREEN_WIDTH;

/** マップ表示部の高さ（ドット）。下部のパネル48ドットを除いた分。 */
export const VIEW_HEIGHT = 176;

/** マップ表示部のスクロール状態と描画。 */
export class MapView {
  /** 表示部の左上が指しているマップ上のX座標（ドット）。 */
  scrollX = 0;
  /** 表示部の左上が指しているマップ上のY座標（ドット）。 */
  scrollY = 0;

  /**
   * @param map 表示するマップ。
   * @param tileset タイル絵のアトラス。
   */
  constructor(
    private readonly map: CityMap,
    private readonly tileset: Tileset,
  ) {}

  /** スクロール位置をマップの範囲内に収める。 */
  clampScroll(): void {
    const maxX = Math.max(0, this.map.width * TILE_SIZE - VIEW_WIDTH);
    const maxY = Math.max(0, this.map.height * TILE_SIZE - VIEW_HEIGHT);
    this.scrollX = Math.min(maxX, Math.max(0, this.scrollX));
    this.scrollY = Math.min(maxY, Math.max(0, this.scrollY));
  }

  /**
   * スクロール位置をずらす。
   * @param dx 横方向の移動量（ドット）。
   * @param dy 縦方向の移動量（ドット）。
   */
  scrollBy(dx: number, dy: number): void {
    this.scrollX += dx;
    this.scrollY += dy;
    this.clampScroll();
  }

  /**
   * 指定したタイルが表示部の中央に来るようスクロールする。
   * @param tileX タイルX座標。
   * @param tileY タイルY座標。
   */
  centerOn(tileX: number, tileY: number): void {
    this.scrollX = Math.round(tileX * TILE_SIZE - VIEW_WIDTH / 2);
    this.scrollY = Math.round(tileY * TILE_SIZE - VIEW_HEIGHT / 2);
    this.clampScroll();
  }

  /**
   * 画面座標が指しているマップ上のタイル座標を返す。表示部の外なら `null`。
   * @param screenX 画面上のX座標（ドット）。
   * @param screenY 画面上のY座標（ドット）。
   */
  tileAt(screenX: number, screenY: number): TilePos | null {
    if (screenX < 0 || screenY < 0 || screenX >= VIEW_WIDTH || screenY >= VIEW_HEIGHT) return null;
    const x = Math.floor((screenX + this.scrollX) / TILE_SIZE);
    const y = Math.floor((screenY + this.scrollY) / TILE_SIZE);
    return this.map.inBounds(x, y) ? { x, y } : null;
  }

  /**
   * マップを描画する。
   * @param screen 描画先。
   * @param animationFrame アニメーション用のフレーム番号。炎や洪水のコマ送りに使う。
   */
  draw(screen: Screen, animationFrame: number): void {
    screen.setClip(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    const firstTileX = Math.floor(this.scrollX / TILE_SIZE);
    const firstTileY = Math.floor(this.scrollY / TILE_SIZE);
    const offsetX = this.scrollX - firstTileX * TILE_SIZE;
    const offsetY = this.scrollY - firstTileY * TILE_SIZE;
    const cols = Math.ceil((VIEW_WIDTH + offsetX) / TILE_SIZE);
    const rows = Math.ceil((VIEW_HEIGHT + offsetY) / TILE_SIZE);

    for (let row = 0; row < rows; row++) {
      const tileY = firstTileY + row;
      const dstY = row * TILE_SIZE - offsetY;
      for (let col = 0; col < cols; col++) {
        const tileX = firstTileX + col;
        const dstX = col * TILE_SIZE - offsetX;
        let tile = this.map.get(tileX, tileY);
        if (isFire(tile)) {
          tile = TileId.Fire + (animationFrame % FIRE_FRAMES);
        } else if (isFlood(tile)) {
          tile = TileId.Flood + (animationFrame % FLOOD_FRAMES);
        }
        screen.blit(
          this.tileset.pixels,
          TILE_SIZE,
          0,
          tile * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          dstX,
          dstY,
        );
      }
    }

    screen.resetClip();
  }
}
