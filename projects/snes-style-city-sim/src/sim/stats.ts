/**
 * 都市の集計値。画面表示と需要計算の両方がこれを見る。
 * @packageDocumentation
 */
import { ZoneType, buildingByKind } from "./buildings.js";
import { CityMap, TileFlag } from "./map.js";
import { isRail, isRoad } from "./tiles.js";

/** 都市全体の集計。 */
export interface CityStats {
  /** 住民の数。 */
  residents: number;
  /** 商業の雇用者数。 */
  commercialJobs: number;
  /** 工業の雇用者数。 */
  industrialJobs: number;
  /** 表示用の総人口。 */
  population: number;
  /** 住宅区画の数。 */
  residentialZones: number;
  /** 商業区画の数。 */
  commercialZones: number;
  /** 工業区画の数。 */
  industrialZones: number;
  /** 道路タイルの数。 */
  roadTiles: number;
  /** 線路タイルの数。 */
  railTiles: number;
  /** 警察署の数。 */
  policeStations: number;
  /** 消防署の数。 */
  fireStations: number;
  /** 電気が来ていない建物の数。 */
  unpoweredBuildings: number;
}

/** すべて0の集計値を作る。 */
export function emptyStats(): CityStats {
  return {
    residents: 0,
    commercialJobs: 0,
    industrialJobs: 0,
    population: 0,
    residentialZones: 0,
    commercialZones: 0,
    industrialZones: 0,
    roadTiles: 0,
    railTiles: 0,
    policeStations: 0,
    fireStations: 0,
    unpoweredBuildings: 0,
  };
}

/**
 * マップ全体を走査して集計し直す。
 * @param map 対象のマップ。
 * @param stats 書き込む集計値。
 */
export function collectStats(map: CityMap, stats: CityStats): void {
  Object.assign(stats, emptyStats());

  for (let i = 0; i < map.tiles.length; i++) {
    const tile = map.tiles[i];
    if (isRoad(tile)) stats.roadTiles++;
    if (isRail(tile)) stats.railTiles++;

    const flags = map.flags[i];
    if ((flags & TileFlag.origin) === 0) continue;
    const def = buildingByKind(map.buildingKind[i]);

    if (def.zone === ZoneType.residential) {
      stats.residentialZones++;
      stats.residents += def.capacity;
    } else if (def.zone === ZoneType.commercial) {
      stats.commercialZones++;
      stats.commercialJobs += def.capacity;
    } else if (def.zone === ZoneType.industrial) {
      stats.industrialZones++;
      stats.industrialJobs += def.capacity;
    }

    if (def.id === "police-station") stats.policeStations++;
    if (def.id === "fire-station") stats.fireStations++;
    if (def.powerDemand > 0 && (flags & TileFlag.powered) === 0) stats.unpoweredBuildings++;
  }

  // 商業・工業の従業員も都市に住んでいるものとして人口に数える。
  stats.population =
    stats.residents + Math.round((stats.commercialJobs + stats.industrialJobs) / 2);
}
