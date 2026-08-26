/**
 * 住宅・商業・工業の需要（RCI）の計算。
 *
 * 住民が増えれば店と工場の働き手が求められ、働き口が増えれば住む場所が求められる、
 * という相互作用でそれぞれの需要が決まる。税率が高いと全体的に needs が冷え込む。
 * @packageDocumentation
 */
import type { CityStats } from "./stats.js";

/** 住宅・商業・工業それぞれの需要。-1（供給過剰）〜1（不足）。 */
export interface Demand {
  /** 住宅需要。 */
  residential: number;
  /** 商業需要。 */
  commercial: number;
  /** 工業需要。 */
  industrial: number;
}

/** 開発が始まっていない都市でも街ができ始めるようにする下駄。 */
const BOOTSTRAP = 60;

/**
 * 値を -1〜1 に収める。
 * @param value 収める値。
 */
function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * 現在の統計から需要を計算する。
 * @param stats 都市の統計。
 * @param taxRate 税率（パーセント）。
 */
export function computeDemand(stats: CityStats, taxRate: number): Demand {
  const jobs = stats.commercialJobs + stats.industrialJobs;
  const residents = stats.residents;

  // 税率は7%を基準にして、高いほど全体の需要を冷やす。
  const taxEffect = (taxRate - 7) * 0.06;

  // 「働き口が住民を呼び、住民が店と工場を呼ぶ」の係数の積を1より少し大きくしてある。
  // こうすると健全な街は伸び続け、頭打ちになるのは区画・地価・公害の方の事情になる。
  // 分母を大きめに取っているのは、需要が振り切れて街が伸び縮みを繰り返すのを抑えるため。
  return {
    residential: clamp(
      (jobs * 1.3 + BOOTSTRAP - residents) / Math.max(200, residents * 0.5) - taxEffect,
    ),
    commercial: clamp(
      (residents * 0.42 + BOOTSTRAP / 2 - stats.commercialJobs) /
        Math.max(120, stats.commercialJobs * 0.5) -
        taxEffect,
    ),
    industrial: clamp(
      (residents * 0.5 + BOOTSTRAP / 2 - stats.industrialJobs) /
        Math.max(120, stats.industrialJobs * 0.5) -
        taxEffect,
    ),
  };
}
