import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// Tauriの規約(https://tauri.app/start/frontend/vite/)に合わせて、
// 開発サーバーのポートを固定し、src-tauri配下の変更監視は無視する。
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
