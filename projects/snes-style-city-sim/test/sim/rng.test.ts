import { describe, expect, it } from "vitest";
import { Rng } from "../../src/sim/rng.js";

describe("Rng", () => {
  it("同じシードからは同じ乱数列を返す", () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("異なるシードからは異なる乱数列を返す", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("next は 0以上1未満に収まる", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int は指定した範囲の整数を返す", () => {
    const rng = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it("状態を保存して復元すると続きの乱数列が一致する", () => {
    const rng = new Rng(2024);
    for (let i = 0; i < 5; i++) rng.next();
    const saved = rng.getState();
    const expected = Array.from({ length: 5 }, () => rng.next());

    const restored = new Rng(0);
    restored.setState(saved);
    expect(Array.from({ length: 5 }, () => restored.next())).toEqual(expected);
  });

  it("シード0でも縮退せず乱数列を生成する", () => {
    const rng = new Rng(0);
    const values = new Set(Array.from({ length: 10 }, () => rng.next()));
    expect(values.size).toBe(10);
  });

  it("chance(0) は常にfalse、chance(1) は常にtrue", () => {
    const rng = new Rng(5);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it("pick は配列の要素を返す", () => {
    const rng = new Rng(42);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });
});
