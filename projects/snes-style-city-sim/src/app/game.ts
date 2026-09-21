/**
 * 遊んでいる最中の画面。入力・シミュレーション・描画をつなぐ。
 * @packageDocumentation
 */
import { drawAdvisor, drawDisasterEntities } from "../render/entities.js";
import { MapView, VIEW_HEIGHT, VIEW_WIDTH } from "../render/mapview.js";
import { DATA_MAP_NAMES, DataMap, type DataMapValue, drawDataMap } from "../render/overlays.js";
import { COLOR } from "../render/palette.js";
import { drawPanel, toolIndexAt } from "../render/panel.js";
import { canPlaceStructure } from "../sim/build.js";
import type { AdvisorMessage } from "../sim/messages.js";
import { isToolUnlocked, titleFor } from "../sim/milestones.js";
import { type Scenario, scenarioStatus } from "../sim/scenario.js";
import { SPEEDS, Simulation } from "../sim/simulation.js";
import type { CityState } from "../sim/state.js";
import { TILE_SIZE, type TilePos } from "../sim/tiles.js";
import {
  BudgetModal,
  DisasterModal,
  EvaluationModal,
  GraphModal,
  type Modal,
  ResultModal,
  SystemModal,
} from "../ui/modals.js";
import type { AppNavigation, UiScreen } from "../ui/screens.js";
import { TOOLS, applyTool, toolOrigin } from "../ui/tools.js";
import type { GameContext } from "./context.js";

/** キーボードでスクロールするときの速さ（ドット毎秒）。 */
const SCROLL_SPEED = 220;

/** アニメーションを1コマ進める間隔（秒）。 */
const ANIMATION_INTERVAL = 0.2;

/** パネルの通知を表示し続ける秒数。 */
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

/** 遊んでいる最中の画面。 */
export class Game implements UiScreen {
  private readonly context: GameContext;
  private readonly nav: AppNavigation;
  /** 遊んでいる都市の状態。 */
  readonly state: CityState;
  /** 遊んでいるシナリオ。自由に遊ぶモードなら `null`。 */
  readonly scenario: Scenario | null;

  private readonly simulation: Simulation;
  private readonly view: MapView;

  private speed = 2;
  private tickAccumulator = 0;
  private selectedTool = 2;
  private modal: Modal | null = null;
  private dataMap: DataMapValue = DataMap.none;
  private advisorMessage: AdvisorMessage | null = null;
  private advisorTimer = 0;
  private message = "";
  private messageTimer = 0;
  private lastBuiltTile: TilePos | null = null;
  private animationFrame = 0;
  private animationTimer = 0;
  private finished = false;
  private wasCalm = true;

  /**
   * @param context 共有の道具立て。
   * @param state 遊ぶ都市の状態。
   * @param scenario 遊ぶシナリオ。自由に遊ぶモードなら `null`。
   * @param nav 画面切り替えの窓口。
   */
  constructor(
    context: GameContext,
    state: CityState,
    scenario: Scenario | null,
    nav: AppNavigation,
  ) {
    this.context = context;
    this.state = state;
    this.scenario = scenario;
    this.nav = nav;
    this.simulation = new Simulation(state);
    this.view = new MapView(state.map, context.tileset);
    this.view.centerOn(state.map.width / 2, state.map.height / 2);

    if (scenario) {
      state.messages.push(`${scenario.name}: ${scenario.goalText}`, "info");
    }
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
   * アドバイザーの一言を表示する。
   * @param message 表示する助言。
   */
  private showAdvice(message: AdvisorMessage): void {
    this.advisorMessage = message;
    this.advisorTimer = ADVISOR_DURATION;
  }

  /**
   * 1フレーム分の状態更新。
   * @param delta 前のフレームからの経過秒数。
   */
  update(delta: number): void {
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
      this.modal = this.createBudgetModal();
      this.context.audio.play("window");
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
    this.updateMusic();
    this.checkScenario();
  }

  /** 災害の有無に合わせてBGMを切り替える。 */
  private updateMusic(): void {
    const inDanger = this.state.entities.length > 0 || this.simulation.disasters.burningCount > 0;
    // 落ち着いた状態から急に危険になった瞬間だけ、災害の効果音を鳴らす。
    if (inDanger && this.wasCalm) this.context.audio.play("disaster");
    this.wasCalm = !inDanger;
    this.context.audio.playMusic(inDanger ? "disaster" : "city");
  }

  /** 予算ウィンドウを作る。決算したときに音を鳴らす。 */
  private createBudgetModal(): Modal {
    return new BudgetModal(this.state, () => {
      this.simulation.settleBudget();
      this.context.audio.play("coin");
    });
  }

  /**
   * アドバイザーの吹き出しの出し入れを行う。
   * @param delta 前のフレームからの経過秒数。
   */
  private updateAdvisor(delta: number): void {
    if (this.advisorMessage) {
      this.advisorTimer -= delta;
      // クリックでも読み飛ばせるようにする。
      if (this.advisorTimer <= 0 || (this.context.input.clicked && !this.modal)) {
        this.advisorMessage = null;
      }
      return;
    }
    const next = this.state.messages.shift();
    if (next) {
      if (next.tone === "good") this.context.audio.play("milestone");
      this.showAdvice(next);
    }
  }

  /** 開いているウィンドウへの入力を処理する。 */
  private updateModal(): void {
    const modal = this.modal;
    if (!modal) return;
    const input = this.context.input;
    if (input.clicked) modal.click(input.pointer.x, input.pointer.y);
    // 年度末の予算は「決定」でしか閉じられない（決算を飛ばせないようにする）。
    const closable = !this.simulation.pendingBudget && !this.finished;
    if (modal.done || (closable && input.wasPressed("Escape"))) this.modal = null;
  }

  /** ウィンドウの開閉とデータマップの切り替えを処理する。 */
  private updateWindows(): void {
    const input = this.context.input;
    const before = this.modal;
    if (input.wasPressed("KeyB")) this.modal = this.createBudgetModal();
    if (input.wasPressed("KeyE")) this.modal = new EvaluationModal(this.state);
    if (input.wasPressed("KeyG")) this.modal = new GraphModal(this.state);
    if (input.wasPressed("KeyX")) {
      this.modal = new DisasterModal(this.state, this.simulation.disasters, (message) =>
        this.showAdvice({ text: message, tone: "warning" }),
      );
    }
    if (input.wasPressed("Escape")) {
      this.modal = new SystemModal(this.state, this.scenario?.id ?? null, () =>
        this.nav.showTitle(),
      );
    }
    if (this.modal !== before) this.context.audio.play("window");

    if (input.wasPressed("KeyV")) {
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
    const input = this.context.input;
    if (input.wasPressed("Space")) {
      this.speed = this.speed === 0 ? 2 : 0;
      this.notify(`進行: ${SPEEDS[this.speed].name}`);
    }
    if (input.wasPressed("Minus") && this.speed > 0) {
      this.speed--;
      this.notify(`進行: ${SPEEDS[this.speed].name}`);
    }
    if (input.wasPressed("Equal") && this.speed < SPEEDS.length - 1) {
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

  /** シナリオの達成・失敗を判定する。 */
  private checkScenario(): void {
    if (!this.scenario || this.finished) return;
    const status = scenarioStatus(this.scenario, this.state);
    if (status === "playing") return;

    this.finished = true;
    this.speed = 0;
    this.modal = new ResultModal(
      status === "achieved",
      this.scenario.name,
      status === "achieved"
        ? `${this.scenario.goalText} を達成しました!`
        : `期限の${this.scenario.years}年が過ぎました。`,
      this.state,
      () => this.nav.showTitle(),
    );
  }

  /**
   * スクロール操作を処理する。
   * @param delta 前のフレームからの経過秒数。
   */
  private updateScroll(delta: number): void {
    const input = this.context.input;
    const step = SCROLL_SPEED * delta;
    let dx = 0;
    let dy = 0;
    if (input.isAnyDown("ArrowLeft", "KeyA")) dx -= step;
    if (input.isAnyDown("ArrowRight", "KeyD")) dx += step;
    if (input.isAnyDown("ArrowUp", "KeyW")) dy -= step;
    if (input.isAnyDown("ArrowDown", "KeyS")) dy += step;
    if (dx !== 0 || dy !== 0) this.view.scrollBy(dx, dy);

    // 右ドラッグは地図の移動。掴んだ場所が指に付いてくるように動かす。
    if (input.pointer.rightDown && input.pointer.y < VIEW_HEIGHT) {
      this.view.scrollBy(-input.pointerDelta.x, -input.pointerDelta.y);
    }
  }

  /** 道具の選択を処理する。 */
  private updateToolSelection(): void {
    const input = this.context.input;
    const previous = this.selectedTool;
    TOOL_HOTKEYS.forEach((code, index) => {
      if (input.wasPressed(code) && index < TOOLS.length) this.selectedTool = index;
    });
    if (input.wasPressed("BracketLeft")) {
      this.selectedTool = (this.selectedTool + TOOLS.length - 1) % TOOLS.length;
    }
    if (input.wasPressed("BracketRight")) {
      this.selectedTool = (this.selectedTool + 1) % TOOLS.length;
    }
    if (input.clicked) {
      const index = toolIndexAt(input.pointer.x, input.pointer.y, TOOLS.length);
      if (index !== null) this.selectedTool = index;
    }
    if (this.selectedTool !== previous) this.context.audio.play("select");
  }

  /** マップ上の建設操作を処理する。 */
  private updateBuilding(): void {
    const input = this.context.input;
    const pointer = input.pointer;
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
    if (!input.clicked && !tool.drag) return;

    this.lastBuiltTile = target;
    const result = applyTool(this.state, tool, target.x, target.y);
    this.notify(result.message);

    if (result.ok && result.cost > 0) {
      this.context.audio.play(tool.id === "bulldoze" ? "bulldoze" : "build");
      // 建てた直後に通電状態を反映させ、送電線をつないだ手応えがすぐ出るようにする。
      this.simulation.refreshPower();
    } else if (!result.ok && result.message) {
      this.context.audio.play("error");
    }
  }

  /** 1フレーム分の描画。 */
  draw(): void {
    const { screen, font, sprites, icons, input } = this.context;
    screen.clear(COLOR.black);
    this.view.draw(screen, this.animationFrame);
    drawDisasterEntities(screen, this.state, sprites, this.view, this.animationFrame);
    drawDataMap(screen, this.state, this.view, this.dataMap);
    if (this.dataMap !== DataMap.none) {
      font.drawTextShadow(screen, DATA_MAP_NAMES[this.dataMap], 4, 4, COLOR.white, COLOR.black);
    }
    if (this.scenario) {
      const remaining = this.scenario.years - (this.state.year - 1900);
      font.drawTextShadow(
        screen,
        `${this.scenario.name}  のこり${Math.max(0, remaining)}年`,
        4,
        VIEW_HEIGHT - 12,
        COLOR.uiYellow,
        COLOR.black,
      );
    }
    if (!this.modal) this.drawCursor();

    if (this.advisorMessage) {
      drawAdvisor(screen, font, sprites, this.advisorMessage);
    }

    const cursor = input.pointer.inside ? this.view.tileAt(input.pointer.x, input.pointer.y) : null;
    const tool = TOOLS[this.selectedTool];
    const locked = TOOLS.map((t) => !isToolUnlocked(t.id, this.state.stats.population));

    drawPanel(screen, font, icons, locked, this.selectedTool, {
      cityName: `${this.state.cityName}(${titleFor(this.state.stats.population)})`,
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

    this.modal?.draw(screen, font);
  }

  /** 選択中の道具が占める範囲をカーソルとして描く。 */
  private drawCursor(): void {
    const { screen, input } = this.context;
    const pointer = input.pointer;
    if (!pointer.inside || pointer.y >= VIEW_HEIGHT) return;
    const target = this.view.tileAt(pointer.x, pointer.y);
    if (!target) return;

    const tool = TOOLS[this.selectedTool];
    const origin = toolOrigin(tool, target.x, target.y);
    const size = tool.footprint;
    const placeable =
      tool.footprint === 1 || canPlaceStructure(this.state.map, origin.x, origin.y, size, size);
    const affordable = this.state.canAfford(tool.cost);
    const unlocked = isToolUnlocked(tool.id, this.state.stats.population);
    const color = !affordable || !placeable || !unlocked ? COLOR.red : COLOR.white;

    screen.setClip(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    screen.strokeRect(
      origin.x * TILE_SIZE - this.view.scrollX,
      origin.y * TILE_SIZE - this.view.scrollY,
      TILE_SIZE * size,
      TILE_SIZE * size,
      color,
    );
    screen.resetClip();
  }
}
