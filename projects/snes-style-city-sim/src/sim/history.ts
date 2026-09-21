/**
 * 都市の推移の記録。年に一度、主要な数値を書き留めてグラフ表示に使う。
 * @packageDocumentation
 */
import { averageDevelopedLandValue } from "./budget.js";
import type { CityState } from "./state.js";

/** 記録しておく年数の上限。 */
export const HISTORY_LIMIT = 120;

/** ある年の記録。 */
export interface HistorySample {
  /** 年。 */
  year: number;
  /** 人口。 */
  population: number;
  /** 所持金。 */
  funds: number;
  /** 市街地の平均地価。 */
  landValue: number;
  /** 市全体の平均公害。 */
  pollution: number;
  /** 市全体の平均犯罪発生度。 */
  crime: number;
}

/**
 * 面データの平均を求める。
 * @param field 対象の面データ。
 */
function average(field: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += field[i];
  return field.length === 0 ? 0 : sum / field.length;
}

/** 年ごとの記録の集まり。 */
export class CityHistory {
  /** 古い順に並んだ記録。 */
  readonly samples: HistorySample[] = [];

  /**
   * いまの状態を1年分の記録として書き留める。
   * @param state 都市の状態。
   */
  record(state: CityState): void {
    this.samples.push({
      year: state.year,
      population: state.stats.population,
      funds: state.funds,
      landValue: Math.round(averageDevelopedLandValue(state)),
      pollution: Math.round(average(state.fields.pollution)),
      crime: Math.round(average(state.fields.crime)),
    });
    if (this.samples.length > HISTORY_LIMIT) this.samples.shift();
  }
}
