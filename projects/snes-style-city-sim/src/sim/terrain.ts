/**
 * 地形の自動生成。同じシードからは必ず同じ地形ができる。
 *
 * 川は「太さを持つ筆でランダムウォークする」方式、湖と森は円形の塊を散らす方式で作る。
 * 生成後に `refreshShorelines` を呼ぶと、水辺のタイルが周囲の陸地に合わせた見た目に整う。
 * @packageDocumentation
 */
import { CityMap, MAP_HEIGHT, MAP_WIDTH } from "./map.js";
import type { Rng } from "./rng.js";
import { FOREST_VARIANTS, TileId, isWater } from "./tiles.js";

/** 地形生成のパラメータ。 */
export interface TerrainOptions {
  /** マップの横幅（タイル数）。 */
  width: number;
  /** マップの高さ（タイル数）。 */
  height: number;
  /** 生成する川の本数。 */
  rivers: number;
  /** 生成する湖の数。 */
  lakes: number;
  /** 生成する森の塊の数。 */
  forests: number;
}

/** 標準的な地形生成のパラメータ。 */
export const DEFAULT_TERRAIN_OPTIONS: TerrainOptions = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  rivers: 2,
  lakes: 5,
  forests: 26,
};

/**
 * 円形にタイルを塗る。
 * @param map 対象のマップ。
 * @param cx 中心のX座標。
 * @param cy 中心のY座標。
 * @param radius 半径（タイル）。
 * @param tile 塗るタイルID。
 */
function paintDisc(map: CityMap, cx: number, cy: number, radius: number, tile: number): void {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) map.set(x, y, tile);
    }
  }
}

/**
 * 太さを持つ筆でランダムウォークし、川を1本描く。
 * @param map 対象のマップ。
 * @param rng 乱数生成器。
 * @param startX 始点のX座標。
 * @param startY 始点のY座標。
 * @param dirX 進む向き（X成分）。
 * @param dirY 進む向き（Y成分）。
 */
function carveRiver(
  map: CityMap,
  rng: Rng,
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
): void {
  let x = startX;
  let y = startY;
  let vx = dirX;
  let vy = dirY;
  let radius = rng.next() * 1.8 + 2.2;
  const maxSteps = (map.width + map.height) * 2;

  for (let step = 0; step < maxSteps; step++) {
    paintDisc(map, x, y, radius, TileId.Water);

    // 進行方向を少しずつ揺らして蛇行させる。元の向きへ引き戻す力も掛けて、
    // マップ内を往復せずに向こう岸まで抜けるようにする。
    vx += (rng.next() - 0.5) * 0.9 + (dirX - vx) * 0.05;
    vy += (rng.next() - 0.5) * 0.9 + (dirY - vy) * 0.05;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len;
    vy /= len;

    x += vx;
    y += vy;
    radius = Math.max(1.6, Math.min(4.5, radius + (rng.next() - 0.5) * 0.5));

    if (x < -6 || y < -6 || x > map.width + 6 || y > map.height + 6) break;
  }
}

/**
 * 地形を新規に生成する。
 * @param rng 乱数生成器。
 * @param options 生成パラメータ。省略時は `DEFAULT_TERRAIN_OPTIONS`。
 */
export function generateTerrain(rng: Rng, options: Partial<TerrainOptions> = {}): CityMap {
  const opts = { ...DEFAULT_TERRAIN_OPTIONS, ...options };
  const map = new CityMap(opts.width, opts.height);
  map.tiles.fill(TileId.Grass);

  for (let i = 0; i < opts.rivers; i++) {
    // 川は必ずマップの端から入ってくる。横断か縦断かを半々で選ぶ。
    if (rng.chance(0.5)) {
      const y = rng.int(Math.floor(map.height * 0.15), Math.floor(map.height * 0.85));
      const fromLeft = rng.chance(0.5);
      carveRiver(map, rng, fromLeft ? 0 : map.width - 1, y, fromLeft ? 1 : -1, 0);
    } else {
      const x = rng.int(Math.floor(map.width * 0.15), Math.floor(map.width * 0.85));
      const fromTop = rng.chance(0.5);
      carveRiver(map, rng, x, fromTop ? 0 : map.height - 1, 0, fromTop ? 1 : -1);
    }
  }

  for (let i = 0; i < opts.lakes; i++) {
    const cx = rng.int(4, map.width - 5);
    const cy = rng.int(4, map.height - 5);
    const blobs = rng.int(2, 5);
    for (let b = 0; b < blobs; b++) {
      paintDisc(map, cx + rng.int(-4, 4), cy + rng.int(-4, 4), rng.next() * 3 + 2, TileId.Water);
    }
  }

  for (let i = 0; i < opts.forests; i++) {
    const cx = rng.int(0, map.width - 1);
    const cy = rng.int(0, map.height - 1);
    const blobs = rng.int(2, 6);
    for (let b = 0; b < blobs; b++) {
      const bx = cx + rng.int(-5, 5);
      const by = cy + rng.int(-5, 5);
      const radius = rng.next() * 2.5 + 1.2;
      const r2 = radius * radius;
      for (let y = Math.floor(by - radius); y <= Math.ceil(by + radius); y++) {
        for (let x = Math.floor(bx - radius); x <= Math.ceil(bx + radius); x++) {
          const dx = x - bx;
          const dy = y - by;
          if (dx * dx + dy * dy > r2) continue;
          if (map.get(x, y) !== TileId.Grass) continue;
          map.set(x, y, TileId.Forest + rng.int(0, FOREST_VARIANTS - 1));
        }
      }
    }
  }

  refreshShorelines(map);
  return map;
}

/**
 * 水辺の見た目を整える。水面タイルは隣接する陸地の向きに応じた種類に、
 * 水に面した草地は砂浜に置き換える。
 * @param map 対象のマップ。
 */
export function refreshShorelines(map: CityMap): void {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.get(x, y);
      if (isWater(tile)) {
        let mask = 0;
        if (!isWater(map.get(x, y - 1))) mask |= 1;
        if (!isWater(map.get(x + 1, y))) mask |= 2;
        if (!isWater(map.get(x, y + 1))) mask |= 4;
        if (!isWater(map.get(x - 1, y))) mask |= 8;
        map.set(x, y, TileId.Water + mask);
      } else if (tile === TileId.Grass || tile === TileId.Sand) {
        const nearWater =
          isWater(map.get(x, y - 1)) ||
          isWater(map.get(x + 1, y)) ||
          isWater(map.get(x, y + 1)) ||
          isWater(map.get(x - 1, y));
        map.set(x, y, nearWater ? TileId.Sand : TileId.Grass);
      }
    }
  }
}
