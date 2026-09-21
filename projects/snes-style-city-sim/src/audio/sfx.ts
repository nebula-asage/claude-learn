/**
 * 効果音。すべてその場で合成する。
 * @packageDocumentation
 */
import { noteToFrequency } from "./notes.js";
import type { Synth } from "./synth.js";

/** 鳴らせる効果音の種類。 */
export type SoundName =
  "build" | "bulldoze" | "error" | "select" | "window" | "disaster" | "milestone" | "coin";

/** 効果音を鳴らす。 */
export class SoundEffects {
  /**
   * @param synth 使う音源。
   */
  constructor(private readonly synth: Synth) {}

  /**
   * 効果音を鳴らす。
   * @param name 鳴らす音の種類。
   */
  play(name: SoundName): void {
    const synth = this.synth;
    const now = synth.currentTime;

    switch (name) {
      case "build":
        // 「コッ」と短く鳴らす設置音。
        synth.playTone({ wave: "square", frequency: 660, duration: 0.06, volume: 0.25 });
        synth.playTone({
          wave: "square",
          frequency: 990,
          duration: 0.06,
          volume: 0.18,
          when: now + 0.05,
        });
        break;
      case "bulldoze":
        synth.playNoise({ duration: 0.18, volume: 0.28, cutoff: 1400 });
        break;
      case "error":
        synth.playTone({ wave: "square", frequency: 220, duration: 0.16, volume: 0.25 });
        synth.playTone({
          wave: "square",
          frequency: 165,
          duration: 0.2,
          volume: 0.25,
          when: now + 0.12,
        });
        break;
      case "select":
        synth.playTone({ wave: "square", frequency: 880, duration: 0.05, volume: 0.18 });
        break;
      case "window":
        synth.playTone({ wave: "triangle", frequency: 440, duration: 0.08, volume: 0.22 });
        synth.playTone({
          wave: "triangle",
          frequency: 660,
          duration: 0.1,
          volume: 0.2,
          when: now + 0.06,
        });
        break;
      case "disaster":
        // 下降するサイレンと爆発音。
        synth.playTone({
          wave: "sawtooth",
          frequency: 440,
          slideTo: 90,
          duration: 0.7,
          volume: 0.3,
        });
        synth.playNoise({ duration: 0.6, volume: 0.3, cutoff: 900 });
        break;
      case "milestone":
        ["C5", "E5", "G5", "C6"].forEach((note, i) => {
          synth.playTone({
            wave: "square",
            frequency: noteToFrequency(note),
            duration: 0.22,
            volume: 0.25,
            when: now + i * 0.09,
          });
        });
        break;
      case "coin":
        synth.playTone({ wave: "square", frequency: 988, duration: 0.07, volume: 0.22 });
        synth.playTone({
          wave: "square",
          frequency: 1319,
          duration: 0.18,
          volume: 0.22,
          when: now + 0.06,
        });
        break;
    }
  }
}
