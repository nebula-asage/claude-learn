---
name: python-uv-project
description: Pythonの練習・開発プロジェクト一式（uv前提のpyproject.toml + main.py + README + pytest/pytest-covによるテスト・カバレッジ計測環境 + flake8-docstrings/pydoclint/pdocによるドキュメンテーションコメント強制・APIドキュメント生成環境）をホスト環境に直接構築するときに使う。「pythonの練習環境作って」「python環境構築して」「uvでpythonプロジェクト作って」「このリポジトリにpythonプロジェクト追加して」「pythonのテスト環境も入れて」「カバレッジ測定したい」「カバレッジレポート出したい」「docstringのコメント環境も欲しい」「ドキュメンテーションコメントを強制したい」「docstringの引数名が実際のコードと一致しているか検証したい」「APIドキュメントを生成したい」「pdocを入れたい」など、このリポジトリ配下にPythonプロジェクトを新規作成・再作成したい場合や、既存プロジェクトにpytest/カバレッジ計測/ドキュメンテーションコメント環境を追加したい場合にトリガーする。Docker/devcontainerには依存せず、uv自体が入っていなければ公式インストーラー（curl経由）でホストに直接導入する。パッケージ管理はpip/venvではなく常にuvを使う前提で、サプライチェーン攻撃対策（min release age = 7日）も標準で組み込む。テスト・カバレッジ計測（`pytest` + `pytest-cov`、`uv run pytest --cov --cov-report=html`によるHTMLレポート生成）と、ドキュメンテーションコメント環境（公開関数・モジュールへのdocstringをflake8-docstringsで強制し、pydoclintでdocstringのArgs/Returnsと実際の関数シグネチャの不一致（引数名の誤記・過不足など）を検出し、pdocでHTML形式のAPIリファレンスを生成）も標準で組み込む。devcontainer/コンテナ環境の構築自体を頼まれた場合はdevcontainer-ubuntu-jaスキルを使うこと（このスキルとは独立で、組み合わせる必要もない）。
---

# python-uv-project

**uv前提**のPython環境構築条件を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`projects/python-practice/` で一度構築・検証済みの条件（uv一本化・サプライチェーン攻撃対策）に加え、flake8-docstrings/pdocによるドキュメンテーションコメント強制・APIドキュメント生成環境も、コンテナに依存しない形でテンプレート化したもの。

このスキルは [[devcontainer-ubuntu-ja]] などのdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときはそちらのスキルを使うこと。

## このスキルが前提とする条件（変更しない）

- **パッケージ管理・実行はuv一本**。`pip install` / `python -m venv` は使わず、依存追加は必ず `uv add`、実行は `uv run` を使う
- **Pythonランタイム自体もuvに管理させる**（`uv python install`）。distroやシステムに入っている `python3` には依存しない
- **サプライチェーン攻撃対策として `pyproject.toml` の `[tool.uv]` に `exclude-newer = "7 days"` を設定する**。公開から7日未満のパッケージバージョンは依存解決の対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保できる（7日という値もこのスキルの固定条件。ユーザーから別の期間指定があれば従う）
- `requirements.txt` は作らない。依存関係は `pyproject.toml` + `uv.lock`（`uv add`/`uv sync`で生成、コミット対象）で管理する
- **開発用依存として `flake8`（lint）・`black`（フォーマッタ）を `[dependency-groups] dev` に標準で入れる**。`black` の整形（1行88文字・スライスの空白など）はflake8のデフォルト設定と一部競合するため、`.flake8` に `max-line-length = 88` / `extend-ignore = E203` / `extend-exclude = .venv` を設定して揃える（flake8は `pyproject.toml` を読まないため別ファイルが必要）
- **テスト・カバレッジ計測も標準で組み込む**。開発用依存として `pytest`・`pytest-cov` を追加し、テストは `tests/` 配下に置く。`main.py` はパッケージ化していないプロジェクト直下のモジュールなので、pytestのデフォルトのimportモードのままでは `tests/` から見えない。そのため `pyproject.toml` の `[tool.pytest.ini_options]` で `testpaths = ["tests"]` と `pythonpath = ["."]` を設定し、プロジェクトルートをsys.pathに加えて `from main import ...` を可能にする。カバレッジは `[tool.coverage.run]`（`source`/`omit` で `.venv/`・`tests/` を対象外にする）と `[tool.coverage.report]`（`show_missing = true`）で設定し、`uv run pytest --cov --cov-report=term-missing` でターミナルに未カバー行を表示、`uv run pytest --cov --cov-report=html` で `htmlcov/index.html` にHTMLレポートを生成できるようにする
- **ドキュメンテーションコメント（docstring）は `flake8-docstrings`（pydocstyle）で強制する**。新しいツールを増やさず、既に導入済みの `flake8` にプラグインとして追加するだけで、公開モジュール・公開関数へのdocstring欠落を `D1xx` 系のエラーとして検出できる。デフォルトの `pep257` convention をそのまま使う（`Args:`/`Returns:` の完全な構造化までは強制しない。存在チェックと簡単な書式チェックに留める）。ただし `D400`（1行目はピリオドで終える）・`D401`（1行目は命令形にする）・`D415`（1行目は句読点で終える）は英語の文章作法を前提にしたルールで、日本語のdocstring（例: 「〜を返す。」）では全角句点や敬体を誤検知するため `.flake8` の `extend-ignore` で無効化する。`tests/` 配下のテスト関数はpytestの慣習としてdocstring不要なので、`.flake8` の `per-file-ignores` で `tests/*: D` を指定して除外する
- **docstringの `Args:` に書かれた引数名と実際の関数シグネチャの引数名が食い違っていないかは `pydoclint`（`pydoclint[flake8]`）で検証する**。`flake8-docstrings`（pydocstyle）はdocstringの「有無・書式」しか見ておらず、`Args:` の中身をASTと突き合わせる機能を持たないため、たとえば引数 `name` に対してdocstringで `nam` と書き間違えても検出できない。`pydoclint` は同じ `flake8` プラグインとして動作し、docstringをパースして関数シグネチャと比較することで、引数名の誤記・過不足を `DOC103`（`Docstring arguments are different from function arguments`）として検出できる。設定は `.flake8` に `style = google`（このスキルのdocstring方針に合わせてGoogleスタイルとしてパースさせる）を追加するだけでよい。ただし `pydoclint` はデフォルトで引数・戻り値の**型注釈**までdocstringとシグネチャで一致させようとする（`DOC105`/`DOC109`/`DOC110`/`DOC203` など）。このスキルのdocstring方針は型をシグネチャ側だけで管理し、docstring本文には型を書かないため、`.flake8` に `arg-type-hints-in-docstring = False` と `check-return-types = False` を設定して型チェックは無効化し、名前の突き合わせ（`DOC103`/`DOC104`）だけを有効なまま残す。`tests/` 配下は `flake8-docstrings` と同様の理由でdocstring自体を書かせないので、`.flake8` の `per-file-ignores` は `tests/*: D,DOC` として `pydoclint` の `DOC` コードもまとめて除外する
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
   - `.claude/skills/python-uv-project/templates/.flake8` → `<配置先>/.flake8`（置換不要）
   - `.claude/skills/python-uv-project/templates/.gitignore` → `<配置先>/.gitignore`（置換不要）

5. **依存関係を同期し、動作確認する**
   `<配置先>` に移動し、以下を確認する。確認後、テストで作った一時的な依存追加や `uv.lock` / `.venv` / `.pytest_cache` / `htmlcov` / `.coverage` / `apidocs` は元に戻す/削除すること。
   - `uv sync` を実行し、`pyproject.toml` に記載した `flake8`/`flake8-docstrings`/`pydoclint`/`black`/`pytest`/`pytest-cov`/`pdoc` を含む依存が解決されることを確認する（`uv.lock` が生成される。これはコミット対象）。
   - `uv run main.py` を実行し、`.venv` の自動生成込みで動くことを確認する。
   - `uv run flake8 .` が警告なしで終了する（exit 0）ことを確認する。`.venv` を除外できていないと大量の誤検知が出るので、`.flake8` の `extend-exclude` が効いているかも併せて見る。テンプレートの `main.py` にはdocstringが入っているので、まずはこれが素直に通ることを確認し、そのうえで一時的に `main.py` のdocstringを削って `D100`/`D103` が検出されること・`tests/test_main.py` にdocstringが無くてもエラーにならないことも確認するとよい（確認後は削った内容を必ず元に戻す）。
   - `pydoclint` によるDOC103検出も確認する。一時的に `main.py` の `greet` 関数のdocstring内の `Args:` の引数名（`name`）だけを別の文字列（例: `nam`）に書き換え、`uv run flake8 .` で `DOC103`（引数名の不一致）が検出されることを確認する。確認後は必ず元の引数名に戻す。
   - `uv run black --check .` で `main.py`/`tests/test_main.py` がblackのフォーマットに沿っていることを確認する。
   - `uv run pytest` を実行し、テンプレート同梱のサンプルテスト（`tests/test_main.py`）が通ることを確認する。
   - `uv run pytest --cov --cov-report=term-missing` を実行し、ターミナルにカバレッジのサマリと未カバー行が表示されることを確認する（`.venv/`・`tests/` がカバレッジ集計から除外されているかも見る）。
   - `uv run pytest --cov --cov-report=html` を実行し、`htmlcov/index.html` が生成されることを確認する。
   - `uv run pdoc main.py -d google -o apidocs` を実行し、`apidocs/index.html` と `apidocs/main.html` が生成されることを確認する。`main.html` を開き（またはgrepで）、`greet` のdocstringの `Args:`/`Returns:` が見出し付きで描画されていることも確認する。
   - `exclude-newer` が効いているかは、適当なパッケージを試験的に追加してverboseログを見て確認する。例: `uv add <パッケージ名> -v 2>&1 | grep -i exclude` を実行し、`Solving with exclude-newer: global: <実行日の7日前の日時>` のような行が出ることを確認する。確認後はこの試験的な依存追加を `pyproject.toml` から取り除く。

6. **（任意）bash補完を有効化する**
   - uvは `uv generate-shell-completion bash` でbash補完スクリプトを生成できる。ホスト環境ではroot権限で `/etc/bash_completion.d/` に置く方法は使えないことが多いので、ユーザー単位で有効化する。
     ```bash
     echo 'eval "$(uv generate-shell-completion bash)"' >> ~/.bashrc
     ```
   - これもユーザーのシェル設定ファイルを変更する操作なので、追加してよいか確認してから実施する。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外。コンテナ環境が欲しいと言われたら [[devcontainer-ubuntu-ja]] スキルを使う（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- `exclude-newer` の7日という値やuv前提の方針、flake8/black、pytest/pytest-covによるテスト・カバレッジ計測環境一式、flake8-docstrings（`D400`/`D401`/`D415`無視・`tests/`除外込み）・pydoclint（`style = google`・型チェック無効化・`tests/`除外込み）とpdoc（`-d google`）によるドキュメンテーションコメント環境一式は、このリポジトリで検証済みの固定条件として扱い、単なる「Python環境を作って」的な依頼でも省略しない。
