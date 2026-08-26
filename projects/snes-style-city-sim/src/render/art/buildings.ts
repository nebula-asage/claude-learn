/**
 * 建物のドット絵。
 *
 * 建物は複数タイルにまたがるので、まず建物1棟ぶんの大きな面に描いてから
 * 16x16に切り分けてアトラスへ入れる。個々の棟は「家」「ビル」「工場」といった
 * 部品を組み合わせて手続き的に描く。
 * @packageDocumentation
 */
import { Rng } from "../../sim/rng.js";
import { TILE_SIZE } from "../../sim/tiles.js";
import {
  AIRPORT,
  BUILDINGS,
  COAL_PLANT,
  FIRE_STATION,
  NUCLEAR_PLANT,
  PARK,
  POLICE_STATION,
  SEAPORT,
  STADIUM,
  ZoneType,
  type BuildingDef,
} from "../../sim/buildings.js";
import { COLOR } from "../palette.js";
import type { Tileset } from "../tileset.js";
import { ArtCanvas } from "./canvas.js";

/**
 * 建物1棟ぶんの描画面を作り、地面で塗りつぶす。
 * @param width 横のタイル数。
 * @param height 縦のタイル数。
 * @param ground 地面の色。
 */
function lot(width: number, height: number, ground: number): ArtCanvas {
  const canvas = new ArtCanvas(width * TILE_SIZE, height * TILE_SIZE);
  canvas.fill(ground);
  for (let i = 0; i < width * height * 6; i++) {
    canvas.px((i * 13) % canvas.width, (i * 7) % canvas.height, COLOR.darkGrass);
  }
  return canvas;
}

/**
 * 三角屋根の家を描く。
 * @param canvas 描画先。
 * @param x 左端。
 * @param y 上端。
 * @param w 幅。
 * @param h 高さ。
 * @param wall 壁の色。
 * @param roof 屋根の色。
 */
function house(
  canvas: ArtCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  wall: number,
  roof: number,
): void {
  const roofHeight = Math.max(3, Math.floor(h * 0.4));
  canvas.rect(x, y + roofHeight, w, h - roofHeight, wall);
  canvas.frame(x, y + roofHeight, w, h - roofHeight, COLOR.black);
  for (let i = 0; i < roofHeight; i++) {
    const inset = Math.floor((i * (w / 2 - 1)) / roofHeight);
    canvas.rect(x + inset, y + i, w - inset * 2, 1, i === 0 ? COLOR.black : roof);
  }
  // 扉と窓。
  const doorX = x + Math.floor(w / 2) - 1;
  canvas.rect(doorX, y + h - 4, 2, 3, COLOR.brown);
  canvas.rect(x + 1, y + roofHeight + 2, 2, 2, COLOR.window);
  canvas.rect(x + w - 3, y + roofHeight + 2, 2, 2, COLOR.window);
}

/**
 * 窓の並んだビルを描く。
 * @param canvas 描画先。
 * @param x 左端。
 * @param y 上端。
 * @param w 幅。
 * @param h 高さ。
 * @param wall 壁の色。
 * @param seed 窓の点灯パターンを決める種。
 */
function tower(
  canvas: ArtCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  wall: number,
  seed: number,
): void {
  const rng = new Rng(seed);
  canvas.rect(x, y, w, h, wall);
  canvas.frame(x, y, w, h, COLOR.black);
  canvas.rect(x + 1, y + 1, w - 2, 2, COLOR.wallDark);
  canvas.rect(x + 1, y + h - 4, w - 2, 3, COLOR.concrete);

  for (let wy = y + 5; wy < y + h - 5; wy += 4) {
    for (let wx = x + 2; wx < x + w - 3; wx += 4) {
      canvas.rect(wx, wy, 2, 2, rng.chance(0.35) ? COLOR.windowLit : COLOR.window);
    }
  }
  // 入口。
  canvas.rect(x + Math.floor(w / 2) - 2, y + h - 4, 4, 3, COLOR.darkGray);
}

/**
 * 煙突つきの工場を描く。
 * @param canvas 描画先。
 * @param x 左端。
 * @param y 上端。
 * @param w 幅。
 * @param h 高さ。
 * @param chimneys 煙突の本数。
 */
function factory(
  canvas: ArtCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  chimneys: number,
): void {
  const bodyTop = y + 6;
  canvas.rect(x, bodyTop, w, h - 6, COLOR.wallDark);
  canvas.frame(x, bodyTop, w, h - 6, COLOR.black);
  // のこぎり屋根。
  for (let sx = x + 1; sx < x + w - 2; sx += 5) {
    canvas.rect(sx, bodyTop + 1, 3, 2, COLOR.gray);
    canvas.rect(sx, bodyTop + 1, 1, 2, COLOR.lightGray);
  }
  for (let wx = x + 2; wx < x + w - 3; wx += 5) {
    canvas.rect(wx, bodyTop + 6, 3, 3, COLOR.window);
  }
  canvas.rect(x + 2, y + h - 5, 5, 4, COLOR.darkGray);

  for (let i = 0; i < chimneys; i++) {
    const cx = x + 3 + i * 8;
    canvas.rect(cx, y, 4, bodyTop - y + 4, COLOR.brown);
    canvas.rect(cx, y, 4, 2, COLOR.darkRed);
    canvas.rect(cx + 1, y - 4, 2, 4, COLOR.smoke);
    canvas.px(cx, y - 5, COLOR.smoke);
    canvas.px(cx + 3, y - 6, COLOR.smoke);
  }
}

/**
 * 更地の区画（まだ何も建っていない状態）を描く。
 * @param zone 区画種別。
 */
function emptyLot(zone: number): ArtCanvas {
  const canvas = lot(3, 3, COLOR.dirt);
  const markerColor =
    zone === ZoneType.residential
      ? COLOR.green
      : zone === ZoneType.commercial
        ? COLOR.lightBlue
        : COLOR.yellow;

  canvas.frame(1, 1, 46, 46, COLOR.darkDirt);
  for (const [mx, my] of [
    [2, 2],
    [40, 2],
    [2, 40],
    [40, 40],
  ]) {
    canvas.rect(mx, my, 6, 6, markerColor);
    canvas.frame(mx, my, 6, 6, COLOR.black);
  }
  // 区画の目印になる杭と縄。
  canvas.rect(23, 4, 2, 40, COLOR.darkDirt);
  canvas.rect(4, 23, 40, 2, COLOR.darkDirt);
  return canvas;
}

/**
 * 住宅区画の建物を描く。
 * @param level 成長段階（1以上）。
 */
function residential(level: number): ArtCanvas {
  const canvas = lot(3, 3, COLOR.grass);
  const walls = [COLOR.wall, COLOR.lightBrown, COLOR.pink];
  const roofs = [COLOR.roofRed, COLOR.roofBlue, COLOR.brown];

  if (level === 1) {
    house(canvas, 4, 6, 14, 14, walls[0], roofs[0]);
    house(canvas, 26, 10, 14, 14, walls[1], roofs[1]);
    house(canvas, 14, 28, 14, 14, walls[2], roofs[0]);
  } else if (level === 2) {
    house(canvas, 2, 4, 13, 13, walls[0], roofs[0]);
    house(canvas, 18, 3, 13, 13, walls[1], roofs[1]);
    house(canvas, 33, 6, 13, 13, walls[2], roofs[2]);
    house(canvas, 6, 24, 13, 13, walls[1], roofs[0]);
    house(canvas, 24, 26, 15, 15, walls[0], roofs[1]);
  } else if (level === 3) {
    tower(canvas, 3, 8, 18, 34, COLOR.wall, 31);
    house(canvas, 25, 6, 16, 16, walls[1], roofs[0]);
    house(canvas, 26, 28, 15, 15, walls[2], roofs[1]);
  } else if (level === 4) {
    tower(canvas, 3, 4, 20, 40, COLOR.wall, 12);
    tower(canvas, 26, 12, 18, 32, COLOR.lightBrown, 44);
  } else {
    tower(canvas, 4, 2, 22, 44, COLOR.wall, 7);
    tower(canvas, 28, 8, 17, 38, COLOR.pink, 21);
  }
  return canvas;
}

/**
 * 商業区画の建物を描く。
 * @param level 成長段階（1以上）。
 */
function commercial(level: number): ArtCanvas {
  const canvas = lot(3, 3, COLOR.concrete);

  if (level === 1) {
    house(canvas, 4, 10, 18, 16, COLOR.wall, COLOR.roofBlue);
    canvas.rect(4, 24, 18, 2, COLOR.red);
    house(canvas, 26, 14, 16, 14, COLOR.lightBrown, COLOR.roofRed);
  } else if (level === 2) {
    tower(canvas, 3, 12, 20, 30, COLOR.wall, 3);
    canvas.rect(3, 12, 20, 3, COLOR.uiBlue);
    house(canvas, 27, 16, 16, 14, COLOR.wall, COLOR.roofRed);
  } else if (level === 3) {
    tower(canvas, 2, 6, 22, 38, COLOR.concreteLight, 9);
    tower(canvas, 27, 14, 18, 30, COLOR.wall, 15);
  } else if (level === 4) {
    tower(canvas, 2, 2, 24, 44, COLOR.concreteLight, 33);
    tower(canvas, 29, 10, 16, 36, COLOR.lightBlue, 51);
  } else {
    tower(canvas, 2, 0, 26, 46, COLOR.lightBlue, 61);
    tower(canvas, 31, 6, 15, 40, COLOR.concreteLight, 77);
    canvas.rect(13, 0, 4, 2, COLOR.red);
  }
  return canvas;
}

/**
 * 工業区画の建物を描く。
 * @param level 成長段階（1以上）。
 */
function industrial(level: number): ArtCanvas {
  const canvas = lot(3, 3, COLOR.dirt);

  if (level === 1) {
    factory(canvas, 4, 12, 24, 24, 1);
  } else if (level === 2) {
    factory(canvas, 2, 10, 26, 26, 1);
    canvas.rect(32, 26, 12, 12, COLOR.gray);
    canvas.frame(32, 26, 12, 12, COLOR.black);
  } else if (level === 3) {
    factory(canvas, 2, 8, 28, 30, 2);
    canvas.rect(34, 20, 10, 18, COLOR.concrete);
    canvas.frame(34, 20, 10, 18, COLOR.black);
  } else if (level === 4) {
    factory(canvas, 1, 8, 30, 32, 2);
    // 貯蔵タンク。
    canvas.rect(34, 16, 12, 12, COLOR.lightGray);
    canvas.frame(34, 16, 12, 12, COLOR.black);
    canvas.rect(34, 20, 12, 2, COLOR.gray);
    canvas.rect(34, 32, 12, 10, COLOR.gray);
  } else {
    factory(canvas, 1, 6, 32, 36, 3);
    canvas.rect(36, 12, 10, 30, COLOR.lightGray);
    canvas.frame(36, 12, 10, 30, COLOR.black);
    canvas.rect(36, 18, 10, 2, COLOR.gray);
    canvas.rect(36, 30, 10, 2, COLOR.gray);
  }
  return canvas;
}

/** 火力発電所を描く。 */
function coalPlant(): ArtCanvas {
  const canvas = lot(4, 4, COLOR.dirt);
  canvas.rect(2, 26, 60, 34, COLOR.wallDark);
  canvas.frame(2, 26, 60, 34, COLOR.black);
  canvas.rect(4, 28, 56, 3, COLOR.gray);
  for (let wx = 7; wx < 56; wx += 11) {
    canvas.rect(wx, 36, 4, 4, COLOR.window);
    canvas.rect(wx, 48, 4, 4, COLOR.window);
  }
  // 配管とタービン建屋の切り欠き。
  canvas.rect(4, 42, 56, 3, COLOR.darkGray);
  canvas.rect(30, 31, 4, 29, COLOR.gray);
  for (let i = 0; i < 2; i++) {
    const cx = 10 + i * 30;
    canvas.rect(cx, 6, 8, 22, COLOR.brown);
    canvas.rect(cx, 6, 8, 3, COLOR.darkRed);
    canvas.rect(cx + 1, 0, 6, 6, COLOR.smoke);
    canvas.px(cx, 2, COLOR.smoke);
    canvas.px(cx + 7, 1, COLOR.smoke);
  }
  // 石炭の山。
  canvas.rect(44, 14, 16, 12, COLOR.black);
  canvas.rect(46, 12, 12, 4, COLOR.darkGray);
  return canvas;
}

/** 原子力発電所を描く。 */
function nuclearPlant(): ArtCanvas {
  const canvas = lot(4, 4, COLOR.concrete);
  canvas.rect(2, 30, 60, 30, COLOR.concreteLight);
  canvas.frame(2, 30, 60, 30, COLOR.black);
  for (let wx = 6; wx < 58; wx += 9) {
    canvas.rect(wx, 40, 6, 6, COLOR.window);
  }
  // 円筒形の格納容器。
  canvas.rect(8, 10, 20, 22, COLOR.lightGray);
  canvas.frame(8, 10, 20, 22, COLOR.black);
  canvas.rect(10, 6, 16, 6, COLOR.lightGray);
  canvas.frame(10, 6, 16, 6, COLOR.black);
  canvas.rect(12, 14, 12, 10, COLOR.gray);
  // 冷却塔。
  canvas.rect(38, 8, 18, 24, COLOR.lightGray);
  canvas.frame(38, 8, 18, 24, COLOR.black);
  canvas.rect(40, 4, 14, 6, COLOR.lightGray);
  canvas.rect(41, 0, 12, 5, COLOR.smoke);
  // 放射線マーク。
  canvas.rect(30, 44, 8, 8, COLOR.yellow);
  canvas.px(34, 48, COLOR.black);
  canvas.rect(31, 45, 2, 2, COLOR.black);
  canvas.rect(35, 45, 2, 2, COLOR.black);
  canvas.rect(33, 49, 2, 2, COLOR.black);
  return canvas;
}

/** 警察署を描く。 */
function policeStation(): ArtCanvas {
  const canvas = lot(3, 3, COLOR.concrete);
  canvas.rect(4, 12, 40, 30, COLOR.wall);
  canvas.frame(4, 12, 40, 30, COLOR.black);
  canvas.rect(4, 12, 40, 6, COLOR.roofBlue);
  for (let wx = 8; wx < 42; wx += 8) {
    canvas.rect(wx, 22, 5, 6, COLOR.window);
  }
  canvas.rect(20, 32, 8, 10, COLOR.darkGray);
  // 星のマーク。
  canvas.rect(22, 6, 4, 4, COLOR.uiYellow);
  canvas.px(21, 8, COLOR.uiYellow);
  canvas.px(26, 8, COLOR.uiYellow);
  return canvas;
}

/** 消防署を描く。 */
function fireStation(): ArtCanvas {
  const canvas = lot(3, 3, COLOR.concrete);
  canvas.rect(4, 12, 40, 30, COLOR.roofRed);
  canvas.frame(4, 12, 40, 30, COLOR.black);
  canvas.rect(4, 12, 40, 5, COLOR.darkRed);
  // ガレージの扉。
  for (let i = 0; i < 2; i++) {
    const gx = 8 + i * 18;
    canvas.rect(gx, 24, 14, 18, COLOR.lightGray);
    canvas.frame(gx, 24, 14, 18, COLOR.black);
    for (let gy = 26; gy < 40; gy += 4) canvas.rect(gx + 1, gy, 12, 1, COLOR.gray);
  }
  canvas.rect(20, 4, 4, 9, COLOR.darkGray);
  canvas.rect(18, 2, 8, 3, COLOR.red);
  return canvas;
}

/** 公園を描く。 */
function park(): ArtCanvas {
  const canvas = lot(1, 1, COLOR.grass);
  canvas.rect(1, 9, 14, 6, COLOR.shallow);
  canvas.frame(1, 9, 14, 6, COLOR.water);
  canvas.rect(6, 1, 4, 2, COLOR.forest);
  canvas.rect(5, 2, 6, 4, COLOR.forest);
  canvas.rect(6, 3, 4, 2, COLOR.darkForest);
  canvas.rect(7, 6, 2, 3, COLOR.brown);
  canvas.rect(1, 2, 3, 1, COLOR.sand);
  canvas.rect(12, 4, 3, 1, COLOR.sand);
  return canvas;
}

/** スタジアムを描く。 */
function stadium(): ArtCanvas {
  const canvas = lot(4, 4, COLOR.concrete);
  canvas.rect(4, 8, 56, 48, COLOR.concreteLight);
  canvas.frame(4, 8, 56, 48, COLOR.black);
  canvas.rect(10, 14, 44, 36, COLOR.green);
  canvas.frame(10, 14, 44, 36, COLOR.white);
  canvas.rect(31, 14, 2, 36, COLOR.white);
  canvas.rect(10, 26, 6, 12, COLOR.white);
  canvas.rect(48, 26, 6, 12, COLOR.white);
  // 観客席と照明。
  for (let sx = 6; sx < 58; sx += 6) canvas.rect(sx, 10, 4, 3, COLOR.lightBlue);
  for (const [lx, ly] of [
    [2, 4],
    [58, 4],
    [2, 56],
    [58, 56],
  ]) {
    canvas.rect(lx, ly, 4, 4, COLOR.uiYellow);
    canvas.frame(lx, ly, 4, 4, COLOR.black);
  }
  return canvas;
}

/** 港を描く。 */
function seaport(): ArtCanvas {
  const canvas = lot(4, 4, COLOR.concrete);
  canvas.rect(0, 40, 64, 24, COLOR.water);
  canvas.rect(0, 40, 64, 2, COLOR.shallow);
  // 桟橋。
  canvas.rect(6, 40, 8, 20, COLOR.brown);
  canvas.rect(30, 40, 8, 20, COLOR.brown);
  // 倉庫とコンテナ。
  canvas.rect(4, 6, 26, 22, COLOR.wallDark);
  canvas.frame(4, 6, 26, 22, COLOR.black);
  canvas.rect(4, 6, 26, 4, COLOR.gray);
  const colors = [COLOR.red, COLOR.blue, COLOR.green, COLOR.orange];
  for (let i = 0; i < 8; i++) {
    canvas.rect(36 + (i % 4) * 7, 8 + Math.floor(i / 4) * 8, 6, 7, colors[i % colors.length]);
    canvas.frame(36 + (i % 4) * 7, 8 + Math.floor(i / 4) * 8, 6, 7, COLOR.black);
  }
  // クレーン。
  canvas.rect(46, 26, 3, 16, COLOR.uiYellow);
  canvas.rect(40, 26, 18, 3, COLOR.uiYellow);
  canvas.rect(40, 29, 2, 6, COLOR.darkGray);
  return canvas;
}

/** 空港を描く。 */
function airport(): ArtCanvas {
  const canvas = lot(6, 6, COLOR.grass);
  // 滑走路。
  canvas.rect(4, 40, 88, 18, COLOR.darkGray);
  canvas.frame(4, 40, 88, 18, COLOR.black);
  for (let x = 8; x < 88; x += 10) canvas.rect(x, 48, 6, 2, COLOR.white);
  // 誘導路とターミナル。
  canvas.rect(20, 30, 56, 8, COLOR.gray);
  canvas.rect(16, 6, 48, 22, COLOR.concreteLight);
  canvas.frame(16, 6, 48, 22, COLOR.black);
  canvas.rect(16, 6, 48, 4, COLOR.roofBlue);
  for (let wx = 20; wx < 62; wx += 8) canvas.rect(wx, 14, 5, 6, COLOR.window);
  // 管制塔。
  canvas.rect(72, 4, 10, 26, COLOR.lightGray);
  canvas.frame(72, 4, 10, 26, COLOR.black);
  canvas.rect(70, 2, 14, 8, COLOR.window);
  canvas.frame(70, 2, 14, 8, COLOR.black);
  // 駐機中の飛行機。
  canvas.rect(30, 62, 30, 5, COLOR.white);
  canvas.rect(28, 63, 4, 3, COLOR.lightGray);
  canvas.rect(40, 58, 6, 14, COLOR.white);
  canvas.rect(56, 59, 4, 6, COLOR.white);
  return canvas;
}

/**
 * 建物の絵を1棟ぶん作る。アイコン生成でも使うためexportしている。
 * @param def 建物定義。
 */
export function buildingArt(def: BuildingDef): ArtCanvas {
  if (def.zone !== ZoneType.none) {
    if (def.level === 0) return emptyLot(def.zone);
    if (def.zone === ZoneType.residential) return residential(def.level);
    if (def.zone === ZoneType.commercial) return commercial(def.level);
    return industrial(def.level);
  }

  switch (def.id) {
    case COAL_PLANT.id:
      return coalPlant();
    case NUCLEAR_PLANT.id:
      return nuclearPlant();
    case POLICE_STATION.id:
      return policeStation();
    case FIRE_STATION.id:
      return fireStation();
    case PARK.id:
      return park();
    case STADIUM.id:
      return stadium();
    case SEAPORT.id:
      return seaport();
    case AIRPORT.id:
      return airport();
    default:
      throw new Error(`絵が用意されていない建物です: ${def.id}`);
  }
}

/**
 * 建物タイルの絵をアトラスへ書き込む。
 * @param tileset 書き込み先のアトラス。
 */
export function paintBuildingTiles(tileset: Tileset): void {
  for (const def of BUILDINGS) {
    tileset.setGrid(def.tileBase, buildingArt(def), def.width, def.height);
  }
}
