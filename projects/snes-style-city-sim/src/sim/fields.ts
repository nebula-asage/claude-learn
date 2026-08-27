/**
 * 都市に重なる各種の「面」データ（人口密度・地価・公害・犯罪・交通量・管轄）。
 *
 * タイル単位で持つと重いうえに細かすぎるので、2x2タイルを1マスとする
 * 半分の解像度で保持する。値はすべて0〜255。
 * @packageDocumentation
 */
import { buildingByKind } from "./buildings.js";
import { CityMap, TileFlag } from "./map.js";
import type { CityState } from "./state.js";
import { type TilePos, isRoad, isWater } from "./tiles.js";

/** 面データの解像度。1なら2x2タイルで1マス。 */
export const FIELD_SHIFT = 1;

/** 面データの1マスが対応するタイル数。 */
export const FIELD_SCALE = 1 << FIELD_SHIFT;

/** 各種の面データをまとめて持つ。 */
export class CityFields {
  /** 面データの横幅。 */
  readonly width: number;
  /** 面データの高さ。 */
  readonly height: number;
  /** 人口密度。 */
  readonly populationDensity: Uint8Array;
  /** 地価。 */
  readonly landValue: Uint8Array;
  /** 公害。 */
  readonly pollution: Uint8Array;
  /** 犯罪発生度。 */
  readonly crime: Uint8Array;
  /** 交通量。 */
  readonly traffic: Uint8Array;
  /** 警察の管轄の厚み。 */
  readonly policeCoverage: Uint8Array;
  /** 消防の管轄の厚み。 */
  readonly fireCoverage: Uint8Array;

  /**
   * @param mapWidth マップの横幅（タイル数）。
   * @param mapHeight マップの高さ（タイル数）。
   */
  constructor(mapWidth: number, mapHeight: number) {
    this.width = mapWidth >> FIELD_SHIFT;
    this.height = mapHeight >> FIELD_SHIFT;
    const size = this.width * this.height;
    this.populationDensity = new Uint8Array(size);
    this.landValue = new Uint8Array(size);
    this.pollution = new Uint8Array(size);
    this.crime = new Uint8Array(size);
    this.traffic = new Uint8Array(size);
    this.policeCoverage = new Uint8Array(size);
    this.fireCoverage = new Uint8Array(size);
  }

  /**
   * タイル座標に対応する面データの値を読む。
   * @param field 対象の面データ。
   * @param x タイルX座標。
   * @param y タイルY座標。
   */
  at(field: Uint8Array, x: number, y: number): number {
    const fx = x >> FIELD_SHIFT;
    const fy = y >> FIELD_SHIFT;
    if (fx < 0 || fy < 0 || fx >= this.width || fy >= this.height) return 0;
    return field[fy * this.width + fx];
  }

  /**
   * タイル座標に対応する面データへ値を足す（0〜255に収める）。
   * @param field 対象の面データ。
   * @param x タイルX座標。
   * @param y タイルY座標。
   * @param amount 足す量。
   */
  add(field: Uint8Array, x: number, y: number, amount: number): void {
    const fx = x >> FIELD_SHIFT;
    const fy = y >> FIELD_SHIFT;
    if (fx < 0 || fy < 0 || fx >= this.width || fy >= this.height) return;
    const i = fy * this.width + fx;
    field[i] = Math.max(0, Math.min(255, field[i] + amount));
  }
}

/**
 * 3x3の平均をとって面データをぼかす。公害や管轄の「広がり」を表現する。
 * @param field ぼかす面データ。
 * @param width 面データの横幅。
 * @param height 面データの高さ。
 * @param times 繰り返す回数。
 */
export function smoothField(
  field: Uint8Array,
  width: number,
  height: number,
  times: number = 1,
): void {
  const buffer = new Uint8Array(field.length);
  for (let pass = 0; pass < times; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            sum += field[ny * width + nx];
            count++;
          }
        }
        buffer[y * width + x] = Math.round(sum / count);
      }
    }
    field.set(buffer);
  }
}

/**
 * 建物の位置から一定範囲へ影響を配る（警察・消防の管轄の計算に使う）。
 * @param fields 面データ一式。
 * @param field 書き込む面データ。
 * @param x 建物のタイルX座標。
 * @param y 建物のタイルY座標。
 * @param radius 影響する半径（面データのマス数）。
 * @param strength 中心での強さ。
 */
function spread(
  fields: CityFields,
  field: Uint8Array,
  x: number,
  y: number,
  radius: number,
  strength: number,
): void {
  const cx = x >> FIELD_SHIFT;
  const cy = y >> FIELD_SHIFT;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const fx = cx + dx;
      const fy = cy + dy;
      if (fx < 0 || fy < 0 || fx >= fields.width || fy >= fields.height) continue;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const value = Math.round(strength * (1 - distance / radius));
      const i = fy * fields.width + fx;
      field[i] = Math.min(255, field[i] + value);
    }
  }
}

/**
 * 人が住んでいる場所だけを対象に、面データの平均を求める。開発が無ければ0。
 *
 * 市全体の平均だと、手つかずの土地に薄められて実感と合わない値になるため、
 * 「街の様子」を語るときはこちらを使う。
 * @param fields 面データ一式。
 * @param field 平均をとる面データ。
 */
export function averageWhereDeveloped(fields: CityFields, field: Uint8Array): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < field.length; i++) {
    if (fields.populationDensity[i] === 0) continue;
    sum += field[i];
    count++;
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * 都市の中心（開発が集中している場所）を求める。まだ何も無ければマップ中央。
 * @param map 対象のマップ。
 */
export function cityCenter(map: CityMap): TilePos {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      if ((map.flags[i] & TileFlag.origin) === 0) continue;
      const def = buildingByKind(map.buildingKind[i]);
      if (def.capacity <= 0) continue;
      sumX += x;
      sumY += y;
      count++;
    }
  }
  if (count === 0) return { x: map.width / 2, y: map.height / 2 };
  return { x: sumX / count, y: sumY / count };
}

/**
 * 公害・地価・犯罪・管轄を計算し直す。1か月に1回程度呼ぶ想定。
 * @param state 都市の状態。
 */
export function updateFields(state: CityState): void {
  const { map, fields } = state;
  fields.pollution.fill(0);
  fields.populationDensity.fill(0);
  fields.policeCoverage.fill(0);
  fields.fireCoverage.fill(0);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const tile = map.tiles[i];

      // 道路の交通量そのものが公害になる。
      if (isRoad(tile)) {
        fields.add(fields.pollution, x, y, Math.round(fields.at(fields.traffic, x, y) / 12));
        continue;
      }
      if ((map.flags[i] & TileFlag.origin) === 0) continue;

      const def = buildingByKind(map.buildingKind[i]);
      if (def.pollution > 0) fields.add(fields.pollution, x, y, def.pollution);
      if (def.capacity > 0) fields.add(fields.populationDensity, x, y, def.capacity);
      // 予算を切り詰めると、その分だけ手の届く範囲も薄くなる。
      if (def.id === "police-station") {
        spread(fields, fields.policeCoverage, x, y, 12, 200 * state.funding.police);
      }
      if (def.id === "fire-station") {
        spread(fields, fields.fireCoverage, x, y, 12, 200 * state.funding.fire);
      }
    }
  }

  // ぼかしすぎると公害が薄く広がってしまい、工業地帯の近さが効かなくなる。
  smoothField(fields.pollution, fields.width, fields.height, 1);
  smoothField(fields.populationDensity, fields.width, fields.height, 1);
  smoothField(fields.policeCoverage, fields.width, fields.height, 1);
  smoothField(fields.fireCoverage, fields.width, fields.height, 1);

  updateLandValue(state);
  updateCrime(state);
}

/**
 * 地価を計算し直す。中心に近く、水辺や公園が近く、公害と犯罪が少ないほど高い。
 * @param state 都市の状態。
 */
function updateLandValue(state: CityState): void {
  const { map, fields } = state;
  const center = cityCenter(map);
  const maxDistance = Math.hypot(map.width, map.height) / 2;

  for (let fy = 0; fy < fields.height; fy++) {
    for (let fx = 0; fx < fields.width; fx++) {
      const x = fx << FIELD_SHIFT;
      const y = fy << FIELD_SHIFT;
      const i = fy * fields.width + fx;

      const distance = Math.hypot(x - center.x, y - center.y);
      let value = 160 - (distance / maxDistance) * 120;

      // 水辺と緑は地価を押し上げる。
      let amenity = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const tile = map.get(x + dx, y + dy);
          if (isWater(tile)) amenity += 2;
        }
      }
      value += Math.min(40, amenity);
      value -= fields.pollution[i] / 2;
      value -= fields.crime[i] / 3;
      value -= Math.max(0, fields.traffic[i] - 128) / 4;

      fields.landValue[i] = Math.max(0, Math.min(255, Math.round(value)));
    }
  }
  smoothField(fields.landValue, fields.width, fields.height, 1);
}

/**
 * 犯罪発生度を計算し直す。人が多く地価が低く、警察の手が届かない場所ほど高い。
 * @param state 都市の状態。
 */
function updateCrime(state: CityState): void {
  const { fields } = state;
  for (let i = 0; i < fields.crime.length; i++) {
    const density = fields.populationDensity[i];
    if (density === 0) {
      fields.crime[i] = 0;
      continue;
    }
    // 人が多いほど、そして地価が低いほど犯罪が増える。人がいない場所では起きない。
    let crime = (density * (255 - fields.landValue[i])) / 255;
    crime -= fields.policeCoverage[i] / 2;
    fields.crime[i] = Math.max(0, Math.min(255, Math.round(crime)));
  }
  smoothField(fields.crime, fields.width, fields.height, 1);
}
