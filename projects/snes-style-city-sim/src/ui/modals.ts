/**
 * 重ねて表示するウィンドウ（予算・評価・グラフ）。
 *
 * ウィンドウが開いている間はシミュレーションを止め、クリックはすべてこちらが受け取る。
 * @packageDocumentation
 */
import type { BitmapFont } from "../render/font/font.js";
import { COLOR } from "../render/palette.js";
import { formatNumber } from "../render/panel.js";
import type { Screen } from "../render/screen.js";
import {
  type Rect,
  dimScreen,
  drawButton,
  drawGauge,
  drawLineGraph,
  drawWindowFrame,
  hitTest,
} from "../render/windows.js";
import { MAX_TAX_RATE, computeBudget } from "../sim/budget.js";
import {
  DISASTER_NAMES,
  DisasterKind,
  type DisasterKindValue,
  type DisasterSystem,
} from "../sim/disasters.js";
import { evaluateCity } from "../sim/evaluation.js";
import { titleFor } from "../sim/milestones.js";
import type { CityState } from "../sim/state.js";
import { SAVE_SLOTS, describeSlot, saveCity } from "./storage.js";

/** 重ね表示するウィンドウの共通の形。 */
export interface Modal {
  /** 閉じてよくなったら `true`。 */
  readonly done: boolean;
  /**
   * ウィンドウを描く。
   * @param screen 描画先。
   * @param font 使用するフォント。
   */
  draw(screen: Screen, font: BitmapFont): void;
  /**
   * クリックを処理する。
   * @param x 画面上のX座標。
   * @param y 画面上のY座標。
   */
  click(x: number, y: number): void;
}

/** 予算ウィンドウ。税率と各項目への配分を決める。 */
export class BudgetModal implements Modal {
  /** 閉じてよいか。 */
  done = false;

  private readonly window: Rect = { x: 16, y: 16, width: 224, height: 154 };
  private readonly rows: { label: string; get: () => string; change: (delta: number) => void }[];
  private readonly confirmButton: Rect = { x: 168, y: 152, width: 56, height: 14 };
  private readonly autoButton: Rect = { x: 24, y: 152, width: 72, height: 14 };

  /**
   * @param state 都市の状態。
   * @param onConfirm 「決定」を押したときに呼ばれる処理。
   */
  constructor(
    private readonly state: CityState,
    private readonly onConfirm: () => void,
  ) {
    const adjustFunding = (key: "roads" | "police" | "fire") => (delta: number) => {
      const next = Math.round((state.funding[key] + delta * 0.1) * 10) / 10;
      state.funding[key] = Math.max(0, Math.min(1, next));
    };
    const percent = (key: "roads" | "police" | "fire") => () =>
      `${Math.round(state.funding[key] * 100)}%`;

    this.rows = [
      {
        label: "税率",
        get: () => `${state.taxRate}%`,
        change: (delta) => {
          state.taxRate = Math.max(0, Math.min(MAX_TAX_RATE, state.taxRate + delta));
        },
      },
      { label: "道路の維持", get: percent("roads"), change: adjustFunding("roads") },
      { label: "警察", get: percent("police"), change: adjustFunding("police") },
      { label: "消防", get: percent("fire"), change: adjustFunding("fire") },
    ];
  }

  /**
   * 行の位置を求める。
   * @param index 行番号。
   */
  private rowY(index: number): number {
    return 48 + index * 20;
  }

  /**
   * 行のマイナスボタンの位置を求める。
   * @param index 行番号。
   */
  private minusRect(index: number): Rect {
    return { x: 104, y: this.rowY(index) - 2, width: 12, height: 12 };
  }

  /**
   * 行のプラスボタンの位置を求める。
   * @param index 行番号。
   */
  private plusRect(index: number): Rect {
    return { x: 152, y: this.rowY(index) - 2, width: 12, height: 12 };
  }

  /**
   * ウィンドウを描く。
   * @param screen 描画先。
   * @param font 使用するフォント。
   */
  draw(screen: Screen, font: BitmapFont): void {
    const report = computeBudget(this.state);
    dimScreen(screen);
    drawWindowFrame(screen, font, this.window, `${this.state.year}年度 予算`);

    font.drawText(screen, `税収 $${formatNumber(report.taxIncome)}`, 24, 32, COLOR.uiYellow);

    const amounts = [
      "",
      `$${formatNumber(report.roadSpending)} / $${formatNumber(report.roadRequired)}`,
      `$${formatNumber(report.policeSpending)} / $${formatNumber(report.policeRequired)}`,
      `$${formatNumber(report.fireSpending)} / $${formatNumber(report.fireRequired)}`,
    ];

    this.rows.forEach((row, i) => {
      const y = this.rowY(i);
      font.drawText(screen, row.label, 24, y, COLOR.white);
      drawButton(screen, font, this.minusRect(i), "-");
      font.drawTextCentered(screen, row.get(), 134, y, COLOR.uiYellow);
      drawButton(screen, font, this.plusRect(i), "+");
      if (amounts[i]) font.drawTextRight(screen, amounts[i], 232, y, COLOR.lightGray);
    });

    font.drawText(screen, `支出 $${formatNumber(report.totalSpending)}`, 24, 128, COLOR.white);
    font.drawText(
      screen,
      `収支 ${report.balance < 0 ? "-" : "+"}$${formatNumber(Math.abs(report.balance))}`,
      24,
      140,
      report.balance < 0 ? COLOR.red : COLOR.green,
    );

    drawButton(
      screen,
      font,
      this.autoButton,
      this.state.autoBudget ? "自動: ON" : "自動: OFF",
      this.state.autoBudget,
    );
    drawButton(screen, font, this.confirmButton, "決定", true);
  }

  /**
   * クリックを処理する。
   * @param x 画面上のX座標。
   * @param y 画面上のY座標。
   */
  click(x: number, y: number): void {
    this.rows.forEach((row, i) => {
      if (hitTest(this.minusRect(i), x, y)) row.change(-1);
      if (hitTest(this.plusRect(i), x, y)) row.change(1);
    });
    if (hitTest(this.autoButton, x, y)) this.state.autoBudget = !this.state.autoBudget;
    if (hitTest(this.confirmButton, x, y)) {
      this.onConfirm();
      this.done = true;
    }
  }
}

/** 市政の評価を見るウィンドウ。 */
export class EvaluationModal implements Modal {
  /** 閉じてよいか。 */
  done = false;

  private readonly window: Rect = { x: 32, y: 24, width: 192, height: 136 };
  private readonly closeButton: Rect = { x: 96, y: 140, width: 64, height: 14 };

  /**
   * @param state 都市の状態。
   */
  constructor(private readonly state: CityState) {}

  /**
   * ウィンドウを描く。
   * @param screen 描画先。
   * @param font 使用するフォント。
   */
  draw(screen: Screen, font: BitmapFont): void {
    const evaluation = evaluateCity(this.state);
    const stats = this.state.stats;
    dimScreen(screen);
    drawWindowFrame(screen, font, this.window, "市政の評価");

    font.drawText(screen, `人口 ${formatNumber(stats.population)}人`, 40, 42, COLOR.white);
    font.drawText(screen, `支持率 ${evaluation.approval}%`, 40, 54, COLOR.white);
    drawGauge(
      screen,
      40,
      66,
      176,
      evaluation.approval / 100,
      evaluation.approval >= 50 ? COLOR.green : COLOR.red,
    );

    font.drawText(screen, "市民が挙げた問題:", 40, 78, COLOR.lightGray);
    if (evaluation.issues.length === 0) {
      font.drawText(screen, "  特にありません", 40, 90, COLOR.green);
    } else {
      evaluation.issues.forEach((issue, i) => {
        font.drawText(screen, `  ${i + 1}. ${issue}`, 40, 90 + i * 10, COLOR.uiYellow);
      });
    }

    font.drawText(
      screen,
      `住宅 ${stats.residentialZones} / 商業 ${stats.commercialZones} / 工業 ${stats.industrialZones}`,
      40,
      128,
      COLOR.lightGray,
    );

    drawButton(screen, font, this.closeButton, "閉じる", true);
  }

  /**
   * クリックを処理する。
   * @param x 画面上のX座標。
   * @param y 画面上のY座標。
   */
  click(x: number, y: number): void {
    if (hitTest(this.closeButton, x, y)) this.done = true;
  }
}

/** 推移のグラフを見るウィンドウ。 */
export class GraphModal implements Modal {
  /** 閉じてよいか。 */
  done = false;

  private readonly window: Rect = { x: 16, y: 20, width: 224, height: 144 };
  private readonly closeButton: Rect = { x: 172, y: 144, width: 56, height: 14 };

  /**
   * @param state 都市の状態。
   */
  constructor(private readonly state: CityState) {}

  /**
   * ウィンドウを描く。
   * @param screen 描画先。
   * @param font 使用するフォント。
   */
  draw(screen: Screen, font: BitmapFont): void {
    const samples = this.state.history.samples;
    dimScreen(screen);
    drawWindowFrame(screen, font, this.window, "年ごとの推移");

    if (samples.length === 0) {
      font.drawTextCentered(screen, "まだ記録がありません", 128, 70, COLOR.lightGray);
      drawButton(screen, font, this.closeButton, "閉じる", true);
      return;
    }

    const graphs: readonly [string, number[], number][] = [
      ["人口", samples.map((s) => s.population), COLOR.green],
      ["資金", samples.map((s) => s.funds), COLOR.uiYellow],
      ["公害", samples.map((s) => s.pollution), COLOR.red],
    ];

    graphs.forEach(([label, values, color], i) => {
      const y = 34 + i * 36;
      font.drawText(screen, label, 24, y, COLOR.white);
      font.drawTextRight(screen, formatNumber(values[values.length - 1]), 232, y, color);
      drawLineGraph(screen, 24, y + 10, 208, 22, values, color);
    });

    font.drawText(
      screen,
      `${samples[0].year}年 〜 ${samples[samples.length - 1].year}年`,
      24,
      144,
      COLOR.lightGray,
    );
    drawButton(screen, font, this.closeButton, "閉じる", true);
  }

  /**
   * クリックを処理する。
   * @param x 画面上のX座標。
   * @param y 画面上のY座標。
   */
  click(x: number, y: number): void {
    if (hitTest(this.closeButton, x, y)) this.done = true;
  }
}

/** 災害を手動で起こすウィンドウ。 */
export class DisasterModal implements Modal {
  /** 閉じてよいか。 */
  done = false;

  private readonly window: Rect = { x: 40, y: 28, width: 176, height: 132 };
  private readonly kinds: DisasterKindValue[] = [
    DisasterKind.fire,
    DisasterKind.flood,
    DisasterKind.tornado,
    DisasterKind.earthquake,
    DisasterKind.monster,
    DisasterKind.meltdown,
  ];
  private readonly autoButton: Rect = { x: 48, y: 140, width: 88, height: 14 };
  private readonly closeButton: Rect = { x: 152, y: 140, width: 56, height: 14 };

  /**
   * @param state 都市の状態。
   * @param disasters 災害の進行役。
   * @param onTriggered 災害を起こしたときに呼ばれる処理。
   */
  constructor(
    private readonly state: CityState,
    private readonly disasters: DisasterSystem,
    private readonly onTriggered: (message: string) => void,
  ) {}

  /**
   * 災害ボタンの位置を求める。
   * @param index ボタンの番号。
   */
  private buttonRect(index: number): Rect {
    return {
      x: 48 + (index % 2) * 84,
      y: 44 + Math.floor(index / 2) * 22,
      width: 76,
      height: 16,
    };
  }

  /**
   * ウィンドウを描く。
   * @param screen 描画先。
   * @param font 使用するフォント。
   */
  draw(screen: Screen, font: BitmapFont): void {
    dimScreen(screen);
    drawWindowFrame(screen, font, this.window, "災害");
    this.kinds.forEach((kind, i) => {
      drawButton(screen, font, this.buttonRect(i), DISASTER_NAMES[kind]);
    });
    drawButton(
      screen,
      font,
      this.autoButton,
      this.state.disastersEnabled ? "自然発生: ON" : "自然発生: OFF",
      this.state.disastersEnabled,
    );
    drawButton(screen, font, this.closeButton, "閉じる", true);
  }

  /**
   * クリックを処理する。
   * @param x 画面上のX座標。
   * @param y 画面上のY座標。
   */
  click(x: number, y: number): void {
    this.kinds.forEach((kind, i) => {
      if (!hitTest(this.buttonRect(i), x, y)) return;
      const message = this.disasters.trigger(kind);
      this.onTriggered(message ?? `${DISASTER_NAMES[kind]}は起こせませんでした`);
      this.done = true;
    });
    if (hitTest(this.autoButton, x, y)) {
      this.state.disastersEnabled = !this.state.disastersEnabled;
    }
    if (hitTest(this.closeButton, x, y)) this.done = true;
  }
}

/** ゲーム中のメニュー。保存・読み込み・タイトルへの復帰を扱う。 */
export class SystemModal implements Modal {
  /** 閉じてよいか。 */
  done = false;

  private readonly window: Rect = { x: 32, y: 24, width: 192, height: 140 };
  private readonly titleButton: Rect = { x: 40, y: 142, width: 88, height: 14 };
  private readonly closeButton: Rect = { x: 136, y: 142, width: 80, height: 14 };
  private notice = "";

  /**
   * @param state 都市の状態。
   * @param scenarioId 遊んでいるシナリオの識別子。
   * @param onQuit タイトルへ戻るときに呼ばれる処理。
   */
  constructor(
    private readonly state: CityState,
    private readonly scenarioId: string | null,
    private readonly onQuit: () => void,
  ) {}

  /**
   * 保存枠のボタンの位置を求める。
   * @param slot 枠の番号。
   */
  private slotRect(slot: number): Rect {
    return { x: 40, y: 44 + slot * 20, width: 176, height: 16 };
  }

  /**
   * ウィンドウを描く。
   * @param screen 描画先。
   * @param font 使用するフォント。
   */
  draw(screen: Screen, font: BitmapFont): void {
    dimScreen(screen);
    drawWindowFrame(screen, font, this.window, "メニュー");
    font.drawText(screen, "クリックした枠に保存します", 40, 34, COLOR.lightGray);

    for (let slot = 0; slot < SAVE_SLOTS; slot++) {
      const description = describeSlot(slot);
      drawButton(
        screen,
        font,
        this.slotRect(slot),
        `枠${slot + 1}: ${description ?? "空き"}`,
        false,
      );
    }

    if (this.notice) font.drawText(screen, this.notice, 40, 110, COLOR.green);
    font.drawText(
      screen,
      `${this.state.cityName} / ${titleFor(this.state.stats.population)}`,
      40,
      124,
      COLOR.white,
    );

    drawButton(screen, font, this.titleButton, "タイトルへ");
    drawButton(screen, font, this.closeButton, "ゲームに戻る", true);
  }

  /**
   * クリックを処理する。
   * @param x 画面上のX座標。
   * @param y 画面上のY座標。
   */
  click(x: number, y: number): void {
    for (let slot = 0; slot < SAVE_SLOTS; slot++) {
      if (!hitTest(this.slotRect(slot), x, y)) continue;
      saveCity(this.state, slot, this.scenarioId);
      this.notice = `枠${slot + 1}に保存しました`;
    }
    if (hitTest(this.titleButton, x, y)) {
      this.onQuit();
      this.done = true;
    }
    if (hitTest(this.closeButton, x, y)) this.done = true;
  }
}

/** シナリオの結果を伝えるウィンドウ。 */
export class ResultModal implements Modal {
  /** 閉じてよいか。 */
  done = false;

  private readonly window: Rect = { x: 32, y: 48, width: 192, height: 112 };
  private readonly closeButton: Rect = { x: 88, y: 140, width: 80, height: 14 };

  /**
   * @param achieved 目標を達成したか。
   * @param title シナリオの名前。
   * @param detail 結果の説明。
   * @param state 都市の状態。
   * @param onClose 閉じたときに呼ばれる処理。
   */
  constructor(
    private readonly achieved: boolean,
    private readonly title: string,
    private readonly detail: string,
    private readonly state: CityState,
    private readonly onClose: () => void,
  ) {}

  /**
   * ウィンドウを描く。
   * @param screen 描画先。
   * @param font 使用するフォント。
   */
  draw(screen: Screen, font: BitmapFont): void {
    dimScreen(screen);
    drawWindowFrame(screen, font, this.window, this.achieved ? "目標達成!" : "任期終了");

    font.drawTextCentered(screen, this.title, 128, 68, COLOR.white);
    font.drawTextCentered(
      screen,
      this.detail,
      128,
      84,
      this.achieved ? COLOR.green : COLOR.uiYellow,
    );
    font.drawTextCentered(
      screen,
      `最終人口 ${formatNumber(this.state.stats.population)}人`,
      128,
      104,
      COLOR.white,
    );
    font.drawTextCentered(
      screen,
      `支持率 ${evaluateCity(this.state).approval}%`,
      128,
      116,
      COLOR.white,
    );

    drawButton(screen, font, this.closeButton, "タイトルへ", true);
  }

  /**
   * クリックを処理する。
   * @param x 画面上のX座標。
   * @param y 画面上のY座標。
   */
  click(x: number, y: number): void {
    if (hitTest(this.closeButton, x, y)) {
      this.onClose();
      this.done = true;
    }
  }
}
