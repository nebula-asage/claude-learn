import { describe, expect, it } from "vitest";
import { CityMap, MAP_HEIGHT, MAP_WIDTH, TileFlag } from "../../src/sim/map.js";
import { TileId } from "../../src/sim/tiles.js";

describe("CityMap", () => {
  it("既定の大きさで作られ、初期状態は草地", () => {
    const map = new CityMap();
    expect(map.width).toBe(MAP_WIDTH);
    expect(map.height).toBe(MAP_HEIGHT);
    expect(map.get(0, 0)).toBe(TileId.Grass);
    expect(map.get(MAP_WIDTH - 1, MAP_HEIGHT - 1)).toBe(TileId.Grass);
  });

  it("範囲外の読み出しは水面として扱う", () => {
    const map = new CityMap(10, 10);
    expect(map.inBounds(-1, 0)).toBe(false);
    expect(map.inBounds(0, 10)).toBe(false);
    expect(map.get(-1, 5)).toBe(TileId.Water);
    expect(map.get(10, 5)).toBe(TileId.Water);
  });

  it("範囲外への書き込みは無視される", () => {
    const map = new CityMap(4, 4);
    map.set(-1, 0, TileId.Road);
    map.set(4, 0, TileId.Road);
    expect(map.tiles.every((t) => t === TileId.Grass)).toBe(true);
  });

  it("フラグを立てたり下ろしたりできる", () => {
    const map = new CityMap(8, 8);
    expect(map.hasFlag(2, 3, TileFlag.powered)).toBe(false);
    map.setFlag(2, 3, TileFlag.powered);
    map.setFlag(2, 3, TileFlag.building);
    expect(map.hasFlag(2, 3, TileFlag.powered)).toBe(true);
    expect(map.hasFlag(2, 3, TileFlag.building)).toBe(true);
    map.clearFlag(2, 3, TileFlag.powered);
    expect(map.hasFlag(2, 3, TileFlag.powered)).toBe(false);
    expect(map.hasFlag(2, 3, TileFlag.building)).toBe(true);
  });

  it("建物の一部からは代表タイルの座標を辿れる", () => {
    const map = new CityMap(16, 16);
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        map.setOriginOffset(5 + dx, 7 + dy, dx, dy);
      }
    }
    expect(map.originOf(5, 7)).toEqual({ x: 5, y: 7 });
    expect(map.originOf(7, 9)).toEqual({ x: 5, y: 7 });
    expect(map.originOf(6, 8)).toEqual({ x: 5, y: 7 });
  });

  it("clearTile はタイルと付随情報をまとめて消す", () => {
    const map = new CityMap(8, 8);
    map.set(1, 1, TileId.Road + 5);
    map.setFlag(1, 1, TileFlag.powered | TileFlag.building);
    map.setOriginOffset(1, 1, 1, 2);
    map.buildingKind[map.index(1, 1)] = 9;

    map.clearTile(1, 1);

    expect(map.get(1, 1)).toBe(TileId.Dirt);
    expect(map.flags[map.index(1, 1)]).toBe(0);
    expect(map.originOf(1, 1)).toEqual({ x: 1, y: 1 });
    expect(map.buildingKind[map.index(1, 1)]).toBe(0);
  });
});
