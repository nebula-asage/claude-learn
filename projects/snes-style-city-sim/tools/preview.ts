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
const { Simulation } = await import("../src/sim/simulation.js");
const { TICKS_PER_MONTH } = await import("../src/sim/state.js");
const { DATA_MAP_NAMES, DataMap, drawDataMap } = await import("../src/render/overlays.js");
const { BudgetModal, EvaluationModal, GraphModal } = await import("../src/ui/modals.js");
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
  demand: { residential: 0.8, commercial: 0.25, industrial: -0.6 },
  speedName: "標準",
  powerShortage: false,
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

// 6枚目: 実際にシミュレーションを回して育てた街。
const grownMap = new CityMap(40, 30);
grownMap.tiles.fill(TileId.Grass);
const grown = new CityState(grownMap, new Rng(4242), 500000, "テスト市");

// 5タイル周期の街区にする。0が道路、1〜3が区画、4が送電線用の空き地。
for (let x = 0; x < 40; x += 5) {
  for (let y = 0; y < 30; y++) buildNetwork(grown, x, y, "road");
}
for (let y = 0; y < 30; y += 5) {
  for (let x = 0; x < 40; x++) buildNetwork(grown, x, y, "road");
}
for (let x = 4; x < 40; x += 5) {
  for (let y = 0; y < 30; y++) buildNetwork(grown, x, y, "wire");
}
for (let y = 4; y < 30; y += 5) {
  for (let x = 0; x < 40; x++) buildNetwork(grown, x, y, "wire");
}

let zoneIndex = 0;
const kinds = [
  ZoneType.residential,
  ZoneType.residential,
  ZoneType.commercial,
  ZoneType.industrial,
];
for (let y = 1; y < 29; y += 5) {
  for (let x = 1; x < 39; x += 5) {
    if (x === 26 && y === 21) continue; // 発電所の場所は空けておく
    buildZone(grown, x, y, kinds[zoneIndex % kinds.length]);
    zoneIndex++;
  }
}
// 発電所は送電線の通っている空き地に面する位置に置く。
buildStructure(grown, 26, 21, buildingById("coal-plant"));

grown.autoBudget = true; // プレビューでは予算画面を出さずに自動決算する
const simulation = new Simulation(grown);
console.log("シミュレーション経過:");
for (let month = 0; month <= 12 * 30; month++) {
  if (month % 60 === 0) {
    const s = grown.stats;
    const average = (field: Uint8Array): string =>
      (field.reduce((sum, v) => sum + v, 0) / field.length).toFixed(0);
    console.log(
      `  ${grown.year}年: 人口 ${s.population} (住民 ${s.residents} / 商業 ${s.commercialJobs} / 工業 ${s.industrialJobs})` +
        ` 需要 R${grown.demand.residential.toFixed(2)} C${grown.demand.commercial.toFixed(2)} I${grown.demand.industrial.toFixed(2)}` +
        ` 地価${average(grown.fields.landValue)} 公害${average(grown.fields.pollution)} 犯罪${average(grown.fields.crime)} 交通${average(grown.fields.traffic)}`,
    );
  }
  for (let t = 0; t < TICKS_PER_MONTH; t++) simulation.tick();
}

const grownScreen = new Screen(grownMap.width * TILE_SIZE, grownMap.height * TILE_SIZE);
grownScreen.clear(COLOR.black);
for (let ty = 0; ty < grownMap.height; ty++) {
  for (let tx = 0; tx < grownMap.width; tx++) {
    drawTile(grownScreen, grownMap.get(tx, ty), tx * TILE_SIZE, ty * TILE_SIZE);
  }
}
save(grownScreen, "dist-tools/grown.png");

// 7枚目以降: データマップと各ウィンドウ。
const cityScreen = new Screen();
const cityView = new MapView(grownMap, tileset);
cityView.centerOn(20, 12);

/**
 * 育てた街を背景に、指定した内容を重ねて書き出す。
 *
 * @param path 出力先のパス。
 * @param overlay 背景を描いたあとに実行する処理。
 */
function saveOverlay(path: string, overlay: () => void): void {
  cityScreen.clear(COLOR.black);
  cityView.draw(cityScreen, 0);
  overlay();
  drawPanel(cityScreen, font, icons, TOOLS.length, 6, {
    cityName: grown.cityName,
    year: grown.year,
    month: grown.month,
    funds: grown.funds,
    population: grown.stats.population,
    demand: grown.demand,
    speedName: "標準",
    powerShortage: false,
    toolName: "住宅区画",
    toolCost: 100,
    message: "",
    cursor: { x: 20, y: 12 },
  });
  save(cityScreen, path);
}

saveOverlay("dist-tools/datamap-landvalue.png", () => {
  drawDataMap(cityScreen, grown, cityView, DataMap.landValue);
  font.drawTextShadow(
    cityScreen,
    DATA_MAP_NAMES[DataMap.landValue],
    4,
    4,
    COLOR.white,
    COLOR.black,
  );
});
saveOverlay("dist-tools/datamap-pollution.png", () => {
  drawDataMap(cityScreen, grown, cityView, DataMap.pollution);
  font.drawTextShadow(
    cityScreen,
    DATA_MAP_NAMES[DataMap.pollution],
    4,
    4,
    COLOR.white,
    COLOR.black,
  );
});
saveOverlay("dist-tools/window-budget.png", () => {
  new BudgetModal(grown, () => undefined).draw(cityScreen, font);
});
saveOverlay("dist-tools/window-evaluation.png", () => {
  new EvaluationModal(grown).draw(cityScreen, font);
});
saveOverlay("dist-tools/window-graph.png", () => {
  new GraphModal(grown).draw(cityScreen, font);
});

// 最後: フォントの表示確認。
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
