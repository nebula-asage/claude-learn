/**
 * WebAudio による簡易シンセ。矩形波・三角波・ノイズだけの、レトロ機に寄せた音源。
 *
 * 音声ファイルは持たず、効果音もBGMもすべてその場で合成する。
 * ブラウザは利用者の操作より前に音を鳴らせないため、最初のクリックやキー入力で
 * `resume` を呼んでもらう前提にしている。
 * @packageDocumentation
 */

/** 1音を鳴らすときの指定。 */
export interface ToneOptions {
  /** 波形。 */
  wave: OscillatorType;
  /** 周波数（Hz）。 */
  frequency: number;
  /** 鳴らす長さ（秒）。 */
  duration: number;
  /** 音量（0〜1）。 */
  volume?: number;
  /** 鳴らし始める時刻。省略すると即座に鳴らす。 */
  when?: number;
  /** 終わりに向かって変化させる周波数（Hz）。指定するとスライドする。 */
  slideTo?: number;
}

/** ノイズを鳴らすときの指定。 */
export interface NoiseOptions {
  /** 鳴らす長さ（秒）。 */
  duration: number;
  /** 音量（0〜1）。 */
  volume?: number;
  /** 鳴らし始める時刻。省略すると即座に鳴らす。 */
  when?: number;
  /** ローパスフィルタの遮断周波数（Hz）。低いほどこもった音になる。 */
  cutoff?: number;
}

/** 矩形波・三角波・ノイズを鳴らせる簡易シンセ。 */
export class Synth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.35;

  /** 音を出せる状態かどうか。 */
  get ready(): boolean {
    return this.context !== null && this.context.state === "running";
  }

  /** いまの時刻（音のスケジュールに使う）。 */
  get currentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  /**
   * 音源を用意する。利用者の操作（クリックやキー入力）の中から呼ぶ必要がある。
   * ブラウザが対応していない場合は、以後すべての再生が黙って無視される。
   */
  resume(): void {
    if (!this.context) {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.context);
    }
    void this.context.resume();
  }

  /**
   * 全体の音量を変える。
   * @param value 音量（0〜1）。
   */
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.volume;
  }

  /**
   * ざらついたノイズ音のもとになる、乱数で埋めた短い音声を作る。
   * @param context 音源。
   */
  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /**
   * 1音鳴らす。
   * @param options 鳴らし方の指定。
   */
  playTone(options: ToneOptions): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const start = options.when ?? context.currentTime;
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = options.wave;
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.slideTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, options.slideTo),
        start + options.duration,
      );
    }

    // 立ち上がりを短く、減衰を指数で。これだけでかなり「それらしい」音になる。
    const peak = options.volume ?? 0.3;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + options.duration + 0.02);
  }

  /**
   * ノイズを鳴らす。打楽器や爆発音に使う。
   * @param options 鳴らし方の指定。
   */
  playNoise(options: NoiseOptions): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || !this.noiseBuffer) return;

    const start = options.when ?? context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = options.cutoff ?? 4000;

    const gain = context.createGain();
    const peak = options.volume ?? 0.25;
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + options.duration + 0.02);
  }
}
