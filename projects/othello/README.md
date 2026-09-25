# othello

React(UI) + Tauri(デスクトップアプリ化)で作ったオセロ(リバーシ)。

- ゲームロジックは `src/othello.ts` に純粋関数として実装(盤面・合法手判定・着手・パス・終了判定)
- UIは `src/App.tsx`。盤面クリックで着手、合法手をハイライト表示、スコア/手番/パス/勝敗を表示
- `src-tauri/` はTauri(Rust)側。ネイティブウィンドウとしてアプリを起動する

## 前提環境

- Node.js: nvmで導入(`nvm install --lts`)
- パッケージマネージャ: pnpm(`npm install -g pnpm@^10`。corepackは使わない)
- Rust: [rustup](https://rustup.rs/)で導入
- Tauriのシステム依存(Linux/Ubuntu):

  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

`.npmrc` にサプライチェーン攻撃対策として `ignore-scripts=true` と `min-release-age`/`minimum-release-age`(7日)を設定済み。

## 実行方法

```bash
pnpm install

# 初回のみ: コミット時のlint/format自動適用(Husky)を有効化
pnpm run prepare

# ブラウザで動かす(Viteの開発サーバーのみ)
pnpm dev

# デスクトップアプリとして起動する(Tauri)
pnpm exec tauri dev

# デスクトップアプリをビルドする(実行ファイル/インストーラーを生成)
pnpm exec tauri build
```

## 開発用コマンド

| コマンド                           | 内容                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm run typecheck`               | TypeScriptの型チェック                                                          |
| `pnpm run lint` / `lint:fix`       | ESLint(typescript-eslint + jsdoc + React Hooks)                                 |
| `pnpm run format` / `format:check` | Prettier                                                                        |
| `pnpm test` / `test:watch`         | Vitestによる単体テスト(`src/othello.ts`が対象)                                  |
| `pnpm run test:coverage`           | カバレッジ計測(`coverage/index.html`)                                           |
| `pnpm run docs` / `docs:check`     | TypeDocによるAPIリファレンス生成(`docs/api/index.html`)。対象は`src/othello.ts` |
| `pnpm run build`                   | Viteでフロントエンドをビルド(`dist/`)                                           |

`src/othello.ts` の全exportシンボルにはJSDocが必須(ESLintの`jsdoc/require-jsdoc`で強制)。UI側(`App.tsx`/`main.tsx`)は対象外。

## ディレクトリ構成

```text
src/
  othello.ts   # ゲームロジック(純粋関数、JSDoc必須、テスト対象)
  App.tsx      # 盤面UI
  main.tsx     # エントリポイント
test/
  othello.test.ts
src-tauri/     # Tauri(Rust)側。ネイティブウィンドウ・ビルド設定
```
