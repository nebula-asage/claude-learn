/**
 * ブラウザ側のエントリポイント。起動処理は `app/app.ts` に任せる。
 * @packageDocumentation
 */
import { startApp } from "./app/app.js";

void startApp("screen");
