# 依存関係を同期し、動作確認する

`<配置先>` に移動し、以下を確認する。確認後、テストで作った一時的な依存追加や `uv.lock` / `.venv` / `.pytest_cache` / `htmlcov` / `.coverage` / `coverage.lcov` / `apidocs` は元に戻す/削除すること。

いくつかの項目は「正常に動くことの確認」と「lint/検査が本当に効いているかの反証」を同じ手順の中で行う（設定を書いただけで実は無効、という状態を防ぐため。反証部分の確認後は必ず元に戻すこと）。

- `just sync`（`uv sync`）を実行し、`pyproject.toml` に記載した `ruff`/`pytest`/`pytest-cov`/`pdoc` を含む依存が解決されることを確認する（`uv.lock` が生成される。これはコミット対象）。
- 引数なしで `just` を実行し、レシピ一覧（`just --list`相当）が表示されることを確認する。
- `just run`（`uv run main.py`）を実行し、`.venv` の自動生成込みで動くことを確認する。
- `just lint`（`uv run ruff check .`）が警告なしで終了する（exit 0）ことを確認する。ruffは `.venv` をデフォルトで除外するため、flake8の頃のような除外設定は不要。テンプレートの `main.py` にはdocstringが入っているので、まずはこれが素直に通ることを確認し、そのうえで一時的に `main.py` のdocstringを削って `D100`/`D103` が検出されること・`tests/test_main.py` にdocstringが無くてもエラーにならないことも確認するとよい（確認後は削った内容を必ず元に戻す）。
- `ruff` の `DOC` ルールによる引数名不一致検出も確認する。一時的に `main.py` の `greet` 関数のdocstring内の `Args:` の引数名（`name`）だけを別の文字列（例: `nam`）に書き換え、`just lint` で `docstring-extraneous-parameter`（シグネチャに無い `nam`）と `undocumented-param`（記述漏れの `name`）の両方が検出されることを確認する。確認後は必ず元の引数名に戻す。
- `just fmt-check`（`uv run ruff format --check .`）で `main.py`/`tests/test_main.py` がruffのフォーマットに沿っていることを確認する。
- `just test`（`uv run pytest`）を実行し、テンプレート同梱のサンプルテスト（`tests/test_main.py`）が通ることを確認する。
- `just cover` を実行し、ターミナルにカバレッジのサマリと未カバー行が表示されることを確認する（`.venv/`・`tests/` がカバレッジ集計から除外されているかも見る）。
- `just cover-html` を実行し、`htmlcov/index.html` が生成されることを確認する。
- 手順5でVS Code向け設定を配置した場合は、`just cover-lcov` を実行し、`coverage.lcov` が生成されることも確認する（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、`tests/test_main.py` から呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）。
- `just doc`（`uv run pdoc main.py -d google -o apidocs`）を実行し、`apidocs/index.html` と `apidocs/main.html` が生成されることを確認する。`main.html` を開き（またはgrepで）、`greet` のdocstringの `Args:`/`Returns:` が見出し付きで描画されていることも確認する。
- `just clean` を実行し、`htmlcov`/`.coverage`/`coverage.lcov`/`apidocs`/`.pytest_cache`/`.ruff_cache` が削除されることを確認する。
- `exclude-newer` が効いているかは、適当なパッケージを試験的に追加してverboseログを見て確認する。例: `uv add <パッケージ名> -v 2>&1 | grep -i exclude` を実行し、`Solving with exclude-newer: global: <実行日の7日前の日時>` のような行が出ることを確認する。確認後はこの試験的な依存追加を `pyproject.toml` から取り除く。
- `just audit`（`uvx pip-audit -r <一時ファイル>`）を実行し、まずテンプレート標準の依存構成で `No known vulnerabilities found` になることを確認する。そのうえで `pip-audit` が実際に検出できているかの反証テストとして、既知の脆弱性を持つ古いバージョンのパッケージ（例: `uv add urllib3==1.26.4`）を一時的に追加し、`just audit` が `Found N known vulnerabilities` として検出することを確認する。確認後はこの試験的な依存追加を `pyproject.toml` から取り除き、`uv sync` で `.venv`/`uv.lock` を元の依存構成に戻す。
