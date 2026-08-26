/**
 * 都市マップの格納庫。タイル・付随フラグ・区画情報をすべて TypedArray で持つ。
 * @packageDocumentation
 */
import { TileId, type TilePos } from "./tiles.js";

/** マップの横幅（タイル数）。 */
export const MAP_WIDTH = 120;

/** マップの高さ（タイル数）。 */
export const MAP_HEIGHT = 100;

/** タイルごとの付随フラグ。 */
export const TileFlag = {
  /** 電気が来ている。 */
  powered: 1,
  /** 建物・区画の左上（代表）タイルである。 */
  origin: 2,
  /** 建物の一部である（代表タイルを含む）。 */
  building: 4,
  /** 燃えている。 */
  burning: 8,
  /** 道路に接している（交通の判定結果のキャッシュ）。 */
  roadConnected: 16,
} as const;

/** 都市マップ。描画とシミュレーションの両方がこの1つの実体を参照する。 */
export class CityMap {
  /** 横幅（タイル数）。 */
  readonly width: number;
  /** 高さ（タイル数）。 */
  readonly height: number;
  /** 各マスのタイルID。 */
  readonly tiles: Uint16Array;
  /** 各マスの `TileFlag` の集合。 */
  readonly flags: Uint8Array;
  /** 建物の一部のマスに入る、代表タイルまでの相対位置（上位4bitがdy、下位4bitがdx）。 */
  readonly originOffset: Uint8Array;
  /** 代表タイルに入る建物の種類ID（`buildings.ts` が定義する）。 */
  readonly buildingKind: Uint8Array;

  /**
   * @param width 横幅（タイル数）。
   * @param height 高さ（タイル数）。
   */
  constructor(width: number = MAP_WIDTH, height: number = MAP_HEIGHT) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.tiles = new Uint16Array(size);
    this.flags = new Uint8Array(size);
    this.originOffset = new Uint8Array(size);
    this.buildingKind = new Uint8Array(size);
    this.tiles.fill(TileId.Grass);
  }

  /**
   * 座標がマップ内かどうか。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /**
   * 座標から配列添字を求める。範囲外チェックは行わない。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  index(x: number, y: number): number {
    return y * this.width + x;
  }

  /**
   * タイルIDを読む。範囲外は水面として扱い、端の処理を単純にする。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  get(x: number, y: number): number {
    if (!this.inBounds(x, y)) return TileId.Water;
    return this.tiles[y * this.width + x];
  }

  /**
   * タイルIDを書き込む。範囲外は無視する。
   * @param x タイルX座標。
   * @param y タイルY座標。
   * @param tile 書き込むタイルID。
   */
  set(x: number, y: number, tile: number): void {
    if (!this.inBounds(x, y)) return;
    this.tiles[y * this.width + x] = tile;
  }

  /**
   * 指定したフラグが立っているか。
   * @param x タイルX座標。
   * @param y タイルY座標。
   * @param flag `TileFlag` の値。
   */
  hasFlag(x: number, y: number, flag: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return (this.flags[y * this.width + x] & flag) !== 0;
  }

  /**
   * フラグを立てる。
   * @param x タイルX座標。
   * @param y タイルY座標。
   * @param flag `TileFlag` の値。
   */
  setFlag(x: number, y: number, flag: number): void {
    if (!this.inBounds(x, y)) return;
    this.flags[y * this.width + x] |= flag;
  }

  /**
   * フラグを下ろす。
   * @param x タイルX座標。
   * @param y タイルY座標。
   * @param flag `TileFlag` の値。
   */
  clearFlag(x: number, y: number, flag: number): void {
    if (!this.inBounds(x, y)) return;
    this.flags[y * this.width + x] &= ~flag;
  }

  /**
   * 建物の一部のマスから、その建物の代表タイル（左上）の座標を求める。
   * 建物でない場合は指定した座標をそのまま返す。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  originOf(x: number, y: number): TilePos {
    if (!this.inBounds(x, y)) return { x, y };
    const offset = this.originOffset[y * this.width + x];
    return { x: x - (offset & 0x0f), y: y - (offset >> 4) };
  }

  /**
   * 建物の一部であることを記録する。
   * @param x タイルX座標。
   * @param y タイルY座標。
   * @param dx 代表タイルからの相対X（0〜15）。
   * @param dy 代表タイルからの相対Y（0〜15）。
   */
  setOriginOffset(x: number, y: number, dx: number, dy: number): void {
    if (!this.inBounds(x, y)) return;
    this.originOffset[y * this.width + x] = ((dy & 0x0f) << 4) | (dx & 0x0f);
  }

  /**
   * 1マスを更地に戻し、建物としての情報も消す。
   * @param x タイルX座標。
   * @param y タイルY座標。
   * @param tile 置き換えるタイルID。
   */
  clearTile(x: number, y: number, tile: number = TileId.Dirt): void {
    if (!this.inBounds(x, y)) return;
    const i = y * this.width + x;
    this.tiles[i] = tile;
    this.flags[i] = 0;
    this.originOffset[i] = 0;
    this.buildingKind[i] = 0;
  }
}
