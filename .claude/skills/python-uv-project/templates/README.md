# __PROJECT_NAME__

Pythonの練習用プロジェクト。パッケージ管理・実行は [uv](https://docs.astral.sh/uv/) を前提とする。

## 実行方法

devcontainer（Ubuntu 24.04 / `ja_JP.UTF-8` / `Asia/Tokyo`）を開くと、`uv` が使える状態になる（Pythonランタイムはdistroのapt版ではなく `uv python install` で導入したものを使う）。

```bash
uv run main.py
```

## 依存パッケージの追加

```bash
uv add <パッケージ名>
```

`uv add` / `uv sync` を実行すると `uv.lock` が生成・更新される。このファイルはコミットしてバージョンを固定する。

## サプライチェーン攻撃対策

`pyproject.toml` の `[tool.uv]` で `exclude-newer = "7 days"` を設定している。公開から7日未満のパッケージバージョンは解決対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保する。
