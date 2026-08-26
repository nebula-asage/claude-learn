import { describe, expect, it } from "vitest";
import { buildNetwork, buildStructure, buildZone } from "../../src/sim/build.js";
import { ZoneType, buildingByKind, buildingById } from "../../src/sim/buildings.js";
import { computeDemand } from "../../src/sim/demand.js";
import { updateFields } from "../../src/sim/fields.js";
import { CityMap } from "../../src/sim/map.js";
import { Rng } from "../../src/sim/rng.js";
import { Simulation } from "../../src/sim/simulation.js";
import { CityState, TICKS_PER_MONTH } from "../../src/sim/state.js";
import { collectStats, emptyStats } from "../../src/sim/stats.js";
import { TileId } from "../../src/sim/tiles.js";
import { hasRoadAccess } from "../../src/sim/traffic.js";

/**
 * すべて草地の小さなマップで都市の状態を作る。
 * @param width 横幅。
 * @param height 高さ。
 */
function makeState(width = 24, height = 16): CityState {
  const map = new CityMap(width, height);
  map.tiles.fill(TileId.Grass);
  return new CityState(map, new Rng(20260827), 1000000, "テスト市");
}

/**
 * 電気と道路の通った住宅区画を1つ持つ都市を作る。
 * @param state 都市の状態。
 * @param zone 作る区画の種別。
 */
function setupServicedZone(state: CityState, zone: 1 | 2 | 3): void {
  // 発電所は (1,1) から4x4。その右へ送電線を伸ばし、区画の上辺に接するようにする。
  buildStructure(state, 1, 1, buildingById("coal-plant"));
  for (let x = 5; x < 20; x++) buildNetwork(state, x, 1, "wire");
  // 区画 (9,2)〜(11,4) の下辺に接する道路。
  for (let x = 1; x < 20; x++) buildNetwork(state, x, 5, "road");
  buildZone(state, 9, 2, zone);
}

/**
 * 指定した月数だけシミュレーションを進める。
 * @param simulation 進めるシミュレーション。
 * @param months 進める月数。
 */
function runMonths(simulation: Simulation, months: number): void {
  for (let i = 0; i < months * TICKS_PER_MONTH; i++) simulation.tick();
}

describe("Simulation", () => {
  it("電気と道路が通った区画は建物が育つ", () => {
    const state = makeState();
    setupServicedZone(state, ZoneType.residential);

    const simulation = new Simulation(state);
    expect(buildingByKind(state.map.buildingKind[state.map.index(9, 2)]).level).toBe(0);

    runMonths(simulation, 60);
    expect(buildingByKind(state.map.buildingKind[state.map.index(9, 2)]).level).toBeGreaterThan(0);
    expect(state.stats.residents).toBeGreaterThan(0);
  });

  it("電気が来ていない区画は育たない", () => {
    const state = makeState();
    for (let x = 1; x < 20; x++) buildNetwork(state, x, 5, "road");
    buildZone(state, 9, 2, ZoneType.residential);

    const simulation = new Simulation(state);
    runMonths(simulation, 60);
    expect(buildingByKind(state.map.buildingKind[state.map.index(9, 2)]).level).toBe(0);
  });

  it("道路に接していない区画は育たない", () => {
    const state = makeState();
    buildStructure(state, 1, 1, buildingById("coal-plant"));
    for (let y = 1; y < 8; y++) buildNetwork(state, 5, y, "wire");
    for (let x = 5; x < 13; x++) buildNetwork(state, x, 7, "wire");
    buildZone(state, 9, 8, ZoneType.residential);
    expect(
      hasRoadAccess(state.map, 9, 8, buildingByKind(state.map.buildingKind[state.map.index(9, 8)])),
    ).toBe(false);

    const simulation = new Simulation(state);
    runMonths(simulation, 60);
    expect(buildingByKind(state.map.buildingKind[state.map.index(9, 8)]).level).toBe(0);
  });

  it("日付は月・年の順に進む", () => {
    const state = makeState();
    const simulation = new Simulation(state);
    expect(state.year).toBe(1900);
    expect(state.month).toBe(1);

    runMonths(simulation, 1);
    expect(state.month).toBe(2);

    runMonths(simulation, 11);
    expect(state.year).toBe(1901);
    expect(state.month).toBe(1);
  });

  it("同じ手順・同じシードなら同じ都市になる", () => {
    const build = (): CityState => {
      const state = makeState();
      setupServicedZone(state, ZoneType.residential);
      runMonths(new Simulation(state), 40);
      return state;
    };
    const a = build();
    const b = build();
    expect(Array.from(a.map.tiles)).toEqual(Array.from(b.map.tiles));
    expect(a.stats.population).toBe(b.stats.population);
  });
});

describe("computeDemand", () => {
  it("働き口に対して住民が少なければ住宅需要が高い", () => {
    const stats = emptyStats();
    stats.residents = 10;
    stats.commercialJobs = 200;
    stats.industrialJobs = 200;
    expect(computeDemand(stats, 7).residential).toBeGreaterThan(0.3);
  });

  it("住民に対して働き口が多すぎれば住宅需要は下がらず、商業需要が下がる", () => {
    const stats = emptyStats();
    stats.residents = 100;
    stats.commercialJobs = 400;
    stats.industrialJobs = 400;
    const demand = computeDemand(stats, 7);
    expect(demand.commercial).toBeLessThan(0);
    expect(demand.industrial).toBeLessThan(0);
  });

  it("税率が高いほど需要は冷え込む", () => {
    const stats = emptyStats();
    stats.residents = 100;
    stats.commercialJobs = 50;
    stats.industrialJobs = 50;
    const low = computeDemand(stats, 5);
    const high = computeDemand(stats, 18);
    expect(high.residential).toBeLessThan(low.residential);
    expect(high.commercial).toBeLessThan(low.commercial);
  });

  it("需要は -1〜1 に収まる", () => {
    const stats = emptyStats();
    stats.residents = 0;
    stats.commercialJobs = 100000;
    stats.industrialJobs = 100000;
    const demand = computeDemand(stats, 0);
    for (const value of Object.values(demand)) {
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("面データ", () => {
  it("工業区画は周囲に公害を撒く", () => {
    const state = makeState();
    buildZone(state, 10, 6, ZoneType.industrial);
    // レベル0の空き地は公害を出さないので、育った状態にしておく。
    const map = state.map;
    const grown = buildingById("industrial-4");
    map.buildingKind[map.index(10, 6)] = grown.kind;

    updateFields(state);
    expect(state.fields.at(state.fields.pollution, 10, 6)).toBeGreaterThan(0);
    expect(state.fields.at(state.fields.pollution, 22, 14)).toBe(0);
  });

  it("警察署は周囲の犯罪を抑える", () => {
    const withPolice = makeState(40, 30);
    const withoutPolice = makeState(40, 30);

    for (const state of [withPolice, withoutPolice]) {
      const map = state.map;
      const grown = buildingById("residential-5");
      for (let i = 0; i < 6; i++) {
        buildZone(state, 4 + i * 4, 14, ZoneType.residential);
        map.buildingKind[map.index(4 + i * 4, 14)] = grown.kind;
      }
    }
    buildStructure(withPolice, 14, 20, buildingById("police-station"));

    updateFields(withPolice);
    updateFields(withoutPolice);

    const guarded = withPolice.fields.at(withPolice.fields.crime, 14, 15);
    const unguarded = withoutPolice.fields.at(withoutPolice.fields.crime, 14, 15);
    expect(unguarded).toBeGreaterThan(0);
    expect(guarded).toBeLessThan(unguarded);
  });
});

describe("collectStats", () => {
  it("区画の種類ごとに数と収容力を集計する", () => {
    const state = makeState();
    buildZone(state, 1, 1, ZoneType.residential);
    buildZone(state, 5, 1, ZoneType.commercial);
    buildZone(state, 9, 1, ZoneType.industrial);
    for (let x = 0; x < 10; x++) buildNetwork(state, x, 8, "road");

    const stats = emptyStats();
    collectStats(state.map, stats);
    expect(stats.residentialZones).toBe(1);
    expect(stats.commercialZones).toBe(1);
    expect(stats.industrialZones).toBe(1);
    expect(stats.roadTiles).toBe(10);
    expect(stats.population).toBe(0);
  });
});
