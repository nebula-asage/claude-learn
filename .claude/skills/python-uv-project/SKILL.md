---
name: python-uv-project
description: Pythonの練習・開発プロジェクト一式（uv前提+pytest/pytest-covによるテスト・カバレッジHTMLレポート+ruff/pdocによるドキュメンテーションコメント強制・APIドキュメント生成+pip-audit（uvx経由）による依存の脆弱性検査+justによるタスクランナー）をホスト環境に直接構築するスキル。「pythonの環境/プロジェクトを作って」「uvでpythonプロジェクトを作って」「カバレッジ測定/レポートがほしい」「docstringのコメント環境がほしい」「docstringの引数名がコードと一致しているか検証したい」「APIドキュメントを生成したい」「Pythonの依存の脆弱性を検査したい」など、Pythonプロジェクトの新規作成・再作成や、既存プロジェクトへのpytest/カバレッジ/ドキュメンテーション/依存検査環境の追加を頼まれたら必ず使うこと。配置先が既にVS Code向けの`.vscode/`ディレクトリを持つ場合は、ruff/pytestに対応したPython向けのsettings.json・拡張機能のおすすめ設定に加え、Coverage Gutters拡張によるカバレッジのエディタ上可視化（被覆/未被覆行のガター色付け）設定も追加する。Docker/devcontainerには依存せず、パッケージ管理は常にuv（pip/venvは使わない）でサプライチェーン攻撃対策も組み込む。devcontainer自体の構築はこのスキルの対象外。
---

# python-uv-project

**uv前提**のPython環境構築条件を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`projects/python-practice/` で一度構築・検証済みの条件（uv一本化・サプライチェーン攻撃対策）に加え、ruff/pdocによるドキュメンテーションコメント強制・APIドキュメント生成環境も、コンテナに依存しない形でテンプレート化したもの。

このスキルはdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキルの対象であり、このスキルでは扱わない。

## このスキルが前提とする条件（変更しない）

- パッケージ管理・実行は uv 一本（`uv add`・`uv run`。`pip install`・`python -m venv`・`requirements.txt` は使わない）。依存は `pyproject.toml` + `uv.lock`（コミット対象）で管理する
- Python ランタイムも `uv python install` で uv に管理させる（システムの `python3` に依存しない）
- サプライチェーン対策として `[tool.uv] exclude-newer = "7 days"`（別の期間を指定されたら従う）
- 依存の脆弱性検査は `pip-audit` を `uvx` で隔離実行する（`uv export --no-hashes --no-dev` の結果を渡す）。dev 依存には入れない
- lint・フォーマットは ruff 一本（black 等は入れない）。設定は `pyproject.toml` の `[tool.ruff.lint]`
- テストは pytest + pytest-cov で `tests/` 配下。`[tool.pytest.ini_options]` に `testpaths = ["tests"]`・`pythonpath = ["."]` を設定する
- docstring は ruff の `D`（`convention = "google"`、`D400`/`D401`/`D415` は無視）で強制し、引数名の不一致は `DOC`（`preview = true` が必須）で検出する。`tests/*` は `D`・`DOC` とも除外
- docstring は Google スタイル（`Args:`/`Returns:`）で書く
- APIドキュメントは pdoc で、`uv run pdoc main.py -d google --no-show-source -o apidocs` の形で生成する（モジュール名指定は失敗する）
- タスクランナーは just で、`sync`/`run`/`fmt`/`fmt-check`/`lint`/`test`/`cover`/`cover-html`/`cover-lcov`/`doc`/`clean` を用意する

各条件の理由・却下した代替案・検証で見つかった落とし穴は `.claude/skills/python-uv-project/references/design-notes.md` にある。テンプレートを変更するときや、条件を見直すときに読む。

## 手順

1. **uv・justがホストに導入済みか確認する**
   - `command -v uv` で確認する。
   - `command -v just` と `just --version` でjust（タスクランナー）を確認する。
   - 全て導入済みならステップ3に進んでよい。

2. **未導入の場合、ユーザーローカルに導入する**
   - **これはホスト環境に実際にソフトウェアを導入する操作であり、シェルの設定ファイル（`~/.bashrc` 等）へのPATH追記も伴う。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「uv/justが入っていないのでユーザーローカルに導入してよいか」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
   - 具体的な導入コマンド（uv・`uv python install`・just）は `.claude/skills/python-uv-project/references/install.md` を参照する。

3. **配置先とプロジェクト名を確認する**
   - このリポジトリの `projects/README.md` のルールにより、基本は `projects/<project-name>/` 配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい（例: 「pythonの練習環境」→ `python-practice`）。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

4. **テンプレートをコピーし、プレースホルダを置換する**
   `templates/` 配下は `vscode/` を除きそのまま `<配置先>` へ1階層でコピーできる構成になっているため、
   ファイルを1つずつ Read/Write するのではなく `cp -a` で一括コピーし、そのうえでプレースホルダを含む
   ファイルだけを Edit系ツールで置換する2段構成にする。

   ```bash
   mkdir -p "<配置先>"
   cp -a .claude/skills/python-uv-project/templates/. "<配置先>/"
   rm -rf "<配置先>/vscode"
   ```

   （`.claude/skills/python-uv-project/templates/vscode/` はここではコピーしない。VS Code設定の手順で扱う。）

   コピー後、`grep -rl "__PROJECT_NAME__" "<配置先>"` でプレースホルダを含むファイルを洗い出し、その結果に対してだけ
   Edit系ツールで置換する。テンプレートが変わった場合は下の一覧ではなく grep の結果を優先すること。
   - `pyproject.toml`・`README.md` の `__PROJECT_NAME__` を置換する（`pyproject.toml` の `description` は目的に応じて調整してよい）

5. **配置先がVS Codeプロジェクトの場合、Python向けのVS Code設定を追加する**
   - 判定は `<配置先>/.vscode/` ディレクトリ（`settings.json` または `extensions.json`）の有無で行う。存在しなければVS Code向けの設定は持たないプロジェクトとみなし、この手順はスキップする（`.vscode/` を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、`.vscode/` を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json` を配置する**: `.claude/skills/python-uv-project/templates/vscode/settings.json` の内容を `<配置先>/.vscode/settings.json` にマージする。ファイルが既に存在する場合は、Edit系ツールで直接編集し、既存のキー（言語非依存の共通設定など）を残したまま `python.*`/`coverage-gutters.*` 系のキーと `[python]` ブロックを追加する（同じキーが既にあれば上書きせず、内容を確認したうえでユーザーに判断を仰ぐ）。ファイルが無ければ新規作成する。
     - `coverage-gutters.*` の設定はCoverage Gutters拡張（後述）向けで、`uv run pytest --cov --cov-report=lcov` を実行すると生成される `coverage.lcov`（lcov形式のカバレッジレポート）を読み込み、エディタの行番号横に被覆行（緑）・未被覆行（赤）を色付け表示する。既存の `--cov-report=term-missing`/`--cov-report=html` 運用に加えて使う追加のレポート形式であり、どちらかを置き換えるものではない。`coverage.lcov` はテスト実行のたびに再生成される成果物なのでコミット対象に含めない（テンプレートの `.gitignore` で除外済み）。
   - **拡張機能のおすすめ設定を配置する**: 配置先の判定はさらに `<配置先>/.devcontainer/devcontainer.json` の有無で分岐する（この判定も「devcontainer環境を構築するスキルが動いたかどうか」ではなく、あくまでファイルの有無で行う）。
     - `devcontainer.json` が存在する場合: `.vscode/extensions.json` は使わず、`.claude/skills/python-uv-project/templates/vscode/extensions.json` の `recommendations` 配列の中身を `<配置先>/.devcontainer/devcontainer.json` の `customizations.vscode.extensions` 配列にEdit系ツールで直接マージする（重複を除いて追記。既存の `customizations.vscode.settings` 等は残す）。
     - `devcontainer.json` が存在しない場合: `.claude/skills/python-uv-project/templates/vscode/extensions.json` の内容を `<配置先>/.vscode/extensions.json` にマージする（既存の `recommendations` があれば重複を除いて追記し、既存の非Python系の推奨拡張機能はそのまま残す）。
   - `settings.json`/`extensions.json`（および `devcontainer.json`）はJSONC（コメント付きJSON）として解釈されるため、標準の `jq` に通す前にコメント行を取り除くか、目視でカンマ・かっこの対応を確認する。

6. **依存関係を同期し、動作確認する**
   `<配置先>` に移動し、`.claude/skills/python-uv-project/references/verify.md` の手順に従って確認する（正常動作の確認手順のみでよい。同ファイル末尾の反証部分は、このスキルの`templates/`を変更したときに`template-verifier`が確認する検証項目であり、プロジェクト新規作成のたびに実行する手順ではない）。確認後、テストで作った一時的な依存追加や `uv.lock` / `.venv` / `.pytest_cache` / `htmlcov` / `.coverage` / `coverage.lcov` / `apidocs` は元に戻す/削除すること。

7. **（任意）bash補完を有効化する**
   - 手順は `.claude/skills/python-uv-project/references/install.md` を参照する。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- `.vscode/` ディレクトリが存在しない配置先に、VS Code向けの設定一式をゼロから新規作成することはこのスキルの対象外（このスキルが行うのはPython固有の追加設定のみ）。ユーザーから明示的に「VS Code環境ごと作って」等の依頼があった場合のみ、`.vscode/` を新規作成したうえでPython向け設定を配置してよい。
- 「前提とする条件」に並べた項目は、単なる「Python環境を作って」的な依頼でも省略しない。
- Git hooks（コミット時の自動lint/format）の設定はこのスキルの対象外。このリポジトリでは `core.hooksPath` がリポジトリ全体で1つしか持てず、プロジェクトごとにフックを設定すると互いに上書きし合う問題があるため、Pythonプロジェクト側では設定しない。
