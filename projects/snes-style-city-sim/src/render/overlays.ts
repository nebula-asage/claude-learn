/**
 * データマップ表示。地価や公害などの面データを、地図の上に網掛けで重ねる。
 *
 * フレームバッファはパレット方式で半透明が使えないため、値の大きさに応じた
 * 市松模様（ディザ）で「薄い/濃い」を表現する。
 * @packageDocumentation
 */
import { CityFields } from "../sim/fields.js";
import { TileFlag } from "../sim/map.js";
import type { CityState } from "../sim/state.js";
import { TILE_SIZE, isBuilding } from "../sim/tiles.js";
import { COLOR } from "./palette.js";
import type { MapView } from "./mapview.js";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./mapview.js";
import type { Screen } from "./screen.js";

/** 重ねて表示できるデータマップの種類。 */
export const DataMap = {
  /** 何も重ねない。 */
  none: 0,
  /** 地価。 */
  landValue: 1,
  /** 公害。 */
  pollution: 2,
  /** 犯罪発生度。 */
  crime: 3,
  /** 交通量。 */
  traffic: 4,
  /** 人口密度。 */
  population: 5,
  /** 警察の管轄。 */
  police: 6,
  /** 消防の管轄。 */
  fire: 7,
  /** 電力。 */
  power: 8,
} as const;

/** データマップの種類を表す型。 */
export type DataMapValue = (typeof DataMap)[keyof typeof DataMap];

/** データマップの表示名。 */
export const DATA_MAP_NAMES: Readonly<Record<DataMapValue, string>> = {
  [DataMap.none]: "通常表示",
  [DataMap.landValue]: "地価",
  [DataMap.pollution]: "公害",
  [DataMap.crime]: "犯罪",
  [DataMap.traffic]: "交通量",
  [DataMap.population]: "人口密度",
  [DataMap.police]: "警察の管轄",
  [DataMap.fire]: "消防の管轄",
  [DataMap.power]: "電力",
};

/** 値の大きさを表す色の段階（低い順）。 */
const RAMP = [COLOR.lightBlue, COLOR.green, COLOR.uiYellow, COLOR.orange, COLOR.red];

/**
 * 指定したデータマップの面データを取り出す。`none` と `power` は面データを持たない。
 * @param fields 面データ一式。
 * @param mode データマップの種類。
 */
function fieldFor(fields: CityFields, mode: DataMapValue): Uint8Array | null {
  switch (mode) {
    case DataMap.landValue:
      return fields.landValue;
    case DataMap.pollution:
      return fields.pollution;
    case DataMap.crime:
      return fields.crime;
    case DataMap.traffic:
      return fields.traffic;
    case DataMap.population:
      return fields.populationDensity;
    case DataMap.police:
      return fields.policeCoverage;
    case DataMap.fire:
      return fields.fireCoverage;
    default:
      return null;
  }
}

/**
 * 1タイル分を網掛けで塗る。`level` が大きいほど密に塗る。
 * @param screen 描画先。
 * @param x 塗る左端。
 * @param y 塗る上端。
 * @param color パレット添字。
 * @param level 濃さ（1〜4）。
 */
function ditherTile(screen: Screen, x: number, y: number, color: number, level: number): void {
  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      // 2x2の並びに0〜3の順位をつけ、濃さより小さい位置だけ塗る。
      const rank = (px & 1) + ((py & 1) << 1);
      if (rank < level) screen.setPixel(x + px, y + py, color);
    }
  }
}

/**
 * データマップを地図の上に重ねて描く。
 * @param screen 描画先。
 * @param state 都市の状態。
 * @param view 地図の表示位置。
 * @param mode 表示するデータマップの種類。
 */
export function drawDataMap(
  screen: Screen,
  state: CityState,
  view: MapView,
  mode: DataMapValue,
): void {
  if (mode === DataMap.none) return;

  const map = state.map;
  const field = fieldFor(state.fields, mode);
  screen.setClip(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const firstTileX = Math.floor(view.scrollX / TILE_SIZE);
  const firstTileY = Math.floor(view.scrollY / TILE_SIZE);
  const offsetX = view.scrollX - firstTileX * TILE_SIZE;
  const offsetY = view.scrollY - firstTileY * TILE_SIZE;
  const cols = Math.ceil((VIEW_WIDTH + offsetX) / TILE_SIZE);
  const rows = Math.ceil((VIEW_HEIGHT + offsetY) / TILE_SIZE);

  for (let row = 0; row < rows; row++) {
    const tileY = firstTileY + row;
    const dstY = row * TILE_SIZE - offsetY;
    for (let col = 0; col < cols; col++) {
      const tileX = firstTileX + col;
      const dstX = col * TILE_SIZE - offsetX;
      if (!map.inBounds(tileX, tileY)) continue;

      if (mode === DataMap.power) {
        if (!isBuilding(map.get(tileX, tileY))) continue;
        const powered = map.hasFlag(tileX, tileY, TileFlag.powered);
        ditherTile(screen, dstX, dstY, powered ? COLOR.uiYellow : COLOR.red, powered ? 2 : 4);
        continue;
      }

      if (!field) continue;
      const value = state.fields.at(field, tileX, tileY);
      if (value < 16) continue;
      const step = Math.min(RAMP.length - 1, Math.floor((value / 256) * RAMP.length));
      const level = 1 + Math.min(3, Math.floor((value / 256) * 4));
      ditherTile(screen, dstX, dstY, RAMP[step], level);
    }
  }

  screen.resetClip();
}
