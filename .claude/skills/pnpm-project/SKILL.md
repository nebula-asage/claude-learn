---
name: pnpm-project
description: Node.js(TypeScript)の練習・開発プロジェクト一式（pnpmスタンドアロン導入前提+TypeScript/ESLint/Prettier/Vitest+JSDoc/TypeDocによるAPIドキュメント生成+Husky/lint-stagedのGit hooks+justによるタスクランナー）をホスト環境に直接構築するスキル。「pnpm/Node.jsの環境・プロジェクトを作って」「TypeScriptのlint/format/testを入れて」「JSDoc/TypeDocでAPIドキュメントを生成したい」「コミット時に自動でlint/formatかけたい」など、pnpmベースのNode.js/TypeScriptプロジェクトの新規作成や、既存プロジェクトへのlint/test/ドキュメンテーション/Git hooks追加を頼まれたら必ず使うこと。配置先が既にVS Code向けの`.vscode/`ディレクトリを持つ場合は、ESLint(flat config)/Prettier/Vitestに対応したTypeScript向けのsettings.json・拡張機能のおすすめ設定に加え、Coverage Gutters拡張によるカバレッジのエディタ上可視化（被覆/未被覆行のガター色付け）設定も追加する。Docker/devcontainerには依存せず、pnpm本体は公式スタンドアロンインストーラで導入し、Node.jsランタイム自体もpnpmの`runtime`機能で管理する（npm・nvm・corepackいずれにも依存しない）。サプライチェーン攻撃対策も組み込む。devcontainer自体の構築はこのスキルの対象外。
---

# pnpm-project

**pnpmスタンドアロン導入前提**のNode.js環境構築条件を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`.devcontainer/`（このリポジトリのdevcontainer環境）で一度構築・検証済みの条件（pnpmのバージョン固定・サプライチェーン攻撃対策）に加え、`projects/gitlab-mcp-server/`で実際に運用・検証済みのTypeScript開発環境（TypeScript + tscビルド、ESLint(flat config, typescript-eslint) + Prettier、Vitest、eslint-plugin-jsdoc + TypeDocによるJSDoc必須化とAPIドキュメント生成、Husky + lint-stagedによるpre-commit時の自動lint/format）を、コンテナに依存しない形でテンプレート化したもの。

**旧経緯**: かつては nvm で Node.js を導入し、pnpm 本体は `npm install -g pnpm` で導入する方式（スキル名は `pnpm-nvm-project`）だった。2026-09、pnpm公式のスタンドアロンインストーラ（https://pnpm.io/ja/installation#on-posix-systems）に一本化し、npm・nvmへの依存を廃止した。Node.jsランタイム自体もpnpmの`runtime`機能（`pnpm runtime set node`）で管理する方式に変更し、スキル名も`pnpm-project`に改名した。

このスキルはdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキルの対象であり、このスキルでは扱わない。

## このスキルが前提とする条件（変更しない）

- pnpm 本体は公式スタンドアロンインストーラで導入する（npm・nvm・corepack に依存しない）。12系を使う
- Node.js ランタイムも `pnpm runtime set node <version> -g` で pnpm に管理させる（システムの node・nvm に依存しない）
- パッケージマネージャは pnpm 一本（`npm install`・`yarn`・`package-lock.json` は使わない）。依存は `package.json` + `pnpm-lock.yaml`（コミット対象）で管理する
- サプライチェーン対策として、プロジェクト直下の `pnpm-workspace.yaml` に `ignoreScripts: true` と `minimumReleaseAge: 10080`（7日）を書く。`.npmrc` には書かない（pnpm 11以降は無視される。auth/registry 設定の置き場としてのみ残す）
- 言語は TypeScript 一本（`src/` の `.ts` を `tsc` で `dist/` にビルドする）
- ESLint（flat config、`recommendedTypeChecked`）・Prettier・Vitest・`@vitest/coverage-v8` を標準で組み込む
- exportしたシンボルの JSDoc を `eslint-plugin-jsdoc` で必須にし、TypeDoc で `docs/api` にAPIドキュメントを生成する（`@param`/`@returns` に型注記は書かない。ファイル先頭は `@packageDocumentation`）
- Git hooks は Husky + lint-staged。`scripts/install-husky.mjs` がリポジトリルートの `core.hooksPath` を設定する。`.husky/pre-commit` の2つのガード（無関係なコミットは素通し・依存未導入の作業ツリーでは警告してスキップ）は省略しない
- `ignoreScripts: true` のため `prepare` は自動実行されない。`pnpm install` 後に初回のみ `pnpm run prepare` を手動で実行する（README にも書く）
- タスクランナーは just で、`package.json` の `scripts` を呼ぶだけの薄いラッパーにする（`build`/`start`/`dev`/`typecheck`/`lint`/`lint-fix`/`fmt`/`fmt-check`/`test`/`test-watch`/`cover`/`doc`/`doc-check`/`prepare`/`clean`）

各条件の理由・却下した代替案・検証で見つかった落とし穴は `.claude/skills/pnpm-project/references/design-notes.md` にある。テンプレートを変更するときや、条件を見直すときに読む。

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
   `templates/` 配下は `vscode/` を除きそのまま `<配置先>` へ1階層でコピーできる構成になっているため、
   ファイルを1つずつ Read/Write するのではなく `cp -a` で一括コピーし、そのうえでプレースホルダを含む
   ファイルだけを Edit系ツールで置換する2段構成にする。

   ```bash
   mkdir -p "<配置先>"
   cp -a .claude/skills/pnpm-project/templates/. "<配置先>/"
   rm -rf "<配置先>/vscode"
   ```

   （`.claude/skills/pnpm-project/templates/vscode/` はここではコピーしない。VS Code設定の手順で扱う。）

   コピー後、`grep -rl "__PROJECT_NAME__\|__PROJECT_PATH__" "<配置先>"` でプレースホルダを含むファイルを洗い出し、その結果に対してだけ
   Edit系ツールで置換する。テンプレートが変わった場合は下の一覧ではなく grep の結果を優先すること。
   - `package.json`・`typedoc.json`・`README.md` の `__PROJECT_NAME__` を置換する
   - `.husky/pre-commit` の `__PROJECT_PATH__` を、リポジトリルートから見た配置先の相対パスに置換する（このリポジトリの通常の配置なら `projects/<project-name>`）
   - `.npmrc` は auth/registry 設定の置き場としてのみ残す。サプライチェーン攻撃対策の本体は `pnpm-workspace.yaml`。`scripts/install-husky.mjs` はパスを実行時に求めるため置換不要

4. **配置先がVS Codeプロジェクトの場合、TypeScript向けのVS Code設定を追加する**
   - 判定は`<配置先>/.vscode/`ディレクトリ（`settings.json`または`extensions.json`）の有無で行う。存在しなければVS Code向けの設定は持たないプロジェクトとみなし、この手順はスキップする（`.vscode/`を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、`.vscode/`を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json`を配置する**: `.claude/skills/pnpm-project/templates/vscode/settings.json`の内容を`<配置先>/.vscode/settings.json`にマージする。ファイルが既に存在する場合は、Edit系ツールで直接編集し、既存のキー（言語非依存の共通設定など）を残したまま`[typescript]`ブロックと`coverage-gutters.*`系のキーを追加する（同じキーが既にあれば上書きせず、内容を確認したうえでユーザーに判断を仰ぐ）。ファイルが無ければ新規作成する。
     - `coverage-gutters.*`の設定はCoverage Gutters拡張（後述）向けで、`just cover`（`pnpm run test:coverage`）を実行すると`@vitest/coverage-v8`のデフォルトレポータ（`clover`/`json`）が生成する`coverage/clover.xml`・`coverage/coverage-final.json`を読み込み、エディタの行番号横に被覆行（緑）・未被覆行（赤）を色付け表示する。この2ファイルはCoverage Gutters拡張がデフォルトで認識するファイル名なので、`vitest.config.ts`側でレポータを追加する必要はない。既存の`test:coverage`スクリプトが出すHTMLレポート（`coverage/index.html`）運用に加えて使う追加のレポート形式であり、どちらかを置き換えるものではない。`coverage/`はテスト実行のたびに再生成される成果物なのでコミット対象に含めない（テンプレートの`.gitignore`で除外済み）。
   - **拡張機能のおすすめ設定を配置する**: 配置先の判定はさらに`<配置先>/.devcontainer/devcontainer.json`の有無で分岐する（この判定も「devcontainer環境を構築するスキルが動いたかどうか」ではなく、あくまでファイルの有無で行う）。
     - `devcontainer.json`が存在する場合: `.vscode/extensions.json`は使わず、`.claude/skills/pnpm-project/templates/vscode/extensions.json`の`recommendations`配列の中身を`<配置先>/.devcontainer/devcontainer.json`の`customizations.vscode.extensions`配列にEdit系ツールで直接マージする（重複を除いて追記。既存の`customizations.vscode.settings`等は残す）。
     - `devcontainer.json`が存在しない場合: `.claude/skills/pnpm-project/templates/vscode/extensions.json`の内容を`<配置先>/.vscode/extensions.json`にマージする（既存の`recommendations`があれば重複を除いて追記し、既存のTypeScript以外の推奨拡張機能はそのまま残す）。
   - `settings.json`/`extensions.json`（および`devcontainer.json`）はJSONC（コメント付きJSON）として解釈されるため、標準の`jq`に通す前にコメント行を取り除くか、目視でカンマ・かっこの対応を確認する。

5. **依存関係を同期し、動作確認する**
   `<配置先>`に移動し、`.claude/skills/pnpm-project/references/verify.md`の手順に従って確認する。確認後、テストで作った一時的な依存追加や`pnpm-lock.yaml`/`node_modules`/`dist`/`coverage`/`docs`は元に戻す/削除すること。lint/JSDoc/カバレッジの実効性の反証（`.claude/skills/pnpm-project/references/counter-tests.md`）は、このスキルの`templates/`を変更したときに`template-verifier`が確認する検証項目であり、プロジェクト新規作成のたびに実行する手順ではない。
   - （任意）bash補完の有効化手順は`.claude/skills/pnpm-project/references/install.md`を参照する。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- `.vscode/`ディレクトリが存在しない配置先に、VS Code向けの設定一式をゼロから新規作成することはこのスキルの対象外（このスキルが行うのはTypeScript固有の追加設定のみ）。ユーザーから明示的に「VS Code環境ごと作って」等の依頼があった場合のみ、`.vscode/`を新規作成したうえでTypeScript向け設定を配置してよい。
- 「前提とする条件」に並べた項目は、単なる「pnpm環境作って」的な依頼でも省略しない。
- ビルドバンドラ（Vite等）は含まない。`projects/gitlab-mcp-server/`はNode.js向けMCPサーバであり、ブラウザ向けバンドルを必要としないため`tsc`ビルドのみで完結している。ブラウザ向けアプリ等でバンドラが必要な場合は、テンプレートに`vite`等を追加導入すること。
