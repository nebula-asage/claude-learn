import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { FIXTURE_ORIGIN, FIXTURE_PORT, SAMPLE_URL } from "./e2e/constants";

// Ubuntu/WSLでは chromium の実行に libnss3 / libnspr4 が要るが、sudoが使えない
// 環境ではシステムに入れられない。~/.local/chromedeps に展開してあればそこを
// 探させる(展開手順はREADMEの「e2eテスト」節を参照)。
const localLibDir = path.join(os.homedir(), ".local/chromedeps/usr/lib/x86_64-linux-gnu");
if (existsSync(localLibDir)) {
  process.env.LD_LIBRARY_PATH = [localLibDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
}

export default defineConfig({
  testDir: "./e2e",
  // 拡張は永続コンテキストで1つだけ起動し、クリップボードという共有資源を
  // 読み書きするため、並列実行はしない。
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"]],
  use: {
    baseURL: FIXTURE_ORIGIN,
    trace: process.env.CI ? "off" : "retain-on-failure",
  },
  webServer: {
    command: `python3 -m http.server ${FIXTURE_PORT} --bind 127.0.0.1 --directory fixtures`,
    url: SAMPLE_URL,
    reuseExistingServer: !process.env.CI,
    // python3 -m http.server はアクセスログをstderrに出すので両方黙らせる。
    stdout: "ignore",
    stderr: "ignore",
  },
});
