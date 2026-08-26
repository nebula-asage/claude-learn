/**
 * ドット絵を文字列で書くための、1文字＝1パレット添字の対応表。
 *
 * ドット絵はバイナリ画像ではなくTSのソース上に文字列として置く。差分がそのまま読めて、
 * パレットを変えれば全タイルの色が一斉に変わる。
 * @packageDocumentation
 */
import { COLOR } from "../palette.js";

/** ドット絵の文字と描画色の対応。`.` と空白は透明。 */
export const ART_CHARS: Readonly<Record<string, number>> = {
  ".": COLOR.transparent,
  " ": COLOR.transparent,
  K: COLOR.black,
  D: COLOR.darkGray,
  Y: COLOR.gray,
  L: COLOR.lightGray,
  W: COLOR.white,
  A: COLOR.abyss,
  B: COLOR.deepWater,
  U: COLOR.water,
  H: COLOR.shallow,
  S: COLOR.sand,
  T: COLOR.dirt,
  t: COLOR.darkDirt,
  G: COLOR.grass,
  g: COLOR.darkGrass,
  F: COLOR.forest,
  f: COLOR.darkForest,
  R: COLOR.road,
  r: COLOR.roadLine,
  I: COLOR.rail,
  E: COLOR.wire,
  X: COLOR.red,
  x: COLOR.darkRed,
  O: COLOR.orange,
  Q: COLOR.yellow,
  N: COLOR.brown,
  n: COLOR.lightBrown,
  V: COLOR.wall,
  v: COLOR.wallDark,
  J: COLOR.roofRed,
  j: COLOR.roofBlue,
  M: COLOR.window,
  m: COLOR.windowLit,
  C: COLOR.concrete,
  c: COLOR.concreteLight,
  Z: COLOR.blue,
  z: COLOR.lightBlue,
  e: COLOR.green,
  P: COLOR.purple,
  p: COLOR.pink,
  "1": COLOR.panel,
  "2": COLOR.panelLight,
  "3": COLOR.panelShadow,
  "4": COLOR.uiBlue,
  "5": COLOR.uiYellow,
  "6": COLOR.smoke,
  "7": COLOR.flame,
  "8": COLOR.flameLight,
};
