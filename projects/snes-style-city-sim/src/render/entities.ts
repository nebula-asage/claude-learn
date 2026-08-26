/**
 * 地図の上を動く災害（竜巻・怪獣）の描画と、アドバイザーの吹き出し。
 * @packageDocumentation
 */
import type { AdvisorMessage } from "../sim/messages.js";
import type { CityState } from "../sim/state.js";
import { TILE_SIZE } from "../sim/tiles.js";
import type { SpriteImage, SpriteName } from "./art/sprites.js";
import type { BitmapFont } from "./font/font.js";
import type { MapView } from "./mapview.js";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./mapview.js";
import { COLOR } from "./palette.js";
import type { Screen } from "./screen.js";

/**
 * スプライトを1枚描く。
 * @param screen 描画先。
 * @param sprite 描くスプライト。
 * @param x 左端。
 * @param y 上端。
 */
export function drawSprite(screen: Screen, sprite: SpriteImage, x: number, y: number): void {
  screen.blit(sprite.pixels, sprite.width, 0, 0, sprite.width, sprite.height, x, y);
}

/**
 * 動いている災害を地図の上に描く。
 * @param screen 描画先。
 * @param state 都市の状態。
 * @param sprites スプライトの絵。
 * @param view 地図の表示位置。
 * @param animationFrame アニメーション用のフレーム番号。
 */
export function drawDisasterEntities(
  screen: Screen,
  state: CityState,
  sprites: Record<SpriteName, SpriteImage[]>,
  view: MapView,
  animationFrame: number,
): void {
  if (state.entities.length === 0) return;
  screen.setClip(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  for (const entity of state.entities) {
    const frames = sprites[entity.kind];
    const sprite = frames[animationFrame % frames.length];
    // 足元がタイルの中心に来るように置く。
    const x = Math.round(entity.x * TILE_SIZE + TILE_SIZE / 2 - sprite.width / 2 - view.scrollX);
    const y = Math.round(entity.y * TILE_SIZE + TILE_SIZE - sprite.height - view.scrollY);
    drawSprite(screen, sprite, x, y);
  }

  screen.resetClip();
}

/**
 * アドバイザーの助言を、地図の下端に吹き出しとして描く。
 * @param screen 描画先。
 * @param font 使用するフォント。
 * @param sprites スプライトの絵。
 * @param message 表示する助言。
 */
export function drawAdvisor(
  screen: Screen,
  font: BitmapFont,
  sprites: Record<SpriteName, SpriteImage[]>,
  message: AdvisorMessage,
): void {
  const boxY = VIEW_HEIGHT - 36;
  screen.fillRect(2, boxY, VIEW_WIDTH - 4, 32, COLOR.panelShadow);
  screen.strokeRect(2, boxY, VIEW_WIDTH - 4, 32, COLOR.white);
  screen.strokeRect(3, boxY + 1, VIEW_WIDTH - 6, 30, COLOR.panelLight);

  drawSprite(screen, sprites.advisor[0], 6, boxY + 4);

  const color =
    message.tone === "warning" ? COLOR.red : message.tone === "good" ? COLOR.green : COLOR.white;
  font.drawText(screen, "都市計画アドバイザー", 34, boxY + 5, COLOR.lightBlue);

  // 幅に収まるように、全角8ドット・半角4ドット換算で折り返す。
  const maxWidth = VIEW_WIDTH - 44;
  let line = "";
  let lineIndex = 0;
  for (const char of message.text) {
    if (font.measure(line + char) > maxWidth) {
      font.drawText(screen, line, 34, boxY + 16 + lineIndex * 10, color);
      lineIndex++;
      line = "";
      if (lineIndex >= 2) break;
    }
    line += char;
  }
  if (lineIndex < 2 && line) font.drawText(screen, line, 34, boxY + 16 + lineIndex * 10, color);
}
