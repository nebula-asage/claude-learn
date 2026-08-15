---
name: python-uv-project
description: Pythonの練習・開発プロジェクト一式（uv前提のpyproject.toml + main.py + README + pytest/pytest-covによるテスト・カバレッジ計測環境）をホスト環境に直接構築するときに使う。「pythonの練習環境作って」「python環境構築して」「uvでpythonプロジェクト作って」「このリポジトリにpythonプロジェクト追加して」「pythonのテスト環境も入れて」「カバレッジ測定したい」「カバレッジレポート出したい」など、このリポジトリ配下にPythonプロジェクトを新規作成・再作成したい場合や、既存プロジェクトにpytest/カバレッジ計測を追加したい場合にトリガーする。Docker/devcontainerには依存せず、uv自体が入っていなければ公式インストーラー（curl経由）でホストに直接導入する。パッケージ管理はpip/venvではなく常にuvを使う前提で、サプライチェーン攻撃対策（min release age = 7日）も標準で組み込む。テスト・カバレッジ計測（`pytest` + `pytest-cov`、`uv run pytest --cov --cov-report=html`によるHTMLレポート生成）も標準で組み込む。devcontainer/コンテナ環境の構築自体を頼まれた場合はdevcontainer-ubuntu-jaスキルを使うこと（このスキルとは独立で、組み合わせる必要もない）。
---

# python-uv-project

**uv前提**のPython環境構築条件を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`projects/python-practice/` で一度構築・検証済みの条件（uv一本化・サプライチェーン攻撃対策）を、コンテナに依存しない形でテンプレート化したもの。

このスキルは [[devcontainer-ubuntu-ja]] などのdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときはそちらのスキルを使うこと。

## このスキルが前提とする条件（変更しない）

- **パッケージ管理・実行はuv一本**。`pip install` / `python -m venv` は使わず、依存追加は必ず `uv add`、実行は `uv run` を使う
- **Pythonランタイム自体もuvに管理させる**（`uv python install`）。distroやシステムに入っている `python3` には依存しない
- **サプライチェーン攻撃対策として `pyproject.toml` の `[tool.uv]` に `exclude-newer = "7 days"` を設定する**。公開から7日未満のパッケージバージョンは依存解決の対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保できる（7日という値もこのスキルの固定条件。ユーザーから別の期間指定があれば従う）
- `requirements.txt` は作らない。依存関係は `pyproject.toml` + `uv.lock`（`uv add`/`uv sync`で生成、コミット対象）で管理する
- **開発用依存として `flake8`（lint）・`black`（フォーマッタ）を `[dependency-groups] dev` に標準で入れる**。`black` の整形（1行88文字・スライスの空白など）はflake8のデフォルト設定と一部競合するため、`.flake8` に `max-line-length = 88` / `extend-ignore = E203` / `extend-exclude = .venv` を設定して揃える（flake8は `pyproject.toml` を読まないため別ファイルが必要）
- **テスト・カバレッジ計測も標準で組み込む**。開発用依存として `pytest`・`pytest-cov` を追加し、テストは `tests/` 配下に置く。`main.py` はパッケージ化していないプロジェクト直下のモジュールなので、pytestのデフォルトのimportモードのままでは `tests/` から見えない。そのため `pyproject.toml` の `[tool.pytest.ini_options]` で `testpaths = ["tests"]` と `pythonpath = ["."]` を設定し、プロジェクトルートをsys.pathに加えて `from main import ...` を可能にする。カバレッジは `[tool.coverage.run]`（`source`/`omit` で `.venv/`・`tests/` を対象外にする）と `[tool.coverage.report]`（`show_missing = true`）で設定し、`uv run pytest --cov --cov-report=term-missing` でターミナルに未カバー行を表示、`uv run pytest --cov --cov-report=html` で `htmlcov/index.html` にHTMLレポートを生成できるようにする

## 手順

1. **uvがホストに導入済みか確認する**
   - `command -v uv` で確認する。
   - 導入済みならそのバージョンで進めてよい。
   - 未導入の場合は、[uv公式が推奨するインストーラー](https://docs.astral.sh/uv/getting-started/installation/)を使う。
     ```bash
     curl -LsSf https://astral.sh/uv/install.sh | sh
     ```
   - **これはホスト環境に実際にソフトウェアを導入する操作であり、シェルの設定ファイル（`~/.bashrc` 等）へのPATH追記も伴う。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「uvが入っていないので公式インストーラーで導入してよいか」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
   - インストール後は新しいシェルを開くかプロファイルを再読込しないと `uv` コマンドが見つからないことがある点に注意する（`source ~/.bashrc` 等、あるいはインストーラーが出力するPATHの案内に従う）。

2. **Pythonランタイムを導入する**
   - `uv python install 3.12` を実行する。これでdistro提供のpythonに頼らず、uvが管理するPythonが使えるようになる。

3. **配置先とプロジェクト名を確認する**
   - このリポジトリの `projects/README.md` のルールにより、基本は `projects/<project-name>/` 配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい（例: 「pythonの練習環境」→ `python-practice`）。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

4. **テンプレートをコピーし、プレースホルダを置換する**
   - `.claude/skills/python-uv-project/templates/pyproject.toml` → `<配置先>/pyproject.toml`（`__PROJECT_NAME__` を置換。目的に応じて `description` も調整してよい）
   - `.claude/skills/python-uv-project/templates/main.py` → `<配置先>/main.py`
   - `.claude/skills/python-uv-project/templates/tests/test_main.py` → `<配置先>/tests/test_main.py`
   - `.claude/skills/python-uv-project/templates/README.md` → `<配置先>/README.md`（`__PROJECT_NAME__` を置換）
   - `.claude/skills/python-uv-project/templates/.flake8` → `<配置先>/.flake8`（置換不要）
   - `.claude/skills/python-uv-project/templates/.gitignore` → `<配置先>/.gitignore`（置換不要）

5. **依存関係を同期し、動作確認する**
   `<配置先>` に移動し、以下を確認する。確認後、テストで作った一時的な依存追加や `uv.lock` / `.venv` / `.pytest_cache` / `htmlcov` / `.coverage` は元に戻す/削除すること。
   - `uv sync` を実行し、`pyproject.toml` に記載した `flake8`/`black`/`pytest`/`pytest-cov` を含む依存が解決されることを確認する（`uv.lock` が生成される。これはコミット対象）。
   - `uv run main.py` を実行し、`.venv` の自動生成込みで動くことを確認する。
   - `uv run flake8 .` が警告なしで終了する（exit 0）ことを確認する。`.venv` を除外できていないと大量の誤検知が出るので、`.flake8` の `extend-exclude` が効いているかも併せて見る。
   - `uv run black --check .` で `main.py`/`tests/test_main.py` がblackのフォーマットに沿っていることを確認する。
   - `uv run pytest` を実行し、テンプレート同梱のサンプルテスト（`tests/test_main.py`）が通ることを確認する。
   - `uv run pytest --cov --cov-report=term-missing` を実行し、ターミナルにカバレッジのサマリと未カバー行が表示されることを確認する（`.venv/`・`tests/` がカバレッジ集計から除外されているかも見る）。
   - `uv run pytest --cov --cov-report=html` を実行し、`htmlcov/index.html` が生成されることを確認する。
   - `exclude-newer` が効いているかは、適当なパッケージを試験的に追加してverboseログを見て確認する。例: `uv add <パッケージ名> -v 2>&1 | grep -i exclude` を実行し、`Solving with exclude-newer: global: <実行日の7日前の日時>` のような行が出ることを確認する。確認後はこの試験的な依存追加を `pyproject.toml` から取り除く。

6. **（任意）bash補完を有効化する**
   - uvは `uv generate-shell-completion bash` でbash補完スクリプトを生成できる。ホスト環境ではroot権限で `/etc/bash_completion.d/` に置く方法は使えないことが多いので、ユーザー単位で有効化する。
     ```bash
     echo 'eval "$(uv generate-shell-completion bash)"' >> ~/.bashrc
     ```
   - これもユーザーのシェル設定ファイルを変更する操作なので、追加してよいか確認してから実施する。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外。コンテナ環境が欲しいと言われたら [[devcontainer-ubuntu-ja]] スキルを使う（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- `exclude-newer` の7日という値やuv前提の方針、flake8/black、pytest/pytest-covによるテスト・カバレッジ計測環境一式は、このリポジトリで検証済みの固定条件として扱い、単なる「Python環境を作って」的な依頼でも省略しない。
