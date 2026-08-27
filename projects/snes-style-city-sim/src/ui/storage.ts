/**
 * セーブデータのブラウザへの保存と読み出し。
 *
 * `sim` はDOMに依存させない方針なので、localStorage を触る処理だけをここに分けている。
 * @packageDocumentation
 */
import { type SaveData, deserializeCity, serializeCity } from "../sim/save.js";
import type { CityState } from "../sim/state.js";

/** 保存に使うキーの接頭辞。 */
const STORAGE_PREFIX = "snes-style-city-sim/save/";

/** 使える保存枠の数。 */
export const SAVE_SLOTS = 3;

/**
 * 都市の状態を保存する。
 * @param state 都市の状態。
 * @param slot 保存する枠の番号。
 * @param scenarioId 遊んでいるシナリオの識別子。
 */
export function saveCity(state: CityState, slot: number, scenarioId: string | null): void {
  localStorage.setItem(
    `${STORAGE_PREFIX}${slot}`,
    JSON.stringify(serializeCity(state, scenarioId)),
  );
}

/**
 * 保存された内容を読み出す。無ければ `null`。
 * @param slot 読み込む枠の番号。
 */
export function readSave(slot: number): SaveData | null {
  const text = localStorage.getItem(`${STORAGE_PREFIX}${slot}`);
  if (!text) return null;
  try {
    return JSON.parse(text) as SaveData;
  } catch {
    return null;
  }
}

/**
 * 保存された都市を読み込んで復元する。無ければ `null`。
 * @param slot 読み込む枠の番号。
 */
export function loadCity(slot: number): CityState | null {
  const data = readSave(slot);
  return data ? deserializeCity(data) : null;
}

/**
 * 保存枠の中身を短い文字列で説明する。空なら `null`。
 * @param slot 調べる枠の番号。
 */
export function describeSlot(slot: number): string | null {
  const data = readSave(slot);
  if (!data) return null;
  const year = 1900 + Math.floor(data.ticks / (16 * 12));
  return `${data.cityName} ${year}年`;
}
