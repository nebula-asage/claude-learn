import { describe, expect, it } from "vitest";
import {
  BUILDING_TILE_BASE,
  TileId,
  connectionMask,
  isBuilding,
  isBuildable,
  isClearable,
  isConductive,
  isFire,
  isFlammable,
  isForest,
  isRail,
  isRoad,
  isWater,
  isWire,
} from "../../src/sim/tiles.js";

describe("タイルの分類", () => {
  it("水面は16通りのバリエーションすべてが水と判定される", () => {
    for (let mask = 0; mask < 16; mask++) {
      expect(isWater(TileId.Water + mask)).toBe(true);
    }
    expect(isWater(TileId.Grass)).toBe(false);
    expect(isWater(TileId.Water + 16)).toBe(false);
  });

  it("道路は接続16通りと橋・踏切・送電線との交差を含む", () => {
    for (let mask = 0; mask < 16; mask++) {
      expect(isRoad(TileId.Road + mask)).toBe(true);
    }
    expect(isRoad(TileId.RoadRail)).toBe(true);
    expect(isRoad(TileId.RoadWire + 1)).toBe(true);
    expect(isRoad(TileId.RoadBridge)).toBe(true);
    expect(isRoad(TileId.Rail)).toBe(false);
    expect(isRoad(TileId.Wire)).toBe(false);
  });

  it("踏切は道路でも線路でもある", () => {
    expect(isRoad(TileId.RoadRail)).toBe(true);
    expect(isRail(TileId.RoadRail)).toBe(true);
    expect(isWire(TileId.RoadRail)).toBe(false);
  });

  it("送電線との交差タイルは送電線として扱われる", () => {
    expect(isWire(TileId.RoadWire)).toBe(true);
    expect(isWire(TileId.RailWire + 1)).toBe(true);
    expect(isWire(TileId.WireBridge)).toBe(true);
    expect(isWire(TileId.Road)).toBe(false);
  });

  it("建物は基準値以降のIDすべて", () => {
    expect(isBuilding(BUILDING_TILE_BASE)).toBe(true);
    expect(isBuilding(BUILDING_TILE_BASE + 300)).toBe(true);
    expect(isBuilding(BUILDING_TILE_BASE - 1)).toBe(false);
  });

  it("電気を通すのは送電線と建物", () => {
    expect(isConductive(TileId.Wire + 5)).toBe(true);
    expect(isConductive(BUILDING_TILE_BASE + 1)).toBe(true);
    expect(isConductive(TileId.Road)).toBe(false);
    expect(isConductive(TileId.Grass)).toBe(false);
  });

  it("燃えるのは森と建物", () => {
    expect(isFlammable(TileId.Forest)).toBe(true);
    expect(isFlammable(BUILDING_TILE_BASE)).toBe(true);
    expect(isFlammable(TileId.Road)).toBe(false);
    expect(isFlammable(TileId.Water)).toBe(false);
  });

  it("水面と燃焼中は更地化できない", () => {
    expect(isClearable(TileId.Water + 3)).toBe(false);
    expect(isClearable(TileId.Fire + 1)).toBe(false);
    expect(isClearable(TileId.Forest)).toBe(true);
    expect(isClearable(BUILDING_TILE_BASE)).toBe(true);
  });

  it("そのまま建てられるのは更地・草地・砂浜", () => {
    expect(isBuildable(TileId.Dirt)).toBe(true);
    expect(isBuildable(TileId.Grass)).toBe(true);
    expect(isBuildable(TileId.Sand)).toBe(true);
    expect(isBuildable(TileId.Forest)).toBe(false);
    expect(isBuildable(TileId.Rubble)).toBe(false);
    expect(isBuildable(TileId.Water)).toBe(false);
  });

  it("炎はコマ送りの範囲だけが炎と判定される", () => {
    expect(isFire(TileId.Fire)).toBe(true);
    expect(isFire(TileId.Fire + 3)).toBe(true);
    expect(isFire(TileId.Fire + 4)).toBe(false);
  });

  it("森は4種類", () => {
    expect(isForest(TileId.Forest)).toBe(true);
    expect(isForest(TileId.Forest + 3)).toBe(true);
    expect(isForest(TileId.Forest + 4)).toBe(false);
  });

  it("接続マスクは基準値からの差分になる", () => {
    expect(connectionMask(TileId.Road + 5)).toBe(5);
    expect(connectionMask(TileId.Rail + 10)).toBe(10);
    expect(connectionMask(TileId.Wire + 15)).toBe(15);
    expect(connectionMask(TileId.Grass)).toBe(0);
    expect(connectionMask(TileId.RoadBridge)).toBe(0);
  });
});
