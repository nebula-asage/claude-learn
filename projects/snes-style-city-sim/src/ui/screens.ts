/**
 * タイトル・新しい街・シナリオ選択の各画面。
 * @packageDocumentation
 */
import type { GameContext } from "../app/context.js";
import { drawMinimap } from "../render/minimap.js";
import { COLOR } from "../render/palette.js";
import { formatNumber } from "../render/panel.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../render/screen.js";
import { type Rect, drawButton, drawWindowFrame, hitTest } from "../render/windows.js";
import type { CityMap } from "../sim/map.js";
import { Rng } from "../sim/rng.js";
import { SCENARIOS, type Scenario } from "../sim/scenario.js";
import { CityState } from "../sim/state.js";
import { generateTerrain } from "../sim/terrain.js";
import { SAVE_SLOTS, describeSlot } from "./storage.js";

/** 画面ひとつぶんの振る舞い。 */
export interface UiScreen {
  /**
   * 状態を進める。
   * @param delta 前のフレームからの経過秒数。
   */
  update(delta: number): void;
  /** 画面を描く。 */
  draw(): void;
}

/** 画面の切り替えを頼むための窓口。 */
export interface AppNavigation {
  /**
   * 自由に遊ぶモードを始める。
   * @param state 遊ぶ都市の状態。
   */
  startFreePlay(state: CityState): void;
  /**
   * シナリオを始める。
   * @param scenario 遊ぶシナリオ。
   */
  startScenario(scenario: Scenario): void;
  /**
   * 保存した都市を読み込んで再開する。
   * @param slot 読み込む枠の番号。
   */
  loadSlot(slot: number): void;
  /** タイトル画面へ戻る。 */
  showTitle(): void;
  /** 新しい街の画面へ移る。 */
  showNewCity(): void;
  /** シナリオ選択の画面へ移る。 */
  showScenarios(): void;
}

/** 難易度の設定。 */
export interface Difficulty {
  /** 画面に出す名前。 */
  name: string;
  /** 初期資金。 */
  funds: number;
  /** 1か月あたりの災害の発生確率。 */
  disasterChance: number;
}

/** 選べる難易度。 */
export const DIFFICULTIES: readonly Difficulty[] = [
  { name: "かんたん", funds: 30000, disasterChance: 0.008 },
  { name: "ふつう", funds: 20000, disasterChance: 0.02 },
  { name: "むずかしい", funds: 10000, disasterChance: 0.04 },
];

/** 新しい街につける名前の候補。 */
const CITY_NAMES = [
  "ドットメトロポリス",
  "あおぞら市",
  "みどり野市",
  "ひのでヶ丘",
  "つきみ台",
  "かぜのおか市",
];

/** タイトル画面。 */
export class TitleScreen implements UiScreen {
  private readonly items: { label: string; run: () => void }[];
  private selected = 0;
  private blink = 0;

  /**
   * @param context 共有の道具立て。
   * @param nav 画面切り替えの窓口。
   */
  constructor(
    private readonly context: GameContext,
    nav: AppNavigation,
  ) {
    this.items = [
      { label: "新しい街をつくる", run: () => nav.showNewCity() },
      { label: "シナリオであそぶ", run: () => nav.showScenarios() },
    ];
    for (let slot = 0; slot < SAVE_SLOTS; slot++) {
      const description = describeSlot(slot);
      if (!description) continue;
      this.items.push({ label: `つづきから (${description})`, run: () => nav.loadSlot(slot) });
    }
  }

  /**
   * メニュー項目の位置を求める。
   * @param index 項目の番号。
   */
  private itemRect(index: number): Rect {
    return { x: 48, y: 118 + index * 18, width: 160, height: 15 };
  }

  /**
   * 入力を処理する。
   * @param _delta 前のフレームからの経過秒数。
   */
  update(_delta: number): void {
    const input = this.context.input;
    this.blink++;

    if (input.wasPressed("ArrowUp") || input.wasPressed("KeyW")) {
      this.selected = (this.selected + this.items.length - 1) % this.items.length;
    }
    if (input.wasPressed("ArrowDown") || input.wasPressed("KeyS")) {
      this.selected = (this.selected + 1) % this.items.length;
    }
    if (input.wasPressed("Enter") || input.wasPressed("Space")) {
      this.items[this.selected].run();
      return;
    }
    if (input.clicked) {
      this.items.forEach((item, index) => {
        if (hitTest(this.itemRect(index), input.pointer.x, input.pointer.y)) {
          this.selected = index;
          item.run();
        }
      });
    }
  }

  /** 画面を描く。 */
  draw(): void {
    const { screen, font } = this.context;
    screen.clear(COLOR.deepWater);

    // 背景に、遠くの街並みのシルエットを描く。
    for (let i = 0; i < 20; i++) {
      const width = 10 + ((i * 7) % 14);
      const height = 20 + ((i * 13) % 46);
      screen.fillRect(i * 13 - 4, SCREEN_HEIGHT - height - 40, width, height, COLOR.panelShadow);
    }
    screen.fillRect(0, SCREEN_HEIGHT - 40, SCREEN_WIDTH, 40, COLOR.panel);

    font.drawTextCentered(screen, "ドットメトロポリス", SCREEN_WIDTH / 2, 40, COLOR.white);
    font.drawTextCentered(
      screen,
      "SNES風 都市開発シミュレーション",
      SCREEN_WIDTH / 2,
      56,
      COLOR.uiYellow,
    );

    this.items.forEach((item, index) => {
      const rect = this.itemRect(index);
      const active = index === this.selected;
      drawButton(screen, font, rect, item.label, active);
      if (active && Math.floor(this.blink / 20) % 2 === 0) {
        font.drawText(screen, "▶", rect.x - 12, rect.y + 4, COLOR.uiYellow);
      }
    });

    font.drawTextCentered(
      screen,
      "↑↓ で選び、Enter で決定",
      SCREEN_WIDTH / 2,
      SCREEN_HEIGHT - 14,
      COLOR.lightGray,
    );
  }
}

/** 新しい街の地形と難易度を決める画面。 */
export class NewCityScreen implements UiScreen {
  private seed = Date.now() & 0xffff;
  private map: CityMap;
  private difficulty = 1;
  private nameIndex = 0;

  private readonly rerollButton: Rect = { x: 12, y: 154, width: 76, height: 15 };
  private readonly difficultyButton: Rect = { x: 92, y: 154, width: 76, height: 15 };
  private readonly nameButton: Rect = { x: 172, y: 154, width: 72, height: 15 };
  private readonly backButton: Rect = { x: 12, y: 176, width: 68, height: 15 };
  private readonly startButton: Rect = { x: 160, y: 176, width: 84, height: 15 };

  /**
   * @param context 共有の道具立て。
   * @param nav 画面切り替えの窓口。
   */
  constructor(
    private readonly context: GameContext,
    private readonly nav: AppNavigation,
  ) {
    this.map = generateTerrain(new Rng(this.seed));
  }

  /**
   * 入力を処理する。
   * @param _delta 前のフレームからの経過秒数。
   */
  update(_delta: number): void {
    const input = this.context.input;
    if (input.wasPressed("Escape")) {
      this.nav.showTitle();
      return;
    }
    if (!input.clicked) return;

    const { x, y } = input.pointer;
    if (hitTest(this.rerollButton, x, y)) {
      this.seed = (this.seed * 1103515245 + 12345) & 0xffff;
      this.map = generateTerrain(new Rng(this.seed));
    }
    if (hitTest(this.difficultyButton, x, y)) {
      this.difficulty = (this.difficulty + 1) % DIFFICULTIES.length;
    }
    if (hitTest(this.nameButton, x, y)) {
      this.nameIndex = (this.nameIndex + 1) % CITY_NAMES.length;
    }
    if (hitTest(this.backButton, x, y)) this.nav.showTitle();
    if (hitTest(this.startButton, x, y)) this.start();
  }

  /** 選んだ設定で遊び始める。 */
  private start(): void {
    const difficulty = DIFFICULTIES[this.difficulty];
    const state = new CityState(
      this.map,
      new Rng(this.seed ^ 0x2545f491),
      difficulty.funds,
      CITY_NAMES[this.nameIndex],
    );
    state.disasterChance = difficulty.disasterChance;
    this.nav.startFreePlay(state);
  }

  /** 画面を描く。 */
  draw(): void {
    const { screen, font } = this.context;
    screen.clear(COLOR.panelShadow);
    drawWindowFrame(screen, font, { x: 4, y: 4, width: 248, height: 216 }, "新しい街をつくる");

    // 地形のプレビュー。マップ1タイルを1ドットで表示する。
    const previewX = Math.round((SCREEN_WIDTH - this.map.width) / 2);
    screen.strokeRect(previewX - 1, 21, this.map.width + 2, this.map.height + 2, COLOR.black);
    drawMinimap(screen, this.map, previewX, 22, 1);

    const difficulty = DIFFICULTIES[this.difficulty];
    font.drawText(screen, `街の名前: ${CITY_NAMES[this.nameIndex]}`, 12, 128, COLOR.white);
    font.drawText(
      screen,
      `難易度: ${difficulty.name}   初期資金 $${formatNumber(difficulty.funds)}`,
      12,
      140,
      COLOR.uiYellow,
    );

    drawButton(screen, font, this.rerollButton, "地形を変える");
    drawButton(screen, font, this.difficultyButton, "難易度");
    drawButton(screen, font, this.nameButton, "名前を変える");
    drawButton(screen, font, this.backButton, "もどる");
    drawButton(screen, font, this.startButton, "この地形で", true);
    font.drawTextCentered(screen, "Esc でタイトルへ", SCREEN_WIDTH / 2, 200, COLOR.lightGray);
  }
}

/** シナリオを選ぶ画面。 */
export class ScenarioScreen implements UiScreen {
  private selected = 0;
  private starting: Scenario | null = null;

  private readonly startButton: Rect = { x: 140, y: 200, width: 100, height: 15 };
  private readonly backButton: Rect = { x: 16, y: 200, width: 60, height: 15 };

  /**
   * @param context 共有の道具立て。
   * @param nav 画面切り替えの窓口。
   */
  constructor(
    private readonly context: GameContext,
    private readonly nav: AppNavigation,
  ) {}

  /**
   * シナリオの見出しの位置を求める。
   * @param index シナリオの番号。
   */
  private itemRect(index: number): Rect {
    return { x: 12, y: 24 + index * 18, width: 232, height: 16 };
  }

  /**
   * 入力を処理する。
   * @param _delta 前のフレームからの経過秒数。
   */
  update(_delta: number): void {
    // 「準備中」を1フレーム描いてから、時間のかかる生成に入る。
    if (this.starting) {
      const scenario = this.starting;
      this.starting = null;
      this.nav.startScenario(scenario);
      return;
    }

    const input = this.context.input;
    if (input.wasPressed("Escape")) {
      this.nav.showTitle();
      return;
    }
    if (input.wasPressed("ArrowUp")) {
      this.selected = (this.selected + SCENARIOS.length - 1) % SCENARIOS.length;
    }
    if (input.wasPressed("ArrowDown")) {
      this.selected = (this.selected + 1) % SCENARIOS.length;
    }
    if (input.wasPressed("Enter")) this.starting = SCENARIOS[this.selected];

    if (input.clicked) {
      SCENARIOS.forEach((_, index) => {
        if (hitTest(this.itemRect(index), input.pointer.x, input.pointer.y)) this.selected = index;
      });
      if (hitTest(this.backButton, input.pointer.x, input.pointer.y)) {
        this.nav.showTitle();
        return;
      }
      if (hitTest(this.startButton, input.pointer.x, input.pointer.y)) {
        this.starting = SCENARIOS[this.selected];
      }
    }
  }

  /** 画面を描く。 */
  draw(): void {
    const { screen, font } = this.context;
    screen.clear(COLOR.panelShadow);
    drawWindowFrame(screen, font, { x: 4, y: 4, width: 248, height: 216 }, "シナリオ");

    SCENARIOS.forEach((scenario, index) => {
      drawButton(screen, font, this.itemRect(index), scenario.name, index === this.selected);
    });

    const scenario = SCENARIOS[this.selected];
    let line = "";
    let row = 0;
    for (const char of scenario.description) {
      if (font.measure(line + char) > 224) {
        font.drawText(screen, line, 14, 86 + row * 11, COLOR.white);
        row++;
        line = "";
      }
      line += char;
    }
    if (line) font.drawText(screen, line, 14, 86 + row * 11, COLOR.white);

    font.drawText(screen, `目標: ${scenario.goalText}`, 14, 160, COLOR.uiYellow);
    font.drawText(screen, `期限: ${scenario.years}年`, 14, 172, COLOR.uiYellow);

    if (this.starting) {
      font.drawTextCentered(screen, "街を用意しています...", SCREEN_WIDTH / 2, 186, COLOR.white);
    }

    drawButton(screen, font, this.backButton, "もどる");
    drawButton(screen, font, this.startButton, "このシナリオで", true);
  }
}
