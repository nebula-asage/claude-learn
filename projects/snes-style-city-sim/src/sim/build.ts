/**
 * 建設・取り壊しの処理。費用の判定と、道路網のつなぎ直しをここに集める。
 * @packageDocumentation
 */
import {
  type BuildingDef,
  ZoneType,
  type ZoneTypeValue,
  buildingByKind,
  zoneBuilding,
} from "./buildings.js";
import type { CityMap } from "./map.js";
import { TileFlag } from "./map.js";
import type { CityState } from "./state.js";
import {
  TileId,
  isBuildable,
  isBuilding,
  isForest,
  isRail,
  isRoad,
  isWater,
  isWire,
} from "./tiles.js";

/** 建設にかかる費用。 */
export const BUILD_COST = {
  /** 取り壊し。 */
  bulldoze: 1,
  /** 道路。 */
  road: 10,
  /** 橋。 */
  roadBridge: 50,
  /** 線路。 */
  rail: 20,
  /** 鉄橋。 */
  railBridge: 100,
  /** 送電線。 */
  wire: 5,
  /** 水上の鉄塔。 */
  wireBridge: 25,
  /** 区画の指定。 */
  zone: 100,
} as const;

/** 建設処理の結果。 */
export interface BuildResult {
  /** 実行できたか。 */
  ok: boolean;
  /** 実際にかかった費用。 */
  cost: number;
  /** 失敗理由。通知不要な場合は空文字。 */
  message: string;
}

/** 何も起きなかったことを表す結果。 */
const NOTHING: BuildResult = { ok: false, cost: 0, message: "" };

/**
 * 失敗を表す結果を作る。
 * @param message 表示する理由。
 */
function fail(message: string): BuildResult {
  return { ok: false, cost: 0, message };
}

/**
 * そのマスを更地にできるか（水面と建設済みの構造物以外）。
 * @param tile タイルID。
 */
function canOverwrite(tile: number): boolean {
  return !isWater(tile) && !isBuilding(tile);
}

/**
 * 道路・線路・送電線タイルの見た目を、周囲の接続状況に合わせて描き直す。
 * @param map 対象のマップ。
 * @param x タイルX座標。
 * @param y タイルY座標。
 */
export function refreshNetworkTile(map: CityMap, x: number, y: number): void {
  const tile = map.get(x, y);
  if (!map.inBounds(x, y)) return;

  // 橋と交差タイルは向きが固定なので、つなぎ直しの対象にしない。
  if (tile >= TileId.RoadRail) return;

  const connect = (test: (t: number) => boolean): number => {
    let mask = 0;
    if (test(map.get(x, y - 1))) mask |= 1;
    if (test(map.get(x + 1, y))) mask |= 2;
    if (test(map.get(x, y + 1))) mask |= 4;
    if (test(map.get(x - 1, y))) mask |= 8;
    return mask;
  };

  if (isRoad(tile)) {
    map.set(x, y, TileId.Road + connect(isRoad));
  } else if (isRail(tile)) {
    map.set(x, y, TileId.Rail + connect(isRail));
  } else if (isWire(tile)) {
    // 建物にも電気は流れるが、見た目の線は送電線どうしだけでつなぐ。
    map.set(x, y, TileId.Wire + connect(isWire));
  }
}

/**
 * 指定したマスとその上下左右の見た目をつなぎ直す。
 * @param map 対象のマップ。
 * @param x タイルX座標。
 * @param y タイルY座標。
 */
export function refreshNetworkAround(map: CityMap, x: number, y: number): void {
  refreshNetworkTile(map, x, y);
  refreshNetworkTile(map, x, y - 1);
  refreshNetworkTile(map, x + 1, y);
  refreshNetworkTile(map, x, y + 1);
  refreshNetworkTile(map, x - 1, y);
}

/**
 * 建物を丸ごと取り壊して瓦礫にする。
 * @param map 対象のマップ。
 * @param x 建物のどこかのタイルX座標。
 * @param y 建物のどこかのタイルY座標。
 */
export function demolishBuilding(map: CityMap, x: number, y: number): void {
  const origin = map.originOf(x, y);
  const def = buildingByKind(map.buildingKind[map.index(origin.x, origin.y)]);
  for (let dy = 0; dy < def.height; dy++) {
    for (let dx = 0; dx < def.width; dx++) {
      map.clearTile(origin.x + dx, origin.y + dy, TileId.Rubble);
    }
  }
  for (let dy = -1; dy <= def.height; dy++) {
    for (let dx = -1; dx <= def.width; dx++) {
      refreshNetworkTile(map, origin.x + dx, origin.y + dy);
    }
  }
}

/**
 * 1マスを取り壊す。建物の一部なら建物ごと取り壊す。
 * @param state 都市の状態。
 * @param x タイルX座標。
 * @param y タイルY座標。
 */
export function bulldoze(state: CityState, x: number, y: number): BuildResult {
  const map = state.map;
  const tile = map.get(x, y);
  if (!map.inBounds(x, y)) return NOTHING;
  if (isWater(tile)) return fail("水面は取り壊せません");
  if (tile === TileId.Dirt) return NOTHING;
  if (!state.canAfford(BUILD_COST.bulldoze)) return fail("資金が足りません");

  state.spend(BUILD_COST.bulldoze);
  if (isBuilding(tile)) {
    demolishBuilding(map, x, y);
  } else {
    map.clearTile(x, y, TileId.Dirt);
    refreshNetworkAround(map, x, y);
  }
  return { ok: true, cost: BUILD_COST.bulldoze, message: "" };
}

/** 敷設できる線状インフラの種類。 */
export type NetworkKind = "road" | "rail" | "wire";

/**
 * 道路・線路・送電線を1マス敷く。既存の線とは自動でつながり、
 * 直線どうしが直交する場合は交差タイルになる。
 * @param state 都市の状態。
 * @param x タイルX座標。
 * @param y タイルY座標。
 * @param kind 敷くものの種類。
 */
export function buildNetwork(
  state: CityState,
  x: number,
  y: number,
  kind: NetworkKind,
): BuildResult {
  const map = state.map;
  if (!map.inBounds(x, y)) return NOTHING;
  const tile = map.get(x, y);

  const isSame = kind === "road" ? isRoad : kind === "rail" ? isRail : isWire;
  if (isSame(tile)) return NOTHING;

  const water = isWater(tile);
  const cost = water
    ? kind === "road"
      ? BUILD_COST.roadBridge
      : kind === "rail"
        ? BUILD_COST.railBridge
        : BUILD_COST.wireBridge
    : kind === "road"
      ? BUILD_COST.road
      : kind === "rail"
        ? BUILD_COST.rail
        : BUILD_COST.wire;

  if (!water && !canOverwrite(tile)) return fail("ここには敷けません");
  if (!state.canAfford(cost)) return fail("資金が足りません");

  if (water) {
    // 橋は向きが固定なので、どちらへ渡そうとしているかを周囲から推測する。
    // 既に繋がっている線路・道路を強く優先し、それが無ければ岸のある向きを見る。
    const vertical = spanScore(map, x, y, kind, true) > spanScore(map, x, y, kind, false);
    const base =
      kind === "road" ? TileId.RoadBridge : kind === "rail" ? TileId.RailBridge : TileId.WireBridge;
    state.spend(cost);
    map.clearTile(x, y, base + (vertical ? 0 : 1));
    return { ok: true, cost, message: "" };
  }

  const crossing = crossingTile(tile, kind);
  if (crossing !== null) {
    state.spend(cost);
    map.set(x, y, crossing);
    return { ok: true, cost, message: "" };
  }

  if (!isBuildable(tile) && !isForest(tile) && tile !== TileId.Rubble) {
    return fail("ここには敷けません");
  }

  state.spend(cost);
  const base = kind === "road" ? TileId.Road : kind === "rail" ? TileId.Rail : TileId.Wire;
  map.clearTile(x, y, base);
  refreshNetworkAround(map, x, y);
  return { ok: true, cost, message: "" };
}

/**
 * 橋の向きを決めるための点数。既存の線につながる向きを強く優先する。
 * @param map 対象のマップ。
 * @param x タイルX座標。
 * @param y タイルY座標。
 * @param kind 敷くものの種類。
 * @param vertical 縦向きとして数えるなら `true`。
 */
function spanScore(
  map: CityMap,
  x: number,
  y: number,
  kind: NetworkKind,
  vertical: boolean,
): number {
  const isSame = kind === "road" ? isRoad : kind === "rail" ? isRail : isWire;
  const neighbors = vertical
    ? [map.get(x, y - 1), map.get(x, y + 1)]
    : [map.get(x - 1, y), map.get(x + 1, y)];
  let score = 0;
  for (const tile of neighbors) {
    if (isSame(tile)) score += 4;
    else if (!isWater(tile) && isBuildable(tile)) score += 1;
  }
  return score;
}

/**
 * 既存の直線インフラの上に別の種類を敷いたときの交差タイルを求める。
 * 交差にできない場合は `null`。
 * @param tile 既にあるタイルID。
 * @param kind 新たに敷く種類。
 */
function crossingTile(tile: number, kind: NetworkKind): number | null {
  const vertical = TileId.Road + 5; // 北+南
  const horizontal = TileId.Road + 10; // 東+西
  const railVertical = TileId.Rail + 5;
  const railHorizontal = TileId.Rail + 10;
  const wireVertical = TileId.Wire + 5;
  const wireHorizontal = TileId.Wire + 10;

  if (kind === "road") {
    if (tile === railVertical) return TileId.RoadRail + 1;
    if (tile === railHorizontal) return TileId.RoadRail;
    if (tile === wireVertical) return TileId.RoadWire + 1;
    if (tile === wireHorizontal) return TileId.RoadWire;
  } else if (kind === "rail") {
    if (tile === vertical) return TileId.RoadRail;
    if (tile === horizontal) return TileId.RoadRail + 1;
    if (tile === wireVertical) return TileId.RailWire + 1;
    if (tile === wireHorizontal) return TileId.RailWire;
  } else {
    if (tile === vertical) return TileId.RoadWire;
    if (tile === horizontal) return TileId.RoadWire + 1;
    if (tile === railVertical) return TileId.RailWire;
    if (tile === railHorizontal) return TileId.RailWire + 1;
  }
  return null;
}

/**
 * 指定した範囲に建物を置けるかどうか。
 * @param map 対象のマップ。
 * @param x 左上のタイルX座標。
 * @param y 左上のタイルY座標。
 * @param width 横のタイル数。
 * @param height 縦のタイル数。
 */
export function canPlaceStructure(
  map: CityMap,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!map.inBounds(x, y) || !map.inBounds(x + width - 1, y + height - 1)) return false;
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      if (!canOverwrite(map.get(x + dx, y + dy))) return false;
    }
  }
  return true;
}

/**
 * 建物をマップに書き込む。費用の判定は呼び出し側で済ませておくこと。
 * @param map 対象のマップ。
 * @param x 左上のタイルX座標。
 * @param y 左上のタイルY座標。
 * @param def 建てる建物の定義。
 */
export function placeStructure(map: CityMap, x: number, y: number, def: BuildingDef): void {
  for (let dy = 0; dy < def.height; dy++) {
    for (let dx = 0; dx < def.width; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      map.clearTile(tx, ty, def.tileBase + dy * def.width + dx);
      map.setOriginOffset(tx, ty, dx, dy);
      map.setFlag(tx, ty, TileFlag.building);
    }
  }
  map.setFlag(x, y, TileFlag.origin);
  map.buildingKind[map.index(x, y)] = def.kind;

  // 建物の周囲の道路・送電線は、見た目のつながりを更新しておく。
  for (let dy = -1; dy <= def.height; dy++) {
    for (let dx = -1; dx <= def.width; dx++) {
      refreshNetworkTile(map, x + dx, y + dy);
    }
  }
}

/**
 * 公共施設などの建物を建てる。指定座標は建物の左上になる。
 * @param state 都市の状態。
 * @param x 左上のタイルX座標。
 * @param y 左上のタイルY座標。
 * @param def 建てる建物の定義。
 */
export function buildStructure(
  state: CityState,
  x: number,
  y: number,
  def: BuildingDef,
): BuildResult {
  const map = state.map;
  if (!canPlaceStructure(map, x, y, def.width, def.height)) {
    return fail("ここには建てられません");
  }
  if (!state.canAfford(def.cost)) return fail("資金が足りません");

  state.spend(def.cost);
  placeStructure(map, x, y, def);
  return { ok: true, cost: def.cost, message: "" };
}

/**
 * 区画を指定する。指定座標は区画の左上になる。
 * @param state 都市の状態。
 * @param x 左上のタイルX座標。
 * @param y 左上のタイルY座標。
 * @param zone 区画種別。
 */
export function buildZone(
  state: CityState,
  x: number,
  y: number,
  zone: ZoneTypeValue,
): BuildResult {
  if (zone === ZoneType.none) return NOTHING;
  const def = zoneBuilding(zone, 0);
  const map = state.map;
  if (!canPlaceStructure(map, x, y, def.width, def.height)) {
    return fail("ここには区画を作れません");
  }
  if (!state.canAfford(BUILD_COST.zone)) return fail("資金が足りません");

  state.spend(BUILD_COST.zone);
  placeStructure(map, x, y, def);
  return { ok: true, cost: BUILD_COST.zone, message: "" };
}
