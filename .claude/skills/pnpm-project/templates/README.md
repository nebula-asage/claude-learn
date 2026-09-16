# __PROJECT_NAME__

Node.jsの練習用プロジェクト。パッケージ管理は [pnpm](https://pnpm.io/) を前提とし、pnpm本体もNode.jsランタイムもnpm/nvm/corepackを使わずpnpm公式スタンドアロン導入に一本化する。言語はTypeScriptで、ESLint（flat config, typescript-eslint）・Prettier・Vitestを組み込み済み。

## セットアップ

pnpmが未導入（またはnpm経由の旧導入）の場合は、公式スタンドアロンインストーラで12系に固定して導入する（理由は `.claude/skills/pnpm-project/SKILL.md` を参照）。

```bash
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=12 sh -
```

インストール後、新しいシェルを開くかプロファイルを再読込む（`source ~/.bashrc` 等）。

Node.jsランタイムはdistroのパッケージやnvmではなく、pnpm自身の`runtime`機能に導入・管理させる。

```bash
pnpm runtime set node lts -g
```

## 実行方法

```bash
pnpm install
pnpm run build   # tsc でビルド（dist へ出力）
pnpm start        # dist/index.js を実行
```

開発中は `pnpm run dev`（`tsc --watch`）でビルドを追従させる。

## Lint / Format / Test

```bash
pnpm run typecheck    # 型チェックのみ（--noEmit）。src と test の両方が対象
pnpm run lint          # eslint .（型情報を使った検査を含む）
pnpm run lint:fix      # eslint . --fix
pnpm run format        # prettier --write .
pnpm run format:check  # prettier --check .
pnpm test              # vitest run
pnpm run test:watch    # vitest（watchモード）
pnpm run test:coverage # vitest run --coverage（カバレッジ計測。coverage/ 配下にHTML/JSON/Cloverレポートを生成）
```

ESLint（`eslint.config.js`）は `typescript-eslint` の `recommendedTypeChecked` をベースに、`tsconfig.json` と `tsconfig.test.json` の両方を型情報のソースとして使う。フォーマットはPrettier（`.prettierrc.json`）。新規コードを追加したら `pnpm run lint` と `pnpm run format:check` を通すこと。

`pnpm run test:coverage` はvitestの既定カバレッジプロバイダ（`@vitest/coverage-v8`、内部でistanbul形式に変換してレポートする）を使う。`coverage/index.html` をブラウザで開くとファイル別・行/分岐単位の詳細を確認できる。`coverage/` は `.gitignore` 済みでコミット対象外。

`src/**/*.ts` には `eslint-plugin-jsdoc`（`flat/recommended-typescript-error`）も適用しており、exportしたシンボル（クラス・関数・interface・型エイリアス・定数、および interface の各フィールド）にはJSDocが必須。TypeScriptが型情報を持つため `@param`/`@returns` に型注記は書かない。ファイル先頭のモジュールコメントは `@module` ではなく `@packageDocumentation` を使う。

## Git hooks（Husky + lint-staged）

`pnpm-workspace.yaml` で `ignoreScripts: true`（サプライチェーン攻撃対策）にしているため、`pnpm install` 時に `prepare` スクリプトは自動実行されない。`pnpm install` の後、**初回のみ手動で以下を実行**してGitのpre-commitフックを有効化すること。

```bash
pnpm run prepare
```

これにより、コミット時にステージされた `.ts` ファイルへ `eslint --fix` と `prettier --write` が自動適用される（設定は `package.json` の `lint-staged` フィールド、フック本体は `.husky/pre-commit`）。このプロジェクトがmonorepoのサブディレクトリにあり `.git` はリポジトリルート直下にしか無い場合、`scripts/install-husky.mjs` がリポジトリルートを検出したうえで `git config core.hooksPath` をこのプロジェクト配下の `.husky/` に向ける。`core.hooksPath` はGitのローカル設定でありコミット対象外のため、リポジトリを新しく clone した環境では毎回 `pnpm run prepare` の実行が必要。

`core.hooksPath` はリポジトリ全体で1つしか持てず、このフックはリポジトリ内のどのコミットでも発火する。そのため `.husky/pre-commit` は、ステージされたファイルにこのプロジェクト配下が含まれない場合は何もせずに通し、`node_modules` が未導入の作業ツリー（clone直後や `pnpm install` 前の git worktree）では警告を出してスキップする。これにより、このプロジェクトと無関係な変更や別worktreeからのコミットが巻き添えで失敗することはない。

## APIドキュメント生成

```bash
pnpm run docs        # TypeDocでソースコードのJSDocコメントからAPIリファレンス(HTML)を docs/api に生成
pnpm run docs:check   # HTMLを出さずにドキュメント記述漏れだけ検証する
```

`docs/api/` はコミットせず、必要なときに手元で都度生成する運用にする（`.gitignore` 済み）。

## 依存パッケージの追加

```bash
pnpm add <パッケージ名>
```

`pnpm install` / `pnpm add` を実行すると `pnpm-lock.yaml` が生成・更新される。このファイルはコミットしてバージョンを固定する。

## サプライチェーン攻撃対策

`pnpm-workspace.yaml` に以下を設定している（pnpm 11以降、`.npmrc` はauth/registry設定専用でこれらの設定は読まれない）。

- `ignoreScripts: true`: postinstallなどのライフサイクルスクリプトを実行しない
- `minimumReleaseAge: 10080`: 公開から7日間（10080分）は新しいバージョンのインストールをスキップする
