/**
 * ゲーム全体の組み立てとメインループ。
 * @packageDocumentation
 */
import { buildTileset } from "../render/art/index.js";
import { buildIconAtlas } from "../render/art/icons.js";
import { BitmapFont, loadFont } from "../render/font/font.js";
import { MapView, VIEW_HEIGHT, VIEW_WIDTH } from "../render/mapview.js";
import { COLOR } from "../render/palette.js";
import { drawPanel, toolIndexAt } from "../render/panel.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "../render/screen.js";
import type { Tileset } from "../render/tileset.js";
import { canPlaceStructure } from "../sim/build.js";
import { Rng } from "../sim/rng.js";
import { CityState } from "../sim/state.js";
import { generateTerrain } from "../sim/terrain.js";
import { TILE_SIZE, type TilePos } from "../sim/tiles.js";
import { Input } from "../ui/input.js";
import { TOOLS, applyTool, toolOrigin } from "../ui/tools.js";

/** キーボードでスクロールするときの速さ（ドット毎秒）。 */
const SCROLL_SPEED = 220;

/** アニメーションを1コマ進める間隔（秒）。 */
const ANIMATION_INTERVAL = 0.2;

/** 通知を表示し続ける秒数。 */
const MESSAGE_DURATION = 2.5;

/** 道具を数字キーで選ぶときの、キーと並び順の対応。 */
const TOOL_HOTKEYS = [
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9",
  "Digit0",
];

/** ゲーム本体。描画・入力・シミュレーションをつなぐ。 */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screen: Screen;
  private readonly input: Input;
  private readonly font: BitmapFont;
  private readonly tileset: Tileset;
  private readonly icons: Tileset;
  private readonly state: CityState;
  private readonly view: MapView;

  private selectedTool = 2;
  private message = "";
  private messageTimer = 0;
  private lastBuiltTile: TilePos | null = null;
  private animationFrame = 0;
  private animationTimer = 0;
  private lastTime = 0;

  /**
   * @param canvas 描画先のcanvas要素。
   * @param font 読み込み済みのフォント。
   * @param state 遊ぶ都市の状態。
   */
  constructor(canvas: HTMLCanvasElement, font: BitmapFont, state: CityState) {
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
    this.icons = buildIconAtlas(
      TOOLS.map((tool) => tool.icon),
      this.tileset,
    );
    this.state = state;
    this.view = new MapView(state.map, this.tileset);
    this.view.centerOn(state.map.width / 2, state.map.height / 2);

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
   * 通知を出す。
   * @param text 表示する文章。
   */
  private notify(text: string): void {
    if (!text) return;
    this.message = text;
    this.messageTimer = MESSAGE_DURATION;
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
    if (this.messageTimer > 0) {
      this.messageTimer -= delta;
      if (this.messageTimer <= 0) this.message = "";
    }

    this.updateScroll(delta);
    this.updateToolSelection();
    this.updateBuilding();
  }

  /**
   * スクロール操作を処理する。
   * @param delta 前のフレームからの経過秒数。
   */
  private updateScroll(delta: number): void {
    const step = SCROLL_SPEED * delta;
    let dx = 0;
    let dy = 0;
    if (this.input.isAnyDown("ArrowLeft", "KeyA")) dx -= step;
    if (this.input.isAnyDown("ArrowRight", "KeyD")) dx += step;
    if (this.input.isAnyDown("ArrowUp", "KeyW")) dy -= step;
    if (this.input.isAnyDown("ArrowDown", "KeyS")) dy += step;
    if (dx !== 0 || dy !== 0) this.view.scrollBy(dx, dy);

    // 右ドラッグは地図の移動。掴んだ場所が指に付いてくるように動かす。
    if (this.input.pointer.rightDown && this.input.pointer.y < VIEW_HEIGHT) {
      this.view.scrollBy(-this.input.pointerDelta.x, -this.input.pointerDelta.y);
    }
  }

  /** 道具の選択を処理する。 */
  private updateToolSelection(): void {
    TOOL_HOTKEYS.forEach((code, index) => {
      if (this.input.wasPressed(code) && index < TOOLS.length) this.selectedTool = index;
    });
    if (this.input.wasPressed("BracketLeft")) {
      this.selectedTool = (this.selectedTool + TOOLS.length - 1) % TOOLS.length;
    }
    if (this.input.wasPressed("BracketRight")) {
      this.selectedTool = (this.selectedTool + 1) % TOOLS.length;
    }

    const pointer = this.input.pointer;
    if (this.input.clicked) {
      const index = toolIndexAt(pointer.x, pointer.y, TOOLS.length);
      if (index !== null) this.selectedTool = index;
    }
  }

  /** マップ上の建設操作を処理する。 */
  private updateBuilding(): void {
    const pointer = this.input.pointer;
    if (!pointer.down) {
      this.lastBuiltTile = null;
      return;
    }
    if (pointer.y >= VIEW_HEIGHT) return;

    const tool = TOOLS[this.selectedTool];
    const target = this.view.tileAt(pointer.x, pointer.y);
    if (!target) return;

    // ドラッグで置ける道具は、カーソルが別のマスへ移るたびに1回だけ適用する。
    const isNewTile =
      this.lastBuiltTile === null ||
      this.lastBuiltTile.x !== target.x ||
      this.lastBuiltTile.y !== target.y;
    if (!isNewTile) return;
    if (!this.input.clicked && !tool.drag) return;

    this.lastBuiltTile = target;
    const result = applyTool(this.state, tool, target.x, target.y);
    this.notify(result.message);
  }

  /** 1フレーム分の描画。 */
  private draw(): void {
    this.screen.clear(COLOR.black);
    this.view.draw(this.screen, this.animationFrame);
    this.drawCursor();

    const pointer = this.input.pointer;
    const cursor = pointer.inside ? this.view.tileAt(pointer.x, pointer.y) : null;
    const tool = TOOLS[this.selectedTool];

    drawPanel(this.screen, this.font, this.icons, TOOLS.length, this.selectedTool, {
      cityName: this.state.cityName,
      year: this.state.year,
      month: this.state.month,
      funds: this.state.funds,
      population: 0,
      toolName: tool.name,
      toolCost: tool.cost,
      message: this.message,
      cursor,
    });

    this.screen.present(this.ctx);
  }

  /** 選択中の道具が占める範囲をカーソルとして描く。 */
  private drawCursor(): void {
    const pointer = this.input.pointer;
    if (!pointer.inside || pointer.y >= VIEW_HEIGHT) return;
    const target = this.view.tileAt(pointer.x, pointer.y);
    if (!target) return;

    const tool = TOOLS[this.selectedTool];
    const origin = toolOrigin(tool, target.x, target.y);
    const size = tool.footprint;
    const placeable =
      tool.footprint === 1 || canPlaceStructure(this.state.map, origin.x, origin.y, size, size);
    const color = !this.state.canAfford(tool.cost) || !placeable ? COLOR.red : COLOR.white;

    this.screen.setClip(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.screen.strokeRect(
      origin.x * TILE_SIZE - this.view.scrollX,
      origin.y * TILE_SIZE - this.view.scrollY,
      TILE_SIZE * size,
      TILE_SIZE * size,
      color,
    );
    this.screen.resetClip();
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
  const seed = Date.now() & 0xffffffff;
  const map = generateTerrain(new Rng(seed));
  const state = new CityState(map, new Rng(seed ^ 0x5bf03635), 20000, "ドットメトロポリス");
  new Game(canvas, font, state).start();
}
