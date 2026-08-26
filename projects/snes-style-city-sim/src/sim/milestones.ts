/**
 * 称号と、人口に応じて解禁される建物。
 * @packageDocumentation
 */
import { canPlaceStructure, placeStructure } from "./build.js";
import { buildingById } from "./buildings.js";
import { cityCenter } from "./fields.js";
import type { CityState } from "./state.js";

/** 人口の節目。 */
export interface Milestone {
  /** この称号になる人口。 */
  population: number;
  /** 称号。 */
  title: string;
  /** 到達したときの祝いの言葉。 */
  message: string;
  /** 到達時にご褒美として建てる建物の内部名。 */
  reward?: string;
}

/** 人口の節目の一覧。人口の小さい順に並べる。 */
export const MILESTONES: readonly Milestone[] = [
  { population: 0, title: "村", message: "小さな村から始まりました。" },
  { population: 1000, title: "町", message: "人口1,000人! 村は町になりました。" },
  {
    population: 4000,
    title: "市",
    message: "人口4,000人! 市に昇格し、市長公舎が建てられました。",
    reward: "mayor-house",
  },
  { population: 10000, title: "首都", message: "人口10,000人! ついに首都と呼ばれる街に。" },
  { population: 30000, title: "大都市", message: "人口30,000人! 押しも押されもせぬ大都市です。" },
  { population: 80000, title: "巨大都市", message: "人口80,000人! 伝説の巨大都市の誕生です。" },
];

/** 人口によって使えるようになる道具。値は必要な人口。 */
export const TOOL_UNLOCK_POPULATION: Readonly<Record<string, number>> = {
  stadium: 2000,
  seaport: 5000,
  nuclear: 5000,
  airport: 10000,
};

/**
 * その人口での称号を返す。
 * @param population 人口。
 */
export function titleFor(population: number): string {
  let title = MILESTONES[0].title;
  for (const milestone of MILESTONES) {
    if (population >= milestone.population) title = milestone.title;
  }
  return title;
}

/**
 * その道具が使える人口に達しているか。
 * @param toolId 道具の識別子。
 * @param population 人口。
 */
export function isToolUnlocked(toolId: string, population: number): boolean {
  const required = TOOL_UNLOCK_POPULATION[toolId];
  return required === undefined || population >= required;
}

/**
 * ご褒美の建物を、都市の中心近くの空いている場所へ建てる。
 * @param state 都市の状態。
 * @param buildingId 建てる建物の内部名。
 */
function placeReward(state: CityState, buildingId: string): boolean {
  const def = buildingById(buildingId);
  const center = cityCenter(state.map);
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);

  // 中心から渦を描くように外へ探して、最初に置ける場所へ建てる。
  for (let radius = 0; radius < 40; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!canPlaceStructure(state.map, x, y, def.width, def.height)) continue;
        placeStructure(state.map, x, y, def);
        return true;
      }
    }
  }
  return false;
}

/**
 * 人口が新しい節目に届いていれば、称号を進めて祝いの言葉を返す。
 * @param state 都市の状態。
 */
export function checkMilestone(state: CityState): string | null {
  const next = MILESTONES[state.milestoneIndex + 1];
  if (!next) return null;
  if (state.stats.population < next.population) return null;

  state.milestoneIndex++;
  if (next.reward) placeReward(state, next.reward);
  return next.message;
}
