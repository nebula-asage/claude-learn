/**
 * ゲーム全体の組み立てとメインループ。
 * @packageDocumentation
 */
import { buildTileset } from "../render/art/index.js";
import { BitmapFont, loadFont } from "../render/font/font.js";
import { MapView, VIEW_HEIGHT, VIEW_WIDTH } from "../render/mapview.js";
import { COLOR } from "../render/palette.js";
import { drawStatusPanel } from "../render/panel.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "../render/screen.js";
import type { Tileset } from "../render/tileset.js";
import { CityMap } from "../sim/map.js";
import { Rng } from "../sim/rng.js";
import { generateTerrain } from "../sim/terrain.js";
import { TILE_SIZE } from "../sim/tiles.js";
import { Input } from "../ui/input.js";

/** キーボードでスクロールするときの速さ（ドット毎秒）。 */
const SCROLL_SPEED = 220;

/** アニメーションを1コマ進める間隔（秒）。 */
const ANIMATION_INTERVAL = 0.2;

/** ゲーム本体。描画・入力・シミュレーションをつなぐ。 */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screen: Screen;
  private readonly input: Input;
  private readonly font: BitmapFont;
  private readonly tileset: Tileset;
  private readonly map: CityMap;
  private readonly view: MapView;

  private animationFrame = 0;
  private animationTimer = 0;
  private lastTime = 0;

  /**
   * @param canvas 描画先のcanvas要素。
   * @param font 読み込み済みのフォント。
   * @param map 遊ぶマップ。
   */
  constructor(canvas: HTMLCanvasElement, font: BitmapFont, map: CityMap) {
    this.canvas = canvas;
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2Dコンテキストを取得できません");
    this.ctx = ctx;

    this.screen = new Screen();
    this.input = new Input(canvas);
    this.font = font;
    this.tileset = buildTileset();
    this.map = map;
    this.view = new MapView(map, this.tileset);
    this.view.centerOn(map.width / 2, map.height / 2);

    window.addEventListener("resize", () => this.fitToWindow());
    this.fitToWindow();
  }

  /** 画面をウィンドウに合わせて整数倍で拡大する。 */
  private fitToWindow(): void {
    const scale = Math.max(
      1,
      Math.min(
        Math.floor(window.innerWidth / SCREEN_WIDTH),
        Math.floor(window.innerHeight / SCREEN_HEIGHT),
      ),
    );
    this.canvas.style.width = `${SCREEN_WIDTH * scale}px`;
    this.canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
  }

  /** メインループを開始する。 */
  start(): void {
    this.lastTime = performance.now();
    const frame = (now: number): void => {
      const delta = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.update(delta);
      this.draw();
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /**
   * 1フレーム分の状態更新。
   * @param delta 前のフレームからの経過秒数。
   */
  private update(delta: number): void {
    this.animationTimer += delta;
    while (this.animationTimer >= ANIMATION_INTERVAL) {
      this.animationTimer -= ANIMATION_INTERVAL;
      this.animationFrame++;
    }

    const step = SCROLL_SPEED * delta;
    let dx = 0;
    let dy = 0;
    if (this.input.isAnyDown("ArrowLeft", "KeyA")) dx -= step;
    if (this.input.isAnyDown("ArrowRight", "KeyD")) dx += step;
    if (this.input.isAnyDown("ArrowUp", "KeyW")) dy -= step;
    if (this.input.isAnyDown("ArrowDown", "KeyS")) dy += step;
    if (dx !== 0 || dy !== 0) this.view.scrollBy(dx, dy);

    // マップ表示部をドラッグしている間は、掴んだ場所が指に付いてくるように動かす。
    if (this.input.pointer.down && this.input.pointer.y < VIEW_HEIGHT) {
      this.view.scrollBy(-this.input.pointerDelta.x, -this.input.pointerDelta.y);
    }
  }

  /** 1フレーム分の描画。 */
  private draw(): void {
    this.screen.clear(COLOR.black);
    this.view.draw(this.screen, this.animationFrame);

    const pointer = this.input.pointer;
    const cursor = pointer.inside ? this.view.tileAt(pointer.x, pointer.y) : null;
    if (cursor) {
      this.screen.setClip(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      this.screen.strokeRect(
        cursor.x * TILE_SIZE - this.view.scrollX,
        cursor.y * TILE_SIZE - this.view.scrollY,
        TILE_SIZE,
        TILE_SIZE,
        COLOR.white,
      );
      this.screen.resetClip();
    }

    drawStatusPanel(this.screen, this.font, {
      cityName: "ドットメトロポリス",
      year: 1900,
      month: 1,
      funds: 20000,
      population: 0,
      cursor,
    });

    this.screen.present(this.ctx);
  }
}

/**
 * 指定したcanvas要素でゲームを起動する。
 * @param canvasId 描画先となるcanvas要素のid。
 */
export async function startGame(canvasId: string): Promise<void> {
  const canvas = document.getElementById(canvasId);
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`画面用のcanvas要素が見つかりません: #${canvasId}`);
  }

  const font = await loadFont();
  const map = generateTerrain(new Rng(Date.now() & 0xffffffff));
  new Game(canvas, font, map).start();
}
