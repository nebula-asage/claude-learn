/**
 * 都市計画アドバイザーからの助言。
 *
 * 都市の状態を見て、いま一番困っていることを短い言葉で伝える。
 * @packageDocumentation
 */
import { evaluateCity } from "./evaluation.js";
import type { CityState } from "./state.js";

/** 助言の調子。 */
export type MessageTone = "info" | "warning" | "good";

/** アドバイザーの一言。 */
export interface AdvisorMessage {
  /** 本文。 */
  text: string;
  /** 調子。表示色に使う。 */
  tone: MessageTone;
}

/** 表示待ちの助言をためておく。 */
export class MessageQueue {
  private readonly queue: AdvisorMessage[] = [];

  /**
   * 助言を積む。同じ本文が既に待っていれば積まない。
   * @param text 本文。
   * @param tone 調子。
   */
  push(text: string, tone: MessageTone = "info"): void {
    if (this.queue.some((message) => message.text === text)) return;
    this.queue.push({ text, tone });
    // 溜まりすぎると古い話ばかりになるので、頭から捨てる。
    if (this.queue.length > 4) this.queue.shift();
  }

  /** 次の助言を取り出す。無ければ `null`。 */
  shift(): AdvisorMessage | null {
    return this.queue.shift() ?? null;
  }

  /** 待っている助言があるか。 */
  get pending(): boolean {
    return this.queue.length > 0;
  }
}

/**
 * いまの都市の状態から、伝えるべき助言を1つ選ぶ。無ければ `null`。
 * @param state 都市の状態。
 */
export function adviseOn(state: CityState): AdvisorMessage | null {
  const { stats, demand, power } = state;

  if (state.funds < 0) {
    return { text: "資金がマイナスです。税率を上げるか支出を見直してください。", tone: "warning" };
  }
  if (power.demand > power.supply) {
    return { text: "電力が足りません。発電所を増やしましょう。", tone: "warning" };
  }
  if (stats.unpoweredBuildings > 0) {
    return {
      text: `電気の届いていない建物が${stats.unpoweredBuildings}件あります。送電線を確認してください。`,
      tone: "warning",
    };
  }

  const evaluation = evaluateCity(state);
  if (evaluation.issues.includes("犯罪")) {
    return { text: "犯罪が増えています。警察署を建ててください。", tone: "warning" };
  }
  if (evaluation.issues.includes("公害")) {
    return { text: "公害がひどくなっています。工業地帯を住宅から離しましょう。", tone: "warning" };
  }
  if (evaluation.issues.includes("渋滞")) {
    return { text: "道路が混雑しています。道を増やすか線路を通しましょう。", tone: "warning" };
  }

  if (stats.residentialZones === 0) {
    return { text: "まずは住宅区画を作り、道路と電気をつなぎましょう。", tone: "info" };
  }
  if (demand.residential > 0.5) {
    return { text: "住む場所が足りません。住宅区画を増やしましょう。", tone: "info" };
  }
  if (demand.commercial > 0.5) {
    return { text: "店が足りません。商業区画を増やしましょう。", tone: "info" };
  }
  if (demand.industrial > 0.5) {
    return { text: "働き口が足りません。工業区画を増やしましょう。", tone: "info" };
  }
  if (evaluation.approval >= 70) {
    return { text: "市民は満足しています。この調子で進めましょう。", tone: "good" };
  }
  return null;
}
