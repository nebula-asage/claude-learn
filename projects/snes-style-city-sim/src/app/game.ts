/**
 * ゲーム全体の組み立てとメインループ。
 * @packageDocumentation
 */
import { buildTileset } from "../render/art/index.js";
import { buildIconAtlas } from "../render/art/icons.js";
import { type SpriteImage, type SpriteName, buildSprites } from "../render/art/sprites.js";
import { drawAdvisor, drawDisasterEntities } from "../render/entities.js";
import { BitmapFont, loadFont } from "../render/font/font.js";
import { MapView, VIEW_HEIGHT, VIEW_WIDTH } from "../render/mapview.js";
import { COLOR } from "../render/palette.js";
import { DATA_MAP_NAMES, DataMap, type DataMapValue, drawDataMap } from "../render/overlays.js";
import { drawPanel, toolIndexAt } from "../render/panel.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "../render/screen.js";
import type { Tileset } from "../render/tileset.js";
import { canPlaceStructure } from "../sim/build.js";
import { Rng } from "../sim/rng.js";
import type { AdvisorMessage } from "../sim/messages.js";
import { isToolUnlocked } from "../sim/milestones.js";
import { SPEEDS, Simulation } from "../sim/simulation.js";
import { CityState } from "../sim/state.js";
import { generateTerrain } from "../sim/terrain.js";
import { TILE_SIZE, type TilePos } from "../sim/tiles.js";
import { Input } from "../ui/input.js";
import {
  BudgetModal,
  DisasterModal,
  EvaluationModal,
  GraphModal,
  type Modal,
} from "../ui/modals.js";
import { TOOLS, applyTool, toolOrigin } from "../ui/tools.js";

/** キーボードでスクロールするときの速さ（ドット毎秒）。 */
const SCROLL_SPEED = 220;

/** アニメーションを1コマ進める間隔（秒）。 */
const ANIMATION_INTERVAL = 0.2;

/** 通知を表示し続ける秒数。 */
const MESSAGE_DURATION = 2.5;

/** アドバイザーの吹き出しを表示し続ける秒数。 */
const ADVISOR_DURATION = 7;

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
  private readonly sprites: Record<SpriteName, SpriteImage[]>;
  private readonly state: CityState;
  private readonly simulation: Simulation;
  private readonly view: MapView;

  private speed = 2;
  private tickAccumulator = 0;
  private selectedTool = 2;
  private modal: Modal | null = null;
  private advisorMessage: AdvisorMessage | null = null;
  private advisorTimer = 0;
  private dataMap: DataMapValue = DataMap.none;
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
    this.sprites = buildSprites();
    this.state = state;
    this.simulation = new Simulation(state);
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
    this.updateAdvisor(delta);

    // 予算画面など、ウィンドウが開いている間は時間を止めて操作だけを受け付ける。
    if (this.simulation.pendingBudget && !this.modal) {
      this.modal = new BudgetModal(this.state, () => this.simulation.settleBudget());
    }
    if (this.modal) {
      this.updateModal();
      return;
    }

    this.updateScroll(delta);
    this.updateToolSelection();
    this.updateWindows();
    this.updateBuilding();
    this.updateSimulation(delta);
  }

  /**
   * アドバイザーの吹き出しの出し入れを行う。
   * @param delta 前のフレームからの経過秒数。
   */
  private updateAdvisor(delta: number): void {
    if (this.advisorMessage) {
      this.advisorTimer -= delta;
      // クリックでも読み飛ばせるようにする。
      if (this.advisorTimer <= 0 || (this.input.clicked && !this.modal)) {
        this.advisorMessage = null;
      }
      return;
    }
    const next = this.state.messages.shift();
    if (next) this.showAdvice(next);
  }

  /**
   * アドバイザーの一言を表示する。
   * @param message 表示する助言。
   */
  private showAdvice(message: AdvisorMessage): void {
    this.advisorMessage = message;
    this.advisorTimer = ADVISOR_DURATION;
  }

  /** 開いているウィンドウへの入力を処理する。 */
  private updateModal(): void {
    const modal = this.modal;
    if (!modal) return;
    if (this.input.clicked) modal.click(this.input.pointer.x, this.input.pointer.y);
    // 年度末の予算は「決定」でしか閉じられない（決算を飛ばせないようにする）。
    const closable = !this.simulation.pendingBudget;
    if (modal.done || (closable && this.input.wasPressed("Escape"))) this.modal = null;
  }

  /** ウィンドウの開閉とデータマップの切り替えを処理する。 */
  private updateWindows(): void {
    if (this.input.wasPressed("KeyB")) {
      this.modal = new BudgetModal(this.state, () => this.simulation.settleBudget());
    }
    if (this.input.wasPressed("KeyE")) this.modal = new EvaluationModal(this.state);
    if (this.input.wasPressed("KeyD")) {
      this.modal = new DisasterModal(this.state, this.simulation.disasters, (message) =>
        this.showAdvice({ text: message, tone: "warning" }),
      );
    }
    if (this.input.wasPressed("KeyG")) this.modal = new GraphModal(this.state);

    if (this.input.wasPressed("KeyV")) {
      const modes = Object.values(DataMap);
      this.dataMap = modes[(modes.indexOf(this.dataMap) + 1) % modes.length];
      this.notify(DATA_MAP_NAMES[this.dataMap]);
    }
  }

  /**
   * 経過時間に応じてシミュレーションを進める。
   * @param delta 前のフレームからの経過秒数。
   */
  private updateSimulation(delta: number): void {
    if (this.input.wasPressed("Space")) {
      this.speed = this.speed === 0 ? 2 : 0;
      this.notify(`進行: ${SPEEDS[this.speed].name}`);
    }
    if (this.input.wasPressed("Minus") && this.speed > 0) {
      this.speed--;
      this.notify(`進行: ${SPEEDS[this.speed].name}`);
    }
    if (this.input.wasPressed("Equal") && this.speed < SPEEDS.length - 1) {
      this.speed++;
      this.notify(`進行: ${SPEEDS[this.speed].name}`);
    }

    const ticksPerSecond = SPEEDS[this.speed].ticksPerSecond;
    if (ticksPerSecond <= 0) {
      this.tickAccumulator = 0;
      return;
    }

    this.tickAccumulator += delta * ticksPerSecond;
    // 処理が追いつかないときに際限なく溜め込まないよう、1フレームの上限を決めておく。
    let budget = 8;
    while (this.tickAccumulator >= 1 && budget-- > 0) {
      this.tickAccumulator -= 1;
      this.simulation.tick();
    }
    if (budget <= 0) this.tickAccumulator = 0;
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
    // 建てた直後に通電状態を反映させ、送電線をつないだ手応えがすぐ出るようにする。
    if (result.ok && result.cost > 0) this.simulation.refreshPower();
  }

  /** 1フレーム分の描画。 */
  private draw(): void {
    this.screen.clear(COLOR.black);
    this.view.draw(this.screen, this.animationFrame);
    drawDisasterEntities(this.screen, this.state, this.sprites, this.view, this.animationFrame);
    drawDataMap(this.screen, this.state, this.view, this.dataMap);
    if (this.dataMap !== DataMap.none) {
      this.font.drawTextShadow(
        this.screen,
        DATA_MAP_NAMES[this.dataMap],
        4,
        4,
        COLOR.white,
        COLOR.black,
      );
    }
    if (!this.modal) this.drawCursor();

    const pointer = this.input.pointer;
    const cursor = pointer.inside ? this.view.tileAt(pointer.x, pointer.y) : null;
    const tool = TOOLS[this.selectedTool];

    if (this.advisorMessage) {
      drawAdvisor(this.screen, this.font, this.sprites, this.advisorMessage);
    }

    const locked = TOOLS.map((t) => !isToolUnlocked(t.id, this.state.stats.population));
    drawPanel(this.screen, this.font, this.icons, locked, this.selectedTool, {
      cityName: this.state.cityName,
      year: this.state.year,
      month: this.state.month,
      funds: this.state.funds,
      population: this.state.stats.population,
      demand: this.state.demand,
      speedName: SPEEDS[this.speed].name,
      powerShortage: this.state.power.demand > this.state.power.supply,
      toolName: tool.name,
      toolCost: tool.cost,
      message: this.message,
      cursor,
    });

    this.modal?.draw(this.screen, this.font);
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
