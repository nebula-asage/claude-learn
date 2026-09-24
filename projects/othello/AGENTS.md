# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

React(UI) + Tauri(デスクトップアプリ化)で作ったオセロ(リバーシ)。パッケージマネージャはpnpm(corepackは使わない)。コマンドは `just` 経由(`justfile`)で実行するのが基本だが、中身は `package.json` の `scripts` を叩いているだけなので `pnpm run <script>` でも同じ。

## よく使うコマンド

```bash
just install       # pnpm install
just prepare       # Git hooks(Husky)有効化。初回のみ手動実行が必要(理由は下記)
just dev           # Viteの開発サーバーのみ(ブラウザで動作確認)
just tauri-dev      # デスクトップアプリとして起動
just typecheck      # tsc -b --noEmit
just lint / lint-fix
just fmt / fmt-check       # Prettier
just test / test-watch     # Vitest。対象はtest/othello.test.tsのみ
just cover          # カバレッジ計測、coverage/にHTML出力
just doc            # TypeDocでdocs/api/にAPIリファレンス生成(対象はsrc/othello.tsのみ)
just doc-check      # HTML出力せずJSDoc記述漏れだけを検証(CI向け)
just cspell         # スペルチェック(pnpx cspell)。未知語はcspell.jsonのwordsに追記
just clean          # dist/coverage/docs/api/src-tauri/target を削除
just --list         # レシピ一覧
```

単体テストを1件だけ実行する場合は `pnpm exec vitest run -t "<テスト名>"`、テストファイルを絞る場合は `pnpm exec vitest run test/othello.test.ts` のように直接 `pnpm exec vitest` を使う(justfileにはワイルドカード指定のレシピが無い)。

## アーキテクチャ

- **`src/othello.ts`** — ゲームロジック全体を持つ唯一のモジュール。UIを一切持たない純粋関数群で、`Board`/`GameState` はイミュータブルに扱う(`applyMove` は新しい`GameState`を返し、元の状態は変更しない)。テスト・JSDoc強制・カバレッジ計測の対象はこのファイルのみ。
- **`src/App.tsx`** — 唯一のUIコンポーネント。`othello.ts` の関数を呼ぶだけのグルーコードで、状態は `useState<GameState>` 一つに集約されている。ロジックをここに増やさず `othello.ts` 側に置くこと。
- **`src-tauri/`** — Tauri(Rust)側。ネイティブウィンドウの起動・ビルド設定のみで、フロントエンドのロジックはここに置かない。ESLint/TypeDoc/カバレッジいずれの対象からも除外されている。
- 状態遷移(着手→反転→次手番決定→パス判定→終了判定)は `applyMove` → `advanceTurn` の流れに集約されている。パスは「次のプレイヤーに合法手が無ければ手番を戻す」形で暗黙に処理され、両者とも置けなくなった時点で `isGameOver: true` になる。

## JSDoc強制のルール(eslint.config.js)

`src/othello.ts` の **export された**シンボル(関数・interface・type alias・interfaceの各フィールド)には `jsdoc/require-jsdoc` でJSDocコメントが必須。非exportの内部ヘルパー(`isOnBoard`, `countDiscs`, `advanceTurn` など)は対象外。`App.tsx`/`main.tsx` はUIのグルーコードとして対象外。新しい関数をexportする際はJSDocを書かないとlintが落ちる。

## サプライチェーン対策

`.npmrc` に `ignore-scripts=true` と `minimum-release-age`(7日)を設定済み。この結果 `pnpm install` では `prepare` スクリプト(Husky有効化)も自動実行されないため、**初回は `just prepare` を手動実行する必要がある**。
