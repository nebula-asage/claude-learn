# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

Chrome / Edge用のManifest V3拡張機能。ページ上の要素をDevTools風に選択し、その部分をMarkdownに変換してクリップボードへコピーする。TypeScript + esbuild製。Markdown変換は `turndown` + `@joplin/turndown-plugin-gfm`（GFMテーブル・タスクリスト・打ち消し線）を使う。

## 開発環境

devcontainerは使わず、ホスト環境に直接pnpm(公式スタンドアロンインストーラ導入、`PNPM_HOME`配下でNode.jsランタイムも管理)を前提にしている。`.vscode/`にVS Code共通設定・TypeScript向け設定を、`cspell.json`・`.markdownlint.jsonc`/`.markdownlint-cli2.jsonc`にスペルチェック/Markdown lint設定を配置済み。`justfile`はこれらとlint/format/docs系の`pnpm run`スクリプトを呼ぶ薄いラッパー（`just`を引数なしで実行するとレシピ一覧を確認できる）。

`pnpm-workspace.yaml`の`ignoreScripts: true`（サプライチェーン攻撃対策）により、`pnpm install`では`prepare`スクリプト（Husky設定）が自動実行されない。`pnpm install`後、初回のみ`pnpm run prepare`を手動実行してGitのpre-commitフックを有効化すること（詳細は下記「Git hooks」）。

## コマンド

```bash
pnpm install
pnpm build           # esbuildでdist/へバンドル
pnpm dev             # esbuildのwatchモード
pnpm run typecheck   # tsc --noEmit (本体とe2eで設定ファイルが分かれている)
pnpm test            # vitest run (src/convert/ の単体テストのみ)
pnpm run test:coverage  # vitest run --coverage (coverage/にHTML・clover.xml・coverage-final.jsonを出力)
pnpm test:e2e        # playwright test (実ブラウザに拡張を読み込む通しテスト)
pnpm run lint        # eslint . (型情報を使った検査を含む)
pnpm run lint:fix    # eslint . --fix
pnpm run format      # prettier --write .
pnpm run format:check   # prettier --check .
pnpm run docs        # TypeDocでAPIドキュメント(HTML)をdocs/apiに生成 (生成物はgit管理外)
pnpm run docs:check  # HTMLを出さずドキュメント記述漏れだけ検証する
```

### Lint / Format / JSDoc

ESLint(flat config, `eslint.config.js`)は`typescript-eslint`の`recommendedTypeChecked`をベースに、`tsconfig.json`と`tsconfig.e2e.json`の両方を型情報のソースとして使う。`e2e/**/*.ts`はPlaywrightのfixture定義が空オブジェクトパターン`({}, use) => {...}`を使う慣習のため`no-empty-pattern`を無効化している。フォーマットはPrettier(`.prettierrc.json`)。

`src/**/*.ts`には`eslint-plugin-jsdoc`(`flat/recommended-typescript-error`)も適用しており、**exportしたシンボル(クラス・関数・interface・型エイリアス・定数、およびinterfaceの各フィールド・メソッド)にはJSDocが必須**(非exportの内部ヘルパーは対象外)。TypeScriptが型情報を持つため`@param`/`@returns`に型注記は書かない。ファイル先頭のモジュールコメントは`@module`ではなく`@packageDocumentation`を使うこと(TS環境では`@module`が冗長タグとしてESLintに拒否される)。ESLintの`jsdoc/require-jsdoc`はトップレベルのexportのみを対象にしており、interfaceのメソッドシグネチャや`.d.ts`のアンビエント宣言は検査対象外だが、TypeDoc側の`typedoc.json`の`validation`(`notExported`/`notDocumented`)はより広い範囲(interfaceのメソッド・`.d.ts`のグローバル拡張含む)を検証するため、`pnpm run docs:check`の方が記述漏れの検出範囲が広い。

`cspell.json`・`.markdownlint.jsonc`・`.markdownlint-cli2.jsonc`はPrettierの対象外にしてある(vscode-settingsスキルのテンプレート書式・末尾カンマ無しに揃えるため。`.prettierignore`参照)。

### Git hooks（Husky + lint-staged）

コミット時、ステージされた`*.ts`に`eslint --fix` → `prettier --write`を、それ以外の対象拡張子(`js`/`mjs`/`cjs`/`json`/`md`/`yml`/`yaml`)には`prettier --write`のみを自動適用する(lint-staged。設定は`package.json`の`lint-staged`フィールド)。フック本体は`.husky/pre-commit`。

このプロジェクトはmonorepo(`claude-learn`)のサブディレクトリにあり`.git`はリポジトリルートにしか存在しないため、Husky標準の`npx husky init`はそのままでは使えない。`scripts/install-husky.mjs`が`git rev-parse --show-toplevel`でリポジトリルートを求め、そこへ`chdir`した上でこのプロジェクト配下`.husky`を対象に`core.hooksPath`を設定する(`package.json`の`prepare`はこのスクリプトを指す)。`core.hooksPath`はGitのローカル設定でリポジトリには含まれないため、cloneした環境では毎回`pnpm run prepare`の実行が必要。

`core.hooksPath`はリポジトリ全体で1つしか持てないため、このフックはリポジトリ内のどのコミットでも発火する。そのため`.husky/pre-commit`は先頭で2つのガードを行う。(1)ステージされたファイルに`projects/markdown-element-clipper/`配下が含まれなければ何もせず通す。(2)`node_modules/.bin/lint-staged`が無い作業ツリー(clone直後や`pnpm install`前のgit worktree)では警告を出してスキップする。どちらもコミットを失敗させない。

## アーキテクチャ

### レイヤー構成

```text
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

### テストの二層構成

- `test/` — vitest + jsdom。Markdown変換ロジック(`src/convert/`)の網羅的なテスト
- `e2e/` — Playwright。実ブラウザに拡張を読み込んで、注入・イベント抑止・
  キー操作・クリップボードという「jsdomでは確認できないこと」だけを見る

e2eで押さえておくべき制約が3つある。

- **ツールバーのクリックと`Alt+Shift+M`は発火できない**: どちらもブラウザUI側の
  操作でCDPの対象外。しかも `activeTab` はその操作でしか付与されないため、
  Service Workerから `chrome.scripting.executeScript` を呼んでも権限不足になる。
  そこで `e2e/fixtures.ts` が `dist/` をコピーして fixtureのオリジンだけに
  絞った `host_permissions` を足した `dist-e2e/` を作り、`togglePicker()` が
  background の `activate()` と同じ手順(sendMessage → executeScript)を
  Service Worker上で再現している。**拡張本体のコードはe2eのために変更しない**
- **オーバーレイの中身は覗けない**: `overlay.ts` のShadow DOMは `mode: "closed"`
  で、かつcontent scriptはisolated worldで動くため、`attachShadow` を差し替える
  小細工も効かない。ピッカーの起動判定は、`overlay.ts` が `document.head` に
  挿入する唯一のページDOM(`#markdown-element-clipper-cursor-style`)の有無で行う
- **タブは1枚だけ使う**: `page` フィクスチャは永続コンテキストの既存タブを
  使い回している。新しいタブを開くと元のタブがhiddenになり、picker側の
  `visibilitychange` → `stop()` が走ってしまう
