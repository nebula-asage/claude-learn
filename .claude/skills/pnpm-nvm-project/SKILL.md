---
name: pnpm-nvm-project
description: Node.js(TypeScript)の練習・開発プロジェクト一式（nvm+pnpm前提+TypeScript/ESLint/Prettier/Vitest+JSDoc/TypeDocによるAPIドキュメント生成+Husky/lint-stagedのGit hooks）をホスト環境に直接構築するスキル。「pnpm/Node.jsの環境・プロジェクトを作って」「TypeScriptのlint/format/testを入れて」「JSDoc/TypeDocでAPIドキュメントを生成したい」「コミット時に自動でlint/formatかけたい」など、pnpmベースのNode.js/TypeScriptプロジェクトの新規作成や、既存プロジェクトへのlint/test/ドキュメンテーション/Git hooks追加を頼まれたら必ず使うこと。配置先が既にVS Code向けの`.vscode/`ディレクトリを持つ場合は、ESLint(flat config)/Prettier/Vitestに対応したTypeScript向けのsettings.json・拡張機能のおすすめ設定に加え、Coverage Gutters拡張によるカバレッジのエディタ上可視化（被覆/未被覆行のガター色付け）設定も追加する。Docker/devcontainerには依存せず、pnpm本体はcorepackではなくnpm経由で導入しサプライチェーン攻撃対策も組み込む。devcontainer自体の構築はdevcontainer-ubuntu-jaスキルを使う。
---

# pnpm-nvm-project

**nvm + pnpm前提**のNode.js環境構築条件を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`.devcontainer/`（このリポジトリのdevcontainer環境）で一度構築・検証済みの条件（nvmでのNode.js導入・pnpmのバージョン固定・サプライチェーン攻撃対策）に加え、`projects/gitlab-mcp-server/`で実際に運用・検証済みのTypeScript開発環境（TypeScript + tscビルド、ESLint(flat config, typescript-eslint) + Prettier、Vitest、eslint-plugin-jsdoc + TypeDocによるJSDoc必須化とAPIドキュメント生成、Husky + lint-stagedによるpre-commit時の自動lint/format）を、コンテナに依存しない形でテンプレート化したもの。

このスキルはdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキル（例: devcontainer-ubuntu-ja）を使うこと。

## このスキルが前提とする条件（変更しない）

- **Node.jsランタイムはnvm(Node Version Manager)で導入・管理する**。distro/システムに入っているnodeパッケージや、apt経由のNodeSourceリポジトリには依存しない
- **パッケージマネージャはpnpm一本**。`npm install`（依存追加）や`yarn`は使わない（pnpm自体の導入にnpmコマンドを使うのは例外）
- **pnpm本体の導入はcorepackを使わず、`npm install -g pnpm@^10`で導入する**。理由は2つ:
  1. corepackはNode.js本体から将来的に切り離される方針であり、長期的な前提にしにくい
  2. pnpm 11系はユーザー単位のグローバル設定ファイル(`config.yaml`)の一部設定が未文書化の破壊的変更で効かなくなっており、後述の`.npmrc`ベースの設定が確実に効く10系に固定する必要がある
  
  この2点の事情（特に2）が解消されたら、`pnpm@^10`固定は見直してよい。
- **サプライチェーン攻撃対策として、プロジェクト直下の`.npmrc`に次を設定する（固定条件）**:
  - `ignore-scripts=true` — postinstallなどのライフサイクルスクリプトを実行しない
  - `min-release-age=7`（npm向け、日単位） / `minimum-release-age=10080`（pnpm向け、分単位で7日分） — 公開から7日間は新しいバージョンのインストールをスキップし、悪意あるバージョンが検知・撤回される猶予を確保する
  - 2つの設定キーが必要なのは、npmとpnpmでキー名・単位が異なるため（`min-release-age`は日、`minimum-release-age`は分）。両方書いても片方のツールにとって未知のキーになるが、動作上問題はない（検証済み）
- `package-lock.json`は作らない。依存関係は`package.json` + `pnpm-lock.yaml`（`pnpm install`で生成、コミット対象）で管理する
- **言語はTypeScript一本**。プレーンなJavaScriptのテンプレートは提供しない（`src/`配下に`.ts`を置き、`tsc`で`dist/`にビルドする）
- **Lint/Format/Test/カバレッジ計測は標準で組み込む**。ESLint(flat config, `typescript-eslint`の`recommendedTypeChecked`)・Prettier・Vitest・`@vitest/coverage-v8`（`pnpm run test:coverage`でカバレッジHTMLレポートを生成）は`projects/gitlab-mcp-server/`で検証済みの構成をそのままテンプレート化したものであり、単なる「pnpm環境作って」的な依頼でも省略しない
- **JSDoc必須化とAPIドキュメント生成も標準で組み込む**。`src/**/*.ts`に`eslint-plugin-jsdoc`（`flat/recommended-typescript-error`）を適用し、exportした全シンボル（クラス・関数・interface・型エイリアス・定数、およびinterfaceの各フィールド）にJSDocを必須にする（非exportの内部ヘルパーは対象外）。TypeScriptが型情報を持つため`@param`/`@returns`に型注記は書かない。ファイル先頭のモジュールコメントは`@module`ではなく`@packageDocumentation`を使う（TS環境では`@module`が冗長タグとしてESLintに拒否される）。TypeDoc（`typedoc.json`）で`pnpm run docs`によりHTMLのAPIリファレンスを`docs/api`に生成でき、`pnpm run docs:check`はHTMLを出さずに記述漏れだけを検証する。これも`projects/gitlab-mcp-server/`で検証済みの構成であり、省略しない
- **Git hooks（Husky + lint-staged）も標準で組み込む**。コミット時にステージされた`*.ts`へ`eslint --fix`→`prettier --write`を、それ以外の対象拡張子（`js`/`mjs`/`cjs`/`json`/`md`/`yml`/`yaml`）へ`prettier --write`のみを自動適用する（`package.json`の`lint-staged`フィールド）。フック本体は`.husky/pre-commit`から`pnpm exec lint-staged`を呼ぶ。このリポジトリはmonorepoでプロジェクトが`projects/<name>/`配下のサブディレクトリにあり`.git`はリポジトリルート直下にしか無いため、Husky標準の`npx husky init`（cwd直下の`.git`しか認識しない）はそのままでは使えない。`scripts/install-husky.mjs`が`git rev-parse --show-toplevel`でリポジトリルートを求めてそこへ`chdir`し、プロジェクト配下の`.husky`を対象に`core.hooksPath`を設定する（`package.json`の`prepare`スクリプトがこれを指す）。`.npmrc`の`ignore-scripts=true`により`pnpm install`では`prepare`が自動実行されないため、`pnpm install`後は**初回のみ`pnpm run prepare`を手動実行**してフックを有効化する必要がある（`core.hooksPath`はGitのローカル設定でコミット対象外なので、clone後の環境では毎回必要）。なお`core.hooksPath`はリポジトリ全体で1つしか持てず、設定したフックはリポジトリ内のどのコミットでも発火するため、`.husky/pre-commit`の先頭に2つのガードを入れてある。(1)ステージされたファイルにこのプロジェクト配下が含まれなければ何もせず通す、(2)`node_modules/.bin/lint-staged`が無い作業ツリー（clone直後や`pnpm install`前のgit worktree）では警告を出してスキップする。どちらもコミットを失敗させない。このガードが無いと、無関係なプロジェクトの変更や別worktreeからのコミットが巻き添えで全て止まる。これも`projects/gitlab-mcp-server/`で検証済みの構成であり、省略しない

## 手順

1. **nvmがホストに導入済みか確認する**
   - `[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm --version` で確認する。
   - 導入済みならそのバージョンで進めてよい。
   - 未導入の場合は、[nvm公式](https://github.com/nvm-sh/nvm)の最新リリースを使ってインストールする。
     ```bash
     NVM_LATEST=$(curl -fsSL https://api.github.com/repos/nvm-sh/nvm/releases/latest \
       | grep -m1 '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
     curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_LATEST}/install.sh" | bash
     ```
   - **これはホスト環境に実際にソフトウェアを導入する操作であり、シェルの設定ファイル（`~/.bashrc`等）へのnvm読み込み・bash補完の追記も伴う（インストーラーが自動で行う）。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「nvmが入っていないので公式インストーラーで導入してよいか」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
   - インストール後は新しいシェルを開くかプロファイルを再読込しないと`nvm`コマンドが見つからないことがある点に注意する（`source ~/.bashrc`等）。

2. **Node.jsランタイムを導入する**
   ```bash
   . "$HOME/.nvm/nvm.sh"
   nvm install --lts
   nvm alias default 'lts/*'
   ```
   - これでdistro提供のnodeに頼らず、常に最新のLTSがデフォルトになる。

3. **pnpmを導入する**
   ```bash
   npm install -g pnpm@^10
   ```
   - `pnpm@latest`にはしない（前提条件を参照）。`^10`により10系の最新パッチ・マイナーには自動追従する。

4. **配置先とプロジェクト名を確認する**
   - このリポジトリの`projects/README.md`のルールにより、基本は`projects/<project-name>/`配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

5. **テンプレートをコピーし、プレースホルダを置換する**
   - `.claude/skills/pnpm-nvm-project/templates/package.json` → `<配置先>/package.json`（`__PROJECT_NAME__`を置換）
   - `.claude/skills/pnpm-nvm-project/templates/.npmrc` → `<配置先>/.npmrc`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/.gitignore` → `<配置先>/.gitignore`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/tsconfig.json` → `<配置先>/tsconfig.json`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/tsconfig.test.json` → `<配置先>/tsconfig.test.json`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/eslint.config.js` → `<配置先>/eslint.config.js`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/.prettierrc.json` → `<配置先>/.prettierrc.json`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/.prettierignore` → `<配置先>/.prettierignore`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/vitest.config.ts` → `<配置先>/vitest.config.ts`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/typedoc.json` → `<配置先>/typedoc.json`（`__PROJECT_NAME__`を置換）
   - `.claude/skills/pnpm-nvm-project/templates/src/index.ts` → `<配置先>/src/index.ts`
   - `.claude/skills/pnpm-nvm-project/templates/test/index.test.ts` → `<配置先>/test/index.test.ts`
   - `.claude/skills/pnpm-nvm-project/templates/README.md` → `<配置先>/README.md`（`__PROJECT_NAME__`を置換）
   - `.claude/skills/pnpm-nvm-project/templates/scripts/install-husky.mjs` → `<配置先>/scripts/install-husky.mjs`（置換不要。パスはすべて実行時に動的に求めているため、どのプロジェクト名・配置先でもそのまま使える）
   - `.claude/skills/pnpm-nvm-project/templates/.husky/pre-commit` → `<配置先>/.husky/pre-commit`（`__PROJECT_PATH__`を、リポジトリルートから見た配置先の相対パスに置換する。このリポジトリの通常の配置なら`projects/<project-name>`になる）

6. **配置先がVS Codeプロジェクトの場合、TypeScript向けのVS Code設定を追加する**
   - 判定は`<配置先>/.vscode/`ディレクトリ（`settings.json`または`extensions.json`）の有無で行う。存在しなければVS Code向けの設定は持たないプロジェクトとみなし、この手順はスキップする（`.vscode/`を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、`.vscode/`を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json`を配置する**: `.claude/skills/pnpm-nvm-project/templates/vscode/settings.json`の内容を`<配置先>/.vscode/settings.json`にマージする。ファイルが既に存在する場合は、Edit系ツールで直接編集し、既存のキー（言語非依存の共通設定など）を残したまま`[typescript]`ブロックと`coverage-gutters.*`系のキーを追加する（同じキーが既にあれば上書きせず、内容を確認したうえでユーザーに判断を仰ぐ）。ファイルが無ければ新規作成する。
     - `coverage-gutters.*`の設定はCoverage Gutters拡張（後述）向けで、`pnpm run test:coverage`を実行すると`@vitest/coverage-v8`のデフォルトレポータ（`clover`/`json`）が生成する`coverage/clover.xml`・`coverage/coverage-final.json`を読み込み、エディタの行番号横に被覆行（緑）・未被覆行（赤）を色付け表示する。この2ファイルはCoverage Gutters拡張がデフォルトで認識するファイル名なので、`vitest.config.ts`側でレポータを追加する必要はない。既存の`test:coverage`スクリプトが出すHTMLレポート（`coverage/index.html`）運用に加えて使う追加のレポート形式であり、どちらかを置き換えるものではない。`coverage/`はテスト実行のたびに再生成される成果物なのでコミット対象に含めない（テンプレートの`.gitignore`で除外済み）。
   - **拡張機能のおすすめ設定を配置する**: 配置先の判定はさらに`<配置先>/.devcontainer/devcontainer.json`の有無で分岐する（この判定も「devcontainer環境を構築するスキルが動いたかどうか」ではなく、あくまでファイルの有無で行う）。
     - `devcontainer.json`が存在する場合: `.vscode/extensions.json`は使わず、`.claude/skills/pnpm-nvm-project/templates/vscode/extensions.json`の`recommendations`配列の中身（拡張機能IDのみ。コメントは転記しなくてよい）を`<配置先>/.devcontainer/devcontainer.json`の`customizations.vscode.extensions`配列にEdit系ツールで直接マージする（重複を除いて追記。既存の`customizations.vscode.settings`等は残す）。
     - `devcontainer.json`が存在しない場合: `.claude/skills/pnpm-nvm-project/templates/vscode/extensions.json`の内容を`<配置先>/.vscode/extensions.json`にマージする（既存の`recommendations`があれば重複を除いて追記し、既存のTypeScript以外の推奨拡張機能はそのまま残す）。
   - `settings.json`/`extensions.json`（および`devcontainer.json`）はJSONC（コメント付きJSON）として解釈されるため、標準の`jq`に通す前にコメント行を取り除くか、目視でカンマ・かっこの対応を確認する。

7. **依存関係を同期し、動作確認する**
   `<配置先>`に移動し、以下を確認する。確認後、テストで作った一時的な依存追加や`pnpm-lock.yaml`/`node_modules`/`dist`/`coverage`/`docs`は元に戻す/削除すること。
   - `pnpm install`を実行し、`pnpm-lock.yaml`が生成されることを確認する（これはコミット対象）。
   - `pnpm run build`（`tsc`ビルド）と`pnpm start`（`dist/index.js`を実行）が動くことを確認する。
   - `pnpm run typecheck`・`pnpm run lint`・`pnpm run format:check`・`pnpm test`（テンプレート同梱のサンプルテストが通る）がいずれもエラーなく完了することを確認する。
   - `pnpm run test:coverage`を実行し、`coverage/`配下にHTMLレポート（`coverage/index.html`）が生成されることを確認する。手順6でVS Code向け設定を配置した場合は、同時に`coverage/clover.xml`・`coverage/coverage-final.json`も生成されていることを確認する（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、テストから呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）。
   - `pnpm run docs`を実行し、`docs/api/`配下にHTMLのAPIリファレンス（`docs/api/index.html`）が生成されることを確認する。`pnpm run docs:check`もエラーなく完了することを確認する（テンプレートの`src/index.ts`にはJSDoc必須ルールに準拠したexport例`greet`を同梱しており、これが記述漏れ検出の動作確認を兼ねる）。
   - `pnpm config get minimum-release-age`が`10080`、`npm config get min-release-age`が`7`を返すことを確認する。
   - `ignore-scripts`が効いているかは、postinstallスクリプトを持つ適当なパッケージを試験的に追加し、そのスクリプトのログが出力されないことを確認する。確認後はそのパッケージを取り除く。
   - `pnpm run prepare`を実行し、`git config core.hooksPath`が`<配置先>/.husky`（リポジトリルートからの相対パス）を指していることを確認する。
   - フックの動作確認として、`src/`配下にわざとフォーマット崩れの`.ts`ファイルを追加して`git add`し、`git commit`（コミット自体は成立させず、テスト用に作ったファイルなので確認後は`git reset`でステージを戻す）を試みて、`pnpm exec lint-staged`（または`git commit`のフック経由）が`eslint --fix`/`prettier --write`でファイルを自動整形することを確認する。確認用に追加したファイルは元に戻す/削除する。
   - 確認が終わったら、`git config --unset core.hooksPath`でこの動作確認中に設定されたローカル設定を元に戻す（そのプロジェクトを今後も使い続ける前提であれば、`pnpm run prepare`済みのまま残してよいかユーザーに確認してから判断する）。

8. **（任意）bash補完を有効化する**
   - nvmの補完は公式インストーラーが`~/.bashrc`に自動追記済みのため、追加作業は不要。
   - pnpmの補完はroot権限なしで使えるユーザー単位のディレクトリに配置する:
     ```bash
     mkdir -p ~/.local/share/bash-completion/completions
     pnpm completion bash > ~/.local/share/bash-completion/completions/pnpm
     ```
   - これもユーザーのホーム配下にファイルを追加する操作なので、実施してよいか確認してから行う。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外。コンテナ環境が欲しいと言われたら別スキル（例: devcontainer-ubuntu-ja）を使う（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- `.vscode/`ディレクトリが存在しない配置先に、VS Code向けの設定一式をゼロから新規作成することはこのスキルの対象外（このスキルが行うのはTypeScript固有の追加設定のみ）。ユーザーから明示的に「VS Code環境ごと作って」等の依頼があった場合のみ、`.vscode/`を新規作成したうえでTypeScript向け設定を配置してよい。
- corepackを使わない方針、pnpmを10系に固定する方針、`.npmrc`の3設定、TypeScript/ESLint/Prettier/Vitest+カバレッジ計測(`@vitest/coverage-v8`)+JSDoc必須化(`eslint-plugin-jsdoc`)/TypeDocによるAPIドキュメント生成+Git hooks(Husky/lint-staged)の開発環境一式はこのリポジトリで検証済みの固定条件として扱い、単なる「pnpm環境作って」的な依頼でも省略しない。
- ビルドバンドラ（Vite等）は含まない。`projects/gitlab-mcp-server/`はNode.js向けMCPサーバであり、ブラウザ向けバンドルを必要としないため`tsc`ビルドのみで完結している。ブラウザ向けアプリ等でバンドラが必要な場合は、テンプレートに`vite`等を追加導入すること。
