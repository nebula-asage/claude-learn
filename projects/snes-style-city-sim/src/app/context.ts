/**
 * 画面・入力・絵といった、全画面で共有する道具立て。
 * @packageDocumentation
 */
import { AudioSystem } from "../audio/audio.js";
import { buildTileset } from "../render/art/index.js";
import { buildIconAtlas } from "../render/art/icons.js";
import { type SpriteImage, type SpriteName, buildSprites } from "../render/art/sprites.js";
import type { BitmapFont } from "../render/font/font.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "../render/screen.js";
import type { Tileset } from "../render/tileset.js";
import { Input } from "../ui/input.js";
import { TOOLS } from "../ui/tools.js";

/** どの画面からも使う道具立て。 */
export interface GameContext {
  /** 表示に使うcanvas要素。 */
  canvas: HTMLCanvasElement;
  /** canvasの2Dコンテキスト。 */
  ctx: CanvasRenderingContext2D;
  /** フレームバッファ。 */
  screen: Screen;
  /** 入力状態。 */
  input: Input;
  /** ビットマップフォント。 */
  font: BitmapFont;
  /** タイル絵のアトラス。 */
  tileset: Tileset;
  /** 道具アイコンのアトラス。 */
  icons: Tileset;
  /** スプライトの絵。 */
  sprites: Record<SpriteName, SpriteImage[]>;
  /** 効果音とBGM。 */
  audio: AudioSystem;
}

/**
 * 道具立てを一式そろえる。canvasの大きさもここで内部解像度に合わせる。
 * @param canvas 表示に使うcanvas要素。
 * @param font 読み込み済みのフォント。
 */
export function createContext(canvas: HTMLCanvasElement, font: BitmapFont): GameContext {
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2Dコンテキストを取得できません");

  const tileset = buildTileset();
  return {
    canvas,
    ctx,
    screen: new Screen(),
    input: new Input(canvas),
    font,
    tileset,
    icons: buildIconAtlas(
      TOOLS.map((tool) => tool.icon),
      tileset,
    ),
    sprites: buildSprites(),
    audio: new AudioSystem(),
  };
}

/**
 * 画面をウィンドウに合わせて整数倍で拡大する。
 * @param canvas 表示に使うcanvas要素。
 */
export function fitToWindow(canvas: HTMLCanvasElement): void {
  const scale = Math.max(
    1,
    Math.min(
      Math.floor(window.innerWidth / SCREEN_WIDTH),
      Math.floor(window.innerHeight / SCREEN_HEIGHT),
    ),
  );
  canvas.style.width = `${SCREEN_WIDTH * scale}px`;
  canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
}
