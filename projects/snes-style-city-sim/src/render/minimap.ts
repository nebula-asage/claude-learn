/**
 * ミニマップ（マップ全体を1タイル1ドットで表示する縮小図）の描画。
 * @packageDocumentation
 */
import type { CityMap } from "../sim/map.js";
import {
  TileId,
  isBuilding,
  isFire,
  isFlood,
  isForest,
  isRail,
  isRoad,
  isWater,
  isWire,
} from "../sim/tiles.js";
import { COLOR } from "./palette.js";
import type { Screen } from "./screen.js";

/**
 * ミニマップ上でタイルを表す色を返す。
 * @param tile タイルID。
 */
export function minimapColor(tile: number): number {
  if (isWater(tile)) return COLOR.water;
  if (isForest(tile)) return COLOR.forest;
  if (isFire(tile)) return COLOR.flame;
  if (isFlood(tile)) return COLOR.shallow;
  if (isRoad(tile)) return COLOR.darkGray;
  if (isRail(tile)) return COLOR.rail;
  if (isWire(tile)) return COLOR.wire;
  if (isBuilding(tile)) return COLOR.wall;
  if (tile === TileId.Sand) return COLOR.sand;
  if (tile === TileId.Dirt || tile === TileId.Rubble) return COLOR.dirt;
  return COLOR.grass;
}

/**
 * ミニマップを描く。
 * @param screen 描画先。
 * @param map 描くマップ。
 * @param x 左端。
 * @param y 上端。
 * @param scale 1タイルあたりのドット数。
 */
export function drawMinimap(
  screen: Screen,
  map: CityMap,
  x: number,
  y: number,
  scale: number = 1,
): void {
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const color = minimapColor(map.tiles[ty * map.width + tx]);
      if (scale === 1) {
        screen.setPixel(x + tx, y + ty, color);
      } else {
        screen.fillRect(x + tx * scale, y + ty * scale, scale, scale, color);
      }
    }
  }
}

/**
 * ミニマップ上に、いま表示している範囲を示す枠を描く。
 * @param screen 描画先。
 * @param x ミニマップの左端。
 * @param y ミニマップの上端。
 * @param viewTileX 表示範囲の左上タイルX座標。
 * @param viewTileY 表示範囲の左上タイルY座標。
 * @param viewTilesW 表示範囲の横タイル数。
 * @param viewTilesH 表示範囲の縦タイル数。
 * @param scale 1タイルあたりのドット数。
 */
export function drawMinimapFrame(
  screen: Screen,
  x: number,
  y: number,
  viewTileX: number,
  viewTileY: number,
  viewTilesW: number,
  viewTilesH: number,
  scale: number = 1,
): void {
  screen.strokeRect(
    x + viewTileX * scale,
    y + viewTileY * scale,
    viewTilesW * scale,
    viewTilesH * scale,
    COLOR.white,
  );
}
