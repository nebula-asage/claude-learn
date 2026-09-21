/**
 * 美咲フォント（BDF形式）を、ゲームが読み込む固定長のビットマップフォントに変換する。
 *
 * 使い方:
 *   node scripts/build-font.mjs <misaki_gothic.bdf> [出力先]
 *
 * BDF本体はリポジトリに含めていない。src/render/font/README.md の手順で取得すること。
 *
 * 出力フォーマット（リトルエンディアン）:
 *   0..3    マジック "MSK8"
 *   4..7    グリフ数 count (uint32)
 *   8..     コードポイント count 個 (uint16, 昇順)
 *   ..      文字幅 count 個 (uint8, 4 または 8)
 *   ..      ビットマップ count*8 バイト (1行1バイト・最上位ビットが左端)
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , bdfPath, outPathArg] = process.argv;
if (!bdfPath) {
  console.error("使い方: node scripts/build-font.mjs <misaki_gothic.bdf> [出力先]");
  process.exit(1);
}
const outPath = outPathArg ?? "src/render/font/misaki8.bin";

const text = readFileSync(bdfPath, "utf8");
const lines = text.split(/\r?\n/);

let fontAscent = null;
let cellHeight = null;
for (const line of lines) {
  if (line.startsWith("FONT_ASCENT ")) fontAscent = Number(line.slice(12).trim());
  if (line.startsWith("FONTBOUNDINGBOX ")) cellHeight = Number(line.split(/\s+/)[2]);
  if (fontAscent !== null && cellHeight !== null) break;
}
if (fontAscent === null || cellHeight === null) {
  throw new Error("BDFヘッダから FONT_ASCENT / FONTBOUNDINGBOX を読み取れなかった");
}
if (cellHeight !== 8) {
  throw new Error(`8ドット高のフォントを想定しているが ${cellHeight} だった`);
}

const glyphs = [];
let i = 0;
while (i < lines.length) {
  if (!lines[i].startsWith("STARTCHAR")) {
    i++;
    continue;
  }
  let encoding = -1;
  let dwidth = 8;
  let bbx = null;
  let bitmap = null;
  i++;
  for (; i < lines.length && !lines[i].startsWith("ENDCHAR"); i++) {
    const line = lines[i];
    if (line.startsWith("ENCODING ")) {
      encoding = Number(line.slice(9).trim());
    } else if (line.startsWith("DWIDTH ")) {
      dwidth = Number(line.split(/\s+/)[1]);
    } else if (line.startsWith("BBX ")) {
      const parts = line.split(/\s+/);
      bbx = {
        w: Number(parts[1]),
        h: Number(parts[2]),
        xoff: Number(parts[3]),
        yoff: Number(parts[4]),
      };
    } else if (line === "BITMAP") {
      bitmap = [];
      for (i++; i < lines.length && !lines[i].startsWith("ENDCHAR"); i++) {
        bitmap.push(lines[i].trim());
      }
      break;
    }
  }

  if (encoding < 0 || bbx === null) continue;
  if (encoding > 0xffff) {
    throw new Error(`BMP外のコードポイントは未対応: U+${encoding.toString(16)}`);
  }

  const rows = new Uint8Array(8);
  if (bitmap && bbx.w > 0 && bbx.h > 0) {
    // BDFのビットマップは文字の外周の空白を削った形なので、BBXの位置に戻して8x8のセルへ配置する。
    const top = fontAscent - (bbx.yoff + bbx.h);
    for (let r = 0; r < bbx.h; r++) {
      const hex = bitmap[r];
      if (hex === undefined || hex === "") continue;
      const y = top + r;
      if (y < 0 || y >= 8) continue;
      // 幅は最大8ドットなので、先頭バイトだけ見れば足りる。
      const byte = parseInt(hex.slice(0, 2), 16);
      rows[y] |= (byte >>> bbx.xoff) & 0xff;
    }
  }

  glyphs.push({ code: encoding, width: dwidth <= 4 ? 4 : 8, rows });
}

glyphs.sort((a, b) => a.code - b.code);

const count = glyphs.length;
const out = new Uint8Array(8 + count * 2 + count + count * 8);
const view = new DataView(out.buffer);
out[0] = 0x4d; // M
out[1] = 0x53; // S
out[2] = 0x4b; // K
out[3] = 0x38; // 8
view.setUint32(4, count, true);

let p = 8;
for (const g of glyphs) {
  view.setUint16(p, g.code, true);
  p += 2;
}
for (const g of glyphs) {
  out[p++] = g.width;
}
for (const g of glyphs) {
  out.set(g.rows, p);
  p += 8;
}

writeFileSync(outPath, out);
console.log(`${outPath} に ${count} 文字 (${out.length} バイト) を書き出した`);
