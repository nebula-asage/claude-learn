/**
 * シード付きの擬似乱数生成器。
 *
 * シミュレーションの再現性（同じシードから同じ都市・同じ災害発生）を保証するため、
 * このプロジェクトでは `Math.random` を使わず、必ずこのRNGを経由する。
 * @packageDocumentation
 */

/** シード付き擬似乱数生成器。状態を持つため、セーブデータに含めて復元できる。 */
export class Rng {
  private state: number;

  /**
   * @param seed 初期シード。同じ値からは常に同じ乱数列が得られる。
   */
  constructor(seed: number) {
    // 0 は mulberry32 の状態として縮退しやすいため、必ず非0に正規化する。
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** 現在の内部状態を返す。セーブデータへの書き出し用。 */
  getState(): number {
    return this.state;
  }

  /**
   * 内部状態を復元する。セーブデータからの読み込み用。
   * @param state `getState` が返した内部状態。
   */
  setState(state: number): void {
    this.state = state >>> 0;
  }

  /** 0以上1未満の浮動小数を返す。 */
  next(): number {
    // mulberry32
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * `min` 以上 `max` 以下の整数を返す。
   * @param min 下限（この値を含む）。
   * @param max 上限（この値を含む）。
   */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * 確率 `probability` で `true` を返す。
   * @param probability 0〜1の発生確率。
   */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * 配列から要素をひとつ選ぶ。空配列を渡してはならない。
   * @param items 選択対象の配列。
   */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }
}
