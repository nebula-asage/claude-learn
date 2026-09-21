// esbuild でMV3拡張をビルドするスクリプト。
//
// content script / background(service worker) はそれぞれ独立したIIFEに
// バンドルする必要がある(MV3のcontent scriptはクラシックスクリプトとして
// 評価されるためimport/exportが使えない)。
//
// platform: 'browser' を指定することで、turndown の package.json#browser
// フィールドが解決され、Node専用の依存(@mixmark-io/domino)が自動的に
// 空スタブへ置換される。ビルド後に `grep -ci domino dist/content.js` が
// 0であることを確認して、意図通りbrowserビルドが選ばれたことを検証できる。

import * as esbuild from "esbuild";
import { existsSync } from "node:fs";
import { cp, rm, watch as fsWatch } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");

const isWatch = process.argv.includes("--watch");
const isDev = isWatch || process.env.NODE_ENV === "development";

/** @type {import('esbuild').BuildOptions} */
const commonOptions = {
  bundle: true,
  format: "iife",
  platform: "browser",
  conditions: ["browser"],
  target: ["chrome116", "edge116"],
  charset: "utf8",
  legalComments: "none",
  loader: { ".css": "text" },
  define: {
    "process.env.NODE_ENV": JSON.stringify(isDev ? "development" : "production"),
  },
  sourcemap: isDev ? "inline" : false,
  minify: !isDev,
  outdir: distDir,
  logLevel: "info",
};

async function copyPublic() {
  if (existsSync(distDir)) {
    await rm(distDir, { recursive: true, force: true });
  }
  await cp(publicDir, distDir, { recursive: true });
}

async function watchPublic() {
  const watcher = fsWatch(publicDir, { recursive: true });
  for await (const _event of watcher) {
    await copyPublic();
    console.log("[build] public/ を dist/ に再コピーしました");
  }
}

async function main() {
  await copyPublic();

  const entryOptions = {
    ...commonOptions,
    entryPoints: {
      background: path.join(rootDir, "src/background/index.ts"),
      content: path.join(rootDir, "src/content/index.ts"),
    },
  };

  if (isWatch) {
    const ctx = await esbuild.context(entryOptions);
    await ctx.watch();
    console.log("[build] watchモードで起動しました (Ctrl+C で終了)");
    watchPublic();
  } else {
    await esbuild.build(entryOptions);
    console.log("[build] ビルド完了");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
