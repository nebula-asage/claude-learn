/**
 * 都市の状態一式。シミュレーションもUIも、ここを唯一の情報源として読む。
 * @packageDocumentation
 */
import type { BudgetFunding, BudgetReport } from "./budget.js";
import type { Demand } from "./demand.js";
import { CityFields } from "./fields.js";
import { CityHistory } from "./history.js";
import type { CityMap } from "./map.js";
import type { PowerReport } from "./power.js";
import type { Rng } from "./rng.js";
import { type CityStats, emptyStats } from "./stats.js";

/** シミュレーション何tickで1か月進むか。 */
export const TICKS_PER_MONTH = 16;

/** 1年の月数。 */
export const MONTHS_PER_YEAR = 12;

/** ゲーム開始年。 */
export const START_YEAR = 1900;

/** 都市全体の状態。 */
export class CityState {
  /** 都市の名前。 */
  cityName: string;
  /** マップ。 */
  readonly map: CityMap;
  /** シミュレーション用の乱数生成器。 */
  readonly rng: Rng;
  /** 各種の面データ（地価・公害・犯罪など）。 */
  readonly fields: CityFields;
  /** 集計値。 */
  readonly stats: CityStats = emptyStats();
  /** 所持金。 */
  funds: number;
  /** 開始からの経過tick数。 */
  ticks = 0;
  /** 税率（パーセント）。 */
  taxRate = 7;
  /** 住宅・商業・工業の需要。 */
  demand: Demand = { residential: 0, commercial: 0, industrial: 0 };
  /** 直近の電力の需給。 */
  power: PowerReport = { supply: 0, demand: 0, powered: 0, unpowered: 0 };
  /** 予算の配分。 */
  funding: BudgetFunding = { roads: 1, police: 1, fire: 1 };
  /** 直近の年間収支。まだ決算していなければ `null`。 */
  lastBudget: BudgetReport | null = null;
  /** 年度末に予算画面を出さず、自動で決算するか。 */
  autoBudget = false;
  /** 年ごとの推移の記録。 */
  readonly history = new CityHistory();

  /**
   * @param map 遊ぶマップ。
   * @param rng 乱数生成器。
   * @param funds 初期資金。
   * @param cityName 都市の名前。
   */
  constructor(map: CityMap, rng: Rng, funds: number, cityName: string) {
    this.map = map;
    this.rng = rng;
    this.funds = funds;
    this.cityName = cityName;
    this.fields = new CityFields(map.width, map.height);
  }

  /** 現在の年。 */
  get year(): number {
    return START_YEAR + Math.floor(this.ticks / (TICKS_PER_MONTH * MONTHS_PER_YEAR));
  }

  /** 現在の月（1〜12）。 */
  get month(): number {
    return (Math.floor(this.ticks / TICKS_PER_MONTH) % MONTHS_PER_YEAR) + 1;
  }

  /**
   * 支払えるかどうかを判定する。
   * @param amount 金額。
   */
  canAfford(amount: number): boolean {
    return this.funds >= amount;
  }

  /**
   * 支払う。残高が足りなければ何もせず `false` を返す。
   * @param amount 金額。
   */
  spend(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this.funds -= amount;
    return true;
  }
}
