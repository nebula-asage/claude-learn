/**
 * シミュレーションの進行役。1tickでやることの順序と配分をここで決める。
 *
 * 全区画を毎tick評価すると重いので、区画は1か月（`TICKS_PER_MONTH` tick）かけて
 * 一巡するように少しずつ処理する。電力・面データ・需要の再計算も月に1回ずつ、
 * 別々のtickに散らして負荷を平らにしている。
 * @packageDocumentation
 */
import { applyAnnualBudget, decayUnderfundedRoads } from "./budget.js";
import { ZoneType, buildingByKind } from "./buildings.js";
import { computeDemand } from "./demand.js";
import { DisasterKind, type DisasterKindValue, DisasterSystem } from "./disasters.js";
import { updateFields } from "./fields.js";
import { TileFlag } from "./map.js";
import { adviseOn } from "./messages.js";
import { checkMilestone } from "./milestones.js";
import { updatePower } from "./power.js";
import { MONTHS_PER_YEAR, TICKS_PER_MONTH, type CityState } from "./state.js";
import { collectStats } from "./stats.js";
import { decayTraffic } from "./traffic.js";
import { updateZone } from "./zones.js";

/** ゲームの進行速度。 */
export interface SpeedSetting {
  /** 画面に出す名前。 */
  name: string;
  /** 1秒あたりのtick数。0なら停止。 */
  ticksPerSecond: number;
}

/** 選べる進行速度。 */
export const SPEEDS: readonly SpeedSetting[] = [
  { name: "停止", ticksPerSecond: 0 },
  { name: "低速", ticksPerSecond: 3 },
  { name: "標準", ticksPerSecond: 8 },
  { name: "高速", ticksPerSecond: 24 },
];

/** シミュレーションの進行を受け持つ。 */
export class Simulation {
  private readonly state: CityState;
  /** 評価対象の区画（代表タイルの添字）の一覧。 */
  private zones: number[] = [];
  /** 一覧のどこまで評価したか。 */
  private cursor = 0;
  /** 年度末の決算待ちかどうか。予算画面を出している間は `true`。 */
  pendingBudget = false;
  /** 災害の進行役。UIから手動で災害を起こすときにも使う。 */
  readonly disasters: DisasterSystem;

  /**
   * @param state 進行させる都市の状態。
   */
  constructor(state: CityState) {
    this.state = state;
    this.disasters = new DisasterSystem(state);
    this.refresh();
  }

  /** 区画の一覧を作り直し、電力・面データ・集計をすべて計算し直す。 */
  refresh(): void {
    this.rebuildZoneList();
    this.state.power = updatePower(this.state);
    updateFields(this.state);
    collectStats(this.state.map, this.state.stats);
    this.state.demand = computeDemand(this.state.stats, this.state.taxRate);
  }

  /** 電力だけを計算し直す。建設直後に呼んで、通電状態をすぐ反映させる。 */
  refreshPower(): void {
    this.state.power = updatePower(this.state);
  }

  /** 1tick進める。 */
  tick(): void {
    const state = this.state;
    state.ticks++;

    if (state.ticks % (TICKS_PER_MONTH * MONTHS_PER_YEAR) === 0) {
      collectStats(state.map, state.stats);
      if (state.autoBudget) this.settleBudget();
      else this.pendingBudget = true;
    }

    switch (state.ticks % TICKS_PER_MONTH) {
      case 0:
        this.rebuildZoneList();
        state.power = updatePower(state);
        break;
      case 1:
        decayTraffic(state);
        break;
      case 2:
        updateFields(state);
        break;
      case 3:
        collectStats(state.map, state.stats);
        state.demand = computeDemand(state.stats, state.taxRate);
        break;
      case 4:
        this.monthlyEvents();
        break;
      default:
        break;
    }

    this.updateZoneSlice();
    this.disasters.tick();
  }

  /** 月に一度の出来事（称号の判定・助言・災害の抽選）を処理する。 */
  private monthlyEvents(): void {
    const state = this.state;

    const milestone = checkMilestone(state);
    if (milestone) state.messages.push(milestone, "good");

    const advice = adviseOn(state);
    if (advice) state.messages.push(advice.text, advice.tone);

    if (!state.disastersEnabled) return;
    // 火災が一番起きやすく、他の災害はまれ。
    const kinds: DisasterKindValue[] = [
      DisasterKind.fire,
      DisasterKind.fire,
      DisasterKind.fire,
      DisasterKind.flood,
      DisasterKind.tornado,
      DisasterKind.earthquake,
      DisasterKind.monster,
    ];
    if (state.rng.chance(state.disasterChance)) {
      const message = this.disasters.trigger(state.rng.pick(kinds));
      if (message) state.messages.push(message, "warning");
    }
  }

  /** 年度末の決算を行う。予算画面で確定したときにも呼ばれる。 */
  settleBudget(): void {
    applyAnnualBudget(this.state);
    decayUnderfundedRoads(this.state);
    this.state.history.record(this.state);
    this.pendingBudget = false;
  }

  /** マップを走査して区画の一覧を作り直す。 */
  private rebuildZoneList(): void {
    const map = this.state.map;
    this.zones = [];
    for (let i = 0; i < map.tiles.length; i++) {
      if ((map.flags[i] & TileFlag.origin) === 0) continue;
      if (buildingByKind(map.buildingKind[i]).zone === ZoneType.none) continue;
      this.zones.push(i);
    }
    if (this.cursor >= this.zones.length) this.cursor = 0;
  }

  /** 一覧のうち、このtickぶんの区画を評価する。 */
  private updateZoneSlice(): void {
    if (this.zones.length === 0) return;
    const map = this.state.map;
    const perTick = Math.ceil(this.zones.length / TICKS_PER_MONTH);

    for (let n = 0; n < perTick; n++) {
      if (this.zones.length === 0) return;
      const index = this.zones[this.cursor % this.zones.length];
      this.cursor = (this.cursor + 1) % this.zones.length;

      // 一覧を作ってから取り壊された区画は飛ばす。
      if ((map.flags[index] & TileFlag.origin) === 0) continue;
      if (buildingByKind(map.buildingKind[index]).zone === ZoneType.none) continue;
      updateZone(this.state, index % map.width, Math.floor(index / map.width));
    }
  }
}
