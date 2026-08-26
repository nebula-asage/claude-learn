/**
 * 交通の判定。区画から道路をたどって行き先が見つかるかを調べ、通った道に交通量を足す。
 *
 * すべての経路を厳密に探索すると重いので、区画ごとに「道路をランダムに何歩か進んでみて、
 * 目的地の区画にたどり着けたか」を試す。多くの区画で何度も繰り返されることで、
 * 結果として渋滞や行き止まりが自然に浮かび上がる。
 * @packageDocumentation
 */
import { type BuildingDef, ZoneType, type ZoneTypeValue, buildingByKind } from "./buildings.js";
import type { CityMap } from "./map.js";
import { TileFlag } from "./map.js";
import type { CityState } from "./state.js";
import { NEIGHBORS, type TilePos, isRoad } from "./tiles.js";

/** 1回の移動で進める最大の歩数。 */
export const MAX_TRIP_LENGTH = 26;

/** 移動1回が道路に足す交通量。 */
const TRAFFIC_PER_TRIP = 20;

/**
 * その区画の住民・従業員が向かう先の区画種別を返す。
 * @param zone 出発する区画の種別。
 */
function destinationsFor(zone: ZoneTypeValue): readonly ZoneTypeValue[] {
  if (zone === ZoneType.residential) return [ZoneType.commercial, ZoneType.industrial];
  if (zone === ZoneType.commercial) return [ZoneType.residential];
  return [ZoneType.residential];
}

/**
 * 建物の外周に接している道路タイルを集める。
 * @param map 対象のマップ。
 * @param x 建物の左上のタイルX座標。
 * @param y 建物の左上のタイルY座標。
 * @param def 建物定義。
 */
export function adjacentRoads(map: CityMap, x: number, y: number, def: BuildingDef): TilePos[] {
  const roads: TilePos[] = [];
  for (let dx = 0; dx < def.width; dx++) {
    for (const ny of [y - 1, y + def.height]) {
      if (isRoad(map.get(x + dx, ny))) roads.push({ x: x + dx, y: ny });
    }
  }
  for (let dy = 0; dy < def.height; dy++) {
    for (const nx of [x - 1, x + def.width]) {
      if (isRoad(map.get(nx, y + dy))) roads.push({ x: nx, y: y + dy });
    }
  }
  return roads;
}

/**
 * 建物が道路に接しているか。
 * @param map 対象のマップ。
 * @param x 建物の左上のタイルX座標。
 * @param y 建物の左上のタイルY座標。
 * @param def 建物定義。
 */
export function hasRoadAccess(map: CityMap, x: number, y: number, def: BuildingDef): boolean {
  return adjacentRoads(map, x, y, def).length > 0;
}

/**
 * その道路タイルの隣に、指定した種別の（すでに建物が建っている）区画があるか。
 * @param map 対象のマップ。
 * @param x 道路のタイルX座標。
 * @param y 道路のタイルY座標。
 * @param wanted 探している区画種別。
 */
function touchesZone(
  map: CityMap,
  x: number,
  y: number,
  wanted: readonly ZoneTypeValue[],
): boolean {
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!map.inBounds(nx, ny)) continue;
    if (!map.hasFlag(nx, ny, TileFlag.building)) continue;
    const origin = map.originOf(nx, ny);
    const def = buildingByKind(map.buildingKind[map.index(origin.x, origin.y)]);
    if (def.level > 0 && wanted.includes(def.zone)) return true;
  }
  return false;
}

/**
 * 区画から目的地までたどり着けるかを1回試し、たどり着けた道に交通量を足す。
 * @param state 都市の状態。
 * @param x 区画の左上のタイルX座標。
 * @param y 区画の左上のタイルY座標。
 * @param def 区画の建物定義。
 */
export function attemptTrip(state: CityState, x: number, y: number, def: BuildingDef): boolean {
  const { map, rng, fields } = state;
  const starts = adjacentRoads(map, x, y, def);
  if (starts.length === 0) return false;

  const wanted = destinationsFor(def.zone);
  let current = rng.pick(starts);
  let previousX = -1;
  let previousY = -1;
  const path: TilePos[] = [current];

  for (let step = 0; step < MAX_TRIP_LENGTH; step++) {
    if (touchesZone(map, current.x, current.y, wanted)) {
      for (const tile of path) fields.add(fields.traffic, tile.x, tile.y, TRAFFIC_PER_TRIP);
      return true;
    }

    // 来た道を除いた行き先を集める。行き止まりなら、そこで打ち切る。
    const options: TilePos[] = [];
    for (const [dx, dy] of NEIGHBORS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx === previousX && ny === previousY) continue;
      if (!isRoad(map.get(nx, ny))) continue;
      options.push({ x: nx, y: ny });
    }
    if (options.length === 0) return false;

    previousX = current.x;
    previousY = current.y;
    current = rng.pick(options);
    path.push(current);
  }
  return false;
}

/**
 * 交通量を少しずつ減らす。1か月ごとに呼ぶ想定。
 * @param state 都市の状態。
 */
export function decayTraffic(state: CityState): void {
  const traffic = state.fields.traffic;
  for (let i = 0; i < traffic.length; i++) {
    traffic[i] = Math.round(traffic[i] * 0.85);
  }
}
