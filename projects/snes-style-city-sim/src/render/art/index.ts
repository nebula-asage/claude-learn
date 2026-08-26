/**
 * タイル絵の組み立て口。起動時に一度だけ全タイルを焼いてアトラスにする。
 * @packageDocumentation
 */
import { Tileset } from "../tileset.js";
import { paintNetworkTiles } from "./network.js";
import { paintTerrainTiles } from "./terrain.js";

/** アトラスが確保するタイル数。建物タイル用の余白を含む。 */
export const TILESET_CAPACITY = 512;

/** 全タイルの絵を焼いたアトラスを作る。 */
export function buildTileset(): Tileset {
  const tileset = new Tileset(TILESET_CAPACITY);
  paintTerrainTiles(tileset);
  paintNetworkTiles(tileset);
  return tileset;
}
