/**
 * アプリ全体の進行役。タイトルと遊んでいる最中の画面を切り替え、メインループを回す。
 * @packageDocumentation
 */
import { loadFont } from "../render/font/font.js";
import type { Scenario } from "../sim/scenario.js";
import { scenarioById } from "../sim/scenario.js";
import type { CityState } from "../sim/state.js";
import type { AppNavigation, UiScreen } from "../ui/screens.js";
import { NewCityScreen, ScenarioScreen, TitleScreen } from "../ui/screens.js";
import { loadCity, readSave } from "../ui/storage.js";
import { type GameContext, createContext, fitToWindow } from "./context.js";
import { Game } from "./game.js";

/** 画面の切り替えとメインループを受け持つ。 */
export class App implements AppNavigation {
  private readonly context: GameContext;
  private current: UiScreen;
  private lastTime = 0;

  /**
   * @param context 共有の道具立て。
   */
  constructor(context: GameContext) {
    this.context = context;
    this.current = new TitleScreen(context, this);
    window.addEventListener("resize", () => fitToWindow(context.canvas));
    fitToWindow(context.canvas);
  }

  /** タイトル画面へ戻る。 */
  showTitle(): void {
    this.current = new TitleScreen(this.context, this);
  }

  /** 新しい街の画面へ移る。 */
  showNewCity(): void {
    this.current = new NewCityScreen(this.context, this);
  }

  /** シナリオ選択の画面へ移る。 */
  showScenarios(): void {
    this.current = new ScenarioScreen(this.context, this);
  }

  /**
   * 自由に遊ぶモードを始める。
   * @param state 遊ぶ都市の状態。
   */
  startFreePlay(state: CityState): void {
    this.current = new Game(this.context, state, null, this);
  }

  /**
   * シナリオを始める。街の生成には少し時間がかかる。
   * @param scenario 遊ぶシナリオ。
   */
  startScenario(scenario: Scenario): void {
    this.current = new Game(this.context, scenario.build(), scenario, this);
  }

  /**
   * 保存した都市を読み込んで再開する。
   * @param slot 読み込む枠の番号。
   */
  loadSlot(slot: number): void {
    const state = loadCity(slot);
    if (!state) return;
    const scenarioId = readSave(slot)?.scenarioId ?? null;
    this.current = new Game(
      this.context,
      state,
      scenarioId ? scenarioById(scenarioId) : null,
      this,
    );
  }

  /** メインループを開始する。 */
  start(): void {
    this.lastTime = performance.now();
    const frame = (now: number): void => {
      const delta = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.current.update(delta);
      this.current.draw();
      this.context.screen.present(this.context.ctx);
      this.context.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

/**
 * 指定したcanvas要素でゲームを起動する。
 * @param canvasId 描画先となるcanvas要素のid。
 */
export async function startApp(canvasId: string): Promise<void> {
  const canvas = document.getElementById(canvasId);
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`画面用のcanvas要素が見つかりません: #${canvasId}`);
  }
  const font = await loadFont();
  new App(createContext(canvas, font)).start();
}
