import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById, scenarioStatus } from "../../src/sim/scenario.js";
import { TICKS_PER_MONTH } from "../../src/sim/state.js";
import { averageWhereDeveloped } from "../../src/sim/fields.js";
import { TileId, isBuilding } from "../../src/sim/tiles.js";

describe("シナリオ", () => {
  it("識別子で引ける", () => {
    for (const scenario of SCENARIOS) {
      expect(scenarioById(scenario.id)).toBe(scenario);
    }
    expect(scenarioById("なにもない")).toBeNull();
  });

  it("どのシナリオも、街ができた状態から始まる", () => {
    for (const scenario of SCENARIOS) {
      const state = scenario.build();
      expect(state.map.tiles.some((tile) => isBuilding(tile))).toBe(true);
      expect(state.stats.population).toBeGreaterThan(0);
      // 年は必ず開始時点に戻っている。
      expect(state.ticks).toBe(0);
      expect(state.year).toBe(1900);
    }
  });

  it("始めた時点では、まだ目標を達成していない", () => {
    for (const scenario of SCENARIOS) {
      const state = scenario.build();
      expect(scenario.isAchieved(state)).toBe(false);
      expect(scenarioStatus(scenario, state)).toBe("playing");
    }
  });

  it("期限を過ぎると失敗になる", () => {
    const scenario = SCENARIOS[0];
    const state = scenario.build();
    state.ticks = scenario.years * 12 * TICKS_PER_MONTH;
    expect(scenarioStatus(scenario, state)).toBe("failed");
  });

  it("目標を満たせば、期限を過ぎていても達成として扱う", () => {
    const scenario = SCENARIOS[0];
    const state = scenario.build();
    state.stats.population = 100000;
    state.ticks = scenario.years * 12 * TICKS_PER_MONTH;
    expect(scenarioStatus(scenario, state)).toBe("achieved");
  });

  it("震災のシナリオは、がれきが残った状態から始まる", () => {
    const state = scenarioById("quake")?.build();
    expect(state).toBeDefined();
    const rubble = state?.map.tiles.filter((tile) => tile === TileId.Rubble).length ?? 0;
    expect(rubble).toBeGreaterThan(20);
  });

  it("公害のシナリオは、市街地の公害が目標より高い状態から始まる", () => {
    const scenario = scenarioById("smog");
    expect(scenario).not.toBeNull();
    const state = scenario!.build();
    // 目標は「市街地の公害12以下」。始めた時点ではそれを超えている。
    expect(averageWhereDeveloped(state.fields, state.fields.pollution)).toBeGreaterThan(12);
    expect(state.stats.population).toBeGreaterThan(0);
  });
});
