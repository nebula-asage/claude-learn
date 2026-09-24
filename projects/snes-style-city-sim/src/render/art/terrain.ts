/**
 * 地形タイルのドット絵。
 *
 * 草地・土・砂浜のような一様な地面は文字列のドット絵で、水面のように
 * 隣接状況で16通りに変化するものは手続き的に描く。
 * @packageDocumentation
 */
import { COLOR } from "../palette.js";
import type { Tileset } from "../tileset.js";
import { ArtCanvas } from "./canvas.js";
import { FIRE_FRAMES, FLOOD_FRAMES, FOREST_VARIANTS, TILE_SIZE, TileId } from "../../sim/tiles.js";

const GRASS = [
  "GGGGGGgGGGGGGGGG",
  "GgGGGGGGGGgGGGGG",
  "GGGGGgGGGGGGGgGG",
  "GGGGGGGGGGGGGGGG",
  "GGgGGGGGGgGGGGGG",
  "GGGGGGGgGGGGGGGG",
  "GGGGGGGGGGgGGGgG",
  "GgGGGGGGGGGGGGGG",
  "GGGGGgGGGGGGGGgG",
  "GGGGGGGGGgGGGGGG",
  "GGgGGGGGGGGGGgGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGgGGGgGGGGG",
  "GgGGGGGGGGGGGGGG",
  "GGGGGGGGGgGGGGgG",
  "GGGGGGGGGGGGGGGG",
];

const DIRT = [
  "TTTTTTtTTTTTTTTT",
  "TtTTTTTTTTtTTTTT",
  "TTTTTtTTTTTTTtTT",
  "TTTTTTTTTTTTTTTT",
  "TTtTTTTTTtTTTTTT",
  "TTTTTTTtTTTTTTTT",
  "TTTTTTTTTTtTTTtT",
  "TtTTTTTTTTTTTTTT",
  "TTTTTtTTTTTTTTtT",
  "TTTTTTTTTtTTTTTT",
  "TTtTTTTTTTTTTtTT",
  "TTTTTTTTTTTTTTTT",
  "TTTTTTtTTTtTTTTT",
  "TtTTTTTTTTTTTTTT",
  "TTTTTTTTTtTTTTtT",
  "TTTTTTTTTTTTTTTT",
];

const SAND = [
  "SSSSSSnSSSSSSSSS",
  "SnSSSSSSSSnSSSSS",
  "SSSSSnSSSSSSSnSS",
  "SSSSSSSSSSSSSSSS",
  "SSnSSSSSSnSSSSSS",
  "SSSSSSSnSSSSSSSS",
  "SSSSSSSSSSnSSSnS",
  "SnSSSSSSSSSSSSSS",
  "SSSSSnSSSSSSSSnS",
  "SSSSSSSSSnSSSSSS",
  "SSnSSSSSSSSSSnSS",
  "SSSSSSSSSSSSSSSS",
  "SSSSSSnSSSnSSSSS",
  "SnSSSSSSSSSSSSSS",
  "SSSSSSSSSnSSSSnS",
  "SSSSSSSSSSSSSSSS",
];

const TREE = ["..ff..", ".fFFf.", "fFFFFf", "fFFFFf", ".fFFf.", "..KK..", "..tK.."];

// cspell:disable-next-line -- ドット絵をピクセルごとの文字コードで表現したデータ。単語ではない
const ROCK = [".YYY.", "YLLYD", "YLYYD", ".DDD."];

/** 森タイルのバリエーションごとの、木を植える位置。 */
const FOREST_LAYOUTS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 1],
    [6, 0],
    [11, 3],
    [3, 8],
    [9, 8],
  ],
  [
    [2, 0],
    [8, 2],
    [13, 6],
    [-1, 7],
    [6, 9],
  ],
  [
    [5, 1],
    [11, 0],
    [1, 4],
    [7, 7],
    [12, 9],
  ],
  [
    [1, 2],
    [7, 0],
    [12, 4],
    [4, 9],
    [10, 8],
  ],
];

/** 瓦礫タイルの、岩を置く位置。 */
const RUBBLE_LAYOUT: readonly (readonly [number, number])[] = [
  [1, 2],
  [8, 1],
  [4, 7],
  [11, 9],
  [6, 12],
  [0, 10],
];

/**
 * 水面タイルを描く。
 * @param landMask 陸地に接している向き（北1・東2・南4・西8）。
 */
function waterTile(landMask: number): ArtCanvas {
  const canvas = new ArtCanvas(TILE_SIZE, TILE_SIZE);
  canvas.fill(COLOR.water);

  // さざ波。全タイル共通の模様にしておく。タイルごとに変えると、
  // 広い水面がタイル境界の格子模様として浮き上がってしまう。
  for (const [wx, wy] of [
    [2, 3],
    [9, 6],
    [4, 11],
    [12, 13],
  ]) {
    canvas.rect(wx, wy, 3, 1, COLOR.deepWater);
    canvas.px(wx + 3, wy + 1, COLOR.deepWater);
  }

  // 陸に接している辺だけ浅瀬にして、岸の位置が分かるようにする。
  if (landMask & 1) {
    canvas.rect(0, 0, 16, 2, COLOR.shallow);
    canvas.rect(0, 2, 16, 1, COLOR.water);
  }
  if (landMask & 2) {
    canvas.rect(14, 0, 2, 16, COLOR.shallow);
    canvas.rect(13, 0, 1, 16, COLOR.water);
  }
  if (landMask & 4) {
    canvas.rect(0, 14, 16, 2, COLOR.shallow);
    canvas.rect(0, 13, 16, 1, COLOR.water);
  }
  if (landMask & 8) {
    canvas.rect(0, 0, 2, 16, COLOR.shallow);
    canvas.rect(2, 0, 1, 16, COLOR.water);
  }

  return canvas;
}

/**
 * 炎タイルを描く。
 * @param frame アニメーションのコマ番号。
 */
function fireTile(frame: number): ArtCanvas {
  const canvas = new ArtCanvas(TILE_SIZE, TILE_SIZE);
  canvas.fill(COLOR.darkGray);
  canvas.rect(0, 12, 16, 4, COLOR.black);

  const offsets = [0, 2, 1, 3];
  const shift = offsets[frame % offsets.length];
  for (let i = 0; i < 3; i++) {
    const bx = 1 + i * 5 + ((shift + i) % 2);
    const height = 8 + ((shift + i) % 3);
    for (let y = 0; y < height; y++) {
      const py = 14 - y;
      const half = Math.max(1, Math.round((height - y) / 2.4));
      canvas.rect(bx + 2 - half, py, half * 2, 1, y < height - 3 ? COLOR.flame : COLOR.flameLight);
    }
    canvas.px(bx + 2, 14 - height, COLOR.yellow);
  }
  return canvas;
}

/**
 * 浸水タイルを描く。
 * @param frame アニメーションのコマ番号。
 */
function floodTile(frame: number): ArtCanvas {
  const canvas = new ArtCanvas(TILE_SIZE, TILE_SIZE);
  canvas.fill(COLOR.shallow);
  for (let i = 0; i < 4; i++) {
    const y = (i * 4 + frame) % 16;
    canvas.rect(0, y, 16, 1, COLOR.water);
    canvas.rect((i * 5 + frame * 3) % 12, (y + 2) % 16, 4, 1, COLOR.lightGray);
  }
  canvas.px(3 + frame, 6, COLOR.brown);
  canvas.px(11 - frame, 11, COLOR.brown);
  return canvas;
}

/**
 * 地形タイルの絵をアトラスへ書き込む。
 * @param tileset 書き込み先のアトラス。
 */
export function paintTerrainTiles(tileset: Tileset): void {
  const dirt = new ArtCanvas(TILE_SIZE, TILE_SIZE);
  dirt.stamp(0, 0, DIRT);
  tileset.setCanvas(TileId.Dirt, dirt);

  const grass = new ArtCanvas(TILE_SIZE, TILE_SIZE);
  grass.stamp(0, 0, GRASS);
  tileset.setCanvas(TileId.Grass, grass);

  const sand = new ArtCanvas(TILE_SIZE, TILE_SIZE);
  sand.stamp(0, 0, SAND);
  tileset.setCanvas(TileId.Sand, sand);

  const rubble = new ArtCanvas(TILE_SIZE, TILE_SIZE);
  rubble.stamp(0, 0, DIRT);
  for (const [x, y] of RUBBLE_LAYOUT) rubble.stamp(x, y, ROCK);
  tileset.setCanvas(TileId.Rubble, rubble);

  for (let v = 0; v < FOREST_VARIANTS; v++) {
    const forest = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    forest.fill(COLOR.darkGrass);
    for (const [x, y] of FOREST_LAYOUTS[v]) forest.stamp(x, y, TREE);
    tileset.setCanvas(TileId.Forest + v, forest);
  }

  for (let mask = 0; mask < 16; mask++) {
    tileset.setCanvas(TileId.Water + mask, waterTile(mask));
  }

  for (let frame = 0; frame < FIRE_FRAMES; frame++) {
    tileset.setCanvas(TileId.Fire + frame, fireTile(frame));
  }

  for (let frame = 0; frame < FLOOD_FRAMES; frame++) {
    tileset.setCanvas(TileId.Flood + frame, floodTile(frame));
  }
}
