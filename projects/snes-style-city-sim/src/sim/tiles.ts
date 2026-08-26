/**
 * マップに置かれるタイルのID体系と、その分類を判定するヘルパー。
 *
 * タイルIDは「見た目」と「意味」を兼ねる。道路・線路・送電線は接続方向を表す16通りの
 * バリエーションを連番で持ち、建物は `BUILDING_TILE_BASE` 以降に建物ごとの連番で割り当てる。
 * @packageDocumentation
 */

/** タイル1枚の大きさ（ドット）。 */
export const TILE_SIZE = 16;

/** マップ上のタイル座標。 */
export interface TilePos {
  /** タイルX座標。 */
  x: number;
  /** タイルY座標。 */
  y: number;
}

/** 森のバリエーション数。 */
export const FOREST_VARIANTS = 4;

/** 炎アニメーションのコマ数。 */
export const FIRE_FRAMES = 4;

/** 洪水アニメーションのコマ数。 */
export const FLOOD_FRAMES = 4;

/** 建物タイルに割り当てるIDの開始位置。ここから先は建物レジストリが管理する。 */
export const BUILDING_TILE_BASE = 128;

/**
 * タイルIDの基準値。接続バリエーションを持つものは、この値に
 * `Direction` のビットマスク（北1・東2・南4・西8）を足した値になる。
 */
export const TileId = {
  /** 更地。何でも建てられる。 */
  Dirt: 0,
  /** 瓦礫。取り壊し跡や被災跡で、更地にするには再度ならす必要がある。 */
  Rubble: 1,
  /** 砂浜。水辺に自動でできる。 */
  Sand: 2,
  /** 草地。開発されていない土地。 */
  Grass: 3,
  /** 森（`FOREST_VARIANTS` 種）。 */
  Forest: 4,
  /** 水面（隣接する陸地の向きで16種）。 */
  Water: 8,
  /** 燃えている土地（`FIRE_FRAMES` コマ）。 */
  Fire: 24,
  /** 浸水した土地（`FLOOD_FRAMES` コマ）。 */
  Flood: 28,
  /** 道路（接続16種）。 */
  Road: 32,
  /** 線路（接続16種）。 */
  Rail: 48,
  /** 送電線（接続16種）。 */
  Wire: 64,
  /** 踏切。+0が縦道路×横線路、+1が横道路×縦線路。 */
  RoadRail: 80,
  /** 道路と送電線の交差。+0が縦道路、+1が横道路。 */
  RoadWire: 82,
  /** 線路と送電線の交差。+0が縦線路、+1が横線路。 */
  RailWire: 84,
  /** 道路の橋。+0が縦、+1が横。 */
  RoadBridge: 86,
  /** 線路の橋。+0が縦、+1が横。 */
  RailBridge: 88,
  /** 送電線の水上鉄塔。+0が縦、+1が横。 */
  WireBridge: 90,
} as const;

/** 接続方向のビットマスク。 */
export const Direction = {
  /** 北（上）。 */
  north: 1,
  /** 東（右）。 */
  east: 2,
  /** 南（下）。 */
  south: 4,
  /** 西（左）。 */
  west: 8,
} as const;

/** 隣接4方向の座標差。`Direction` のビット順に対応する。 */
export const NEIGHBORS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * タイルIDが指定した基準値のバリエーション範囲に入るかを判定する。
 * @param tile 判定するタイルID。
 * @param base 基準値。
 * @param count バリエーション数。
 */
function inRange(tile: number, base: number, count: number): boolean {
  return tile >= base && tile < base + count;
}

/**
 * 水面かどうか。
 * @param tile 判定するタイルID。
 */
export function isWater(tile: number): boolean {
  return inRange(tile, TileId.Water, 16);
}

/**
 * 森かどうか。
 * @param tile 判定するタイルID。
 */
export function isForest(tile: number): boolean {
  return inRange(tile, TileId.Forest, FOREST_VARIANTS);
}

/**
 * 燃えている最中かどうか。
 * @param tile 判定するタイルID。
 */
export function isFire(tile: number): boolean {
  return inRange(tile, TileId.Fire, FIRE_FRAMES);
}

/**
 * 浸水中かどうか。
 * @param tile 判定するタイルID。
 */
export function isFlood(tile: number): boolean {
  return inRange(tile, TileId.Flood, FLOOD_FRAMES);
}

/**
 * 建物の一部かどうか。
 * @param tile 判定するタイルID。
 */
export function isBuilding(tile: number): boolean {
  return tile >= BUILDING_TILE_BASE;
}

/**
 * 車が通れる道路系のタイルかどうか（橋・踏切・送電線との交差を含む）。
 * @param tile 判定するタイルID。
 */
export function isRoad(tile: number): boolean {
  return (
    inRange(tile, TileId.Road, 16) ||
    inRange(tile, TileId.RoadRail, 2) ||
    inRange(tile, TileId.RoadWire, 2) ||
    inRange(tile, TileId.RoadBridge, 2)
  );
}

/**
 * 列車が通れる線路系のタイルかどうか。
 * @param tile 判定するタイルID。
 */
export function isRail(tile: number): boolean {
  return (
    inRange(tile, TileId.Rail, 16) ||
    inRange(tile, TileId.RoadRail, 2) ||
    inRange(tile, TileId.RailWire, 2) ||
    inRange(tile, TileId.RailBridge, 2)
  );
}

/**
 * 送電線そのものかどうか。
 * @param tile 判定するタイルID。
 */
export function isWire(tile: number): boolean {
  return (
    inRange(tile, TileId.Wire, 16) ||
    inRange(tile, TileId.RoadWire, 2) ||
    inRange(tile, TileId.RailWire, 2) ||
    inRange(tile, TileId.WireBridge, 2)
  );
}

/**
 * 電気を通すタイルかどうか。送電線のほか、建物同士も隣接していれば電気を通す。
 * @param tile 判定するタイルID。
 */
export function isConductive(tile: number): boolean {
  return isWire(tile) || isBuilding(tile);
}

/**
 * 火がつくタイルかどうか。
 * @param tile 判定するタイルID。
 */
export function isFlammable(tile: number): boolean {
  return isForest(tile) || isBuilding(tile);
}

/**
 * 何かを建てるために更地化できるタイルかどうか（水面は埋め立て不可）。
 * @param tile 判定するタイルID。
 */
export function isClearable(tile: number): boolean {
  return !isWater(tile) && !isFire(tile);
}

/**
 * 更地とみなせるかどうか。ここには建物や道路をそのまま置ける。
 * @param tile 判定するタイルID。
 */
export function isBuildable(tile: number): boolean {
  return tile === TileId.Dirt || tile === TileId.Grass || tile === TileId.Sand;
}

/**
 * 道路・線路・送電線タイルから、接続方向のビットマスクを取り出す。
 * 接続バリエーションを持たないタイルでは0を返す。
 * @param tile 判定するタイルID。
 */
export function connectionMask(tile: number): number {
  if (inRange(tile, TileId.Road, 16)) return tile - TileId.Road;
  if (inRange(tile, TileId.Rail, 16)) return tile - TileId.Rail;
  if (inRange(tile, TileId.Wire, 16)) return tile - TileId.Wire;
  return 0;
}
