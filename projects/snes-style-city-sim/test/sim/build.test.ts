import { beforeEach, describe, expect, it } from "vitest";
import {
  BUILD_COST,
  buildNetwork,
  buildStructure,
  buildZone,
  bulldoze,
  canPlaceStructure,
} from "../../src/sim/build.js";
import { ZoneType, buildingById, buildingOfTile, zoneBuilding } from "../../src/sim/buildings.js";
import { CityMap, TileFlag } from "../../src/sim/map.js";
import { Rng } from "../../src/sim/rng.js";
import { CityState } from "../../src/sim/state.js";
import { TileId, isRoad } from "../../src/sim/tiles.js";

/**
 * すべて草地の小さなマップで都市の状態を作る。
 * @param funds 初期資金。
 */
function makeState(funds = 100000): CityState {
  const map = new CityMap(12, 12);
  map.tiles.fill(TileId.Grass);
  return new CityState(map, new Rng(1), funds, "テスト市");
}

describe("道路の敷設", () => {
  let state: CityState;
  beforeEach(() => {
    state = makeState();
  });

  it("1マス置くと孤立した道路になり、費用が引かれる", () => {
    const before = state.funds;
    const result = buildNetwork(state, 5, 5, "road");
    expect(result.ok).toBe(true);
    expect(state.funds).toBe(before - BUILD_COST.road);
    expect(state.map.get(5, 5)).toBe(TileId.Road);
  });

  it("隣り合う道路は自動でつながる", () => {
    buildNetwork(state, 5, 5, "road");
    buildNetwork(state, 6, 5, "road");
    // 西の道路は東へ、東の道路は西へつながる。
    expect(state.map.get(5, 5)).toBe(TileId.Road + 2);
    expect(state.map.get(6, 5)).toBe(TileId.Road + 8);

    buildNetwork(state, 7, 5, "road");
    expect(state.map.get(6, 5)).toBe(TileId.Road + 10);
  });

  it("十字路は4方向すべてにつながる", () => {
    buildNetwork(state, 5, 5, "road");
    buildNetwork(state, 5, 4, "road");
    buildNetwork(state, 5, 6, "road");
    buildNetwork(state, 4, 5, "road");
    buildNetwork(state, 6, 5, "road");
    expect(state.map.get(5, 5)).toBe(TileId.Road + 15);
  });

  it("同じ場所に重ねて敷いても費用はかからない", () => {
    buildNetwork(state, 5, 5, "road");
    const before = state.funds;
    const result = buildNetwork(state, 5, 5, "road");
    expect(result.ok).toBe(false);
    expect(state.funds).toBe(before);
  });

  it("資金が足りなければ敷けない", () => {
    const poor = makeState(5);
    const result = buildNetwork(poor, 5, 5, "road");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("資金が足りません");
    expect(poor.map.get(5, 5)).toBe(TileId.Grass);
  });

  it("水面に敷くと橋になり、橋の費用がかかる", () => {
    state.map.set(5, 5, TileId.Water);
    const before = state.funds;
    const result = buildNetwork(state, 5, 5, "road");
    expect(result.ok).toBe(true);
    expect(state.funds).toBe(before - BUILD_COST.roadBridge);
    expect(state.map.get(5, 5)).toBe(TileId.RoadBridge + 1); // 左右に陸があるので横向き
  });

  it("縦につながる位置に架けた橋は縦向きになる", () => {
    for (let y = 4; y <= 6; y++) state.map.set(5, y, TileId.Water);
    buildNetwork(state, 5, 3, "road");
    const result = buildNetwork(state, 5, 4, "road");
    expect(result.ok).toBe(true);
    expect(state.map.get(5, 4)).toBe(TileId.RoadBridge);
  });

  it("直線の線路に道路を重ねると踏切になる", () => {
    buildNetwork(state, 4, 5, "rail");
    buildNetwork(state, 5, 5, "rail");
    buildNetwork(state, 6, 5, "rail");
    expect(state.map.get(5, 5)).toBe(TileId.Rail + 10);

    const result = buildNetwork(state, 5, 5, "road");
    expect(result.ok).toBe(true);
    expect(state.map.get(5, 5)).toBe(TileId.RoadRail);
    expect(isRoad(state.map.get(5, 5))).toBe(true);
  });

  it("送電線は道路と交差できる", () => {
    buildNetwork(state, 5, 4, "road");
    buildNetwork(state, 5, 5, "road");
    buildNetwork(state, 5, 6, "road");
    const result = buildNetwork(state, 5, 5, "wire");
    expect(result.ok).toBe(true);
    expect(state.map.get(5, 5)).toBe(TileId.RoadWire);
  });

  it("建物の上には敷けない", () => {
    buildStructure(state, 4, 4, buildingById("police-station"));
    const result = buildNetwork(state, 5, 5, "road");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("ここには敷けません");
  });
});

describe("取り壊し", () => {
  it("道路を壊すと更地になり、隣の道路のつながりも直る", () => {
    const state = makeState();
    buildNetwork(state, 5, 5, "road");
    buildNetwork(state, 6, 5, "road");
    bulldoze(state, 6, 5);
    expect(state.map.get(6, 5)).toBe(TileId.Dirt);
    expect(state.map.get(5, 5)).toBe(TileId.Road);
  });

  it("建物は1マス壊すと丸ごと瓦礫になる", () => {
    const state = makeState();
    buildStructure(state, 4, 4, buildingById("police-station"));
    bulldoze(state, 5, 5);
    for (let y = 4; y < 7; y++) {
      for (let x = 4; x < 7; x++) {
        expect(state.map.get(x, y)).toBe(TileId.Rubble);
        expect(state.map.hasFlag(x, y, TileFlag.building)).toBe(false);
      }
    }
  });

  it("水面は壊せず、既に更地のマスは何も起きない", () => {
    const state = makeState();
    state.map.set(5, 5, TileId.Water);
    state.map.set(6, 6, TileId.Dirt);
    expect(bulldoze(state, 5, 5).message).toBe("水面は取り壊せません");
    expect(bulldoze(state, 6, 6).ok).toBe(false);
  });

  it("草地はならして更地にできる", () => {
    const state = makeState();
    expect(bulldoze(state, 6, 6).ok).toBe(true);
    expect(state.map.get(6, 6)).toBe(TileId.Dirt);
  });
});

describe("区画と建物", () => {
  it("区画は3x3で置かれ、代表タイルに種類が記録される", () => {
    const state = makeState();
    const result = buildZone(state, 4, 4, ZoneType.residential);
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(BUILD_COST.zone);

    const def = zoneBuilding(ZoneType.residential, 0);
    expect(state.map.buildingKind[state.map.index(4, 4)]).toBe(def.kind);
    expect(state.map.hasFlag(4, 4, TileFlag.origin)).toBe(true);
    expect(state.map.hasFlag(6, 6, TileFlag.building)).toBe(true);
    expect(state.map.originOf(6, 6)).toEqual({ x: 4, y: 4 });
    expect(buildingOfTile(state.map.get(5, 5))).toBe(def);
  });

  it("重なる位置には置けない", () => {
    const state = makeState();
    buildZone(state, 4, 4, ZoneType.residential);
    const result = buildZone(state, 5, 5, ZoneType.commercial);
    expect(result.ok).toBe(false);
  });

  it("水面にかかる位置には置けない", () => {
    const state = makeState();
    state.map.set(6, 6, TileId.Water);
    expect(canPlaceStructure(state.map, 4, 4, 3, 3)).toBe(false);
    expect(buildZone(state, 4, 4, ZoneType.residential).ok).toBe(false);
  });

  it("マップの外にはみ出す位置には置けない", () => {
    const state = makeState();
    expect(canPlaceStructure(state.map, 11, 11, 3, 3)).toBe(false);
    expect(buildStructure(state, 11, 11, buildingById("coal-plant")).ok).toBe(false);
  });

  it("資金が足りなければ建てられない", () => {
    const state = makeState(100);
    const result = buildStructure(state, 4, 4, buildingById("coal-plant"));
    expect(result.ok).toBe(false);
    expect(result.message).toBe("資金が足りません");
  });

  it("発電所は4x4のタイルを占める", () => {
    const state = makeState();
    const def = buildingById("coal-plant");
    expect(buildStructure(state, 2, 2, def).ok).toBe(true);
    for (let y = 2; y < 6; y++) {
      for (let x = 2; x < 6; x++) {
        expect(buildingOfTile(state.map.get(x, y))).toBe(def);
      }
    }
    expect(state.map.get(2, 2)).toBe(def.tileBase);
    expect(state.map.get(5, 5)).toBe(def.tileBase + 15);
  });
});
