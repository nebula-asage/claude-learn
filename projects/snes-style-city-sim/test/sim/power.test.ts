import { describe, expect, it } from "vitest";
import { buildNetwork, buildStructure, buildZone } from "../../src/sim/build.js";
import { ZoneType, buildingById } from "../../src/sim/buildings.js";
import { CityMap, TileFlag } from "../../src/sim/map.js";
import { updatePower } from "../../src/sim/power.js";
import { Rng } from "../../src/sim/rng.js";
import { CityState } from "../../src/sim/state.js";
import { TileId } from "../../src/sim/tiles.js";

/**
 * すべて草地の小さなマップで都市の状態を作る。
 * @param width 横幅。
 * @param height 高さ。
 */
function makeState(width = 20, height = 12): CityState {
  const map = new CityMap(width, height);
  map.tiles.fill(TileId.Grass);
  return new CityState(map, new Rng(1), 1000000, "テスト市");
}

describe("updatePower", () => {
  it("発電所に隣接した建物には電気が届く", () => {
    const state = makeState();
    buildStructure(state, 1, 1, buildingById("coal-plant"));
    buildZone(state, 5, 1, ZoneType.residential);
    // 発電所(1..4)と区画(5..7)は隣り合っているので、建物どうしで電気が伝わる。

    const report = updatePower(state);
    expect(report.supply).toBe(buildingById("coal-plant").powerSupply);
    expect(state.map.hasFlag(5, 1, TileFlag.powered)).toBe(true);
  });

  it("送電線でつながっていれば離れた建物にも電気が届く", () => {
    const state = makeState();
    buildStructure(state, 1, 1, buildingById("coal-plant"));
    for (let x = 5; x < 14; x++) buildNetwork(state, x, 2, "wire");
    buildStructure(state, 14, 1, buildingById("police-station"));

    updatePower(state);
    expect(state.map.hasFlag(14, 1, TileFlag.powered)).toBe(true);
    expect(state.map.hasFlag(9, 2, TileFlag.powered)).toBe(true);
  });

  it("送電線が切れていると電気は届かない", () => {
    const state = makeState();
    buildStructure(state, 1, 1, buildingById("coal-plant"));
    for (let x = 5; x < 14; x++) {
      if (x === 9) continue; // わざと1マス空ける
      buildNetwork(state, x, 2, "wire");
    }
    buildStructure(state, 14, 1, buildingById("police-station"));

    const report = updatePower(state);
    expect(state.map.hasFlag(14, 1, TileFlag.powered)).toBe(false);
    expect(report.unpowered).toBeGreaterThan(0);
  });

  it("発電所が無ければどの建物にも電気は届かない", () => {
    const state = makeState();
    buildStructure(state, 1, 1, buildingById("police-station"));
    const report = updatePower(state);
    expect(report.supply).toBe(0);
    expect(state.map.hasFlag(1, 1, TileFlag.powered)).toBe(false);
    expect(report.unpowered).toBe(1);
  });

  it("需要は建物の数だけ積み上がり、通電・停電の内訳と一致する", () => {
    const state = makeState(60, 22);
    buildStructure(state, 1, 1, buildingById("coal-plant"));
    for (let x = 5; x < 58; x++) buildNetwork(state, x, 2, "wire");

    const airport = buildingById("airport");
    let connected = 0;
    for (let x = 6; x + airport.width <= 58; x += airport.width + 1) {
      // 送電線の1つ下に並べるので、すべて電力網につながる。
      if (buildStructure(state, x, 3, airport).ok) connected++;
    }
    // 電力網から離れた場所にも1つ建てておく。
    expect(buildStructure(state, 50, 14, airport).ok).toBe(true);

    const report = updatePower(state);
    expect(connected).toBeGreaterThan(1);
    expect(report.demand).toBe((connected + 1) * airport.powerDemand);
    expect(report.powered).toBe(connected);
    expect(report.unpowered).toBe(1);
  });

  it("電力が復旧すると通電フラグも戻る", () => {
    const state = makeState();
    buildStructure(state, 1, 1, buildingById("coal-plant"));
    for (let x = 5; x < 14; x++) buildNetwork(state, x, 2, "wire");
    buildStructure(state, 14, 1, buildingById("police-station"));
    updatePower(state);
    expect(state.map.hasFlag(14, 1, TileFlag.powered)).toBe(true);

    // 送電線を1マス壊すと届かなくなる。
    state.map.clearTile(9, 2, TileId.Dirt);
    updatePower(state);
    expect(state.map.hasFlag(14, 1, TileFlag.powered)).toBe(false);

    // つなぎ直せば戻る。
    buildNetwork(state, 9, 2, "wire");
    updatePower(state);
    expect(state.map.hasFlag(14, 1, TileFlag.powered)).toBe(true);
  });
});
