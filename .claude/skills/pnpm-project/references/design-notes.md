# pnpm-project: 固定条件の理由と検証記録

`SKILL.md` の「このスキルが前提とする条件」に並べた各条件の、採用理由・却下した代替案・検証で見つかった落とし穴。プロジェクトを配置するだけなら読まなくてよい。テンプレートを変更するとき、生成されたプロジェクトを改造するとき、条件を見直すときに参照する。

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
- **タスクランナーはjust（`github.com/casey/just`）**。`package.json`の`scripts`は残したまま、`justfile`はその薄いラッパーとして`build`/`start`/`dev`/`typecheck`/`lint`/`lint-fix`/`fmt`/`fmt-check`/`test`/`test-watch`/`cover`/`doc`/`doc-check`/`prepare`/`clean`の各レシピを用意する（中身は対応する`pnpm run <script>`を呼ぶだけで、ロジックの二重管理はしない）。狙いは他の言語のプロジェクトと`just test`/`just lint`のような呼び方を揃えること
