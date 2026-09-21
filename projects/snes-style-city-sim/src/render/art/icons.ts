/**
 * 道具アイコン（16x16）の生成。
 *
 * 建物のアイコンは、その建物のドット絵をそのまま縮小して作る。こうしておくと
 * 建物の絵を描き直したときにアイコンも自動で追従する。
 * @packageDocumentation
 */
import { buildingById } from "../../sim/buildings.js";
import { TILE_SIZE } from "../../sim/tiles.js";
import { COLOR } from "../palette.js";
import { Tileset } from "../tileset.js";
import { ArtCanvas } from "./canvas.js";
import { buildingArt } from "./buildings.js";

/** 手描きのアイコン絵の名前。 */
export type GlyphName = "bulldozer" | "query";

/** 建物の絵を縮小してアイコンにする指定。 */
export interface BuildingIconSpec {
  /** 種別の目印。 */
  kind: "building";
  /** 建物の内部名。 */
  id: string;
}

/** タイル絵をそのままアイコンにする指定。 */
export interface TileIconSpec {
  /** 種別の目印。 */
  kind: "tile";
  /** 使うタイルID。 */
  tile: number;
}

/** 手描きの絵をアイコンにする指定。 */
export interface GlyphIconSpec {
  /** 種別の目印。 */
  kind: "glyph";
  /** 使う絵の名前。 */
  glyph: GlyphName;
}

/** アイコンの絵をどこから持ってくるかの指定。 */
export type IconSpec = BuildingIconSpec | TileIconSpec | GlyphIconSpec;

const GLYPHS: Record<GlyphName, readonly string[]> = {
  bulldozer: [
    "................",
    "................",
    "......KKKKKK....",
    "......KQQQQK....",
    "..KKKKKQQQQK....",
    "..KYYYKKKKKK....",
    "..KYYYYYYYYK....",
    "..KYYYYYYYYK.K..",
    "..KKKKKKKKKK.K..",
    ".KDDKKKDDKK..K..",
    ".KDDKKKDDKK..K..",
    ".KKKKKKKKKK..K..",
    "..KKKKKKKK...K..",
    ".............K..",
    "................",
    "................",
  ],
  query: [
    "................",
    "....KKKKKK......",
    "..KKWWWWWWKK....",
    "..KWWzzzzWWK....",
    ".KWzzKKKKzzWK...",
    ".KWzzKWWKzzWK...",
    ".KWzzzzKKzzWK...",
    ".KWzzzKKzzzWK...",
    "..KWzzKKzzWK....",
    "..KKWWKKWWKK....",
    "....KKKKKKK.....",
    "........KKKK....",
    ".........KKKK...",
    "..........KKKK..",
    "...........KKK..",
    "................",
  ],
};

/**
 * 大きな絵を整数分の1に縮小する。各ブロックで最も多く使われている色を採る。
 * @param source 縮小元。
 * @param factor 縮小率（3なら1/3）。
 */
export function downscale(source: ArtCanvas, factor: number): ArtCanvas {
  const out = new ArtCanvas(Math.floor(source.width / factor), Math.floor(source.height / factor));
  const tally = new Map<number, number>();
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      tally.clear();
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const color = source.data[(y * factor + sy) * source.width + x * factor + sx];
          tally.set(color, (tally.get(color) ?? 0) + 1);
        }
      }
      let best = 0;
      let bestCount = -1;
      for (const [color, count] of tally) {
        // 同数なら、輪郭が潰れないよう明るい方（添字の大きい方）を優先する。
        if (count > bestCount || (count === bestCount && color > best)) {
          best = color;
          bestCount = count;
        }
      }
      out.px(x, y, best);
    }
  }
  return out;
}

/**
 * 指定に従ってアイコンを1枚作る。
 * @param spec アイコンの内容。
 * @param tileset タイル絵のアトラス（`kind: "tile"` で使う）。
 */
function makeIcon(spec: IconSpec, tileset: Tileset): ArtCanvas {
  const canvas = new ArtCanvas(TILE_SIZE, TILE_SIZE);

  if (spec.kind === "glyph") {
    canvas.fill(COLOR.panel);
    canvas.stamp(0, 0, GLYPHS[spec.glyph]);
    return canvas;
  }

  if (spec.kind === "tile") {
    const start = spec.tile * TILE_SIZE * TILE_SIZE;
    canvas.data.set(tileset.pixels.subarray(start, start + TILE_SIZE * TILE_SIZE));
    return canvas;
  }

  const def = buildingById(spec.id);
  const art = buildingArt(def);
  const factor = Math.max(1, Math.round(art.width / TILE_SIZE));
  canvas.stampCanvas(0, 0, factor === 1 ? art : downscale(art, factor));
  return canvas;
}

/**
 * 道具アイコンのアトラスを作る。並び順は渡した指定の順になる。
 * @param specs アイコンの指定一覧。
 * @param tileset タイル絵のアトラス。
 */
export function buildIconAtlas(specs: readonly IconSpec[], tileset: Tileset): Tileset {
  const icons = new Tileset(specs.length);
  specs.forEach((spec, index) => {
    icons.setCanvas(index, makeIcon(spec, tileset));
  });
  return icons;
}
