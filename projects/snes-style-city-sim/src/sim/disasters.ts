/**
 * 災害。火災・洪水・竜巻・地震・炉心融解・怪獣を扱う。
 *
 * 火と水は「タイルそのものが災害の状態になる」方式、竜巻と怪獣は
 * 地図上を動き回る実体として扱う。
 * @packageDocumentation
 */
import { demolishBuilding, refreshNetworkAround } from "./build.js";
import { buildingByKind } from "./buildings.js";
import { TileFlag } from "./map.js";
import type { CityState } from "./state.js";
import {
  FIRE_FRAMES,
  FLOOD_FRAMES,
  NEIGHBORS,
  TileId,
  isBuilding,
  isFire,
  isFlammable,
  isFlood,
  isWater,
  type TilePos,
} from "./tiles.js";

/** 災害の種類。 */
export const DisasterKind = {
  /** 火災。 */
  fire: "fire",
  /** 洪水。 */
  flood: "flood",
  /** 竜巻。 */
  tornado: "tornado",
  /** 地震。 */
  earthquake: "earthquake",
  /** 原子力発電所の炉心融解。 */
  meltdown: "meltdown",
  /** 怪獣。 */
  monster: "monster",
} as const;

/** 災害の種類を表す型。 */
export type DisasterKindValue = (typeof DisasterKind)[keyof typeof DisasterKind];

/** 災害の表示名。 */
export const DISASTER_NAMES: Readonly<Record<DisasterKindValue, string>> = {
  fire: "火災",
  flood: "洪水",
  tornado: "竜巻",
  earthquake: "地震",
  meltdown: "炉心融解",
  monster: "怪獣",
};

/** 地図の上を動き回る災害の実体。 */
export interface DisasterEntity {
  /** 竜巻か怪獣か。 */
  kind: "tornado" | "monster";
  /** タイル単位のX座標（小数）。 */
  x: number;
  /** タイル単位のY座標（小数）。 */
  y: number;
  /** 1tickあたりのX方向の移動量。 */
  vx: number;
  /** 1tickあたりのY方向の移動量。 */
  vy: number;
  /** 消えるまでの残りtick数。 */
  ticksLeft: number;
}

/** 火災が自然に消える確率（消防の管轄が無い場合）。 */
const BASE_EXTINGUISH_CHANCE = 0.05;

/** 火災が隣へ燃え移る確率。延焼より鎮火のほうが起きやすくしておかないと、街全体が焼ける。 */
const SPREAD_CHANCE = 0.04;

/** 浸水が引くまでのtick数。 */
const FLOOD_DURATION = 40;

/** 災害の進行を受け持つ。 */
export class DisasterSystem {
  private readonly state: CityState;
  /** 燃えているタイルの添字。 */
  private readonly fires = new Set<number>();
  /** 浸水しているタイルの添字と、引くまでの残りtick数。 */
  private readonly floods = new Map<number, number>();

  /**
   * @param state 対象の都市の状態。
   */
  constructor(state: CityState) {
    this.state = state;
  }

  /** 燃えているタイルの数。 */
  get burningCount(): number {
    return this.fires.size;
  }

  /**
   * 1マスに火をつける。燃えないタイルなら何も起きない。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  ignite(x: number, y: number): boolean {
    const map = this.state.map;
    if (!map.inBounds(x, y)) return false;
    const tile = map.get(x, y);
    if (!isFlammable(tile)) return false;

    if (isBuilding(tile)) {
      // 建物は構造ごと失われて瓦礫になり、火がついたマスだけが燃え続ける。
      // 建物の全タイルを火にすると、大きな建物ほど火元が増えて街ごと燃えてしまう。
      demolishBuilding(map, x, y);
      this.setFire(x, y);
      return true;
    }

    this.setFire(x, y);
    return true;
  }

  /**
   * 指定したマスを燃焼中の状態にする。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  private setFire(x: number, y: number): void {
    const map = this.state.map;
    if (!map.inBounds(x, y)) return;
    const index = map.index(x, y);
    map.clearTile(x, y, TileId.Fire + (index % FIRE_FRAMES));
    map.setFlag(x, y, TileFlag.burning);
    this.fires.add(index);
    refreshNetworkAround(map, x, y);
  }

  /**
   * 指定したマスを浸水させる。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  private setFlood(x: number, y: number): void {
    const map = this.state.map;
    if (!map.inBounds(x, y)) return;
    const tile = map.get(x, y);
    if (isWater(tile) || isFlood(tile)) return;
    if (isBuilding(tile)) demolishBuilding(map, x, y);
    const index = map.index(x, y);
    map.clearTile(x, y, TileId.Flood + (index % FLOOD_FRAMES));
    this.floods.set(index, FLOOD_DURATION);
    this.fires.delete(index);
    refreshNetworkAround(map, x, y);
  }

  /**
   * 1マスを破壊して瓦礫にする。竜巻・怪獣・地震が使う。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  private destroy(x: number, y: number): void {
    const map = this.state.map;
    if (!map.inBounds(x, y)) return;
    const tile = map.get(x, y);
    if (isWater(tile) || isFire(tile)) return;
    if (isBuilding(tile)) {
      demolishBuilding(map, x, y);
      return;
    }
    if (tile === TileId.Dirt || tile === TileId.Rubble) return;
    map.clearTile(x, y, TileId.Rubble);
    refreshNetworkAround(map, x, y);
  }

  /**
   * 災害を1つ起こす。起こせた場合は説明の文章を返す。
   * @param kind 起こす災害の種類。
   */
  trigger(kind: DisasterKindValue): string | null {
    switch (kind) {
      case DisasterKind.fire:
        return this.startFire();
      case DisasterKind.flood:
        return this.startFlood();
      case DisasterKind.tornado:
        return this.spawnEntity("tornado");
      case DisasterKind.monster:
        return this.spawnEntity("monster");
      case DisasterKind.earthquake:
        return this.startEarthquake();
      case DisasterKind.meltdown:
        return this.startMeltdown();
    }
  }

  /** 燃えるものを1つ探して火をつける。 */
  private startFire(): string | null {
    const map = this.state.map;
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = this.state.rng.int(0, map.width - 1);
      const y = this.state.rng.int(0, map.height - 1);
      if (this.ignite(x, y)) return "火事です! 消防署の手当てを!";
    }
    return null;
  }

  /** 水辺から浸水を始める。 */
  private startFlood(): string | null {
    const map = this.state.map;
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = this.state.rng.int(0, map.width - 1);
      const y = this.state.rng.int(0, map.height - 1);
      if (!isWater(map.get(x, y))) continue;
      let flooded = false;
      for (const [dx, dy] of NEIGHBORS) {
        if (isWater(map.get(x + dx, y + dy))) continue;
        this.setFlood(x + dx, y + dy);
        flooded = true;
      }
      if (flooded) return "川が氾濫しました! 浸水に注意してください。";
    }
    return null;
  }

  /**
   * 竜巻や怪獣を出現させる。
   * @param kind 出現させる実体の種類。
   */
  private spawnEntity(kind: "tornado" | "monster"): string {
    const map = this.state.map;
    const rng = this.state.rng;
    const angle = rng.next() * Math.PI * 2;
    const speed = kind === "tornado" ? 0.35 : 0.18;

    this.state.entities.push({
      kind,
      x: rng.int(0, map.width - 1),
      y: rng.int(0, map.height - 1),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ticksLeft: kind === "tornado" ? 160 : 260,
    });

    return kind === "tornado"
      ? "竜巻が発生しました! 進路上の建物が危険です。"
      : "怪獣が現れました! 公害がひどい街には近づいてくるようです。";
  }

  /** 地震を起こす。広い範囲がまとめて壊れ、あちこちから出火する。 */
  private startEarthquake(): string {
    const map = this.state.map;
    const rng = this.state.rng;
    const damage = Math.round((map.width * map.height) / 90);

    for (let i = 0; i < damage; i++) {
      const x = rng.int(0, map.width - 1);
      const y = rng.int(0, map.height - 1);
      this.destroy(x, y);
      if (rng.chance(0.12)) this.ignite(x, y);
    }
    return "地震です! 建物が倒壊し、各地で火災が発生しています。";
  }

  /** 原子力発電所の炉心融解を起こす。発電所が無ければ何も起きない。 */
  private startMeltdown(): string | null {
    const map = this.state.map;
    for (let i = 0; i < map.tiles.length; i++) {
      if ((map.flags[i] & TileFlag.origin) === 0) continue;
      if (buildingByKind(map.buildingKind[i]).id !== "nuclear-plant") continue;

      const x = i % map.width;
      const y = Math.floor(i / map.width);
      demolishBuilding(map, x, y);
      // 発電所を中心に、広い範囲が焼ける。
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          if (Math.hypot(dx, dy) > 5) continue;
          this.destroy(x + dx, y + dy);
          if (this.state.rng.chance(0.35)) this.ignite(x + dx, y + dy);
        }
      }
      return "原子力発電所で炉心融解が起きました! 周辺は壊滅です。";
    }
    return null;
  }

  /** 1tick分の災害の進行。 */
  tick(): void {
    this.updateFires();
    this.updateFloods();
    this.updateEntities();
  }

  /** 火災の延焼・鎮火を進める。 */
  private updateFires(): void {
    const { map, fields, rng } = this.state;
    for (const index of Array.from(this.fires)) {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      if (!isFire(map.tiles[index])) {
        this.fires.delete(index);
        continue;
      }

      // 消防の管轄が厚いほど早く消し止められる。
      const coverage = fields.at(fields.fireCoverage, x, y) / 255;
      if (rng.chance(BASE_EXTINGUISH_CHANCE + coverage * 0.3)) {
        map.clearTile(x, y, TileId.Rubble);
        this.fires.delete(index);
        refreshNetworkAround(map, x, y);
        continue;
      }

      if (rng.chance(SPREAD_CHANCE)) {
        const [dx, dy] = rng.pick(NEIGHBORS);
        this.ignite(x + dx, y + dy);
      }
    }
  }

  /** 浸水を進め、時間が経ったら水を引かせる。 */
  private updateFloods(): void {
    const { map, rng } = this.state;
    for (const [index, remaining] of Array.from(this.floods)) {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      if (!isFlood(map.tiles[index])) {
        this.floods.delete(index);
        continue;
      }

      if (remaining <= 0) {
        map.clearTile(x, y, TileId.Rubble);
        this.floods.delete(index);
        refreshNetworkAround(map, x, y);
        continue;
      }
      this.floods.set(index, remaining - 1);

      // 引き始めるまでは、じわじわと広がる。
      if (remaining > FLOOD_DURATION / 2 && rng.chance(0.06)) {
        const [dx, dy] = rng.pick(NEIGHBORS);
        this.setFlood(x + dx, y + dy);
      }
    }
  }

  /** 竜巻と怪獣を動かす。 */
  private updateEntities(): void {
    const { map, rng, entities } = this.state;

    for (let i = entities.length - 1; i >= 0; i--) {
      const entity = entities[i];
      entity.ticksLeft--;
      if (entity.ticksLeft <= 0) {
        entities.splice(i, 1);
        continue;
      }

      // 竜巻は気まぐれに、怪獣は公害の濃い方へ進む。
      if (entity.kind === "tornado") {
        entity.vx += (rng.next() - 0.5) * 0.1;
        entity.vy += (rng.next() - 0.5) * 0.1;
      } else {
        const target = this.smellPollution(entity.x, entity.y);
        entity.vx += (target.x - entity.x) * 0.002 + (rng.next() - 0.5) * 0.04;
        entity.vy += (target.y - entity.y) * 0.002 + (rng.next() - 0.5) * 0.04;
      }
      const speed = Math.hypot(entity.vx, entity.vy) || 1;
      const limit = entity.kind === "tornado" ? 0.35 : 0.18;
      entity.vx = (entity.vx / speed) * limit;
      entity.vy = (entity.vy / speed) * limit;

      entity.x += entity.vx;
      entity.y += entity.vy;

      // 端に着いたら跳ね返す。
      if (entity.x < 0 || entity.x > map.width - 1) entity.vx = -entity.vx;
      if (entity.y < 0 || entity.y > map.height - 1) entity.vy = -entity.vy;
      entity.x = Math.max(0, Math.min(map.width - 1, entity.x));
      entity.y = Math.max(0, Math.min(map.height - 1, entity.y));

      const tx = Math.round(entity.x);
      const ty = Math.round(entity.y);
      const radius = entity.kind === "tornado" ? 1 : 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          this.destroy(tx + dx, ty + dy);
        }
      }
      if (entity.kind === "monster" && rng.chance(0.25)) this.ignite(tx, ty);
    }
  }

  /**
   * 周囲でいちばん公害の濃い場所を探す。怪獣の進行方向に使う。
   * @param x 現在のタイルX座標。
   * @param y 現在のタイルY座標。
   */
  private smellPollution(x: number, y: number): TilePos {
    const { fields, map } = this.state;
    let bestX = map.width / 2;
    let bestY = map.height / 2;
    let best = -1;
    for (let fy = 0; fy < fields.height; fy++) {
      for (let fx = 0; fx < fields.width; fx++) {
        const value = fields.pollution[fy * fields.width + fx];
        const distance = Math.hypot((fx << 1) - x, (fy << 1) - y) + 1;
        const score = value / distance;
        if (score > best) {
          best = score;
          bestX = fx << 1;
          bestY = fy << 1;
        }
      }
    }
    return { x: bestX, y: bestY };
  }
}
