/**
 * 音まわりの窓口。効果音とBGMをまとめて扱う。
 * @packageDocumentation
 */
import { MusicPlayer, SONGS, type SongName } from "./music.js";
import { SoundEffects, type SoundName } from "./sfx.js";
import { Synth } from "./synth.js";

/** 効果音とBGMをまとめた音の窓口。 */
export class AudioSystem {
  private readonly synth = new Synth();
  private readonly effects: SoundEffects;
  private readonly music: MusicPlayer;
  private started = false;
  private currentSong: SongName | null = null;

  /** 音を鳴らす設定になっているか。 */
  enabled = true;

  /** 効果音とBGMを用意する。 */
  constructor() {
    this.effects = new SoundEffects(this.synth);
    this.music = new MusicPlayer(this.synth);
  }

  /**
   * 利用者の最初の操作で音源を起こす。ブラウザは操作より前に音を鳴らせないため、
   * クリックやキー入力のたびに呼んでおく（2回目以降は何もしない）。
   */
  unlock(): void {
    if (this.started) return;
    this.started = true;
    this.synth.resume();
    if (this.enabled && this.currentSong) this.music.play(SONGS[this.currentSong]);
  }

  /** 音の入り切りを切り替える。 */
  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.music.stop();
    } else if (this.currentSong) {
      this.music.play(SONGS[this.currentSong]);
    }
    return this.enabled;
  }

  /**
   * 効果音を鳴らす。
   * @param name 鳴らす音の種類。
   */
  play(name: SoundName): void {
    if (!this.enabled) return;
    this.effects.play(name);
  }

  /**
   * BGMを切り替える。同じ曲なら鳴らし直さない。
   * @param name 鳴らす曲。
   */
  playMusic(name: SongName): void {
    this.currentSong = name;
    if (!this.enabled || !this.started) return;
    this.music.play(SONGS[name]);
  }

  /** BGMを止める。 */
  stopMusic(): void {
    this.currentSong = null;
    this.music.stop();
  }
}
