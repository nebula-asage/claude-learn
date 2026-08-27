/**
 * 音名と周波数の対応。
 *
 * 曲データを「C4」「A#3」のような読める文字列で書けるようにするための変換。
 * @packageDocumentation
 */

/** 1オクターブ内の音名と、Cからの半音数。 */
const SEMITONES: Readonly<Record<string, number>> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

/**
 * 音名（例: `"A4"`, `"C#5"`）を周波数に変換する。
 *
 * A4 = 440Hz を基準に、半音ごとに 2 の 1/12 乗を掛けた平均律で求める。
 * @param note 音名。
 */
export function noteToFrequency(note: string): number {
  const match = /^([A-G][#b]?)(-?\d)$/.exec(note);
  if (!match) throw new Error(`音名として読めません: ${note}`);

  const semitone = SEMITONES[match[1]];
  const octave = Number(match[2]);
  // MIDIノート番号に直してから、A4(69番)との差で周波数を求める。
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
