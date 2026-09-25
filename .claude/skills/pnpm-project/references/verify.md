# 依存関係を同期し、動作確認する

`<配置先>`に移動し、以下を確認する。確認後、テストで作った一時的な依存追加や`pnpm-lock.yaml`/`node_modules`/`dist`/`coverage`/`docs`は元に戻す/削除すること。

- `just install`（`pnpm install`）を実行し、`pnpm-lock.yaml`が生成されることを確認する（これはコミット対象）。
- 引数なしで `just` を実行し、レシピ一覧（`just --list`相当）が表示されることを確認する。
- `just build`（`tsc`ビルド）と`just start`（`dist/index.js`を実行）が動くことを確認する。
- `just typecheck`・`just lint`・`just fmt-check`・`just test`（テンプレート同梱のサンプルテストが通る）がいずれもエラーなく完了することを確認する。
- `just cover`を実行し、`coverage/`配下にHTMLレポート（`coverage/index.html`）が生成されることを確認する。手順4でVS Code向け設定を配置した場合は、同時に`coverage/clover.xml`・`coverage/coverage-final.json`も生成されていることを確認する（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、テストから呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）。
- `just doc`を実行し、`docs/api/`配下にHTMLのAPIリファレンス（`docs/api/index.html`）が生成されることを確認する。`just doc-check`もエラーなく完了することを確認する（テンプレートの`src/index.ts`にはJSDoc必須ルールに準拠したexport例`greet`を同梱しており、これが記述漏れ検出の動作確認を兼ねる）。
- `pnpm config get minimumReleaseAge`が`10080`を返すことを確認する。
- `ignoreScripts`が効いているかは、postinstallスクリプトを持つ適当なパッケージを試験的に追加し、そのスクリプトのログが出力されないことを確認する。確認後はそのパッケージを取り除く。
- `just prepare`（`pnpm run prepare`）を実行し、`git config core.hooksPath`が`<配置先>/.husky`（リポジトリルートからの相対パス）を指していることを確認する。
- フックの動作確認として、`src/`配下にわざとフォーマット崩れの`.ts`ファイルを追加して`git add`し、`git commit`（コミット自体は成立させず、テスト用に作ったファイルなので確認後は`git reset`でステージを戻す）を試みて、`pnpm exec lint-staged`（または`git commit`のフック経由）が`eslint --fix`/`prettier --write`でファイルを自動整形することを確認する。確認用に追加したファイルは元に戻す/削除する。
- `just clean`を実行し、`dist`/`coverage`/`docs`が削除されることを確認する。
- 確認が終わったら、`git config --unset core.hooksPath`でこの動作確認中に設定されたローカル設定を元に戻す（そのプロジェクトを今後も使い続ける前提であれば、`pnpm run prepare`済みのまま残してよいかユーザーに確認してから判断する）。

lint/JSDoc/カバレッジの実効性を反証で確かめる場合は `references/counter-tests.md` を参照する。
