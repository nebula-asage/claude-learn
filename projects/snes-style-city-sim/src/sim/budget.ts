/**
 * 予算。年に一度、税収を受け取り、道路の維持費と警察・消防の予算を支払う。
 *
 * 予算の配分は0〜100%で決められる。切り詰めれば支出は減るが、
 * 道路は傷み、警察と消防の手が届く範囲も狭くなる。
 * @packageDocumentation
 */
import { refreshNetworkAround } from "./build.js";
import type { CityState } from "./state.js";
import type { CityStats } from "./stats.js";
import { TileId, isRoad } from "./tiles.js";

/** 税率の上限（パーセント）。 */
export const MAX_TAX_RATE = 20;

/** 道路タイル1枚あたりの年間維持費。 */
export const ROAD_UPKEEP = 2;

/** 線路タイル1枚あたりの年間維持費。 */
export const RAIL_UPKEEP = 4;

/** 警察署1つあたりの年間予算。 */
export const POLICE_UPKEEP = 100;

/** 消防署1つあたりの年間予算。 */
export const FIRE_UPKEEP = 100;

/** 予算の配分（それぞれ0〜1）。 */
export interface BudgetFunding {
  /** 道路・線路の維持費に回す割合。 */
  roads: number;
  /** 警察に回す割合。 */
  police: number;
  /** 消防に回す割合。 */
  fire: number;
}

/** 1年分の収支の見積もり。 */
export interface BudgetReport {
  /** 税収。 */
  taxIncome: number;
  /** 道路・線路の維持に必要な額。 */
  roadRequired: number;
  /** 警察に必要な額。 */
  policeRequired: number;
  /** 消防に必要な額。 */
  fireRequired: number;
  /** 実際に道路へ支払う額。 */
  roadSpending: number;
  /** 実際に警察へ支払う額。 */
  policeSpending: number;
  /** 実際に消防へ支払う額。 */
  fireSpending: number;
  /** 支出の合計。 */
  totalSpending: number;
  /** 収支。 */
  balance: number;
}

/**
 * 1年分の税収を求める。人が多く、地価が高く、税率が高いほど増える。
 * @param stats 都市の統計。
 * @param taxRate 税率（パーセント）。
 * @param averageLandValue 市街地の平均地価（0〜255）。
 */
export function computeTaxIncome(
  stats: CityStats,
  taxRate: number,
  averageLandValue: number,
): number {
  const taxableValue =
    stats.residents * 1 + stats.commercialJobs * 1.8 + stats.industrialJobs * 1.4;
  const valueFactor = 0.5 + averageLandValue / 200;
  return Math.round(taxableValue * (taxRate / 100) * valueFactor * 12);
}

/**
 * 市街地（人が住んでいる場所）の平均地価を求める。開発が無ければ0。
 * @param state 都市の状態。
 */
export function averageDevelopedLandValue(state: CityState): number {
  const { landValue, populationDensity } = state.fields;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < landValue.length; i++) {
    if (populationDensity[i] === 0) continue;
    sum += landValue[i];
    count++;
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * 現在の設定でこの1年の収支を見積もる。
 * @param state 都市の状態。
 */
export function computeBudget(state: CityState): BudgetReport {
  const stats = state.stats;
  const taxIncome = computeTaxIncome(stats, state.taxRate, averageDevelopedLandValue(state));

  const roadRequired = stats.roadTiles * ROAD_UPKEEP + stats.railTiles * RAIL_UPKEEP;
  const policeRequired = stats.policeStations * POLICE_UPKEEP;
  const fireRequired = stats.fireStations * FIRE_UPKEEP;

  const roadSpending = Math.round(roadRequired * state.funding.roads);
  const policeSpending = Math.round(policeRequired * state.funding.police);
  const fireSpending = Math.round(fireRequired * state.funding.fire);
  const totalSpending = roadSpending + policeSpending + fireSpending;

  return {
    taxIncome,
    roadRequired,
    policeRequired,
    fireRequired,
    roadSpending,
    policeSpending,
    fireSpending,
    totalSpending,
    balance: taxIncome - totalSpending,
  };
}

/**
 * 1年分の収支を実際に資金へ反映する。
 * @param state 都市の状態。
 */
export function applyAnnualBudget(state: CityState): BudgetReport {
  const report = computeBudget(state);
  state.funds += report.balance;
  state.lastBudget = report;
  return report;
}

/**
 * 予算不足で道路が傷むかどうかを判定し、傷んだ道路を瓦礫に変える。
 * @param state 都市の状態。
 */
export function decayUnderfundedRoads(state: CityState): number {
  const shortage = 1 - state.funding.roads;
  if (shortage <= 0.05) return 0;

  const map = state.map;
  let broken = 0;
  // 予算の不足ぶんに応じて、道路タイルを少しずつ壊していく。
  const attempts = Math.round(state.stats.roadTiles * shortage * 0.02);
  for (let i = 0; i < attempts; i++) {
    const x = state.rng.int(0, map.width - 1);
    const y = state.rng.int(0, map.height - 1);
    if (!isRoad(map.get(x, y))) continue;
    map.clearTile(x, y, TileId.Rubble);
    refreshNetworkAround(map, x, y);
    broken++;
  }
  return broken;
}
