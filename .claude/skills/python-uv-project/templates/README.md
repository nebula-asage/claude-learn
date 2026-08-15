# __PROJECT_NAME__

Pythonの練習用プロジェクト。パッケージ管理・実行は [uv](https://docs.astral.sh/uv/) を前提とする。

## セットアップ

`uv` が未導入の場合は公式インストーラーで導入する。

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Pythonランタイムはdistroのパッケージではなく `uv` に導入・管理させる。

```bash
uv python install 3.12
```

## 実行方法

```bash
uv run main.py
```

## 依存パッケージの追加

```bash
uv add <パッケージ名>
```

`uv add` / `uv sync` を実行すると `uv.lock` が生成・更新される。このファイルはコミットしてバージョンを固定する。

## Lint / Format

開発用依存として `flake8`（lint）・`black`（フォーマッタ）を導入済み。

```bash
uv run black .
uv run flake8 .
```

`black` の整形（1行88文字・スライスの空白など）とflake8のデフォルト設定は一部競合するため、`.flake8` で `max-line-length = 88` と `E203` の無視を設定している。

## テスト / カバレッジ

開発用依存として `pytest`（テストランナー）・`pytest-cov`（カバレッジ計測）を導入済み。テストは `tests/` 配下に `test_*.py` として置く。

```bash
# テストのみ実行
uv run pytest

# カバレッジ付きで実行（terminalに未カバー行を表示）
uv run pytest --cov --cov-report=term-missing

# カバレッジのHTMLレポートを生成（htmlcov/index.html）
uv run pytest --cov --cov-report=html
```

カバレッジの対象・除外は `pyproject.toml` の `[tool.coverage.run]` で設定している（`.venv/`・`tests/` は対象外）。`htmlcov/`・`.coverage`・`.pytest_cache/` はいずれもテスト実行のたびに再生成される成果物なので `.gitignore` 済み。

## ドキュメンテーションコメント / APIドキュメント生成

公開関数・モジュールへのdocstring記述は開発用依存の `flake8-docstrings`（pydocstyle）により `flake8` の実行時に強制される。docstringが無い、あるいは1行目がおかしい場合は `D1xx`/`D2xx` 等のエラーで検出される。

```bash
uv run flake8 .
```

docstringは [Google スタイル](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)（`Args:`/`Returns:` セクション）で書く。英語の文章作法を前提にした `D400`（ピリオド終端）・`D401`（命令形）・`D415` は日本語のdocstringには馴染まないため `.flake8` で無視している。`tests/` 配下のテスト関数はpytestの慣習としてdocstring不要のため、`per-file-ignores` で除外している。

APIドキュメントはdocstringから `pdoc` でHTML生成する。

```bash
uv run pdoc main.py -d google -o apidocs
```

`apidocs/index.html` を開くと、docstringから生成されたAPIリファレンス（Google スタイルの `Args:`/`Returns:` セクション込み）が確認できる。テストのたびに再生成される成果物なので `apidocs/` は `.gitignore` 済み。

## サプライチェーン攻撃対策

`pyproject.toml` の `[tool.uv]` で `exclude-newer = "7 days"` を設定している。公開から7日未満のパッケージバージョンは解決対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保する。
