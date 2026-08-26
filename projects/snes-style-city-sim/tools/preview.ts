/**
 * 開発用プレビュー。ブラウザを開かずに、タイル絵と実際の画面をPNGとして書き出す。
 *
 *   pnpm run preview:png
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
const { drawPanel } = await import("../src/render/panel.js");
const { buildIconAtlas } = await import("../src/render/art/icons.js");
const { TOOLS } = await import("../src/ui/tools.js");
const { generateTerrain } = await import("../src/sim/terrain.js");
const { Rng } = await import("../src/sim/rng.js");
const { TILE_SIZE, TileId, isForest, isWater } = await import("../src/sim/tiles.js");
const { CityMap } = await import("../src/sim/map.js");
const { CityState } = await import("../src/sim/state.js");
const { BUILDINGS, ZoneType, buildingById, zoneBuilding } = await import("../src/sim/buildings.js");
const { buildNetwork, buildStructure, buildZone, placeStructure } =
  await import("../src/sim/build.js");
const { encodePng } = await import("./png.js");

mkdirSync("dist-tools", { recursive: true });

const fontData = readFileSync("src/render/font/misaki8.bin");
const font = new BitmapFont(
  fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength),
);
const tileset = buildTileset();

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

/**
 * タイルを1枚描く。
 *
 * @param screen 描画先。
 * @param tile タイルID。
 * @param x 左端。
 * @param y 上端。
 */
function drawTile(screen: InstanceType<typeof Screen>, tile: number, x: number, y: number): void {
  screen.blit(tileset.pixels, TILE_SIZE, 0, tile * TILE_SIZE, TILE_SIZE, TILE_SIZE, x, y);
}

// 1枚目: 地形・道路網のタイル一覧。
const sheet = new Screen(16 * TILE_SIZE, 8 * TILE_SIZE);
sheet.clear(COLOR.black);
for (let tile = 0; tile < 128; tile++) {
  drawTile(sheet, tile, (tile % 16) * TILE_SIZE, Math.floor(tile / 16) * TILE_SIZE);
}
save(sheet, "dist-tools/tiles.png");

// 2枚目: 建物の一覧。
const buildingSheet = new Screen(400, 260);
buildingSheet.clear(COLOR.panelShadow);
let bx = 4;
let by = 12;
let rowHeight = 0;
for (const def of BUILDINGS) {
  const w = def.width * TILE_SIZE;
  const h = def.height * TILE_SIZE;
  if (bx + w > buildingSheet.width - 4) {
    bx = 4;
    by += rowHeight + 14;
    rowHeight = 0;
  }
  for (let ty = 0; ty < def.height; ty++) {
    for (let tx = 0; tx < def.width; tx++) {
      drawTile(
        buildingSheet,
        def.tileBase + ty * def.width + tx,
        bx + tx * TILE_SIZE,
        by + ty * TILE_SIZE,
      );
    }
  }
  font.drawText(buildingSheet, def.name, bx, by - 9, COLOR.white);
  bx += w + 6;
  rowHeight = Math.max(rowHeight, h);
}
save(buildingSheet, "dist-tools/buildings.png");

// 3枚目: 自然地形のゲーム画面。
const map = generateTerrain(new Rng(20260826));
const screen = new Screen();
const view = new MapView(map, tileset);
view.centerOn(map.width / 2, map.height / 2);
screen.clear(COLOR.black);
view.draw(screen, 0);
const icons = buildIconAtlas(
  TOOLS.map((tool) => tool.icon),
  tileset,
);
drawPanel(screen, font, icons, TOOLS.length, 2, {
  cityName: "ドットメトロポリス",
  year: 1900,
  month: 1,
  funds: 20000,
  population: 12345,
  toolName: "道路",
  toolCost: 10,
  message: "",
  cursor: { x: 60, y: 50 },
});
save(screen, "dist-tools/screen.png");

// 4枚目: マップ全体の俯瞰と、地形の内訳。
const overview = new Screen(map.width * 2, map.height * 2);
overview.clear(COLOR.black);
drawMinimap(overview, map, 0, 0, 2);
save(overview, "dist-tools/overview.png");

const counts = new Map<string, number>();
for (const tile of map.tiles) {
  const kind = isWater(tile)
    ? "水"
    : isForest(tile)
      ? "森"
      : tile === TileId.Sand
        ? "砂浜"
        : "草地";
  counts.set(kind, (counts.get(kind) ?? 0) + 1);
}
for (const [kind, n] of counts) {
  console.log(`  ${kind}: ${n} (${((n / map.tiles.length) * 100).toFixed(1)}%)`);
}

// 5枚目: 建設処理を通して作った街並み。
const demoMap = new CityMap(24, 18);
demoMap.tiles.fill(TileId.Grass);
for (let y = 12; y < 18; y++) {
  for (let x = 0; x < 24; x++) demoMap.set(x, y, TileId.Water);
}
const demo = new CityState(demoMap, new Rng(7), 999999, "デモシティ");

for (let x = 0; x < 24; x++) buildNetwork(demo, x, 4, "road");
for (let x = 0; x < 24; x++) buildNetwork(demo, x, 11, "road");
for (const x of [3, 11, 19]) {
  for (let y = 0; y < 12; y++) buildNetwork(demo, x, y, "road");
}
for (let x = 0; x < 24; x++) buildNetwork(demo, x, 8, "rail");
for (let y = 0; y < 4; y++) buildNetwork(demo, 7, y, "wire");
for (let x = 7; x < 16; x++) buildNetwork(demo, x, 0, "wire");

buildZone(demo, 0, 1, ZoneType.residential);
buildZone(demo, 4, 1, ZoneType.commercial);
buildZone(demo, 8, 1, ZoneType.industrial);
buildStructure(demo, 12, 0, buildingById("coal-plant"));
buildStructure(demo, 20, 0, buildingById("police-station"));
buildStructure(demo, 20, 5, buildingById("fire-station"));
buildStructure(demo, 12, 5, buildingById("stadium"));
buildStructure(demo, 0, 9, buildingById("park"));
buildStructure(demo, 4, 9, buildingById("seaport"));

// 成長段階の見本を並べる。
for (let level = 1; level <= 5; level++) {
  placeStructure(demoMap, (level - 1) * 4, 5, zoneBuilding(ZoneType.residential, level));
}
for (let level = 3; level <= 5; level++) {
  placeStructure(demoMap, (level - 3) * 4, 9, zoneBuilding(ZoneType.commercial, level));
  placeStructure(demoMap, 12 + (level - 3) * 4, 9, zoneBuilding(ZoneType.industrial, level));
}

// デモの街は画面より広いので、マップ全体を等倍でそのまま書き出す。
const demoScreen = new Screen(demoMap.width * TILE_SIZE, demoMap.height * TILE_SIZE);
demoScreen.clear(COLOR.black);
for (let ty = 0; ty < demoMap.height; ty++) {
  for (let tx = 0; tx < demoMap.width; tx++) {
    drawTile(demoScreen, demoMap.get(tx, ty), tx * TILE_SIZE, ty * TILE_SIZE);
  }
}
save(demoScreen, "dist-tools/city.png");

// 6枚目: フォントの表示確認。
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
