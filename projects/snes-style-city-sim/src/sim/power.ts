/**
 * 電力網の走査。発電所から送電線と建物を伝って電気を配る。
 * @packageDocumentation
 */
import { buildingByKind } from "./buildings.js";
import { CityMap, TileFlag } from "./map.js";
import type { CityState } from "./state.js";
import { isBuilding, isConductive } from "./tiles.js";

/** 電力の需給の集計結果。 */
export interface PowerReport {
  /** 発電量の合計。 */
  supply: number;
  /** 必要な電力の合計。 */
  demand: number;
  /** 電気が届いた建物の数。 */
  powered: number;
  /** 電気が届かなかった建物の数。 */
  unpowered: number;
}

/**
 * 電力を配り直し、各タイルの通電フラグを更新する。
 *
 * 発電所から送電線・建物を伝ってたどり、発電量を使い切った時点で
 * その先へは電気が届かなくなる。
 * @param state 都市の状態。
 */
export function updatePower(state: CityState): PowerReport {
  const map = state.map;
  const size = map.width * map.height;

  for (let i = 0; i < size; i++) map.flags[i] &= ~TileFlag.powered;

  const report: PowerReport = { supply: 0, demand: 0, powered: 0, unpowered: 0 };
  const visited = new Uint8Array(size);
  const queue: number[] = [];

  // 発電所を探して起点にする。
  for (let i = 0; i < size; i++) {
    if ((map.flags[i] & TileFlag.origin) === 0) continue;
    const def = buildingByKind(map.buildingKind[i]);
    if (def.powerSupply <= 0) continue;
    report.supply += def.powerSupply;
    markBuilding(map, i % map.width, Math.floor(i / map.width), visited, queue, true);
  }

  let remaining = report.supply;

  while (queue.length > 0) {
    const index = queue.shift() as number;
    const x = index % map.width;
    const y = Math.floor(index / map.width);

    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = ny * map.width + nx;
      if (visited[ni]) continue;
      const tile = map.tiles[ni];
      if (!isConductive(tile)) continue;

      if (isBuilding(tile)) {
        const origin = map.originOf(nx, ny);
        const oi = map.index(origin.x, origin.y);
        if (visited[oi]) continue;
        const def = buildingByKind(map.buildingKind[oi]);
        report.demand += def.powerDemand;

        if (def.powerDemand > remaining) {
          // 電力が足りない。この建物には電気が届かず、その先へも進めない。
          visited[oi] = 1;
          report.unpowered++;
          continue;
        }
        remaining -= def.powerDemand;
        if (def.powerDemand > 0) report.powered++;
        markBuilding(map, origin.x, origin.y, visited, queue, true);
      } else {
        visited[ni] = 1;
        map.flags[ni] |= TileFlag.powered;
        queue.push(ni);
      }
    }
  }

  // 走査から漏れた建物（電力網につながっていない）も需要としては数える。
  for (let i = 0; i < size; i++) {
    if ((map.flags[i] & TileFlag.origin) === 0) continue;
    if (visited[i]) continue;
    const def = buildingByKind(map.buildingKind[i]);
    if (def.powerDemand <= 0) continue;
    report.demand += def.powerDemand;
    report.unpowered++;
  }

  return report;
}

/**
 * 建物の全タイルを訪問済みにし、必要なら通電フラグを立てて探索の続きに積む。
 * @param map 対象のマップ。
 * @param x 建物の左上のタイルX座標。
 * @param y 建物の左上のタイルY座標。
 * @param visited 訪問済みの記録。
 * @param queue 探索の待ち行列。
 * @param powered 通電フラグを立てるか。
 */
function markBuilding(
  map: CityMap,
  x: number,
  y: number,
  visited: Uint8Array,
  queue: number[],
  powered: boolean,
): void {
  const def = buildingByKind(map.buildingKind[map.index(x, y)]);
  for (let dy = 0; dy < def.height; dy++) {
    for (let dx = 0; dx < def.width; dx++) {
      if (!map.inBounds(x + dx, y + dy)) continue;
      const i = map.index(x + dx, y + dy);
      visited[i] = 1;
      if (powered) map.flags[i] |= TileFlag.powered;
      queue.push(i);
    }
  }
}
