---
name: pnpm-project
description: Node.js(TypeScript)の練習・開発プロジェクト一式（pnpmスタンドアロン導入前提+TypeScript/ESLint/Prettier/Vitest+JSDoc/TypeDocによるAPIドキュメント生成+Husky/lint-stagedのGit hooks+justによるタスクランナー）をホスト環境に直接構築するスキル。「pnpm/Node.jsの環境・プロジェクトを作って」「TypeScriptのlint/format/testを入れて」「JSDoc/TypeDocでAPIドキュメントを生成したい」「コミット時に自動でlint/formatかけたい」など、pnpmベースのNode.js/TypeScriptプロジェクトの新規作成や、既存プロジェクトへのlint/test/ドキュメンテーション/Git hooks追加を頼まれたら必ず使うこと。配置先が既にVS Code向けの`.vscode/`ディレクトリを持つ場合は、ESLint(flat config)/Prettier/Vitestに対応したTypeScript向けのsettings.json・拡張機能のおすすめ設定に加え、Coverage Gutters拡張によるカバレッジのエディタ上可視化（被覆/未被覆行のガター色付け）設定も追加する。Docker/devcontainerには依存せず、pnpm本体は公式スタンドアロンインストーラで導入し、Node.jsランタイム自体もpnpmの`runtime`機能で管理する（npm・nvm・corepackいずれにも依存しない）。サプライチェーン攻撃対策も組み込む。devcontainer自体の構築はこのスキルの対象外。
---

# pnpm-project

**pnpmスタンドアロン導入前提**のNode.js環境構築条件を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`.devcontainer/`（このリポジトリのdevcontainer環境）で一度構築・検証済みの条件（pnpmのバージョン固定・サプライチェーン攻撃対策）に加え、`projects/gitlab-mcp-server/`で実際に運用・検証済みのTypeScript開発環境（TypeScript + tscビルド、ESLint(flat config, typescript-eslint) + Prettier、Vitest、eslint-plugin-jsdoc + TypeDocによるJSDoc必須化とAPIドキュメント生成、Husky + lint-stagedによるpre-commit時の自動lint/format）を、コンテナに依存しない形でテンプレート化したもの。

**旧経緯**: かつては nvm で Node.js を導入し、pnpm 本体は `npm install -g pnpm` で導入する方式（スキル名は `pnpm-nvm-project`）だった。2026-09、pnpm公式のスタンドアロンインストーラ（https://pnpm.io/ja/installation#on-posix-systems）に一本化し、npm・nvmへの依存を廃止した。Node.jsランタイム自体もpnpmの`runtime`機能（`pnpm runtime set node`）で管理する方式に変更し、スキル名も`pnpm-project`に改名した。

このスキルはdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキルの対象であり、このスキルでは扱わない。

## このスキルが前提とする条件（変更しない）

- **pnpm本体は公式スタンドアロンインストーラで導入する**（npm・nvm・corepackいずれにも依存しない）。理由:
  1. npm経由の導入は「pnpmを入れるためにまずnode/npmが要る」という循環があった。スタンドアロンインストーラは実行可能バイナリを直接取得するため、Node.js自体が未導入のホストでも動く
  2. corepackはNode.js本体から将来的に切り離される方針であり、長期的な前提にしにくい
  3. pnpm 12はnpmレジストリの署名（npmの公開鍵）とチェックサムの両方を検証してからバイナリを展開する設計になっており、単体バイナリの検証をこのリポジトリの他ツール（`AGENTS.md`の「単体バイナリ・tarball配布」導入方針）で個別に用意する必要がない
- **Node.jsランタイムもnvmではなくpnpm自身の`runtime`機能（`pnpm runtime set node <version> -g`。旧称`pnpm env use`、非推奨）で導入・管理する**。distro/システムに入っているnodeパッケージや、apt経由のNodeSourceリポジトリ、nvmには依存しない。この機能はpnpmをスタンドアロンインストーラで導入した場合のみ使える（npm経由で導入したpnpmでは動かない）
- **パッケージマネージャはpnpm一本**。`npm install`（依存追加）や`yarn`は使わない
- **サプライチェーン攻撃対策として、プロジェクト直下の`pnpm-workspace.yaml`に次を設定する（固定条件）**:
  - `ignoreScripts: true` — postinstallなどのライフサイクルスクリプトを実行しない
  - `minimumReleaseAge: 10080`（分単位で7日分） — 公開から7日間は新しいバージョンのインストールをスキップし、悪意あるバージョンが検知・撤回される猶予を確保する
  - pnpm 11以降、`.npmrc`はauth/registry設定専用になり非auth/registry設定は無視される（検証済み）ため、これらのpnpm固有設定は`.npmrc`ではなく`pnpm-workspace.yaml`（YAML、キャメルケース）に書く。`.npmrc`は private registry の認証情報等が必要になった場合の置き場として残す
- `package-lock.json`は作らない。依存関係は`package.json` + `pnpm-lock.yaml`（`pnpm install`で生成、コミット対象）で管理する
- **言語はTypeScript一本**。プレーンなJavaScriptのテンプレートは提供しない（`src/`配下に`.ts`を置き、`tsc`で`dist/`にビルドする）
- **Lint/Format/Test/カバレッジ計測は標準で組み込む**。ESLint(flat config, `typescript-eslint`の`recommendedTypeChecked`)・Prettier・Vitest・`@vitest/coverage-v8`（`pnpm run test:coverage`でカバレッジHTMLレポートを生成）は`projects/gitlab-mcp-server/`で検証済みの構成をそのままテンプレート化したものであり、単なる「pnpm環境作って」的な依頼でも省略しない
- **JSDoc必須化とAPIドキュメント生成も標準で組み込む**。`src/**/*.ts`に`eslint-plugin-jsdoc`（`flat/recommended-typescript-error`）を適用し、exportした全シンボル（クラス・関数・interface・型エイリアス・定数、およびinterfaceの各フィールド）にJSDocを必須にする（非exportの内部ヘルパーは対象外）。TypeScriptが型情報を持つため`@param`/`@returns`に型注記は書かない。ファイル先頭のモジュールコメントは`@module`ではなく`@packageDocumentation`を使う（TS環境では`@module`が冗長タグとしてESLintに拒否される）。TypeDoc（`typedoc.json`）で`pnpm run docs`によりHTMLのAPIリファレンスを`docs/api`に生成でき、`pnpm run docs:check`はHTMLを出さずに記述漏れだけを検証する。これも`projects/gitlab-mcp-server/`で検証済みの構成であり、省略しない
- **Git hooks（Husky + lint-staged）も標準で組み込む**。コミット時にステージされた`*.ts`へ`eslint --fix`→`prettier --write`を、それ以外の対象拡張子（`js`/`mjs`/`cjs`/`json`/`md`/`yml`/`yaml`）へ`prettier --write`のみを自動適用する（`package.json`の`lint-staged`フィールド）。フック本体は`.husky/pre-commit`から`pnpm exec lint-staged`を呼ぶ。このリポジトリはmonorepoでプロジェクトが`projects/<name>/`配下のサブディレクトリにあり`.git`はリポジトリルート直下にしか無いため、Husky標準の`npx husky init`（cwd直下の`.git`しか認識しない）はそのままでは使えない。`scripts/install-husky.mjs`が`git rev-parse --show-toplevel`でリポジトリルートを求めてそこへ`chdir`し、プロジェクト配下の`.husky`を対象に`core.hooksPath`を設定する（`package.json`の`prepare`スクリプトがこれを指す）。`pnpm-workspace.yaml`の`ignoreScripts: true`により`pnpm install`では`prepare`が自動実行されないため、`pnpm install`後は**初回のみ`pnpm run prepare`を手動実行**してフックを有効化する必要がある（`core.hooksPath`はGitのローカル設定でコミット対象外なので、clone後の環境では毎回必要）。なお`core.hooksPath`はリポジトリ全体で1つしか持てず、設定したフックはリポジトリ内のどのコミットでも発火するため、`.husky/pre-commit`の先頭に2つのガードを入れてある。(1)ステージされたファイルにこのプロジェクト配下が含まれなければ何もせず通す、(2)`node_modules/.bin/lint-staged`が無い作業ツリー（clone直後や`pnpm install`前のgit worktree）では警告を出してスキップする。どちらもコミットを失敗させない。このガードが無いと、無関係なプロジェクトの変更や別worktreeからのコミットが巻き添えで全て止まる。これも`projects/gitlab-mcp-server/`で検証済みの構成であり、省略しない
- **タスクランナーには`Makefile`ではなくjust（`github.com/casey/just`）を使う**。`package.json`の`scripts`は残したまま、`justfile`はその薄いラッパーとして`build`/`start`/`dev`/`typecheck`/`lint`/`lint-fix`/`fmt`/`fmt-check`/`test`/`test-watch`/`cover`/`doc`/`doc-check`/`prepare`/`clean`の各レシピを用意する（中身は対応する`pnpm run <script>`を呼ぶだけで、ロジックの二重管理はしない）。狙いはgo-project・rust-cargo-project・python-uv-projectなど他言語スキルと`just test`/`just lint`のような呼び方を揃えること。justは単体バイナリでGitHub Releasesのtarball（`SHA256SUMS`検証込み）からユーザーローカルに導入できるためこのリポジトリのsudo不要方針に合致する

## 手順

1. **pnpm・Node.jsランタイム・justがホストに導入済みか確認し、未導入ならユーザーローカルに導入する**
   - pnpm: `command -v pnpm >/dev/null && [ -n "$PNPM_HOME" ] && echo "$PNPM_HOME"` で確認する（`PNPM_HOME`が空/未設定ならスタンドアロン化されていないものとして扱う。`pnpm --version`で12系であることも確認する）。
   - just: `command -v just` と `just --version` で確認する。
   - 具体的な導入コマンド（pnpm公式スタンドアロンインストーラ・`pnpm runtime set node`・just）は `.claude/skills/pnpm-project/references/install.md` を参照する。いずれもホスト環境に実際にソフトウェアを導入する操作であり、ユーザーが明示的に指定していない場合は実行前に確認する。

2. **配置先とプロジェクト名を確認する**
   - このリポジトリの`projects/README.md`のルールにより、基本は`projects/<project-name>/`配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

3. **テンプレートをコピーし、プレースホルダを置換する**
   - `.claude/skills/pnpm-project/templates/package.json` → `<配置先>/package.json`（`__PROJECT_NAME__`を置換）
   - `.claude/skills/pnpm-project/templates/.npmrc` → `<配置先>/.npmrc`（置換不要。auth/registry設定の置き場としてのみ残す）
   - `.claude/skills/pnpm-project/templates/pnpm-workspace.yaml` → `<配置先>/pnpm-workspace.yaml`（置換不要。サプライチェーン攻撃対策本体）
   - `.claude/skills/pnpm-project/templates/.gitignore` → `<配置先>/.gitignore`（置換不要）
   - `.claude/skills/pnpm-project/templates/tsconfig.json` → `<配置先>/tsconfig.json`（置換不要）
   - `.claude/skills/pnpm-project/templates/tsconfig.test.json` → `<配置先>/tsconfig.test.json`（置換不要）
   - `.claude/skills/pnpm-project/templates/eslint.config.js` → `<配置先>/eslint.config.js`（置換不要）
   - `.claude/skills/pnpm-project/templates/.prettierrc.json` → `<配置先>/.prettierrc.json`（置換不要）
   - `.claude/skills/pnpm-project/templates/.prettierignore` → `<配置先>/.prettierignore`（置換不要）
   - `.claude/skills/pnpm-project/templates/vitest.config.ts` → `<配置先>/vitest.config.ts`（置換不要）
   - `.claude/skills/pnpm-project/templates/typedoc.json` → `<配置先>/typedoc.json`（`__PROJECT_NAME__`を置換）
   - `.claude/skills/pnpm-project/templates/src/index.ts` → `<配置先>/src/index.ts`
   - `.claude/skills/pnpm-project/templates/test/index.test.ts` → `<配置先>/test/index.test.ts`
   - `.claude/skills/pnpm-project/templates/README.md` → `<配置先>/README.md`（`__PROJECT_NAME__`を置換）
   - `.claude/skills/pnpm-project/templates/scripts/install-husky.mjs` → `<配置先>/scripts/install-husky.mjs`（置換不要。パスはすべて実行時に動的に求めているため、どのプロジェクト名・配置先でもそのまま使える）
   - `.claude/skills/pnpm-project/templates/.husky/pre-commit` → `<配置先>/.husky/pre-commit`（`__PROJECT_PATH__`を、リポジトリルートから見た配置先の相対パスに置換する。このリポジトリの通常の配置なら`projects/<project-name>`になる）
   - `.claude/skills/pnpm-project/templates/justfile` → `<配置先>/justfile`（置換不要）

4. **配置先がVS Codeプロジェクトの場合、TypeScript向けのVS Code設定を追加する**
   - 判定は`<配置先>/.vscode/`ディレクトリ（`settings.json`または`extensions.json`）の有無で行う。存在しなければVS Code向けの設定は持たないプロジェクトとみなし、この手順はスキップする（`.vscode/`を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、`.vscode/`を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json`を配置する**: `.claude/skills/pnpm-project/templates/vscode/settings.json`の内容を`<配置先>/.vscode/settings.json`にマージする。ファイルが既に存在する場合は、Edit系ツールで直接編集し、既存のキー（言語非依存の共通設定など）を残したまま`[typescript]`ブロックと`coverage-gutters.*`系のキーを追加する（同じキーが既にあれば上書きせず、内容を確認したうえでユーザーに判断を仰ぐ）。ファイルが無ければ新規作成する。
     - `coverage-gutters.*`の設定はCoverage Gutters拡張（後述）向けで、`just cover`（`pnpm run test:coverage`）を実行すると`@vitest/coverage-v8`のデフォルトレポータ（`clover`/`json`）が生成する`coverage/clover.xml`・`coverage/coverage-final.json`を読み込み、エディタの行番号横に被覆行（緑）・未被覆行（赤）を色付け表示する。この2ファイルはCoverage Gutters拡張がデフォルトで認識するファイル名なので、`vitest.config.ts`側でレポータを追加する必要はない。既存の`test:coverage`スクリプトが出すHTMLレポート（`coverage/index.html`）運用に加えて使う追加のレポート形式であり、どちらかを置き換えるものではない。`coverage/`はテスト実行のたびに再生成される成果物なのでコミット対象に含めない（テンプレートの`.gitignore`で除外済み）。
   - **拡張機能のおすすめ設定を配置する**: 配置先の判定はさらに`<配置先>/.devcontainer/devcontainer.json`の有無で分岐する（この判定も「devcontainer環境を構築するスキルが動いたかどうか」ではなく、あくまでファイルの有無で行う）。
     - `devcontainer.json`が存在する場合: `.vscode/extensions.json`は使わず、`.claude/skills/pnpm-project/templates/vscode/extensions.json`の`recommendations`配列の中身を`<配置先>/.devcontainer/devcontainer.json`の`customizations.vscode.extensions`配列にEdit系ツールで直接マージする（重複を除いて追記。既存の`customizations.vscode.settings`等は残す）。
     - `devcontainer.json`が存在しない場合: `.claude/skills/pnpm-project/templates/vscode/extensions.json`の内容を`<配置先>/.vscode/extensions.json`にマージする（既存の`recommendations`があれば重複を除いて追記し、既存のTypeScript以外の推奨拡張機能はそのまま残す）。
   - `settings.json`/`extensions.json`（および`devcontainer.json`）はJSONC（コメント付きJSON）として解釈されるため、標準の`jq`に通す前にコメント行を取り除くか、目視でカンマ・かっこの対応を確認する。

5. **依存関係を同期し、動作確認する**
   `<配置先>`に移動し、`.claude/skills/pnpm-project/references/verify.md`の手順に従って確認する。確認後、テストで作った一時的な依存追加や`pnpm-lock.yaml`/`node_modules`/`dist`/`coverage`/`docs`は元に戻す/削除すること。lint/JSDoc/カバレッジの実効性を反証で確かめる場合は`.claude/skills/pnpm-project/references/counter-tests.md`を参照する（設定を書いただけで実は無効、という状態を防ぐため。確認後は必ず元に戻すこと）。
   - （任意）bash補完の有効化手順は`.claude/skills/pnpm-project/references/install.md`を参照する。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- `.vscode/`ディレクトリが存在しない配置先に、VS Code向けの設定一式をゼロから新規作成することはこのスキルの対象外（このスキルが行うのはTypeScript固有の追加設定のみ）。ユーザーから明示的に「VS Code環境ごと作って」等の依頼があった場合のみ、`.vscode/`を新規作成したうえでTypeScript向け設定を配置してよい。
- npm/nvm/corepackを使わずpnpmスタンドアロン導入(Node.js管理含む)に一本化する方針、pnpmを12系に固定する方針、`pnpm-workspace.yaml`の2設定、TypeScript/ESLint/Prettier/Vitest+カバレッジ計測(`@vitest/coverage-v8`)+JSDoc必須化(`eslint-plugin-jsdoc`)/TypeDocによるAPIドキュメント生成+Git hooks(Husky/lint-staged)の開発環境一式、justによるタスクランナー（`package.json`の`scripts`を置き換えず薄いラッパーとして使う）はこのリポジトリで検証済みの固定条件として扱い、単なる「pnpm環境作って」的な依頼でも省略しない。
- ビルドバンドラ（Vite等）は含まない。`projects/gitlab-mcp-server/`はNode.js向けMCPサーバであり、ブラウザ向けバンドルを必要としないため`tsc`ビルドのみで完結している。ブラウザ向けアプリ等でバンドラが必要な場合は、テンプレートに`vite`等を追加導入すること。

## このスキルの `templates/` を編集したとき

`templates/` 配下を変更したら、コミット前に以下を実行し、既に配置済みのファイルへの反映漏れ（ドリフト）が無いか確認する。

```bash
python3 .claude/skills/template-drift-sync/scripts/check_drift.py --only-suspect --path-filter <変更したファイル名>
```

差分があれば `AGENTS.md`「スキルを作成・編集するとき」に従い、配置済みファイルへ反映するかどうかを判断し、その結果を必ず報告する（黙って伏せない）。このスクリプト（`template-drift-sync` スキル自体）が存在しない環境では、この手順は省略してよい。
