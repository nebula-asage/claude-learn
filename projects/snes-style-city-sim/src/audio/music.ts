/**
 * BGM。16分音符のステップに音名を並べただけの、素朴なチップチューン。
 *
 * 曲データはこのファイルの中で完結しており、外部の音源ファイルは使わない。
 * @packageDocumentation
 */
import { noteToFrequency } from "./notes.js";
import type { Synth } from "./synth.js";

/** 打楽器の種類。 */
export type DrumHit = "kick" | "snare" | "hat";

/** 旋律や伴奏のパート。 */
export interface MusicTrack {
  /** 波形。 */
  wave: OscillatorType;
  /** 音量（0〜1）。 */
  volume: number;
  /** 1ステップに対する音の長さの割合。大きいほど音が伸びる。 */
  gate: number;
  /** 16分音符ごとの音名。`null` は休符。 */
  steps: readonly (string | null)[];
}

/** 1曲ぶんのデータ。 */
export interface Song {
  /** 画面に出す曲名。 */
  name: string;
  /** 速さ（4分音符が1分間に何個か）。 */
  tempo: number;
  /** 旋律・伴奏のパート。 */
  tracks: readonly MusicTrack[];
  /** 16分音符ごとの打楽器。 */
  drums: readonly (DrumHit | null)[];
}

/** 打楽器を書きやすくするための短縮。 */
const K: DrumHit = "kick";
const S: DrumHit = "snare";
const H: DrumHit = "hat";
const _ = null;

/** 街を眺めているときの曲。ゆったりした長調。 */
const CITY_SONG: Song = {
  name: "まちのテーマ",
  tempo: 108,
  tracks: [
    {
      wave: "square",
      volume: 0.16,
      gate: 0.9,
      // prettier-ignore
      steps: [
        "C5", _, "E5", _, "G5", _, "E5", _,  "F5", _, "E5", _, "D5", _, _, _,
        "E5", _, "G5", _, "A5", _, "G5", _,  "F5", _, "D5", _, "C5", _, _, _,
        "G5", _, "E5", _, "C5", _, "E5", _,  "D5", _, "F5", _, "E5", _, _, _,
        "C5", _, "D5", _, "E5", _, "G5", _,  "E5", _, "C5", _, _,    _, _, _,
      ],
    },
    {
      wave: "triangle",
      volume: 0.22,
      gate: 0.8,
      // prettier-ignore
      steps: [
        "C3", _, _, _, "G2", _, _, _,  "F2", _, _, _, "G2", _, _, _,
        "C3", _, _, _, "E3", _, _, _,  "F2", _, _, _, "G2", _, _, _,
        "C3", _, _, _, "A2", _, _, _,  "F2", _, _, _, "G2", _, _, _,
        "C3", _, _, _, "E3", _, _, _,  "G2", _, _, _, "G2", _, _, _,
      ],
    },
  ],
  // prettier-ignore
  drums: [
    K, _, H, _, S, _, H, _,  K, _, H, _, S, _, H, H,
    K, _, H, _, S, _, H, _,  K, _, H, _, S, _, H, H,
    K, _, H, _, S, _, H, _,  K, _, H, _, S, _, H, H,
    K, _, H, _, S, _, H, _,  K, _, H, _, S, H, H, H,
  ],
};

/** タイトル画面の曲。ゆっくりと広がる感じ。 */
const TITLE_SONG: Song = {
  name: "はじまりのまち",
  tempo: 92,
  tracks: [
    {
      wave: "square",
      volume: 0.16,
      gate: 0.95,
      // prettier-ignore
      steps: [
        "G4", _, _, _, "C5", _, _, _,  "E5", _, _, _, "D5", _, _, _,
        "C5", _, _, _, "E5", _, _, _,  "G5", _, _, _, _,    _, _, _,
        "F5", _, _, _, "E5", _, _, _,  "D5", _, _, _, "C5", _, _, _,
        "D5", _, _, _, "E5", _, _, _,  "C5", _, _, _, _,    _, _, _,
      ],
    },
    {
      wave: "triangle",
      volume: 0.2,
      gate: 0.9,
      // prettier-ignore
      steps: [
        "C3", _, _, _, _, _, _, _,  "G2", _, _, _, _, _, _, _,
        "A2", _, _, _, _, _, _, _,  "E3", _, _, _, _, _, _, _,
        "F2", _, _, _, _, _, _, _,  "C3", _, _, _, _, _, _, _,
        "G2", _, _, _, _, _, _, _,  "C3", _, _, _, _, _, _, _,
      ],
    },
  ],
  // prettier-ignore
  drums: [
    _, _, _, _, _, _, _, _,  H, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _,  H, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _,  H, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _,  H, _, _, _, H, _, H, _,
  ],
};

/** 災害が起きているときの曲。短調で落ち着かない。 */
const DISASTER_SONG: Song = {
  name: "ひなん",
  tempo: 136,
  tracks: [
    {
      wave: "square",
      volume: 0.16,
      gate: 0.6,
      // prettier-ignore
      steps: [
        "A4", _, "A4", _, "C5", _, "A4", _,  "G#4", _, "G#4", _, "B4", _, "G#4", _,
        "A4", _, "A4", _, "C5", _, "E5", _,  "D5",  _, "C5",  _, "B4", _, _,     _,
        "A4", _, "A4", _, "C5", _, "A4", _,  "F4",  _, "F4",  _, "A4", _, "F4",  _,
        "E4", _, "E4", _, "G4", _, "B4", _,  "A4",  _, _,     _, _,    _, _,     _,
      ],
    },
    {
      wave: "sawtooth",
      volume: 0.14,
      gate: 0.5,
      // prettier-ignore
      steps: [
        "A2", _, "A2", _, "A2", _, "A2", _,  "G#2", _, "G#2", _, "G#2", _, "G#2", _,
        "A2", _, "A2", _, "A2", _, "A2", _,  "E2",  _, "E2",  _, "E2",  _, "E2",  _,
        "A2", _, "A2", _, "A2", _, "A2", _,  "F2",  _, "F2",  _, "F2",  _, "F2",  _,
        "E2", _, "E2", _, "E2", _, "E2", _,  "A2",  _, _,     _, "A2",  _, _,     _,
      ],
    },
  ],
  // prettier-ignore
  drums: [
    K, _, H, K, S, _, H, _,  K, _, H, K, S, _, H, H,
    K, _, H, K, S, _, H, _,  K, _, H, K, S, H, S, H,
    K, _, H, K, S, _, H, _,  K, _, H, K, S, _, H, H,
    K, _, H, K, S, _, H, _,  K, K, S, S, H, H, H, H,
  ],
};

/** 曲の名前と中身の対応。 */
export const SONGS = {
  /** タイトル画面。 */
  title: TITLE_SONG,
  /** 街を育てている間。 */
  city: CITY_SONG,
  /** 災害の最中。 */
  disaster: DISASTER_SONG,
} as const;

/** 曲の識別子。 */
export type SongName = keyof typeof SONGS;

/** 先読みして音を予約する間隔（秒）。 */
const LOOKAHEAD = 0.15;

/** 予約処理を回す間隔（ミリ秒）。 */
const SCHEDULE_INTERVAL = 40;

/** 曲を鳴らし続ける係。 */
export class MusicPlayer {
  private song: Song | null = null;
  private timer: number | null = null;
  private nextStepTime = 0;
  private step = 0;

  /**
   * @param synth 使う音源。
   */
  constructor(private readonly synth: Synth) {}

  /** いま鳴っている曲。 */
  get current(): Song | null {
    return this.song;
  }

  /**
   * 曲を切り替える。同じ曲なら何もしない。
   * @param song 鳴らす曲。
   */
  play(song: Song): void {
    if (this.song === song) return;
    this.stop();
    this.song = song;
    this.step = 0;
    this.nextStepTime = this.synth.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), SCHEDULE_INTERVAL);
    this.schedule();
  }

  /** 演奏を止める。 */
  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  /** 少し先までの音を予約する。 */
  private schedule(): void {
    const song = this.song;
    if (!song || !this.synth.ready) return;

    const stepDuration = 60 / song.tempo / 4;
    const limit = this.synth.currentTime + LOOKAHEAD;

    while (this.nextStepTime < limit) {
      this.playStep(song, this.step, this.nextStepTime, stepDuration);
      this.nextStepTime += stepDuration;
      this.step++;
    }
  }

  /**
   * 1ステップぶんの音を鳴らす。
   * @param song 鳴らしている曲。
   * @param step ステップ番号。
   * @param when 鳴らす時刻。
   * @param stepDuration 1ステップの長さ（秒）。
   */
  private playStep(song: Song, step: number, when: number, stepDuration: number): void {
    for (const track of song.tracks) {
      const note = track.steps[step % track.steps.length];
      if (!note) continue;
      // 次に音が来るまでを、そのまま音の長さにする（伸ばした感じを出すため）。
      let length = 1;
      while (
        length < 8 &&
        track.steps[(step + length) % track.steps.length] === null &&
        step + length < step + 8
      ) {
        length++;
      }
      this.synth.playTone({
        wave: track.wave,
        frequency: noteToFrequency(note),
        duration: stepDuration * length * track.gate,
        volume: track.volume,
        when,
      });
    }

    const drum = song.drums[step % song.drums.length];
    if (drum === "kick") {
      this.synth.playTone({
        wave: "sine",
        frequency: 150,
        slideTo: 45,
        duration: 0.16,
        volume: 0.32,
        when,
      });
    } else if (drum === "snare") {
      this.synth.playNoise({ duration: 0.14, volume: 0.2, cutoff: 3200, when });
    } else if (drum === "hat") {
      this.synth.playNoise({ duration: 0.04, volume: 0.09, cutoff: 9000, when });
    }
  }
}
