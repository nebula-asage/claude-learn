import { describe, expect, it } from "vitest";
import { buildNetwork, buildStructure, buildZone } from "../../src/sim/build.js";
import { ZoneType, buildingById } from "../../src/sim/buildings.js";
import { DisasterKind, DisasterSystem } from "../../src/sim/disasters.js";
import { CityMap } from "../../src/sim/map.js";
import { Rng } from "../../src/sim/rng.js";
import { SAVE_VERSION, deserializeCity, serializeCity } from "../../src/sim/save.js";
import { Simulation } from "../../src/sim/simulation.js";
import { CityState, TICKS_PER_MONTH } from "../../src/sim/state.js";
import { TileId } from "../../src/sim/tiles.js";

/** 保存の検証に使う、少し遊んだあとの都市を作る。 */
function makePlayedCity(): CityState {
  const map = new CityMap(24, 18);
  map.tiles.fill(TileId.Grass);
  const state = new CityState(map, new Rng(4711), 12345, "セーブ市");
  state.disastersEnabled = false;

  buildStructure(state, 1, 1, buildingById("coal-plant"));
  for (let x = 5; x < 20; x++) buildNetwork(state, x, 1, "wire");
  for (let x = 1; x < 20; x++) buildNetwork(state, x, 5, "road");
  buildZone(state, 9, 2, ZoneType.residential);
  buildZone(state, 13, 2, ZoneType.commercial);

  state.taxRate = 11;
  state.funding.roads = 0.6;
  state.autoBudget = true;
  state.disasterChance = 0.05;

  const simulation = new Simulation(state);
  for (let i = 0; i < 24 * TICKS_PER_MONTH; i++) simulation.tick();
  return state;
}

describe("セーブとロード", () => {
  it("書き出して読み戻すと、マップも数値もそのまま復元される", () => {
    const original = makePlayedCity();
    const restored = deserializeCity(serializeCity(original, "stagnant"));

    expect(Array.from(restored.map.tiles)).toEqual(Array.from(original.map.tiles));
    expect(Array.from(restored.map.flags)).toEqual(Array.from(original.map.flags));
    expect(Array.from(restored.map.buildingKind)).toEqual(Array.from(original.map.buildingKind));
    expect(Array.from(restored.map.originOffset)).toEqual(Array.from(original.map.originOffset));

    expect(restored.cityName).toBe(original.cityName);
    expect(restored.funds).toBe(original.funds);
    expect(restored.ticks).toBe(original.ticks);
    expect(restored.year).toBe(original.year);
    expect(restored.month).toBe(original.month);
    expect(restored.taxRate).toBe(original.taxRate);
    expect(restored.funding).toEqual(original.funding);
    expect(restored.autoBudget).toBe(original.autoBudget);
    expect(restored.disasterChance).toBe(original.disasterChance);
    expect(restored.milestoneIndex).toBe(original.milestoneIndex);
    expect(restored.rng.getState()).toBe(original.rng.getState());
    expect(restored.history.samples).toEqual(original.history.samples);
  });

  it("読み込んだあとに集計し直すと、人口も元と同じになる", () => {
    const original = makePlayedCity();
    const restored = deserializeCity(serializeCity(original));
    new Simulation(restored); // 読み込み直後の再計算

    expect(restored.stats.population).toBe(original.stats.population);
    expect(restored.power.supply).toBe(original.power.supply);
  });

  it("続きから進めても、元の都市と同じ道をたどる", () => {
    const original = makePlayedCity();
    const restored = deserializeCity(serializeCity(original));

    const continueOriginal = new Simulation(original);
    const continueRestored = new Simulation(restored);
    for (let i = 0; i < 12 * TICKS_PER_MONTH; i++) {
      continueOriginal.tick();
      continueRestored.tick();
    }

    expect(Array.from(restored.map.tiles)).toEqual(Array.from(original.map.tiles));
    expect(restored.funds).toBe(original.funds);
  });

  it("動いている災害も保存される", () => {
    const original = makePlayedCity();
    new DisasterSystem(original).trigger(DisasterKind.tornado);
    expect(original.entities.length).toBe(1);

    const restored = deserializeCity(serializeCity(original));
    expect(restored.entities).toEqual(original.entities);
  });

  it("形式の版が違うセーブデータは読み込まない", () => {
    const data = serializeCity(makePlayedCity());
    expect(data.version).toBe(SAVE_VERSION);
    expect(() => deserializeCity({ ...data, version: SAVE_VERSION + 1 })).toThrow();
  });

  it("シナリオの識別子が残る", () => {
    const data = serializeCity(makePlayedCity(), "quake");
    expect(data.scenarioId).toBe("quake");
    expect(serializeCity(makePlayedCity()).scenarioId).toBeNull();
  });
});
