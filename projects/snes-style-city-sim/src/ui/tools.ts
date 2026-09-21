/**
 * 建設用の道具（ツール）の一覧と、選んだ道具をマップに適用する処理。
 * @packageDocumentation
 */
import type { IconSpec } from "../render/art/icons.js";
import {
  BUILD_COST,
  type BuildResult,
  buildNetwork,
  buildStructure,
  buildZone,
  bulldoze,
} from "../sim/build.js";
import { ZoneType, buildingById, buildingOfTile } from "../sim/buildings.js";
import { TOOL_UNLOCK_POPULATION, isToolUnlocked } from "../sim/milestones.js";
import { TileFlag } from "../sim/map.js";
import type { CityState } from "../sim/state.js";
import {
  TileId,
  type TilePos,
  isFire,
  isFlood,
  isForest,
  isRail,
  isRoad,
  isWater,
  isWire,
} from "../sim/tiles.js";

/** 道具の識別子。 */
export type ToolId =
  | "query"
  | "bulldoze"
  | "road"
  | "rail"
  | "wire"
  | "park"
  | "zone-r"
  | "zone-c"
  | "zone-i"
  | "police"
  | "fire"
  | "stadium"
  | "seaport"
  | "airport"
  | "coal"
  | "nuclear";

/** 道具1つの定義。 */
export interface ToolDef {
  /** 識別子。 */
  id: ToolId;
  /** 画面に出す名前。 */
  name: string;
  /** 表示する費用。0なら費用を表示しない。 */
  cost: number;
  /** 占有するタイル数（正方形の一辺）。 */
  footprint: number;
  /** アイコンの絵。 */
  icon: IconSpec;
  /** ドラッグで連続して置けるか。 */
  drag: boolean;
}

/** 道具の一覧。画面下部にこの順で並ぶ。 */
export const TOOLS: readonly ToolDef[] = [
  {
    id: "query",
    name: "調べる",
    cost: 0,
    footprint: 1,
    icon: { kind: "glyph", glyph: "query" },
    drag: false,
  },
  {
    id: "bulldoze",
    name: "取り壊し",
    cost: BUILD_COST.bulldoze,
    footprint: 1,
    icon: { kind: "glyph", glyph: "bulldozer" },
    drag: true,
  },
  {
    id: "road",
    name: "道路",
    cost: BUILD_COST.road,
    footprint: 1,
    icon: { kind: "tile", tile: TileId.Road + 10 },
    drag: true,
  },
  {
    id: "rail",
    name: "線路",
    cost: BUILD_COST.rail,
    footprint: 1,
    icon: { kind: "tile", tile: TileId.Rail + 10 },
    drag: true,
  },
  {
    id: "wire",
    name: "送電線",
    cost: BUILD_COST.wire,
    footprint: 1,
    icon: { kind: "tile", tile: TileId.Wire + 10 },
    drag: true,
  },
  {
    id: "park",
    name: "公園",
    cost: buildingById("park").cost,
    footprint: 1,
    icon: { kind: "building", id: "park" },
    drag: true,
  },
  {
    id: "zone-r",
    name: "住宅区画",
    cost: BUILD_COST.zone,
    footprint: 3,
    icon: { kind: "building", id: "residential-2" },
    drag: false,
  },
  {
    id: "zone-c",
    name: "商業区画",
    cost: BUILD_COST.zone,
    footprint: 3,
    icon: { kind: "building", id: "commercial-3" },
    drag: false,
  },
  {
    id: "zone-i",
    name: "工業区画",
    cost: BUILD_COST.zone,
    footprint: 3,
    icon: { kind: "building", id: "industrial-3" },
    drag: false,
  },
  {
    id: "police",
    name: "警察署",
    cost: buildingById("police-station").cost,
    footprint: 3,
    icon: { kind: "building", id: "police-station" },
    drag: false,
  },
  {
    id: "fire",
    name: "消防署",
    cost: buildingById("fire-station").cost,
    footprint: 3,
    icon: { kind: "building", id: "fire-station" },
    drag: false,
  },
  {
    id: "stadium",
    name: "スタジアム",
    cost: buildingById("stadium").cost,
    footprint: 4,
    icon: { kind: "building", id: "stadium" },
    drag: false,
  },
  {
    id: "seaport",
    name: "港",
    cost: buildingById("seaport").cost,
    footprint: 4,
    icon: { kind: "building", id: "seaport" },
    drag: false,
  },
  {
    id: "airport",
    name: "空港",
    cost: buildingById("airport").cost,
    footprint: 6,
    icon: { kind: "building", id: "airport" },
    drag: false,
  },
  {
    id: "coal",
    name: "火力発電所",
    cost: buildingById("coal-plant").cost,
    footprint: 4,
    icon: { kind: "building", id: "coal-plant" },
    drag: false,
  },
  {
    id: "nuclear",
    name: "原子力発電所",
    cost: buildingById("nuclear-plant").cost,
    footprint: 4,
    icon: { kind: "building", id: "nuclear-plant" },
    drag: false,
  },
];

/**
 * 道具が占有する範囲の左上座標を求める。カーソルの位置が中央付近に来るようにする。
 * @param tool 道具。
 * @param x カーソルのタイルX座標。
 * @param y カーソルのタイルY座標。
 */
export function toolOrigin(tool: ToolDef, x: number, y: number): TilePos {
  const offset = Math.floor((tool.footprint - 1) / 2);
  return { x: x - offset, y: y - offset };
}

/**
 * カーソル位置のタイルを言葉で説明する。
 * @param state 都市の状態。
 * @param x タイルX座標。
 * @param y タイルY座標。
 */
export function describeTile(state: CityState, x: number, y: number): string {
  const map = state.map;
  const tile = map.get(x, y);
  const building = buildingOfTile(tile);
  if (building) {
    const powered = map.hasFlag(x, y, TileFlag.powered) ? "通電" : "停電";
    return `${building.name}（${powered}）`;
  }
  if (isWater(tile)) return "水面";
  if (isFire(tile)) return "火災";
  if (isFlood(tile)) return "浸水";
  if (isForest(tile)) return "森";
  if (isRoad(tile)) return "道路";
  if (isRail(tile)) return "線路";
  if (isWire(tile)) return "送電線";
  if (tile === TileId.Rubble) return "瓦礫";
  if (tile === TileId.Sand) return "砂浜";
  if (tile === TileId.Dirt) return "更地";
  return "草地";
}

/**
 * 選んだ道具をマップに適用する。
 * @param state 都市の状態。
 * @param tool 使う道具。
 * @param x カーソルのタイルX座標。
 * @param y カーソルのタイルY座標。
 */
export function applyTool(state: CityState, tool: ToolDef, x: number, y: number): BuildResult {
  if (!isToolUnlocked(tool.id, state.stats.population)) {
    const required = TOOL_UNLOCK_POPULATION[tool.id];
    return { ok: false, cost: 0, message: `人口${required}人から建てられます` };
  }
  const origin = toolOrigin(tool, x, y);

  switch (tool.id) {
    case "query":
      return { ok: true, cost: 0, message: describeTile(state, x, y) };
    case "bulldoze":
      return bulldoze(state, x, y);
    case "road":
      return buildNetwork(state, x, y, "road");
    case "rail":
      return buildNetwork(state, x, y, "rail");
    case "wire":
      return buildNetwork(state, x, y, "wire");
    case "zone-r":
      return buildZone(state, origin.x, origin.y, ZoneType.residential);
    case "zone-c":
      return buildZone(state, origin.x, origin.y, ZoneType.commercial);
    case "zone-i":
      return buildZone(state, origin.x, origin.y, ZoneType.industrial);
    case "park":
      return buildStructure(state, origin.x, origin.y, buildingById("park"));
    case "police":
      return buildStructure(state, origin.x, origin.y, buildingById("police-station"));
    case "fire":
      return buildStructure(state, origin.x, origin.y, buildingById("fire-station"));
    case "stadium":
      return buildStructure(state, origin.x, origin.y, buildingById("stadium"));
    case "seaport":
      return buildStructure(state, origin.x, origin.y, buildingById("seaport"));
    case "airport":
      return buildStructure(state, origin.x, origin.y, buildingById("airport"));
    case "coal":
      return buildStructure(state, origin.x, origin.y, buildingById("coal-plant"));
    case "nuclear":
      return buildStructure(state, origin.x, origin.y, buildingById("nuclear-plant"));
  }
}
