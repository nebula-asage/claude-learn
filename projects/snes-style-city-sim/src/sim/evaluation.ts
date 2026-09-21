/**
 * 市政の評価。市長の支持率と、市民が問題だと感じていることを求める。
 * @packageDocumentation
 */
import { averageDevelopedLandValue } from "./budget.js";
import type { CityState } from "./state.js";

/** 市政の評価結果。 */
export interface CityEvaluation {
  /** 支持率（0〜100）。 */
  approval: number;
  /** 市民が挙げる問題。多い順に並ぶ。 */
  issues: string[];
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

/**
 * 市政を評価する。
 * @param state 都市の状態。
 */
export function evaluateCity(state: CityState): CityEvaluation {
  const { fields, stats } = state;
  const pollution = average(fields.pollution);
  const crime = average(fields.crime);
  const traffic = average(fields.traffic);
  const landValue = averageDevelopedLandValue(state);

  const problems: { name: string; weight: number }[] = [
    { name: "公害", weight: pollution / 2 },
    { name: "犯罪", weight: crime / 2 },
    { name: "渋滞", weight: Math.max(0, traffic - 120) / 2 },
    { name: "重い税金", weight: Math.max(0, state.taxRate - 8) * 4 },
    { name: "停電", weight: stats.unpoweredBuildings * 3 },
    { name: "住宅不足", weight: Math.max(0, state.demand.residential) * 25 },
    { name: "働き口不足", weight: Math.max(0, state.demand.industrial) * 20 },
  ];

  const penalty = problems.reduce((sum, problem) => sum + problem.weight, 0);
  const bonus = landValue / 6;
  const approval = Math.max(0, Math.min(100, Math.round(60 + bonus - penalty)));

  const issues = problems
    .filter((problem) => problem.weight >= 5)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((problem) => problem.name);

  return { approval, issues };
}
