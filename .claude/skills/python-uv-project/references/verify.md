# 依存関係を同期し、動作確認する

`<配置先>` に移動し、以下の1本のコマンドにまとめて動作確認する（成功を前提に連結し、落ちたコマンドだけ個別に切り分ける）。`uv.lock` はコミット対象なので残す。

```bash
set -e
echo "=== sync ==="; just sync
echo "=== just (list) ==="; just
echo "=== run ==="; just run
echo "=== lint ==="; just lint
echo "=== fmt-check ==="; just fmt-check
echo "=== test ==="; just test
echo "=== cover ==="; just cover
echo "=== cover-html ==="; just cover-html
echo "=== cover-lcov ==="; just cover-lcov
echo "=== doc ==="; just doc
echo "=== clean ==="; just clean
```

手順5でVS Code向け設定を配置していない場合は `cover-lcov` の行を省いてよい。

出力から以下を確認する:

- `sync`（`uv sync`）: `pyproject.toml` に記載した `ruff`/`pytest`/`pytest-cov`/`pdoc` を含む依存が解決される（`uv.lock` が生成される。これはコミット対象）
- `just`: レシピ一覧（`just --list`相当）が表示される
- `run`（`uv run main.py`）: `.venv` の自動生成込みで動く
- `lint`（`uv run ruff check .`）: 警告なしで終了する（exit 0）。ruffは `.venv` をデフォルトで除外するため、flake8の頃のような除外設定は不要
- `fmt-check`（`uv run ruff format --check .`）: `main.py`/`tests/test_main.py` がruffのフォーマットに沿っている
- `test`（`uv run pytest`）: テンプレート同梱のサンプルテスト（`tests/test_main.py`）が通る
- `cover`: ターミナルにカバレッジのサマリと未カバー行が表示される（`.venv/`・`tests/` がカバレッジ集計から除外されているかも見る）
- `cover-html`: `htmlcov/index.html` が生成される
- `cover-lcov`: `coverage.lcov` が生成される（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、`tests/test_main.py` から呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）
- `doc`（`uv run pdoc main.py -d google -o apidocs`）: `apidocs/index.html` と `apidocs/main.html` が生成される。`main.html` を開き（またはgrepで）、`greet` のdocstringの `Args:`/`Returns:` が見出し付きで描画されていることも確認する
- `clean`: `htmlcov`/`.coverage`/`coverage.lcov`/`apidocs`/`.pytest_cache`/`.ruff_cache` が削除される

途中で失敗したら、そのコマンドだけ単独で再実行して詳細を確認する。

以下はlint/依存検査が「設定を書いただけで実は無効」になっていないかを確かめる反証で、ソースや`pyproject.toml`を一時的に書き換えて確認後に必ず元へ戻す作業を伴うため、バッチ化はせず個別に行う。**この反証は、このスキルの`templates/`を変更したときに`template-verifier`が確認する検証項目であり、プロジェクト新規作成のたびに実行する手順ではない。**

- ruffの `D100`/`D103`（docstring必須）の実効性: `main.py` のdocstringを一時的に削り、`just lint` で検出されることを確認する。`tests/test_main.py` にdocstringが無くてもエラーにならないこともあわせて確認する。確認後は削った内容を必ず元に戻す。
- ruffの `DOC` ルール（引数名不一致検出）の実効性: `main.py` の `greet` 関数のdocstring内の `Args:` の引数名（`name`）だけを別の文字列（例: `nam`）に書き換え、`just lint` で `docstring-extraneous-parameter`（シグネチャに無い `nam`）と `undocumented-param`（記述漏れの `name`）の両方が検出されることを確認する。確認後は必ず元の引数名に戻す。
- `exclude-newer` の実効性: `uv add <パッケージ名> -v 2>&1 | grep -i exclude` を実行し、`Solving with exclude-newer: global: <実行日の7日前の日時>` のような行が出ることを確認する。確認後はこの試験的な依存追加を `pyproject.toml` から取り除く。
- `pip-audit`（`just audit`）の実効性: まずテンプレート標準の依存構成で `No known vulnerabilities found` になることを確認する。そのうえで既知の脆弱性を持つ古いバージョンのパッケージ（例: `uv add urllib3==1.26.4`）を一時的に追加し、`just audit` が `Found N known vulnerabilities` として検出することを確認する。確認後はこの試験的な依存追加を `pyproject.toml` から取り除き、`uv sync` で `.venv`/`uv.lock` を元の依存構成に戻す。
