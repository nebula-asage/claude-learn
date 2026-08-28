---
name: python-uv-project
description: Pythonの練習・開発プロジェクト一式（uv前提+pytest/pytest-covによるテスト・カバレッジHTMLレポート+ruff/pdocによるドキュメンテーションコメント強制・APIドキュメント生成）をホスト環境に直接構築するスキル。「pythonの環境/プロジェクトを作って」「uvでpythonプロジェクトを作って」「カバレッジ測定/レポートがほしい」「docstringのコメント環境がほしい」「docstringの引数名がコードと一致しているか検証したい」「APIドキュメントを生成したい」など、Pythonプロジェクトの新規作成・再作成や、既存プロジェクトへのpytest/カバレッジ/ドキュメンテーション環境の追加を頼まれたら必ず使うこと。配置先が既にVS Code向けの`.vscode/`ディレクトリを持つ場合は、ruff/pytestに対応したPython向けのsettings.json・拡張機能のおすすめ設定に加え、Coverage Gutters拡張によるカバレッジのエディタ上可視化（被覆/未被覆行のガター色付け）設定も追加する。Docker/devcontainerには依存せず、パッケージ管理は常にuv（pip/venvは使わない）でサプライチェーン攻撃対策も組み込む。devcontainer自体の構築はdevcontainer-ubuntu-jaスキルを使う。
---

# python-uv-project

**uv前提**のPython環境構築条件を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`projects/python-practice/` で一度構築・検証済みの条件（uv一本化・サプライチェーン攻撃対策）に加え、ruff/pdocによるドキュメンテーションコメント強制・APIドキュメント生成環境も、コンテナに依存しない形でテンプレート化したもの。

このスキルはdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキル（例: devcontainer-ubuntu-ja）を使うこと。

## このスキルが前提とする条件（変更しない）

- **パッケージ管理・実行はuv一本**。`pip install` / `python -m venv` は使わず、依存追加は必ず `uv add`、実行は `uv run` を使う
- **Pythonランタイム自体もuvに管理させる**（`uv python install`）。distroやシステムに入っている `python3` には依存しない
- **サプライチェーン攻撃対策として `pyproject.toml` の `[tool.uv]` に `exclude-newer = "7 days"` を設定する**。公開から7日未満のパッケージバージョンは依存解決の対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保できる（7日という値もこのスキルの固定条件。ユーザーから別の期間指定があれば従う）
- `requirements.txt` は作らない。依存関係は `pyproject.toml` + `uv.lock`（`uv add`/`uv sync`で生成、コミット対象）で管理する
- **開発用依存として `ruff` を `[dependency-groups] dev` に標準で入れる**。lintは `uv run ruff check .`、フォーマットは `uv run ruff format .` とruff一本に統一する（別途blackを入れない）。`ruff` は `pyproject.toml` を直接読むため `flake8` のような別設定ファイルは不要で、lintの設定は `[tool.ruff.lint]` にまとめる。デフォルトの選択ルール（`E4`/`E7`/`E9`/`F`）には行長や空白まわりのスタイル系ルール（`E2xx`/`E5xx`）が含まれないが、これらは `ruff format` が担当するため競合しない
- **テスト・カバレッジ計測も標準で組み込む**。開発用依存として `pytest`・`pytest-cov` を追加し、テストは `tests/` 配下に置く。`main.py` はパッケージ化していないプロジェクト直下のモジュールなので、pytestのデフォルトのimportモードのままでは `tests/` から見えない。そのため `pyproject.toml` の `[tool.pytest.ini_options]` で `testpaths = ["tests"]` と `pythonpath = ["."]` を設定し、プロジェクトルートをsys.pathに加えて `from main import ...` を可能にする。カバレッジは `[tool.coverage.run]`（`source`/`omit` で `.venv/`・`tests/` を対象外にする）と `[tool.coverage.report]`（`show_missing = true`）で設定し、`uv run pytest --cov --cov-report=term-missing` でターミナルに未カバー行を表示、`uv run pytest --cov --cov-report=html` で `htmlcov/index.html` にHTMLレポートを生成できるようにする
- **ドキュメンテーションコメント（docstring）は `ruff` の `D`（pydocstyle由来）ルールで強制する**。新しいツールを増やさず、既に導入済みの `ruff` の `[tool.ruff.lint] select` に `"D"` を加えるだけで、公開モジュール・公開関数へのdocstring欠落を `D1xx` 系のエラーとして検出できる。`[tool.ruff.lint.pydocstyle]` の `convention = "google"` を設定する（`Args:`/`Returns:` の完全な構造化までは強制しない。存在チェックと簡単な書式チェックに留める）。ただし `D400`（1行目はピリオドで終える）・`D401`（1行目は命令形にする）・`D415`（1行目は句読点で終える）は英語の文章作法を前提にしたルールで、日本語のdocstring（例: 「〜を返す。」）では全角句点や敬体を誤検知するため `[tool.ruff.lint] ignore` で無効化する。`tests/` 配下のテスト関数はpytestの慣習としてdocstring不要なので、`[tool.ruff.lint.per-file-ignores]` で `"tests/*" = ["D", "DOC"]` を指定して除外する
- **docstringの `Args:` に書かれた引数名と実際の関数シグネチャの引数名が食い違っていないかは `ruff` の `DOC`（pydoclint由来）ルールで検証する**。`D`（pydocstyle）系のルールはdocstringの「有無・書式」しか見ておらず、`Args:` の中身をASTと突き合わせる機能を持たないため、たとえば引数 `name` に対してdocstringで `nam` と書き間違えても検出できない。`select` に `"DOC"` を加えると、docstringをパースして関数シグネチャと比較し、シグネチャに存在しない引数の記述を `docstring-extraneous-parameter`、記述漏れの引数を `undocumented-param`（`D417`、`D`側のルール）として検出できる。名前を書き間違えた場合は「シグネチャ側の正しい名前が記述漏れ」「docstring側の誤った名前が余分な記述」の両方として検出されるため、結果的にpydoclintの引数名不一致チェック（`DOC103`相当）と同じ効果が得られる。**注意点として、ruffの `DOC` ルール群はまだpreview（不安定）扱いのため、`[tool.ruff.lint]` に `preview = true` を明示しないと有効化されない**。将来のruffのアップデートでルール内容や番号が変わる可能性がある。型注釈まで一致させる追加チェックはruffの `DOC` ルールには存在しない（pydoclintにあった `arg-type-hints-in-docstring` 相当の無効化設定も不要）。`tests/` 配下は `D` と同様の理由でdocstring自体を書かせないので、`per-file-ignores` の `"tests/*"` に `"DOC"` もまとめて含める
- **docstringは [Google スタイル](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)（`Args:`/`Returns:` セクション）で書く**。厳密な構造は強制していないが、書式を統一しておくと後述の `pdoc` でのAPIドキュメント生成時に整形されたセクションとして描画される
- **APIドキュメントの生成には `pdoc`（`https://pdoc.dev/`）を使う**。Python標準の `pydoc` はdocstringをほぼ生テキストのまま表示するだけでMarkdown/reST的な整形をしないため、実用的なAPIリファレンスにはならない。`pdoc` はdocstringから直接HTMLを生成でき、`go install` 相当の `uv add --dev` で導入も容易なため、これを標準採用する。**`pdoc <モジュール名>` という呼び出しは失敗する**（`uv run pdoc` はコンソールスクリプト経由で起動するため、カレントディレクトリが自動では `sys.path` に乗らず `ModuleNotFoundError` になる）。ファイルパスを直接渡す `uv run pdoc main.py -o apidocs` の形式を使うこと。また `-d google` を付けてGoogleスタイルのdocstringだと明示すると、`Args:`/`Returns:` が見出し付きの整形されたセクションとして描画される（付けないとreStructuredText前提で解釈され、素のテキストのまま表示される）

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
   - `.claude/skills/python-uv-project/templates/.gitignore` → `<配置先>/.gitignore`（置換不要）

5. **配置先がVS Codeプロジェクトの場合、Python向けのVS Code設定を追加する**
   - 判定は `<配置先>/.vscode/` ディレクトリ（`settings.json` または `extensions.json`）の有無で行う。存在しなければVS Code向けの設定は持たないプロジェクトとみなし、この手順はスキップする（`.vscode/` を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、`.vscode/` を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json` を配置する**: `.claude/skills/python-uv-project/templates/vscode/settings.json` の内容を `<配置先>/.vscode/settings.json` にマージする。ファイルが既に存在する場合は、Edit系ツールで直接編集し、既存のキー（言語非依存の共通設定など）を残したまま `python.*`/`coverage-gutters.*` 系のキーと `[python]` ブロックを追加する（同じキーが既にあれば上書きせず、内容を確認したうえでユーザーに判断を仰ぐ）。ファイルが無ければ新規作成する。
     - `coverage-gutters.*` の設定はCoverage Gutters拡張（後述）向けで、`uv run pytest --cov --cov-report=lcov` を実行すると生成される `coverage.lcov`（lcov形式のカバレッジレポート）を読み込み、エディタの行番号横に被覆行（緑）・未被覆行（赤）を色付け表示する。既存の `--cov-report=term-missing`/`--cov-report=html` 運用に加えて使う追加のレポート形式であり、どちらかを置き換えるものではない。`coverage.lcov` はテスト実行のたびに再生成される成果物なのでコミット対象に含めない（テンプレートの `.gitignore` で除外済み）。
   - **拡張機能のおすすめ設定を配置する**: 配置先の判定はさらに `<配置先>/.devcontainer/devcontainer.json` の有無で分岐する（この判定も「devcontainer環境を構築するスキルが動いたかどうか」ではなく、あくまでファイルの有無で行う）。
     - `devcontainer.json` が存在する場合: `.vscode/extensions.json` は使わず、`.claude/skills/python-uv-project/templates/vscode/extensions.json` の `recommendations` 配列の中身（拡張機能IDのみ。コメントは転記しなくてよい）を `<配置先>/.devcontainer/devcontainer.json` の `customizations.vscode.extensions` 配列にEdit系ツールで直接マージする（重複を除いて追記。既存の `customizations.vscode.settings` 等は残す）。
     - `devcontainer.json` が存在しない場合: `.claude/skills/python-uv-project/templates/vscode/extensions.json` の内容を `<配置先>/.vscode/extensions.json` にマージする（既存の `recommendations` があれば重複を除いて追記し、既存の非Python系の推奨拡張機能はそのまま残す）。
   - `settings.json`/`extensions.json`（および `devcontainer.json`）はJSONC（コメント付きJSON）として解釈されるため、標準の `jq` に通す前にコメント行を取り除くか、目視でカンマ・かっこの対応を確認する。

6. **依存関係を同期し、動作確認する**
   `<配置先>` に移動し、以下を確認する。確認後、テストで作った一時的な依存追加や `uv.lock` / `.venv` / `.pytest_cache` / `htmlcov` / `.coverage` / `coverage.lcov` / `apidocs` は元に戻す/削除すること。
   - `uv sync` を実行し、`pyproject.toml` に記載した `ruff`/`pytest`/`pytest-cov`/`pdoc` を含む依存が解決されることを確認する（`uv.lock` が生成される。これはコミット対象）。
   - `uv run main.py` を実行し、`.venv` の自動生成込みで動くことを確認する。
   - `uv run ruff check .` が警告なしで終了する（exit 0）ことを確認する。ruffは `.venv` をデフォルトで除外するため、flake8の頃のような除外設定は不要。テンプレートの `main.py` にはdocstringが入っているので、まずはこれが素直に通ることを確認し、そのうえで一時的に `main.py` のdocstringを削って `D100`/`D103` が検出されること・`tests/test_main.py` にdocstringが無くてもエラーにならないことも確認するとよい（確認後は削った内容を必ず元に戻す）。
   - `ruff` の `DOC` ルールによる引数名不一致検出も確認する。一時的に `main.py` の `greet` 関数のdocstring内の `Args:` の引数名（`name`）だけを別の文字列（例: `nam`）に書き換え、`uv run ruff check .` で `docstring-extraneous-parameter`（シグネチャに無い `nam`）と `undocumented-param`（記述漏れの `name`）の両方が検出されることを確認する。確認後は必ず元の引数名に戻す。
   - `uv run ruff format --check .` で `main.py`/`tests/test_main.py` がruffのフォーマットに沿っていることを確認する。
   - `uv run pytest` を実行し、テンプレート同梱のサンプルテスト（`tests/test_main.py`）が通ることを確認する。
   - `uv run pytest --cov --cov-report=term-missing` を実行し、ターミナルにカバレッジのサマリと未カバー行が表示されることを確認する（`.venv/`・`tests/` がカバレッジ集計から除外されているかも見る）。
   - `uv run pytest --cov --cov-report=html` を実行し、`htmlcov/index.html` が生成されることを確認する。
   - 手順5でVS Code向け設定を配置した場合は、`uv run pytest --cov --cov-report=lcov` を実行し、`coverage.lcov` が生成されることも確認する（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、`tests/test_main.py` から呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）。
   - `uv run pdoc main.py -d google -o apidocs` を実行し、`apidocs/index.html` と `apidocs/main.html` が生成されることを確認する。`main.html` を開き（またはgrepで）、`greet` のdocstringの `Args:`/`Returns:` が見出し付きで描画されていることも確認する。
   - `exclude-newer` が効いているかは、適当なパッケージを試験的に追加してverboseログを見て確認する。例: `uv add <パッケージ名> -v 2>&1 | grep -i exclude` を実行し、`Solving with exclude-newer: global: <実行日の7日前の日時>` のような行が出ることを確認する。確認後はこの試験的な依存追加を `pyproject.toml` から取り除く。

7. **（任意）bash補完を有効化する**
   - uvは `uv generate-shell-completion bash` でbash補完スクリプトを生成できる。ホスト環境ではroot権限で `/etc/bash_completion.d/` に置く方法は使えないことが多いので、ユーザー単位で有効化する。
     ```bash
     echo 'eval "$(uv generate-shell-completion bash)"' >> ~/.bashrc
     ```
   - これもユーザーのシェル設定ファイルを変更する操作なので、追加してよいか確認してから実施する。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外。コンテナ環境が欲しいと言われたら別スキル（例: devcontainer-ubuntu-ja）を使う（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- `.vscode/` ディレクトリが存在しない配置先に、VS Code向けの設定一式をゼロから新規作成することはこのスキルの対象外（このスキルが行うのはPython固有の追加設定のみ）。ユーザーから明示的に「VS Code環境ごと作って」等の依頼があった場合のみ、`.vscode/` を新規作成したうえでPython向け設定を配置してよい。
- `exclude-newer` の7日という値やuv前提の方針、ruff（lint・フォーマット一本化）、pytest/pytest-covによるテスト・カバレッジ計測環境一式、ruffの`D`ルール（`D400`/`D401`/`D415`無視・`tests/`除外込み）・`DOC`ルール（`preview = true`・`tests/`除外込み）とpdoc（`-d google`）によるドキュメンテーションコメント環境一式は、このリポジトリで検証済みの固定条件として扱い、単なる「Python環境を作って」的な依頼でも省略しない。
