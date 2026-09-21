import { describe, expect, it } from "vitest";
import { Rng } from "../../src/sim/rng.js";
import { generateTerrain, refreshShorelines } from "../../src/sim/terrain.js";
import { CityMap } from "../../src/sim/map.js";
import { TileId, isForest, isWater } from "../../src/sim/tiles.js";

describe("generateTerrain", () => {
  it("同じシードからは完全に同じ地形ができる", () => {
    const a = generateTerrain(new Rng(1234));
    const b = generateTerrain(new Rng(1234));
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
  });

  it("シードが違えば地形も変わる", () => {
    const a = generateTerrain(new Rng(1));
    const b = generateTerrain(new Rng(2));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
  });

  it("水も森も陸地も、極端に偏らない割合で生成される", () => {
    for (const seed of [1, 42, 777, 20260827]) {
      const map = generateTerrain(new Rng(seed));
      const total = map.tiles.length;
      let water = 0;
      let forest = 0;
      for (const tile of map.tiles) {
        if (isWater(tile)) water++;
        else if (isForest(tile)) forest++;
      }
      expect(water / total).toBeGreaterThan(0.02);
      expect(water / total).toBeLessThan(0.5);
      expect(forest / total).toBeGreaterThan(0.02);
      const land = total - water;
      expect(land / total).toBeGreaterThan(0.5);
    }
  });

  it("指定した大きさのマップを作れる", () => {
    const map = generateTerrain(new Rng(5), { width: 40, height: 30 });
    expect(map.width).toBe(40);
    expect(map.height).toBe(30);
    expect(map.tiles.length).toBe(40 * 30);
  });

  it("生成直後は水辺の見た目が整っている", () => {
    const map = generateTerrain(new Rng(99));
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.get(x, y);
        if (!isWater(tile)) continue;
        let mask = 0;
        if (!isWater(map.get(x, y - 1))) mask |= 1;
        if (!isWater(map.get(x + 1, y))) mask |= 2;
        if (!isWater(map.get(x, y + 1))) mask |= 4;
        if (!isWater(map.get(x - 1, y))) mask |= 8;
        expect(tile).toBe(TileId.Water + mask);
      }
    }
  });
});

describe("refreshShorelines", () => {
  it("水に接した草地は砂浜になり、離れた砂浜は草地に戻る", () => {
    const map = new CityMap(7, 7);
    map.set(3, 3, TileId.Water);
    map.set(1, 1, TileId.Sand); // 水から離れた砂浜

    refreshShorelines(map);

    expect(map.get(3, 2)).toBe(TileId.Sand);
    expect(map.get(2, 3)).toBe(TileId.Sand);
    expect(map.get(4, 3)).toBe(TileId.Sand);
    expect(map.get(3, 4)).toBe(TileId.Sand);
    expect(map.get(1, 1)).toBe(TileId.Grass);
  });

  it("マップの外は水として扱うため、外周は砂浜になる", () => {
    const map = new CityMap(7, 7);
    refreshShorelines(map);
    expect(map.get(0, 3)).toBe(TileId.Sand);
    expect(map.get(6, 3)).toBe(TileId.Sand);
    expect(map.get(3, 0)).toBe(TileId.Sand);
    expect(map.get(3, 3)).toBe(TileId.Grass);
  });

  it("四方を陸に囲まれた水面は全方向のマスクを持つ", () => {
    const map = new CityMap(5, 5);
    map.set(2, 2, TileId.Water);
    refreshShorelines(map);
    expect(map.get(2, 2)).toBe(TileId.Water + 15);
  });

  it("道路や建物は書き換えない", () => {
    const map = new CityMap(5, 5);
    map.set(2, 2, TileId.Water);
    map.set(2, 1, TileId.Road + 5);
    refreshShorelines(map);
    expect(map.get(2, 1)).toBe(TileId.Road + 5);
  });
});
