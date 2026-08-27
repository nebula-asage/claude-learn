/**
 * 建物の定義表。
 *
 * 建物は「種類ID」で管理し、実際のタイルIDは種類ごとに連続した範囲を自動で割り当てる。
 * 割り当ての順序はこのファイルの定義順で決まるので、途中に挿入するとセーブデータの
 * 互換性が崩れる点に注意する（追加するときは末尾に足す）。
 * @packageDocumentation
 */
import { BUILDING_TILE_BASE } from "./tiles.js";

/** 区画（成長する建物）の種別。 */
export const ZoneType = {
  /** 区画ではない（公共施設など）。 */
  none: 0,
  /** 住宅区画。 */
  residential: 1,
  /** 商業区画。 */
  commercial: 2,
  /** 工業区画。 */
  industrial: 3,
} as const;

/** 区画種別を表す型。 */
export type ZoneTypeValue = (typeof ZoneType)[keyof typeof ZoneType];

/** 建物1種類の定義。 */
export interface BuildingDef {
  /** 種類ID。マップの `buildingKind` に入る値。 */
  kind: number;
  /** 内部名。 */
  id: string;
  /** 画面に出す日本語名。 */
  name: string;
  /** 横のタイル数。 */
  width: number;
  /** 縦のタイル数。 */
  height: number;
  /** この建物に割り当てられたタイルIDの先頭。 */
  tileBase: number;
  /** 区画種別。公共施設は `ZoneType.none`。 */
  zone: ZoneTypeValue;
  /** 区画の成長段階（0が空き地）。 */
  level: number;
  /** 収容人数（住宅）または雇用者数（商業・工業）。 */
  capacity: number;
  /** 必要な電力。 */
  powerDemand: number;
  /** 発電量。発電所以外は0。 */
  powerSupply: number;
  /** 周囲に撒く公害の強さ。 */
  pollution: number;
  /** 出火しやすさ。 */
  fireRisk: number;
  /** 建設費用。プレイヤーが直接建てられないものは0。 */
  cost: number;
  /** 毎年の維持費。 */
  upkeep: number;
}

/** 定義済みの建物一覧。`kind` が添字に一致する。 */
export const BUILDINGS: BuildingDef[] = [];

/** 内部名から建物定義を引くための索引。 */
const BY_ID = new Map<string, BuildingDef>();

let nextTileBase = BUILDING_TILE_BASE;

/**
 * 建物を定義し、タイルIDの範囲を確保する。
 * @param def タイルIDと種類ID以外の定義。
 */
function define(def: Omit<BuildingDef, "kind" | "tileBase">): BuildingDef {
  const entry: BuildingDef = {
    ...def,
    kind: BUILDINGS.length,
    tileBase: nextTileBase,
  };
  nextTileBase += def.width * def.height;
  BUILDINGS.push(entry);
  BY_ID.set(entry.id, entry);
  return entry;
}

/** 住宅区画の成長段階ごとの収容人数。 */
const RESIDENTIAL_CAPACITY = [0, 8, 16, 26, 38, 52];

/** 商業区画の成長段階ごとの雇用者数。 */
const COMMERCIAL_CAPACITY = [0, 6, 14, 24, 34, 46];

/** 工業区画の成長段階ごとの雇用者数。 */
const INDUSTRIAL_CAPACITY = [0, 8, 18, 28, 40, 54];

/** 区画の成長段階の最大値。 */
export const MAX_ZONE_LEVEL = 5;

for (let level = 0; level <= MAX_ZONE_LEVEL; level++) {
  define({
    id: `residential-${level}`,
    name: level === 0 ? "住宅区画" : `住宅 レベル${level}`,
    width: 3,
    height: 3,
    zone: ZoneType.residential,
    level,
    capacity: RESIDENTIAL_CAPACITY[level],
    powerDemand: level === 0 ? 0 : 1 + level,
    powerSupply: 0,
    pollution: 0,
    fireRisk: level === 0 ? 0 : 2 + level,
    cost: 0,
    upkeep: 0,
  });
}

for (let level = 0; level <= MAX_ZONE_LEVEL; level++) {
  define({
    id: `commercial-${level}`,
    name: level === 0 ? "商業区画" : `商業 レベル${level}`,
    width: 3,
    height: 3,
    zone: ZoneType.commercial,
    level,
    capacity: COMMERCIAL_CAPACITY[level],
    powerDemand: level === 0 ? 0 : 2 + level * 2,
    powerSupply: 0,
    pollution: level,
    fireRisk: level === 0 ? 0 : 3 + level,
    cost: 0,
    upkeep: 0,
  });
}

for (let level = 0; level <= MAX_ZONE_LEVEL; level++) {
  define({
    id: `industrial-${level}`,
    name: level === 0 ? "工業区画" : `工業 レベル${level}`,
    width: 3,
    height: 3,
    zone: ZoneType.industrial,
    level,
    capacity: INDUSTRIAL_CAPACITY[level],
    powerDemand: level === 0 ? 0 : 3 + level * 2,
    powerSupply: 0,
    pollution: level * 8,
    fireRisk: level === 0 ? 0 : 4 + level * 2,
    cost: 0,
    upkeep: 0,
  });
}

/** 火力発電所。 */
export const COAL_PLANT = define({
  id: "coal-plant",
  name: "火力発電所",
  width: 4,
  height: 4,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 0,
  powerSupply: 700,
  pollution: 40,
  fireRisk: 8,
  cost: 3000,
  upkeep: 0,
});

/** 原子力発電所。 */
export const NUCLEAR_PLANT = define({
  id: "nuclear-plant",
  name: "原子力発電所",
  width: 4,
  height: 4,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 0,
  powerSupply: 2000,
  pollution: 4,
  fireRisk: 6,
  cost: 5000,
  upkeep: 0,
});

/** 警察署。 */
export const POLICE_STATION = define({
  id: "police-station",
  name: "警察署",
  width: 3,
  height: 3,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 2,
  powerSupply: 0,
  pollution: 0,
  fireRisk: 2,
  cost: 500,
  upkeep: 100,
});

/** 消防署。 */
export const FIRE_STATION = define({
  id: "fire-station",
  name: "消防署",
  width: 3,
  height: 3,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 2,
  powerSupply: 0,
  pollution: 0,
  fireRisk: 0,
  cost: 500,
  upkeep: 100,
});

/** 公園。 */
export const PARK = define({
  id: "park",
  name: "公園",
  width: 1,
  height: 1,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 0,
  powerSupply: 0,
  pollution: 0,
  fireRisk: 0,
  cost: 10,
  upkeep: 1,
});

/** スタジアム。 */
export const STADIUM = define({
  id: "stadium",
  name: "スタジアム",
  width: 4,
  height: 4,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 6,
  powerSupply: 0,
  pollution: 2,
  fireRisk: 3,
  cost: 3000,
  upkeep: 50,
});

/** 港。 */
export const SEAPORT = define({
  id: "seaport",
  name: "港",
  width: 4,
  height: 4,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 5,
  powerSupply: 0,
  pollution: 12,
  fireRisk: 5,
  cost: 3000,
  upkeep: 50,
});

/** 空港。 */
export const AIRPORT = define({
  id: "airport",
  name: "空港",
  width: 6,
  height: 6,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 10,
  powerSupply: 0,
  pollution: 16,
  fireRisk: 5,
  cost: 10000,
  upkeep: 100,
});

/** 市長公舎。人口の節目に、ご褒美として自動で建つ。 */
export const MAYOR_HOUSE = define({
  id: "mayor-house",
  name: "市長公舎",
  width: 3,
  height: 3,
  zone: ZoneType.none,
  level: 0,
  capacity: 0,
  powerDemand: 1,
  powerSupply: 0,
  pollution: 0,
  fireRisk: 1,
  cost: 0,
  upkeep: 0,
});

/** 建物タイルとして確保したIDの総数。 */
export const BUILDING_TILE_COUNT = nextTileBase - BUILDING_TILE_BASE;

/**
 * 内部名から建物定義を引く。
 * @param id 内部名。
 */
export function buildingById(id: string): BuildingDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`未定義の建物です: ${id}`);
  return def;
}

/**
 * 種類IDから建物定義を引く。
 * @param kind 種類ID。
 */
export function buildingByKind(kind: number): BuildingDef {
  const def = BUILDINGS[kind];
  if (!def) throw new Error(`未定義の建物の種類IDです: ${kind}`);
  return def;
}

/**
 * 区画種別と成長段階から建物定義を引く。
 * @param zone 区画種別。
 * @param level 成長段階。
 */
export function zoneBuilding(zone: ZoneTypeValue, level: number): BuildingDef {
  const names: Record<number, string> = {
    [ZoneType.residential]: "residential",
    [ZoneType.commercial]: "commercial",
    [ZoneType.industrial]: "industrial",
  };
  const prefix = names[zone];
  if (!prefix) throw new Error(`区画ではありません: ${zone}`);
  return buildingById(`${prefix}-${Math.max(0, Math.min(MAX_ZONE_LEVEL, level))}`);
}

/**
 * タイルIDがどの建物のものかを返す。建物タイルでなければ `null`。
 * @param tile タイルID。
 */
export function buildingOfTile(tile: number): BuildingDef | null {
  if (tile < BUILDING_TILE_BASE) return null;
  for (const def of BUILDINGS) {
    if (tile >= def.tileBase && tile < def.tileBase + def.width * def.height) return def;
  }
  return null;
}
