# __PROJECT_NAME__

Node.jsの練習用プロジェクト。ランタイムは [nvm](https://github.com/nvm-sh/nvm)、パッケージ管理は [pnpm](https://pnpm.io/) を前提とする。言語はTypeScriptで、ESLint（flat config, typescript-eslint）・Prettier・Vitestを組み込み済み。

## セットアップ

`nvm` が未導入の場合は公式インストーラーで導入する。

```bash
NVM_LATEST=$(curl -fsSL https://api.github.com/repos/nvm-sh/nvm/releases/latest \
  | grep -m1 '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_LATEST}/install.sh" | bash
```

Node.jsランタイムはdistroのパッケージではなく `nvm` に導入・管理させる。

```bash
nvm install --lts
nvm alias default 'lts/*'
```

pnpmはcorepackを使わず、npm経由で10系に固定して導入する（理由は `.claude/skills/pnpm-nvm-project/SKILL.md` を参照）。

```bash
npm install -g pnpm@^10
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

`.npmrc` で `ignore-scripts=true`（サプライチェーン攻撃対策）にしているため、`pnpm install` 時に `prepare` スクリプトは自動実行されない。`pnpm install` の後、**初回のみ手動で以下を実行**してGitのpre-commitフックを有効化すること。

```bash
pnpm run prepare
```

これにより、コミット時にステージされた `.ts` ファイルへ `eslint --fix` と `prettier --write` が自動適用される（設定は `package.json` の `lint-staged` フィールド、フック本体は `.husky/pre-commit`）。このプロジェクトがmonorepoのサブディレクトリにあり `.git` はリポジトリルート直下にしか無い場合、`scripts/install-husky.mjs` がリポジトリルートを検出したうえで `git config core.hooksPath` をこのプロジェクト配下の `.husky/` に向ける。`core.hooksPath` はGitのローカル設定でありコミット対象外のため、リポジトリを新しく clone した環境では毎回 `pnpm run prepare` の実行が必要。

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

`.npmrc` に以下を設定している。

- `ignore-scripts=true`: postinstallなどのライフサイクルスクリプトを実行しない
- `min-release-age=7` / `minimum-release-age=10080`: 公開から7日間は新しいバージョンのインストールをスキップする（npmとpnpmでキー名・単位が異なるため両方指定している）
