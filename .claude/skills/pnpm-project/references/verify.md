# 依存関係を同期し、動作確認する

`<配置先>`に移動し、以下の1本のコマンドにまとめて動作確認する（成功を前提に連結し、落ちたコマンドだけ個別に切り分ける）。`pnpm-lock.yaml`はコミット対象なので残す。

```bash
set -e
echo "=== install ==="; just install
echo "=== just (list) ==="; just
echo "=== build ==="; just build
echo "=== start ==="; just start
echo "=== typecheck ==="; just typecheck
echo "=== lint ==="; just lint
echo "=== fmt-check ==="; just fmt-check
echo "=== test ==="; just test
echo "=== cover ==="; just cover
echo "=== doc ==="; just doc
echo "=== doc-check ==="; just doc-check
echo "=== minimumReleaseAge ==="; pnpm config get minimumReleaseAge
echo "=== prepare ==="; just prepare
echo "=== hooksPath ==="; git config core.hooksPath
echo "=== clean ==="; just clean
```

出力から以下を確認する:

- `install`（`pnpm install`）: `pnpm-lock.yaml`が生成される（これはコミット対象）
- `just`: レシピ一覧（`just --list`相当）が表示される
- `build`/`start`: `tsc`ビルドと`dist/index.js`の実行がどちらも動く
- `typecheck`・`lint`・`fmt-check`・`test`: いずれもエラーなく完了する（`test`はテンプレート同梱のサンプルテストが通る）
- `cover`: `coverage/`配下にHTMLレポート（`coverage/index.html`）が生成される。手順4でVS Code向け設定を配置した場合は、同時に`coverage/clover.xml`・`coverage/coverage-final.json`も生成されていることを確認する（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、テストから呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）
- `doc`/`doc-check`: `docs/api/`配下にHTMLのAPIリファレンス（`docs/api/index.html`）が生成され、`doc-check`もエラーなく完了する（テンプレートの`src/index.ts`にはJSDoc必須ルールに準拠したexport例`greet`を同梱しており、これが記述漏れ検出の動作確認を兼ねる）
- `minimumReleaseAge`: `10080`を返す
- `prepare`（`pnpm run prepare`）→ `hooksPath`: `git config core.hooksPath`が`<配置先の絶対パス>/.husky/_`を指している（husky v9はhookの実体を`.husky/`直下ではなく内部シム用の`_`ディレクトリに置き、`core.hooksPath`も相対パスではなく絶対パスで設定する）
- `clean`: `dist`/`coverage`/`docs`が削除される

途中で失敗したら、そのコマンドだけ単独で再実行して詳細を確認する。

以下は「設定を書いただけで実は無効」になっていないかを確かめる反証と、フックの実地動作確認で、一時的な変更を加えたあと元に戻す作業を伴うためバッチ化はせず個別に行う。

- `ignoreScripts`の実効性: postinstallスクリプトを持つ適当なパッケージを試験的に追加し、そのスクリプトのログが出力されないことを確認する。確認後はそのパッケージを取り除く。
- フックの動作確認: `src/`配下にわざとフォーマット崩れの`.ts`ファイルを追加して`git add`し、`git commit`（コミット自体は成立させず、テスト用に作ったファイルなので確認後は`git reset`でステージを戻す）を試みて、`pnpm exec lint-staged`（または`git commit`のフック経由）が`eslint --fix`/`prettier --write`でファイルを自動整形することを確認する。確認用に追加したファイルは元に戻す/削除する。
- 確認が終わったら、`git config --unset core.hooksPath`でこの動作確認中に設定されたローカル設定を元に戻す（そのプロジェクトを今後も使い続ける前提であれば、`pnpm run prepare`済みのまま残してよいかユーザーに確認してから判断する）。

lint/JSDoc/カバレッジの実効性を反証で確かめる場合は `references/counter-tests.md` を参照する。
