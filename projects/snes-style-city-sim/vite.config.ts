import { defineConfig } from "vite";

// GitHub Pages などのサブディレクトリ配信でもそのまま開けるよう、相対パスで出力する。
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
  },
});
