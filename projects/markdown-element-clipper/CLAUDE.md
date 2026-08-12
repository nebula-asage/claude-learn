# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

Chrome / Edge用のManifest V3拡張機能。ページ上の要素をDevTools風に選択し、その部分をMarkdownに変換してクリップボードへコピーする。TypeScript + esbuild製。Markdown変換は `turndown` + `@joplin/turndown-plugin-gfm`（GFMテーブル・タスクリスト・打ち消し線）を使う。

## コマンド

```bash
pnpm install
pnpm build       # esbuildでdist/へバンドル
pnpm dev         # esbuildのwatchモード
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run (src/convert/ の単体テストのみ)
```

## アーキテクチャ

### レイヤー構成

```
src/background/index.ts   action.onClicked / commands.onCommand → 既注入なら
                           sendMessageでトグル、未注入ならscripting.executeScript
src/content/index.ts       content scriptのエントリ。globalThis.__MD_CLIPPER__
                           による二重注入ガード
src/content/picker.ts      状態機械。イベント抑止、↑↓での親子移動、確定/中止
src/content/overlay.ts     Shadow DOM。ハイライト枠・ラベル・トースト、rAF追従
src/content/clipboard.ts   writeText → execCommand の2段フォールバック
src/convert/index.ts       elementToMarkdown(el) の公開API
src/convert/preprocess.ts  live DOMとクローンを同時に歩くlockstep walk
src/convert/turndown.ts    TurndownServiceのオプション + gfm + カスタムルール
```

MV3のcontent scriptはクラシックスクリプトとして評価される(`import`/`export`
不可)ため、`scripts/build.mjs` でesbuildにより `format: 'iife'` の単一ファイル
にバンドルしている。`platform: 'browser'` を指定することで、turndownの
`package.json#browser` フィールドが解決され、Node専用の依存
`@mixmark-io/domino` が自動的に除外される(外すとNodeビルドが混入し、
content scriptでも一応動いてしまうため気付きにくい)。

### 実装時の注意

- **`getComputedStyle` はクローンには効かない**: preprocess.ts の不可視要素
  判定は必ずlive(DOMツリーに接続された実要素)側で行う。「クローンしてから
  不可視要素を消す」という順序は動かない
- **turndownのルールは後勝ち**: `addRule` は内部配列に `unshift` するため、
  後から追加したルールが先に評価される。`turndown.ts` では `gfm(service)` を
  呼んだ**後に**カスタムルールを追加している
- **rootラップ必須**: turndownは渡されたルート要素自身を変換せず子孫だけを
  変換する。`<pre>` や `<h1>` を単体選択すると書式が消えるため、
  `preprocessElement()` は常に生成した `<div>` でラップしてから返す。同様に
  `li`/`tr`/`td`/`th` を単体選択した場合は、turndownの各ルールが直接の親
  (`ol`/`ul`, `table`)の有無で番号付け・ヘッダー行判定をしているため、
  最小限の親要素で包み直している
- **`<input>` は一律除去しない**: `constants.ts` の `REMOVE_TAGS` から
  `input` は意図的に除いてある。`type="checkbox"` はGFMの
  `taskListItems` ルールで `[x]`/`[ ]` に変換されるため、
  `preprocess.ts` の `shouldRemoveTag()` でcheckbox以外のinputだけを除去する
- **クリップボードコピーは同期実行**: `picker.ts` の確定処理はclickハンドラ
  内で同期的にMarkdown変換とコピーまで行う。`await` を挟むとtransient user
  activationが切れ、`execCommand('copy')` フォールバックが失敗しうるため
- 新しい依存を追加したら `pnpm build` 後に `grep -ci domino dist/content.js`
  が0件であることを確認する(browserビルドが選ばれている証拠)
