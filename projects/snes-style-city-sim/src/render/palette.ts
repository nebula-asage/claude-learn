/**
 * 画面全体で共有する固定パレット。
 *
 * レトロ機風の統一感を出すため、描画で使える色はここに定義したものだけに限定する。
 * ドット絵・UI・オーバーレイはすべてこのパレットの添字で色を指定する。
 * @packageDocumentation
 */

/**
 * リトルエンディアン環境の `Uint32Array` フレームバッファに書き込める形
 * （0xAABBGGRR）へRGBを詰める。
 * @param r 赤成分（0〜255）。
 * @param g 緑成分（0〜255）。
 * @param b 青成分（0〜255）。
 */
function rgb(r: number, g: number, b: number): number {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** パレット添字に付ける名前。ドット絵の文字マップやUIの色指定はこの名前を経由する。 */
export const COLOR = {
  /** 透明。ドット絵ではこの色の画素を書き込まない。 */
  transparent: 0,
  /** 黒。輪郭線に使う。 */
  black: 1,
  /** 暗い灰色。 */
  darkGray: 2,
  /** 灰色。 */
  gray: 3,
  /** 明るい灰色。 */
  lightGray: 4,
  /** 白。 */
  white: 5,
  /** 深い海。 */
  deepWater: 6,
  /** 海・川。 */
  water: 7,
  /** 浅瀬。 */
  shallow: 8,
  /** 砂浜。 */
  sand: 9,
  /** 土（更地）。 */
  dirt: 10,
  /** 暗い土。 */
  darkDirt: 11,
  /** 草地。 */
  grass: 12,
  /** 暗い草地。 */
  darkGrass: 13,
  /** 森。 */
  forest: 14,
  /** 暗い森。 */
  darkForest: 15,
  /** 道路の路面。 */
  road: 16,
  /** 道路の白線。 */
  roadLine: 17,
  /** 線路。 */
  rail: 18,
  /** 送電線。 */
  wire: 19,
  /** 赤。 */
  red: 20,
  /** 暗い赤。 */
  darkRed: 21,
  /** 橙。 */
  orange: 22,
  /** 黄。 */
  yellow: 23,
  /** 茶。 */
  brown: 24,
  /** 明るい茶。 */
  lightBrown: 25,
  /** 建物の壁（明）。 */
  wall: 26,
  /** 建物の壁（暗）。 */
  wallDark: 27,
  /** 赤い屋根。 */
  roofRed: 28,
  /** 青い屋根。 */
  roofBlue: 29,
  /** 窓（消灯）。 */
  window: 30,
  /** 窓（点灯）。 */
  windowLit: 31,
  /** コンクリート（暗）。 */
  concrete: 32,
  /** コンクリート（明）。 */
  concreteLight: 33,
  /** 青。 */
  blue: 34,
  /** 明るい青。 */
  lightBlue: 35,
  /** 緑。 */
  green: 36,
  /** 紫。 */
  purple: 37,
  /** 桃色。 */
  pink: 38,
  /** UIパネルの地色。 */
  panel: 39,
  /** UIパネルのハイライト。 */
  panelLight: 40,
  /** UIパネルの陰。 */
  panelShadow: 41,
  /** UIの強調色（青）。 */
  uiBlue: 42,
  /** UIの強調色（黄）。 */
  uiYellow: 43,
  /** 深海（最暗）。 */
  abyss: 44,
  /** 煙。 */
  smoke: 45,
  /** 炎（芯）。 */
  flame: 46,
  /** 炎（外縁）。 */
  flameLight: 47,
} as const;

/** パレット添字を表す型。 */
export type ColorIndex = (typeof COLOR)[keyof typeof COLOR];

/** 添字から実際の色（0xAABBGGRR）を引くテーブル。0番は透明として扱われ描画されない。 */
export const PALETTE: Uint32Array = new Uint32Array([
  rgb(0, 0, 0), // 0 transparent（実際には描画されない）
  rgb(0x00, 0x00, 0x00), // 1 black
  rgb(0x30, 0x30, 0x38), // 2 darkGray
  rgb(0x60, 0x60, 0x68), // 3 gray
  rgb(0xa0, 0xa0, 0xa8), // 4 lightGray
  rgb(0xf8, 0xf8, 0xf8), // 5 white
  rgb(0x10, 0x38, 0x68), // 6 deepWater
  rgb(0x20, 0x60, 0xa0), // 7 water
  rgb(0x40, 0x90, 0xc8), // 8 shallow
  rgb(0xd8, 0xc0, 0x88), // 9 sand
  rgb(0xa8, 0x88, 0x50), // 10 dirt
  rgb(0x80, 0x60, 0x38), // 11 darkDirt
  rgb(0x4c, 0x98, 0x40), // 12 grass
  rgb(0x2c, 0x68, 0x28), // 13 darkGrass
  rgb(0x20, 0x60, 0x20), // 14 forest
  rgb(0x10, 0x3c, 0x18), // 15 darkForest
  rgb(0x58, 0x58, 0x60), // 16 road
  rgb(0xc8, 0xc8, 0xb0), // 17 roadLine
  rgb(0x80, 0x60, 0x50), // 18 rail
  rgb(0xb0, 0xb0, 0xc0), // 19 wire
  rgb(0xd8, 0x38, 0x20), // 20 red
  rgb(0x90, 0x20, 0x10), // 21 darkRed
  rgb(0xf0, 0x78, 0x18), // 22 orange
  rgb(0xf8, 0xd0, 0x38), // 23 yellow
  rgb(0x98, 0x60, 0x38), // 24 brown
  rgb(0xc8, 0x98, 0x60), // 25 lightBrown
  rgb(0xe0, 0xd0, 0xb8), // 26 wall
  rgb(0xc0, 0xa8, 0x90), // 27 wallDark
  rgb(0xb0, 0x40, 0x30), // 28 roofRed
  rgb(0x30, 0x60, 0xa0), // 29 roofBlue
  rgb(0x68, 0xb8, 0xe0), // 30 window
  rgb(0xf8, 0xf0, 0xa0), // 31 windowLit
  rgb(0x90, 0x90, 0x98), // 32 concrete
  rgb(0xb8, 0xb8, 0xc0), // 33 concreteLight
  rgb(0x28, 0x48, 0xa8), // 34 blue
  rgb(0x60, 0x90, 0xd8), // 35 lightBlue
  rgb(0x38, 0xa0, 0x38), // 36 green
  rgb(0x70, 0x40, 0xa0), // 37 purple
  rgb(0xe0, 0x88, 0x90), // 38 pink
  rgb(0x38, 0x40, 0x58), // 39 panel
  rgb(0x68, 0x78, 0xa0), // 40 panelLight
  rgb(0x20, 0x28, 0x40), // 41 panelShadow
  rgb(0x38, 0x58, 0xa8), // 42 uiBlue
  rgb(0xf8, 0xc0, 0x20), // 43 uiYellow
  rgb(0x08, 0x28, 0x48), // 44 abyss
  rgb(0x78, 0x78, 0x88), // 45 smoke
  rgb(0xf8, 0x58, 0x20), // 46 flame
  rgb(0xf8, 0xa8, 0x20), // 47 flameLight
]);
