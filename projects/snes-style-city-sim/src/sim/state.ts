/**
 * 都市の状態一式。シミュレーションもUIも、ここを唯一の情報源として読む。
 * @packageDocumentation
 */
import type { CityMap } from "./map.js";
import type { Rng } from "./rng.js";

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
  /** 所持金。 */
  funds: number;
  /** 開始からの経過tick数。 */
  ticks = 0;
  /** 税率（パーセント）。 */
  taxRate = 7;

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
