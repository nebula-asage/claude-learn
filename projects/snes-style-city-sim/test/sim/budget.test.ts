import { describe, expect, it } from "vitest";
import {
  applyAnnualBudget,
  computeBudget,
  computeTaxIncome,
  decayUnderfundedRoads,
} from "../../src/sim/budget.js";
import { buildNetwork } from "../../src/sim/build.js";
import { evaluateCity } from "../../src/sim/evaluation.js";
import { HISTORY_LIMIT } from "../../src/sim/history.js";
import { CityMap } from "../../src/sim/map.js";
import { Rng } from "../../src/sim/rng.js";
import { CityState } from "../../src/sim/state.js";
import { collectStats, emptyStats } from "../../src/sim/stats.js";
import { TileId, isRoad } from "../../src/sim/tiles.js";

/**
 * すべて草地の小さなマップで都市の状態を作る。
 * @param funds 初期資金。
 */
function makeState(funds = 10000): CityState {
  const map = new CityMap(30, 20);
  map.tiles.fill(TileId.Grass);
  return new CityState(map, new Rng(3), funds, "テスト市");
}

describe("computeTaxIncome", () => {
  it("税率が高いほど税収が増える", () => {
    const stats = emptyStats();
    stats.residents = 500;
    stats.commercialJobs = 200;
    stats.industrialJobs = 200;
    expect(computeTaxIncome(stats, 10, 128)).toBeGreaterThan(computeTaxIncome(stats, 5, 128));
  });

  it("税率0なら税収も0", () => {
    const stats = emptyStats();
    stats.residents = 500;
    expect(computeTaxIncome(stats, 0, 128)).toBe(0);
  });

  it("地価が高いほど税収が増える", () => {
    const stats = emptyStats();
    stats.residents = 500;
    expect(computeTaxIncome(stats, 7, 200)).toBeGreaterThan(computeTaxIncome(stats, 7, 40));
  });
});

describe("computeBudget", () => {
  it("道路の本数だけ維持費が必要になる", () => {
    const state = makeState();
    for (let x = 0; x < 20; x++) buildNetwork(state, x, 5, "road");
    collectStats(state.map, state.stats);

    const report = computeBudget(state);
    expect(state.stats.roadTiles).toBe(20);
    expect(report.roadRequired).toBe(40);
    expect(report.roadSpending).toBe(40);
  });

  it("配分を絞ると支出が減る", () => {
    const state = makeState();
    for (let x = 0; x < 20; x++) buildNetwork(state, x, 5, "road");
    collectStats(state.map, state.stats);

    state.funding.roads = 0.5;
    const report = computeBudget(state);
    expect(report.roadRequired).toBe(40);
    expect(report.roadSpending).toBe(20);
    expect(report.totalSpending).toBe(20);
  });
});

describe("applyAnnualBudget", () => {
  it("収支のぶんだけ資金が動き、直近の決算として残る", () => {
    const state = makeState(10000);
    state.stats.residents = 400;
    state.taxRate = 10;

    const report = applyAnnualBudget(state);
    expect(report.taxIncome).toBeGreaterThan(0);
    expect(state.funds).toBe(10000 + report.balance);
    expect(state.lastBudget).toBe(report);
  });

  it("支出が税収を上回れば資金は減る", () => {
    const state = makeState(10000);
    for (let x = 0; x < 25; x++) buildNetwork(state, x, 5, "road");
    collectStats(state.map, state.stats);
    state.taxRate = 0;

    applyAnnualBudget(state);
    expect(state.funds).toBeLessThan(10000);
  });
});

describe("decayUnderfundedRoads", () => {
  it("満額なら道路は傷まない", () => {
    const state = makeState();
    for (let x = 0; x < 25; x++) buildNetwork(state, x, 5, "road");
    collectStats(state.map, state.stats);

    expect(decayUnderfundedRoads(state)).toBe(0);
    expect(state.map.tiles.filter((t) => isRoad(t)).length).toBe(25);
  });

  it("予算を切ると道路が壊れていく", () => {
    const state = makeState();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 30; x++) buildNetwork(state, x, y, "road");
    }
    collectStats(state.map, state.stats);
    const before = state.map.tiles.filter((t) => isRoad(t)).length;

    state.funding.roads = 0;
    let broken = 0;
    for (let year = 0; year < 10; year++) broken += decayUnderfundedRoads(state);

    expect(broken).toBeGreaterThan(0);
    expect(state.map.tiles.filter((t) => isRoad(t)).length).toBeLessThan(before);
  });
});

describe("evaluateCity", () => {
  it("問題が無ければ支持率は高い", () => {
    const state = makeState();
    state.taxRate = 7;
    const evaluation = evaluateCity(state);
    expect(evaluation.approval).toBeGreaterThan(40);
  });

  it("犯罪が多いと支持率が下がり、問題として挙がる", () => {
    const state = makeState();
    state.fields.crime.fill(200);
    const evaluation = evaluateCity(state);
    expect(evaluation.approval).toBeLessThan(20);
    expect(evaluation.issues).toContain("犯罪");
  });

  it("税率が高いと問題として挙がる", () => {
    const state = makeState();
    state.taxRate = 20;
    expect(evaluateCity(state).issues).toContain("重い税金");
  });
});

describe("CityHistory", () => {
  it("記録は上限を超えると古いものから捨てられる", () => {
    const state = makeState();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      state.ticks += 16 * 12;
      state.history.record(state);
    }
    expect(state.history.samples.length).toBe(HISTORY_LIMIT);
    expect(state.history.samples[0].year).toBeGreaterThan(1900);
  });
});
