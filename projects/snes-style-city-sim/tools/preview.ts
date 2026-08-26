/**
 * 開発用プレビュー。ブラウザを開かずに、タイル絵と実際の画面をPNGとして書き出す。
 *
 *   pnpm run preview
 *
 * 出力先は dist-tools/ で、Gitの管理対象外。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Screen は ImageData を使う。node上で動かすため、最低限の代替を先に用意しておく。
class ImageDataShim {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace = "srgb" as const;
  pixelFormat = "rgba-unorm8" as const;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}
(globalThis as unknown as { ImageData: unknown }).ImageData = ImageDataShim;

const { Screen } = await import("../src/render/screen.js");
const { buildTileset } = await import("../src/render/art/index.js");
const { MapView } = await import("../src/render/mapview.js");
const { BitmapFont } = await import("../src/render/font/font.js");
const { COLOR } = await import("../src/render/palette.js");
const { drawMinimap } = await import("../src/render/minimap.js");
const { drawStatusPanel } = await import("../src/render/panel.js");
const { generateTerrain } = await import("../src/sim/terrain.js");
const { Rng } = await import("../src/sim/rng.js");
const { TILE_SIZE, TileId, isForest, isWater } = await import("../src/sim/tiles.js");
const TILE_SAND = TileId.Sand;
const { encodePng } = await import("./png.js");

mkdirSync("dist-tools", { recursive: true });

const fontData = readFileSync("src/render/font/misaki8.bin");
const font = new BitmapFont(
  fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength),
);

/**
 * 画面の内容をPNGとして書き出す。
 *
 * @param screen 書き出す画面。
 * @param path 出力先のパス。
 */
function save(screen: InstanceType<typeof Screen>, path: string): void {
  const bytes = new Uint8Array(screen.pixels.buffer);
  writeFileSync(path, encodePng(screen.width, screen.height, bytes));
  console.log(`${path} を書き出した`);
}

// 1枚目: タイル絵の一覧。
const tileset = buildTileset();
const sheet = new Screen(16 * TILE_SIZE, 8 * TILE_SIZE);
sheet.clear(COLOR.black);
for (let tile = 0; tile < 128; tile++) {
  const col = tile % 16;
  const row = Math.floor(tile / 16);
  sheet.blit(
    tileset.pixels,
    TILE_SIZE,
    0,
    tile * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    col * TILE_SIZE,
    row * TILE_SIZE,
  );
}
save(sheet, "dist-tools/tiles.png");

// 2枚目: 実際のゲーム画面。
const map = generateTerrain(new Rng(20260826));
const screen = new Screen();
const view = new MapView(map, tileset);
view.centerOn(map.width / 2, map.height / 2);
screen.clear(COLOR.black);
view.draw(screen, 0);
drawStatusPanel(screen, font, {
  cityName: "ドットメトロポリス",
  year: 1900,
  month: 1,
  funds: 20000,
  population: 12345,
  cursor: { x: 60, y: 50 },
});
save(screen, "dist-tools/screen.png");

// 3枚目: マップ全体の俯瞰と、地形の内訳。
const overview = new Screen(map.width * 2, map.height * 2);
overview.clear(COLOR.black);
drawMinimap(overview, map, 0, 0, 2);
save(overview, "dist-tools/overview.png");

const counts = new Map<string, number>();
for (const tile of map.tiles) {
  const kind = isWater(tile) ? "水" : isForest(tile) ? "森" : tile === TILE_SAND ? "砂浜" : "草地";
  counts.set(kind, (counts.get(kind) ?? 0) + 1);
}
const total = map.tiles.length;
for (const [kind, n] of counts) {
  console.log(`  ${kind}: ${n} (${((n / total) * 100).toFixed(1)}%)`);
}

// 4枚目: フォントの表示確認。
const fontSheet = new Screen(256, 96);
fontSheet.clear(COLOR.panelShadow);
const samples = [
  "住宅 商業 工業 発電所 送電線 道路 線路",
  "予算 税率 人口 地価 公害 犯罪 交通量",
  "火事だ! 消防署を建ててください。",
  "ABCDEFGHIJKLM abcdefghijklm 0123456789",
  "!\"#$%&'()*+,-./:;<=>?@[]^_{|}~",
  "村 → 町 → 市 → 首都 → 大都市 → 巨大都市",
  "ｶﾀｶﾅ ﾊﾝｶｸ ひらがな 漢字",
];
samples.forEach((text, i) => {
  font.drawText(fontSheet, text, 4, 4 + i * 12, i % 2 === 0 ? COLOR.white : COLOR.uiYellow);
});
save(fontSheet, "dist-tools/font.png");
