import { describe, expect, it } from "vitest";
import { SONGS } from "../../src/audio/music.js";
import { noteToFrequency } from "../../src/audio/notes.js";

describe("noteToFrequency", () => {
  it("A4は440Hz", () => {
    expect(noteToFrequency("A4")).toBeCloseTo(440, 6);
  });

  it("1オクターブ上がると周波数は2倍になる", () => {
    expect(noteToFrequency("A5")).toBeCloseTo(880, 6);
    expect(noteToFrequency("A3")).toBeCloseTo(220, 6);
  });

  it("半音の表記は#でもbでも同じ音になる", () => {
    expect(noteToFrequency("A#4")).toBeCloseTo(noteToFrequency("Bb4"), 6);
    expect(noteToFrequency("C#5")).toBeCloseTo(noteToFrequency("Db5"), 6);
  });

  it("中央のドはおよそ261.6Hz", () => {
    expect(noteToFrequency("C4")).toBeCloseTo(261.6256, 3);
  });

  it("音名として読めない文字列は受け付けない", () => {
    expect(() => noteToFrequency("H4")).toThrow();
    expect(() => noteToFrequency("C")).toThrow();
    expect(() => noteToFrequency("")).toThrow();
  });
});

describe("曲データ", () => {
  it("どの曲も、すべてのパートの長さがそろっている", () => {
    for (const song of Object.values(SONGS)) {
      for (const track of song.tracks) {
        expect(track.steps.length).toBe(song.drums.length);
      }
    }
  });

  it("どの曲も、書かれた音名がすべて周波数に変換できる", () => {
    for (const song of Object.values(SONGS)) {
      for (const track of song.tracks) {
        for (const note of track.steps) {
          if (note === null) continue;
          expect(Number.isFinite(noteToFrequency(note))).toBe(true);
        }
      }
    }
  });

  it("速さと音量は現実的な範囲に収まっている", () => {
    for (const song of Object.values(SONGS)) {
      expect(song.tempo).toBeGreaterThan(40);
      expect(song.tempo).toBeLessThan(240);
      for (const track of song.tracks) {
        expect(track.volume).toBeGreaterThan(0);
        expect(track.volume).toBeLessThanOrEqual(1);
      }
    }
  });
});
