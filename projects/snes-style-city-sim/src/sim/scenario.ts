/**
 * シナリオ。あらかじめ用意された街と、期限つきの目標で遊ぶモード。
 *
 * どのシナリオも、地形を生成 → 街を敷く → しばらくシミュレーションを回して育てる →
 * そのシナリオの「事件」を起こす、という手順で作る。実際に育てた街を使うので、
 * 手で置いた街並みより自然な形になる。
 * @packageDocumentation
 */
import { buildNetwork, buildStructure, buildZone } from "./build.js";
import { ZoneType, type ZoneTypeValue, buildingById } from "./buildings.js";
import { DisasterKind, DisasterSystem } from "./disasters.js";
import { Rng } from "./rng.js";
import { Simulation } from "./simulation.js";
import { CityState, TICKS_PER_MONTH } from "./state.js";
import { averageWhereDeveloped } from "./fields.js";
import { generateTerrain } from "./terrain.js";
import { isBuildable, isWire } from "./tiles.js";

/** シナリオの定義。 */
export interface Scenario {
  /** 識別子。セーブデータに残す。 */
  id: string;
  /** 画面に出す名前。 */
  name: string;
  /** 状況の説明。 */
  description: string;
  /** 目標の説明。 */
  goalText: string;
  /** 目標を達成するまでの年数。 */
  years: number;
  /** 遊び始める状態を作る。 */
  build(): CityState;
  /**
   * 目標を達成しているかを判定する。
   * @param state 都市の状態。
   */
  isAchieved(state: CityState): boolean;
}

/**
 * 5タイル周期の街区を敷く。0が道路、1〜3が区画、4が送電線用の空き地になる。
 * @param state 都市の状態。
 * @param left 左端のタイルX座標。
 * @param top 上端のタイルY座標。
 * @param right 右端のタイルX座標（含む）。
 * @param bottom 下端のタイルY座標（含む）。
 * @param mix 区画を置く順番。順に繰り返し使う。
 */
function layoutDistrict(
  state: CityState,
  left: number,
  top: number,
  right: number,
  bottom: number,
  mix: readonly ZoneTypeValue[],
): void {
  for (let x = left; x <= right; x += 5) {
    for (let y = top; y <= bottom; y++) buildNetwork(state, x, y, "road");
  }
  for (let y = top; y <= bottom; y += 5) {
    for (let x = left; x <= right; x++) buildNetwork(state, x, y, "road");
  }
  for (let x = left + 4; x <= right; x += 5) {
    for (let y = top; y <= bottom; y++) buildNetwork(state, x, y, "wire");
  }
  for (let y = top + 4; y <= bottom; y += 5) {
    for (let x = left; x <= right; x++) buildNetwork(state, x, y, "wire");
  }

  let index = 0;
  for (let y = top + 1; y + 2 <= bottom; y += 5) {
    for (let x = left + 1; x + 2 <= right; x += 5) {
      if (buildZone(state, x, y, mix[index % mix.length]).ok) index++;
    }
  }
}

/**
 * 発電所を建てる。置くだけでは電気が流れないので、必ず送電線に接する場所を選ぶ。
 * @param state 都市の状態。
 * @param buildingId 建てる発電所の内部名。
 */
function placePowerPlant(state: CityState, buildingId: string): boolean {
  const def = buildingById(buildingId);
  const map = state.map;

  for (let y = 0; y + def.height < map.height; y++) {
    for (let x = 0; x + def.width < map.width; x++) {
      let clear = true;
      for (let dy = 0; dy < def.height && clear; dy++) {
        for (let dx = 0; dx < def.width && clear; dx++) {
          if (!isBuildable(map.get(x + dx, y + dy))) clear = false;
        }
      }
      if (!clear) continue;

      // 外周のどこかが送電線に触れていなければ、建てても街に電気は届かない。
      let touchesWire = false;
      for (let dx = -1; dx <= def.width && !touchesWire; dx++) {
        if (isWire(map.get(x + dx, y - 1)) || isWire(map.get(x + dx, y + def.height))) {
          touchesWire = true;
        }
      }
      for (let dy = -1; dy <= def.height && !touchesWire; dy++) {
        if (isWire(map.get(x - 1, y + dy)) || isWire(map.get(x + def.width, y + dy))) {
          touchesWire = true;
        }
      }
      if (!touchesWire) continue;

      if (buildStructure(state, x, y, def).ok) return true;
    }
  }
  return false;
}

/**
 * シミュレーションを回して街を育てる。
 * @param state 都市の状態。
 * @param months 進める月数。
 */
function growCity(state: CityState, months: number): void {
  const wasEnabled = state.disastersEnabled;
  const autoBudget = state.autoBudget;
  // 下ごしらえの最中に災害が起きると、シナリオの見た目が毎回変わってしまう。
  state.disastersEnabled = false;
  state.autoBudget = true;

  const simulation = new Simulation(state);
  for (let i = 0; i < months * TICKS_PER_MONTH; i++) simulation.tick();

  state.disastersEnabled = wasEnabled;
  state.autoBudget = autoBudget;
  state.ticks = 0;
  state.history.samples.length = 0;
  state.milestoneIndex = 0;
}

/** 下ごしらえの間だけ使う潤沢な資金。街を敷き終えたら、遊び始める額に付け替える。 */
const SETUP_FUNDS = 10_000_000;

/** シナリオの街を用意するときの指定。 */
interface ScenarioSetup {
  /** 地形のシード。 */
  seed: number;
  /** 都市の名前。 */
  cityName: string;
  /** 遊び始めるときの資金。 */
  funds: number;
  /** 街を育てる月数。 */
  months: number;
  /**
   * 街を敷く。資金は気にしなくてよい。
   * @param state 都市の状態。
   */
  layout(state: CityState): void;
  /**
   * 育てたあとに起こす「事件」。
   * @param state 都市の状態。
   */
  twist?(state: CityState): void;
}

/**
 * シナリオの開始状態を作る。
 * @param setup 用意のしかた。
 */
function buildScenarioCity(setup: ScenarioSetup): CityState {
  const map = generateTerrain(new Rng(setup.seed), {
    width: 70,
    height: 55,
    rivers: 1,
    lakes: 3,
  });
  const state = new CityState(map, new Rng(setup.seed ^ 0x1f2e3d4c), SETUP_FUNDS, setup.cityName);

  setup.layout(state);
  growCity(state, setup.months);
  setup.twist?.(state);

  state.funds = setup.funds;
  state.lastBudget = null;
  // 「事件」のあとの姿で集計し直しておく。目標の判定が初手からずれないようにするため。
  new Simulation(state).refresh();
  return state;
}

/** 遊べるシナリオの一覧。 */
export const SCENARIOS: readonly Scenario[] = [
  {
    id: "stagnant",
    name: "停滞したふるさと",
    description:
      "働き口ばかりが多く、住む人が増えないまま時が止まってしまった街。" +
      "区画のかたよりを直して、もう一度人を呼び込んでください。",
    goalText: "20年以内に人口1,500人",
    years: 20,
    build(): CityState {
      return buildScenarioCity({
        seed: 1001,
        cityName: "ふるさと市",
        funds: 20000,
        months: 12 * 12,
        layout(state) {
          // 工業ばかりの偏った街区。住む場所が足りず、街が伸び悩んでいる。
          layoutDistrict(state, 8, 6, 52, 40, [
            ZoneType.industrial,
            ZoneType.industrial,
            ZoneType.residential,
          ]);
          placePowerPlant(state, "coal-plant");
        },
      });
    },
    isAchieved(state: CityState): boolean {
      return state.stats.population >= 1500;
    },
  },
  {
    id: "quake",
    name: "震災からの復興",
    description:
      "大地震が街を襲いました。倒れた建物と焼け跡が残っています。" +
      "がれきを片づけ、街をもとの姿に戻してください。",
    goalText: "12年以内に人口2,000人",
    years: 12,
    build(): CityState {
      return buildScenarioCity({
        seed: 2002,
        cityName: "みなと市",
        funds: 30000,
        months: 18 * 12,
        layout(state) {
          layoutDistrict(state, 6, 6, 62, 46, [
            ZoneType.residential,
            ZoneType.residential,
            ZoneType.commercial,
            ZoneType.industrial,
          ]);
          placePowerPlant(state, "coal-plant");
          placePowerPlant(state, "coal-plant");
        },
        twist(state) {
          // 事件: 大地震。揺れは2回に分けて起こし、被害を深くする。
          const disasters = new DisasterSystem(state);
          disasters.trigger(DisasterKind.earthquake);
          disasters.trigger(DisasterKind.earthquake);
          for (let i = 0; i < 20; i++) disasters.tick();
        },
      });
    },
    isAchieved(state: CityState): boolean {
      return state.stats.population >= 2000;
    },
  },
  {
    id: "smog",
    name: "煙にかすむ街",
    description:
      "工場に頼りきりで発展した街は、公害で息苦しくなってしまいました。" +
      "人口を保ったまま、空気をきれいにしてください。",
    goalText: "15年以内に、人口1,200人を保ったまま市街地の公害を12以下に",
    years: 15,
    build(): CityState {
      return buildScenarioCity({
        seed: 3003,
        cityName: "けむり市",
        funds: 25000,
        months: 20 * 12,
        layout(state) {
          // 住宅と商業もそれなりに置く。人がいなければ工場も育たず、公害も出ない。
          layoutDistrict(state, 4, 4, 64, 48, [
            ZoneType.industrial,
            ZoneType.residential,
            ZoneType.industrial,
            ZoneType.commercial,
            ZoneType.industrial,
            ZoneType.residential,
          ]);
          placePowerPlant(state, "coal-plant");
          placePowerPlant(state, "coal-plant");
          placePowerPlant(state, "coal-plant");
        },
      });
    },
    isAchieved(state: CityState): boolean {
      const pollution = averageWhereDeveloped(state.fields, state.fields.pollution);
      return state.stats.population >= 1200 && pollution <= 12;
    },
  },
];

/**
 * 識別子からシナリオを引く。見つからなければ `null`。
 * @param id 識別子。
 */
export function scenarioById(id: string): Scenario | null {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

/**
 * シナリオの現在の状況。
 * @param scenario 遊んでいるシナリオ。
 * @param state 都市の状態。
 */
export function scenarioStatus(
  scenario: Scenario,
  state: CityState,
): "achieved" | "failed" | "playing" {
  if (scenario.isAchieved(state)) return "achieved";
  if (state.ticks >= scenario.years * 12 * TICKS_PER_MONTH) return "failed";
  return "playing";
}
