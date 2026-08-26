/**
 * 道路・線路・送電線のドット絵。
 *
 * これらは接続方向の組み合わせで16通りになるため、1枚ずつ描かず、
 * 「中心の塊＋つながっている辺への腕」を手続き的に描いて組み立てる。
 * @packageDocumentation
 */
import { COLOR } from "../palette.js";
import type { Tileset } from "../tileset.js";
import { ArtCanvas } from "./canvas.js";
import { TILE_SIZE, TileId } from "../../sim/tiles.js";

/** 北・東・南・西のビット。 */
const N = 1;
const E = 2;
const S = 4;
const W = 8;

/**
 * 下地の地面を描く。
 * @param canvas 描画先。
 */
function paintGround(canvas: ArtCanvas): void {
  canvas.fill(COLOR.darkGrass);
  for (let i = 0; i < 6; i++) {
    canvas.px((i * 7 + 3) % 16, (i * 5 + 1) % 16, COLOR.grass);
  }
}

/**
 * 道路を描く。
 * @param canvas 描画先。
 * @param mask 接続方向のビットマスク。
 */
function paintRoad(canvas: ArtCanvas, mask: number): void {
  const road = COLOR.road;
  canvas.rect(3, 3, 10, 10, road);
  if (mask & N) canvas.rect(3, 0, 10, 4, road);
  if (mask & S) canvas.rect(3, 12, 10, 4, road);
  if (mask & W) canvas.rect(0, 3, 4, 10, road);
  if (mask & E) canvas.rect(12, 3, 4, 10, road);

  // 路肩の線。直線の場合だけ中央線を入れる。
  if (mask === (N | S)) {
    canvas.rect(2, 0, 1, 16, COLOR.darkGray);
    canvas.rect(13, 0, 1, 16, COLOR.darkGray);
    for (let y = 1; y < 16; y += 4) canvas.rect(7, y, 2, 2, COLOR.roadLine);
  } else if (mask === (E | W)) {
    canvas.rect(0, 2, 16, 1, COLOR.darkGray);
    canvas.rect(0, 13, 16, 1, COLOR.darkGray);
    for (let x = 1; x < 16; x += 4) canvas.rect(x, 7, 2, 2, COLOR.roadLine);
  } else if (mask === 0) {
    canvas.rect(4, 4, 8, 8, road);
    canvas.frame(4, 4, 8, 8, COLOR.darkGray);
  }
}

/**
 * 線路を描く。
 * @param canvas 描画先。
 * @param mask 接続方向のビットマスク。
 */
function paintRail(canvas: ArtCanvas, mask: number): void {
  const bed = COLOR.gray;
  const tie = COLOR.rail;
  canvas.rect(5, 5, 6, 6, bed);
  if (mask & N) canvas.rect(5, 0, 6, 6, bed);
  if (mask & S) canvas.rect(5, 10, 6, 6, bed);
  if (mask & W) canvas.rect(0, 5, 6, 6, bed);
  if (mask & E) canvas.rect(10, 5, 6, 6, bed);

  const vertical = (mask & (N | S)) !== 0;
  const horizontal = (mask & (E | W)) !== 0;
  if (vertical || mask === 0) {
    for (let y = 1; y < 16; y += 3) canvas.rect(5, y, 6, 1, tie);
    canvas.rect(6, 0, 1, 16, COLOR.lightGray);
    canvas.rect(9, 0, 1, 16, COLOR.lightGray);
  }
  if (horizontal) {
    for (let x = 1; x < 16; x += 3) canvas.rect(x, 5, 1, 6, tie);
    canvas.rect(0, 6, 16, 1, COLOR.lightGray);
    canvas.rect(0, 9, 16, 1, COLOR.lightGray);
  }
}

/**
 * 送電線を描く。
 * @param canvas 描画先。
 * @param mask 接続方向のビットマスク。
 */
function paintWire(canvas: ArtCanvas, mask: number): void {
  if (mask & N) canvas.rect(7, 0, 2, 8, COLOR.wire);
  if (mask & S) canvas.rect(7, 8, 2, 8, COLOR.wire);
  if (mask & W) canvas.rect(0, 7, 8, 2, COLOR.wire);
  if (mask & E) canvas.rect(8, 7, 8, 2, COLOR.wire);

  // 鉄塔。
  canvas.rect(5, 5, 6, 6, COLOR.darkGray);
  canvas.rect(6, 6, 4, 4, COLOR.lightGray);
  canvas.px(6, 6, COLOR.gray);
  canvas.px(9, 9, COLOR.gray);
  if (mask === 0) {
    canvas.rect(7, 2, 2, 12, COLOR.wire);
    canvas.rect(2, 7, 12, 2, COLOR.wire);
  }
}

/**
 * 水面の下地を描く（橋タイル用）。
 * @param canvas 描画先。
 */
function paintWaterGround(canvas: ArtCanvas): void {
  canvas.fill(COLOR.water);
  canvas.rect(0, 0, 16, 2, COLOR.deepWater);
  canvas.rect(0, 14, 16, 2, COLOR.deepWater);
  canvas.rect(2, 4, 3, 1, COLOR.shallow);
  canvas.rect(10, 10, 3, 1, COLOR.shallow);
}

/**
 * 橋の桁を描く。
 * @param canvas 描画先。
 * @param vertical 縦向きの橋なら `true`。
 * @param deck 桁の色。
 */
function paintBridgeDeck(canvas: ArtCanvas, vertical: boolean, deck: number): void {
  if (vertical) {
    canvas.rect(3, 0, 10, 16, deck);
    canvas.rect(2, 0, 1, 16, COLOR.lightGray);
    canvas.rect(13, 0, 1, 16, COLOR.lightGray);
  } else {
    canvas.rect(0, 3, 16, 10, deck);
    canvas.rect(0, 2, 16, 1, COLOR.lightGray);
    canvas.rect(0, 13, 16, 1, COLOR.lightGray);
  }
}

/**
 * 道路・線路・送電線のタイル絵をアトラスへ書き込む。
 * @param tileset 書き込み先のアトラス。
 */
export function paintNetworkTiles(tileset: Tileset): void {
  for (let mask = 0; mask < 16; mask++) {
    const road = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintGround(road);
    paintRoad(road, mask);
    tileset.setCanvas(TileId.Road + mask, road);

    const rail = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintGround(rail);
    paintRail(rail, mask);
    tileset.setCanvas(TileId.Rail + mask, rail);

    const wire = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintGround(wire);
    paintWire(wire, mask);
    tileset.setCanvas(TileId.Wire + mask, wire);
  }

  // 交差タイル。0番が「縦の主役＋横の脇役」、1番がその逆。
  for (let i = 0; i < 2; i++) {
    const mainMask = i === 0 ? N | S : E | W;
    const crossMask = i === 0 ? E | W : N | S;

    const roadRail = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintGround(roadRail);
    paintRoad(roadRail, mainMask);
    paintRail(roadRail, crossMask);
    tileset.setCanvas(TileId.RoadRail + i, roadRail);

    const roadWire = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintGround(roadWire);
    paintRoad(roadWire, mainMask);
    paintWire(roadWire, crossMask);
    tileset.setCanvas(TileId.RoadWire + i, roadWire);

    const railWire = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintGround(railWire);
    paintRail(railWire, mainMask);
    paintWire(railWire, crossMask);
    tileset.setCanvas(TileId.RailWire + i, railWire);
  }

  // 橋・水上の鉄塔。0番が縦、1番が横。
  for (let i = 0; i < 2; i++) {
    const vertical = i === 0;

    const roadBridge = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintWaterGround(roadBridge);
    paintBridgeDeck(roadBridge, vertical, COLOR.road);
    if (vertical) {
      for (let y = 1; y < 16; y += 4) roadBridge.rect(7, y, 2, 2, COLOR.roadLine);
    } else {
      for (let x = 1; x < 16; x += 4) roadBridge.rect(x, 7, 2, 2, COLOR.roadLine);
    }
    tileset.setCanvas(TileId.RoadBridge + i, roadBridge);

    const railBridge = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintWaterGround(railBridge);
    paintBridgeDeck(railBridge, vertical, COLOR.gray);
    paintRail(railBridge, vertical ? N | S : E | W);
    tileset.setCanvas(TileId.RailBridge + i, railBridge);

    const wireBridge = new ArtCanvas(TILE_SIZE, TILE_SIZE);
    paintWaterGround(wireBridge);
    paintWire(wireBridge, vertical ? N | S : E | W);
    tileset.setCanvas(TileId.WireBridge + i, wireBridge);
  }
}
