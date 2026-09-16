# python-practice

Pythonの練習用プロジェクト。パッケージ管理・実行は [uv](https://docs.astral.sh/uv/) を前提とする。

## 実行方法

devcontainer（Ubuntu 24.04 / `ja_JP.UTF-8` / `Asia/Tokyo`）を開くと、`uv` が使える状態になる（Pythonランタイムはdistroのapt版ではなく `uv python install` で導入したものを使う）。タスクランナーとして [just](https://just.systems/) を使う。

```bash
just run
```

内部では `uv run main.py` を実行している。`just` を引数なしで実行するとレシピ一覧が確認できる。

## 依存パッケージの追加

```bash
uv add <パッケージ名>
```

`uv add` / `uv sync` を実行すると `uv.lock` が生成・更新される。このファイルはコミットしてバージョンを固定する。

## Lint / Format

開発用依存として `ruff` を導入済み。lint・フォーマット（`ruff format`）どちらもruffに一本化している。

```bash
just fmt         # uv run ruff format .
just fmt-check   # uv run ruff format --check .（適用はしない）
just lint        # uv run ruff check .
```

`ruff` の設定は `pyproject.toml` の `[tool.ruff.lint]` にまとめている（`flake8` と違って別ファイルが不要）。

## テスト / カバレッジ

開発用依存として `pytest`（テストランナー）・`pytest-cov`（カバレッジ計測）を導入済み。テストは `tests/` 配下に `test_*.py` として置く。

```bash
just test         # テストのみ実行
just cover         # カバレッジ付きで実行（terminalに未カバー行を表示）
just cover-html    # カバレッジのHTMLレポートを生成（htmlcov/index.html）
```

カバレッジの対象・除外は `pyproject.toml` の `[tool.coverage.run]` で設定している（`.venv/`・`tests/` は対象外）。`htmlcov/`・`.coverage`・`.pytest_cache/` はいずれもテスト実行のたびに再生成される成果物なので `.gitignore` 済み。

## ドキュメンテーションコメント / APIドキュメント生成

公開関数・モジュールへのdocstring記述は `ruff` の `D`（pydocstyle由来）ルールにより強制される。docstringが無い、あるいは1行目がおかしい場合は `D1xx`/`D2xx` 等のエラーで検出される。

さらに、docstringの `Args:` に書いた引数名が実際の関数シグネチャと一致しているかは `ruff` の `DOC`（pydoclint由来）ルールにより検証される。引数名の誤記や過不足があると `undocumented-param`（引数の記述漏れ）や `docstring-extraneous-parameter`（シグネチャに無い引数の記述）のエラーで検出される（型注釈の一致までは要求しない）。

```bash
just lint
```

docstringは [Google スタイル](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)（`Args:`/`Returns:` セクション）で書く。英語の文章作法を前提にした `D400`（ピリオド終端）・`D401`（命令形）・`D415` は日本語のdocstringには馴染まないため `pyproject.toml` の `[tool.ruff.lint]` で無視している。`tests/` 配下のテスト関数はpytestの慣習としてdocstring不要のため、`per-file-ignores` で `D`・`DOC` どちらも除外している。

APIドキュメントはdocstringから `pdoc` でHTML生成する。

```bash
just doc
```

`apidocs/index.html` を開くと、docstringから生成されたAPIリファレンス（Google スタイルの `Args:`/`Returns:` セクション込み）が確認できる。テストのたびに再生成される成果物なので `apidocs/` は `.gitignore` 済み。

## サプライチェーン攻撃対策

`pyproject.toml` の `[tool.uv]` で `exclude-newer = "7 days"` を設定している。公開から7日未満のパッケージバージョンは解決対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保する。
