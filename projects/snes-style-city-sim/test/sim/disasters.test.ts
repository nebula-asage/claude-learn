import { describe, expect, it } from "vitest";
import { buildNetwork, buildStructure, buildZone } from "../../src/sim/build.js";
import { ZoneType, buildingById } from "../../src/sim/buildings.js";
import { DisasterKind, DisasterSystem } from "../../src/sim/disasters.js";
import { updateFields } from "../../src/sim/fields.js";
import { CityMap } from "../../src/sim/map.js";
import { MILESTONES, checkMilestone, isToolUnlocked, titleFor } from "../../src/sim/milestones.js";
import { Rng } from "../../src/sim/rng.js";
import { CityState } from "../../src/sim/state.js";
import { TileId, isBuilding, isFire, isFlood } from "../../src/sim/tiles.js";

/**
 * すべて草地の小さなマップで都市の状態を作る。
 * @param width 横幅。
 * @param height 高さ。
 */
function makeState(width = 24, height = 20): CityState {
  const map = new CityMap(width, height);
  map.tiles.fill(TileId.Grass);
  return new CityState(map, new Rng(555), 1000000, "テスト市");
}

/**
 * 燃えているタイルの数を数える。
 * @param state 都市の状態。
 */
function countFires(state: CityState): number {
  return state.map.tiles.filter((tile) => isFire(tile)).length;
}

describe("火災", () => {
  it("建物に火をつけると建物は失われ、火のついたマスが燃え続ける", () => {
    const state = makeState();
    buildZone(state, 5, 5, ZoneType.residential);
    const disasters = new DisasterSystem(state);

    expect(disasters.ignite(6, 6)).toBe(true);
    // 火元は1マス。建物の残りは瓦礫になる。
    expect(countFires(state)).toBe(1);
    expect(isFire(state.map.get(6, 6))).toBe(true);
    for (let y = 5; y < 8; y++) {
      for (let x = 5; x < 8; x++) {
        if (x === 6 && y === 6) continue;
        expect(state.map.get(x, y)).toBe(TileId.Rubble);
      }
    }
    expect(isBuilding(state.map.get(5, 5))).toBe(false);
  });

  it("草地や道路には火がつかない", () => {
    const state = makeState();
    buildNetwork(state, 5, 5, "road");
    const disasters = new DisasterSystem(state);

    expect(disasters.ignite(5, 5)).toBe(false);
    expect(disasters.ignite(8, 8)).toBe(false);
  });

  it("森は燃え広がり、やがて瓦礫になる", () => {
    const state = makeState();
    for (let y = 2; y < 18; y++) {
      for (let x = 2; x < 22; x++) state.map.set(x, y, TileId.Forest);
    }
    const disasters = new DisasterSystem(state);
    disasters.ignite(12, 10);

    for (let i = 0; i < 400; i++) disasters.tick();

    // 燃え広がった結果、最初の1マス以外にも被害が出ている。
    const rubble = state.map.tiles.filter((tile) => tile === TileId.Rubble).length;
    expect(rubble).toBeGreaterThan(1);
  });

  it("消防署の管轄内では火が早く消える", () => {
    const build = (withFireStation: boolean): number => {
      const state = makeState(30, 24);
      for (let y = 2; y < 22; y++) {
        for (let x = 2; x < 28; x++) state.map.set(x, y, TileId.Forest);
      }
      if (withFireStation) {
        buildStructure(state, 12, 10, buildingById("fire-station"));
        state.fields.fireCoverage.fill(220);
      }
      const disasters = new DisasterSystem(state);
      disasters.ignite(15, 12);
      for (let i = 0; i < 120; i++) disasters.tick();
      return countFires(state);
    };

    expect(build(true)).toBeLessThan(build(false));
  });
});

describe("洪水", () => {
  it("水辺の陸地が浸水する", () => {
    const state = makeState();
    for (let y = 0; y < 20; y++) state.map.set(3, y, TileId.Water);
    const disasters = new DisasterSystem(state);

    expect(disasters.trigger(DisasterKind.flood)).not.toBeNull();
    expect(state.map.tiles.filter((tile) => isFlood(tile)).length).toBeGreaterThan(0);
  });

  it("時間が経つと水が引く", () => {
    const state = makeState();
    for (let y = 0; y < 20; y++) state.map.set(3, y, TileId.Water);
    const disasters = new DisasterSystem(state);
    disasters.trigger(DisasterKind.flood);

    for (let i = 0; i < 300; i++) disasters.tick();
    expect(state.map.tiles.filter((tile) => isFlood(tile)).length).toBe(0);
  });
});

describe("竜巻と怪獣", () => {
  it("竜巻は実体として現れ、通り道の建物を壊す", () => {
    const state = makeState(30, 24);
    for (let y = 1; y < 22; y += 4) {
      for (let x = 1; x < 27; x += 4) buildZone(state, x, y, ZoneType.residential);
    }
    const before = state.map.tiles.filter((tile) => isBuilding(tile)).length;

    const disasters = new DisasterSystem(state);
    disasters.trigger(DisasterKind.tornado);
    expect(state.entities.length).toBe(1);

    for (let i = 0; i < 200; i++) disasters.tick();
    expect(state.map.tiles.filter((tile) => isBuilding(tile)).length).toBeLessThan(before);
    // 寿命が尽きれば消える。
    expect(state.entities.length).toBe(0);
  });

  it("怪獣は公害の濃い方へ向かう", () => {
    const state = makeState(40, 30);
    state.fields.pollution.fill(0);
    // 右下に強い公害を置く。
    for (let fy = 12; fy < 15; fy++) {
      for (let fx = 16; fx < 20; fx++) state.fields.pollution[fy * state.fields.width + fx] = 255;
    }

    const disasters = new DisasterSystem(state);
    disasters.trigger(DisasterKind.monster);
    const monster = state.entities[0];
    monster.x = 2;
    monster.y = 2;
    const startDistance = Math.hypot(36 - monster.x, 26 - monster.y);

    for (let i = 0; i < 150; i++) disasters.tick();
    const endDistance = Math.hypot(36 - monster.x, 26 - monster.y);
    expect(endDistance).toBeLessThan(startDistance);
  });
});

describe("地震と炉心融解", () => {
  it("地震は広い範囲を壊す", () => {
    const state = makeState(30, 24);
    for (let y = 1; y < 22; y += 4) {
      for (let x = 1; x < 27; x += 4) buildZone(state, x, y, ZoneType.residential);
    }
    const before = state.map.tiles.filter((tile) => isBuilding(tile)).length;

    new DisasterSystem(state).trigger(DisasterKind.earthquake);
    expect(state.map.tiles.filter((tile) => isBuilding(tile)).length).toBeLessThan(before);
  });

  it("炉心融解は原子力発電所が無ければ起きない", () => {
    const state = makeState();
    const disasters = new DisasterSystem(state);
    expect(disasters.trigger(DisasterKind.meltdown)).toBeNull();

    buildStructure(state, 5, 5, buildingById("nuclear-plant"));
    expect(disasters.trigger(DisasterKind.meltdown)).not.toBeNull();
    expect(isBuilding(state.map.get(6, 6))).toBe(false);
  });
});

describe("称号と解禁", () => {
  it("人口に応じて称号が変わる", () => {
    expect(titleFor(0)).toBe("村");
    expect(titleFor(1500)).toBe("町");
    expect(titleFor(5000)).toBe("市");
    expect(titleFor(200000)).toBe("巨大都市");
  });

  it("節目に届くと称号が進み、同じ節目では二度祝われない", () => {
    const state = makeState();
    state.stats.population = MILESTONES[1].population;

    expect(checkMilestone(state)).toBe(MILESTONES[1].message);
    expect(state.milestoneIndex).toBe(1);
    expect(checkMilestone(state)).toBeNull();
  });

  it("市に昇格すると市長公舎が建つ", () => {
    const state = makeState(30, 24);
    buildZone(state, 10, 10, ZoneType.residential);
    updateFields(state);

    state.milestoneIndex = 1;
    state.stats.population = MILESTONES[2].population;
    expect(checkMilestone(state)).toBe(MILESTONES[2].message);

    const mayorHouse = buildingById("mayor-house");
    const placed = state.map.buildingKind.some(
      (kind, i) => kind === mayorHouse.kind && state.map.flags[i] !== 0,
    );
    expect(placed).toBe(true);
  });

  it("人口が足りない道具は使えない", () => {
    expect(isToolUnlocked("road", 0)).toBe(true);
    expect(isToolUnlocked("stadium", 0)).toBe(false);
    expect(isToolUnlocked("stadium", 5000)).toBe(true);
    expect(isToolUnlocked("airport", 5000)).toBe(false);
  });
});
