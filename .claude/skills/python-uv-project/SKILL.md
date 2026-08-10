---
name: python-uv-project
description: Pythonの練習・開発プロジェクト一式（uv前提のdevcontainer + pyproject.toml + main.py + README）を配置するときに使う。「pythonの練習環境作って」「python環境構築して」「uvでpythonプロジェクト作って」「このリポジトリにpythonプロジェクト追加して」など、このリポジトリ配下にPython用のdevcontainer/プロジェクトを新規作成・再作成したい場合にトリガーする。パッケージ管理はpip/venvではなく常にuvを使う前提で、サプライチェーン攻撃対策（min release age = 7日）も標準で組み込む。単にUbuntuのdevcontainerだけが欲しい（言語ランタイム不要）場合はdevcontainer-ubuntu-jaスキルを使うこと。
---

# python-uv-project

Ubuntu 24.04 / `ja_JP.UTF-8` / `Asia/Tokyo` 固定の devcontainer に、**uv前提**のPython環境構築条件を上乗せしたプロジェクト一式を配置するスキル。`projects/python-practice/` で一度構築・検証済みの構成をテンプレート化したもので、[[devcontainer-ubuntu-ja]] スキルのdevcontainer部分を土台にしている。

## このスキルが前提とする条件（変更しない）

- **パッケージ管理・実行はuv一本**。aptで `python3` / `python3-pip` / `python3-venv` は入れない。Pythonランタイム自体も `uv python install` でuvに管理させる（distro提供のpythonに依存しない）
- uv本体は `COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/` で導入する（Astral公式が推奨する、Dockerイメージから直接バイナリをコピーする方法。curlでインストーラースクリプトを実行する方法より速く再現性が高い）
- **サプライチェーン攻撃対策として `pyproject.toml` の `[tool.uv]` に `exclude-newer = "7 days"` を設定する**。公開から7日未満のパッケージバージョンは依存解決の対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保できる（7日という値自体もこのスキルの固定条件。ユーザーから別の期間指定があれば従う）
- `requirements.txt` は作らない。依存関係は `pyproject.toml` + `uv.lock`（`uv add`/`uv sync`で生成、コミット対象）で管理する

## 手順

1. **配置先とプロジェクト名を確認する**
   - このリポジトリの `projects/README.md` のルールにより、基本は `projects/<project-name>/` 配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい（例: 「pythonの練習環境」→ `python-practice`）。判断に迷う場合だけ確認する。
   - 既に配置先ディレクトリや `.devcontainer/` が存在する場合は上書きしてよいか必ず確認する。

2. **テンプレートをコピーし、プレースホルダを置換する**
   - `.claude/skills/python-uv-project/templates/Dockerfile` → `<配置先>/.devcontainer/Dockerfile`
   - `.claude/skills/python-uv-project/templates/devcontainer.json` → `<配置先>/.devcontainer/devcontainer.json`（`__PROJECT_NAME__` を配置先ディレクトリ名に置換）
   - `.claude/skills/python-uv-project/templates/pyproject.toml` → `<配置先>/pyproject.toml`（`__PROJECT_NAME__` を置換。目的に応じて `description` も調整してよい）
   - `.claude/skills/python-uv-project/templates/main.py` → `<配置先>/main.py`
   - `.claude/skills/python-uv-project/templates/README.md` → `<配置先>/README.md`（`__PROJECT_NAME__` を置換）
   - `devcontainer.json` の `workspaceMount` はテンプレートのままでよい（`${localWorkspaceFolder}` はコンテナ設定ファイルのある場所、つまりプロジェクトディレクトリ自身が基準になるため）。

3. **動作確認する**
   `docker build` と `docker run` で一通り検証する。確認後、テストで作った一時イメージ・一時的な依存追加・`uv.lock`・`.venv` は元に戻す/削除すること。
   - `docker build -t <一時タグ> -f <配置先>/.devcontainer/Dockerfile <配置先>` でビルドできることを確認する。
   - `docker run --rm <一時タグ> bash -c 'date; locale; sudo whoami'` で日本語日時表示・`LANG=ja_JP.UTF-8`・`Asia/Tokyo`・sudo権限を確認する。
   - `docker run --rm <一時タグ> bash -c 'uv --version; uv python list --only-installed'` でuv本体とPythonランタイムの導入を確認する。
   - `<配置先>` をマウントして `docker run --rm -v "$(pwd)/<配置先>:/workspace" -w /workspace <一時タグ> bash -c 'uv run main.py'` を実行し、venv自動生成込みで動くことを確認する。
   - `docker run --rm <一時タグ> bash -ic 'complete -p uv'` で `_uv` 関数がbash補完に登録されていることを確認する（uvの補完スクリプトは `/etc/bash_completion.d/` に静的配置されるため、git等の遅延ロード方式と違い `complete -p` で即確認できる）。
   - `exclude-newer` が実際に効いているかは、マウントしたプロジェクトで適当なパッケージを試験的に追加し、verboseログを見て確認する。例: `uv add <パッケージ名> -v 2>&1 | grep -i exclude` を実行し、`Solving with exclude-newer: global: <実行日の7日前の日時>` のような行が出ることを確認する。確認後はこの試験的な依存追加を `pyproject.toml` から取り除き、生成された `uv.lock` と `.venv` も削除する（依存なしの初期状態の `uv.lock` を作り直したい場合は、クリーンな状態で改めて `uv run main.py` を実行すれば再生成される）。

4. **（追加要求があった場合）依存パッケージや追加プログラムを導入する**
   - Pythonの依存パッケージ追加は必ず `uv add <パッケージ名>` を使う（`pip install` は使わない）。
   - devcontainer側に追加でプログラムを入れる場合、bash補完に対応していれば有効化する（方法は [[devcontainer-ubuntu-ja]] スキルの手順6を参照）。

## このスキルの対象外

- Python以外の言語ランタイム、あるいは言語ランタイムを含まない素のdevcontainerが欲しいだけの場合は [[devcontainer-ubuntu-ja]] スキルを使う。
- `exclude-newer` の7日という値やuv前提の方針自体は、このリポジトリで検証済みの固定条件として扱い、単なる「Python環境を作って」的な依頼でも省略しない。
