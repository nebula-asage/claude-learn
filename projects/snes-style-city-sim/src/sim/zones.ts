/**
 * 区画の成長と衰退。
 *
 * 区画は「電気が来ている」「道路につながっている」を前提に、需要・地価・公害・犯罪・
 * 渋滞を足し引きした点数で伸び縮みする。点数が高ければ建物が育ち、低ければ寂れていく。
 * @packageDocumentation
 */
import { placeStructure } from "./build.js";
import { MAX_ZONE_LEVEL, ZoneType, buildingByKind, zoneBuilding } from "./buildings.js";
import { TileFlag } from "./map.js";
import type { CityState } from "./state.js";
import { attemptTrip, hasRoadAccess } from "./traffic.js";

/** 区画1つを評価した結果。 */
export interface ZoneEvaluation {
  /** 成長のしやすさを表す点数。 */
  score: number;
  /** 電気が来ているか。 */
  powered: boolean;
  /** 道路につながっているか。 */
  roadConnected: boolean;
  /** 目的地までたどり着けたか。 */
  tripSucceeded: boolean;
}

/**
 * 区画を1つ評価する。副作用として、交通量の加算（移動の試行）を行う。
 * @param state 都市の状態。
 * @param x 区画の左上のタイルX座標。
 * @param y 区画の左上のタイルY座標。
 */
export function evaluateZone(state: CityState, x: number, y: number): ZoneEvaluation {
  const { map, fields, demand } = state;
  const def = buildingByKind(map.buildingKind[map.index(x, y)]);

  const powered = map.hasFlag(x, y, TileFlag.powered);
  const roadConnected = hasRoadAccess(map, x, y, def);
  const tripSucceeded = def.level > 0 && roadConnected ? attemptTrip(state, x, y, def) : false;

  const landValue = fields.at(fields.landValue, x + 1, y + 1);
  const pollution = fields.at(fields.pollution, x + 1, y + 1);
  const crime = fields.at(fields.crime, x + 1, y + 1);
  const traffic = fields.at(fields.traffic, x + 1, y + 1);

  // 点数は「その場所がどれだけ良いか」が主で、需要は後押し。需要そのものは
  // 下の `updateZone` で成長の可否を分ける門番として使う。
  let score: number;
  if (def.zone === ZoneType.residential) {
    score = (landValue - 50) * 0.6 + demand.residential * 70 - pollution / 2 - crime / 3;
  } else if (def.zone === ZoneType.commercial) {
    score = (landValue - 50) * 0.6 + demand.commercial * 70 - pollution / 4 - crime / 3;
  } else {
    // 工業は地価をあまり選ばず、公害も気にしない。
    score = (landValue - 20) * 0.3 + demand.industrial * 70 - crime / 6;
  }

  // 渋滞は成長を頭打ちにする。
  score -= Math.max(0, traffic - 180) / 3;

  if (!powered) score -= 200;
  if (!roadConnected) score -= 150;
  else if (def.level > 0 && !tripSucceeded) score -= 40;

  return { score, powered, roadConnected, tripSucceeded };
}

/**
 * 区画の成長段階を変更する。通電状態は引き継ぐ（次の電力走査まで持たせるため）。
 * @param state 都市の状態。
 * @param x 区画の左上のタイルX座標。
 * @param y 区画の左上のタイルY座標。
 * @param level 新しい成長段階。
 */
export function setZoneLevel(state: CityState, x: number, y: number, level: number): void {
  const map = state.map;
  const def = buildingByKind(map.buildingKind[map.index(x, y)]);
  const next = zoneBuilding(def.zone, level);
  if (next.kind === def.kind) return;

  const wasPowered = map.hasFlag(x, y, TileFlag.powered);
  placeStructure(map, x, y, next);
  if (wasPowered) {
    for (let dy = 0; dy < next.height; dy++) {
      for (let dx = 0; dx < next.width; dx++) map.setFlag(x + dx, y + dy, TileFlag.powered);
    }
  }
}

/**
 * 区画を1つ評価し、必要なら成長・衰退させる。
 * @param state 都市の状態。
 * @param x 区画の左上のタイルX座標。
 * @param y 区画の左上のタイルY座標。
 */
export function updateZone(state: CityState, x: number, y: number): void {
  const map = state.map;
  const def = buildingByKind(map.buildingKind[map.index(x, y)]);
  if (def.zone === ZoneType.none) return;

  const evaluation = evaluateZone(state, x, y);
  const rng = state.rng;
  const zoneDemand =
    def.zone === ZoneType.residential
      ? state.demand.residential
      : def.zone === ZoneType.commercial
        ? state.demand.commercial
        : state.demand.industrial;

  // 段階が上がるほど、育つのに必要な点数も上がる。需要が無い区画は育たない。
  const growThreshold = 8 + def.level * 14;
  if (
    def.level < MAX_ZONE_LEVEL &&
    zoneDemand > 0.02 &&
    evaluation.score > growThreshold &&
    rng.chance(0.3)
  ) {
    setZoneLevel(state, x, y, def.level + 1);
    return;
  }
  // 衰退の閾値は成長より低くしておく。両者が近いと、同じ区画が伸び縮みを繰り返してしまう。
  if (def.level > 0 && (evaluation.score < -40 || zoneDemand < -0.35) && rng.chance(0.2)) {
    setZoneLevel(state, x, y, def.level - 1);
  }
}
