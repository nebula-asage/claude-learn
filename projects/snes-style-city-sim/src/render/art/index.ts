/**
 * タイル絵の組み立て口。起動時に一度だけ全タイルを焼いてアトラスにする。
 * @packageDocumentation
 */
import { BUILDING_TILE_COUNT } from "../../sim/buildings.js";
import { BUILDING_TILE_BASE } from "../../sim/tiles.js";
import { Tileset } from "../tileset.js";
import { paintBuildingTiles } from "./buildings.js";
import { paintNetworkTiles } from "./network.js";
import { paintTerrainTiles } from "./terrain.js";

/** アトラスが確保するタイル数。地形・道路網の固定枠に建物の分を足したもの。 */
export const TILESET_CAPACITY = BUILDING_TILE_BASE + BUILDING_TILE_COUNT;

/** 全タイルの絵を焼いたアトラスを作る。 */
export function buildTileset(): Tileset {
  const tileset = new Tileset(TILESET_CAPACITY);
  paintTerrainTiles(tileset);
  paintNetworkTiles(tileset);
  paintBuildingTiles(tileset);
  return tileset;
}
