/**
 * セーブデータの書き出しと読み込み。
 *
 * 地価・公害・犯罪といった面データは、地図から計算し直せるので保存しない。
 * 例外は交通量で、これは過去の移動の積み重ねなので計算し直せず、保存の対象にしている。
 * @packageDocumentation
 */
import type { BudgetFunding } from "./budget.js";
import type { DisasterEntity } from "./disasters.js";
import type { HistorySample } from "./history.js";
import { CityMap } from "./map.js";
import { Rng } from "./rng.js";
import { CityState } from "./state.js";

/** セーブデータの形式の版。読み込み時の互換性判定に使う。 */
export const SAVE_VERSION = 1;

/** セーブデータ。JSONにそのまま書き出せる形。 */
export interface SaveData {
  /** 形式の版。 */
  version: number;
  /** 都市の名前。 */
  cityName: string;
  /** マップの横幅。 */
  width: number;
  /** マップの高さ。 */
  height: number;
  /** タイルID（Uint16の並びをBase64にしたもの）。 */
  tiles: string;
  /** タイルのフラグ（Uint8の並びをBase64にしたもの）。 */
  flags: string;
  /** 建物の代表タイルへの相対位置。 */
  originOffset: string;
  /** 建物の種類ID。 */
  buildingKind: string;
  /** 交通量。地図からは計算し直せないので保存する。 */
  traffic: string;
  /** 所持金。 */
  funds: number;
  /** 経過tick数。 */
  ticks: number;
  /** 税率。 */
  taxRate: number;
  /** 予算の配分。 */
  funding: BudgetFunding;
  /** 予算を自動で決算するか。 */
  autoBudget: boolean;
  /** 災害が自然に起きるか。 */
  disastersEnabled: boolean;
  /** 1か月あたりの災害の発生確率。 */
  disasterChance: number;
  /** 到達済みの称号の番号。 */
  milestoneIndex: number;
  /** 乱数生成器の状態。 */
  rngState: number;
  /** 年ごとの記録。 */
  history: HistorySample[];
  /** 動いている災害。 */
  entities: DisasterEntity[];
  /** 遊んでいるシナリオの識別子。フリープレイなら `null`。 */
  scenarioId: string | null;
}

/**
 * TypedArray をBase64の文字列にする。
 * @param array 変換する配列。
 */
function encodeArray(array: Uint8Array | Uint16Array): string {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let binary = "";
  // 一度に渡す量が多すぎると引数の上限に当たるため、小分けにする。
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Base64の文字列を TypedArray に戻す。
 * @param text Base64の文字列。
 * @param target 書き込む先の配列。
 */
function decodeArray(text: string, target: Uint8Array | Uint16Array): void {
  const binary = atob(text);
  const bytes = new Uint8Array(target.buffer, target.byteOffset, target.byteLength);
  if (binary.length !== bytes.length) {
    throw new Error(`セーブデータの大きさが合いません: ${binary.length} / ${bytes.length}`);
  }
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
}

/**
 * 都市の状態をセーブデータに変換する。
 * @param state 都市の状態。
 * @param scenarioId 遊んでいるシナリオの識別子。
 */
export function serializeCity(state: CityState, scenarioId: string | null = null): SaveData {
  return {
    version: SAVE_VERSION,
    cityName: state.cityName,
    width: state.map.width,
    height: state.map.height,
    tiles: encodeArray(state.map.tiles),
    flags: encodeArray(state.map.flags),
    originOffset: encodeArray(state.map.originOffset),
    buildingKind: encodeArray(state.map.buildingKind),
    traffic: encodeArray(state.fields.traffic),
    funds: state.funds,
    ticks: state.ticks,
    taxRate: state.taxRate,
    funding: { ...state.funding },
    autoBudget: state.autoBudget,
    disastersEnabled: state.disastersEnabled,
    disasterChance: state.disasterChance,
    milestoneIndex: state.milestoneIndex,
    rngState: state.rng.getState(),
    history: state.history.samples.map((sample) => ({ ...sample })),
    entities: state.entities.map((entity) => ({ ...entity })),
    scenarioId,
  };
}

/**
 * セーブデータから都市の状態を作り直す。
 * @param data セーブデータ。
 */
export function deserializeCity(data: SaveData): CityState {
  if (data.version !== SAVE_VERSION) {
    throw new Error(`対応していないセーブデータの版です: ${data.version}`);
  }

  const map = new CityMap(data.width, data.height);
  decodeArray(data.tiles, map.tiles);
  decodeArray(data.flags, map.flags);
  decodeArray(data.originOffset, map.originOffset);
  decodeArray(data.buildingKind, map.buildingKind);

  const rng = new Rng(0);
  rng.setState(data.rngState);

  const state = new CityState(map, rng, data.funds, data.cityName);
  decodeArray(data.traffic, state.fields.traffic);
  state.ticks = data.ticks;
  state.taxRate = data.taxRate;
  state.funding = { ...data.funding };
  state.autoBudget = data.autoBudget;
  state.disastersEnabled = data.disastersEnabled;
  state.disasterChance = data.disasterChance;
  state.milestoneIndex = data.milestoneIndex;
  state.history.samples.push(...data.history);
  state.entities.push(...data.entities);
  return state;
}
