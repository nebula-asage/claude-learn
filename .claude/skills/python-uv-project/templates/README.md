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

## サプライチェーン攻撃対策

`pyproject.toml` の `[tool.uv]` で `exclude-newer = "7 days"` を設定している。公開から7日未満のパッケージバージョンは解決対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保する。
