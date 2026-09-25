# claude-token-monitor

Claude Codeのセッショントランスクリプト（`~/.claude/projects/<project>/<session-id>.jsonl`）から、ターン（assistantメッセージ）毎の入力/出力/キャッシュ作成/キャッシュ読み取りトークン数を読み取り、計測・可視化するCLIツール。パッケージ管理・実行は [uv](https://docs.astral.sh/uv/) を前提とする。

## セットアップ

`uv` が未導入の場合は公式インストーラーで導入する。

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Pythonランタイムはdistroのパッケージではなく `uv` に導入・管理させる。

```bash
uv python install 3.12
```

タスクランナーとして [just](https://just.systems/) を使う（`just --version` で確認。未導入ならGitHub ReleasesのtarballとSHA256SUMSで導入する）。

## 実行方法

対象セッションのJSONLファイルは、既定では `~/.claude/projects/<カレントディレクトリをエンコードした名前>/` 配下で最終更新時刻が最も新しいものを自動選択する（`--session <セッションID>` で特定のセッションを指定、`--file <パス>` で直接パスを指定できる）。カレントディレクトリ以外のプロジェクトを対象にしたい場合は `--project-dir <対象プロジェクトの実ディレクトリパス>` を指定する（`~/.claude/projects/<encoded>/` へのエンコードは自動で行われるので、エンコード後のディレクトリ名を自分で組み立てる必要はない）。

Claude Codeは1回のAPIレスポンス（thinking/text/tool_useなど複数のcontentブロック）を複数のJSONL行に分けて書き出すことがあり、各行は同一の`message.usage`スナップショットを重複して持つ。このツールは`message.id`が同じ行を1件目のみ採用し、2件目以降は重複として無視する（[ccusage](https://github.com/ryoppippi/ccusage)も同様にmessage単位で重複除去して集計している）。このため、対象範囲が同じ（同一セッション・同一日など）であればccusageの集計値と一致するはずだが、対象範囲が異なる（このツールは既定で「直近1セッション」のみ、ccusageは「日/月/セッション横断」など集計単位が違う）場合は一致しない点に注意する。

対象セッション中に `Agent` ツールで起動したサブエージェント（`git-committer`・`workspace-auditor`等）がいる場合、その実行結果は完了後に `<セッションID>/subagents/agent-<hash>.jsonl` として永続化される。このツールは `watch`/`report` どちらもこれを自動的に検出して本体のトークン使用量に合算する（`watch`は起動時に既存分を取り込み、以後もポーリングで新規に完了したサブエージェント分を追いかける）。テーブル・HTMLレポートには「エージェント」列として `main` か、サブエージェントの `agentType`（`meta.json`から読み取る。取得できない場合は `subagent`）が表示される。ccusageも `~/.claude/projects/` 配下を再帰的に走査するため、このサブエージェント分もその集計対象に含まれている。

### リアルタイム監視（watch）

```bash
just watch
```

内部では `uv run main.py watch` を実行し、対象セッションのJSONLを末尾から監視して、新しいターン（1回のassistant応答）が追記されるたびに直近ターンの一覧と累計をライブテーブルで表示する。Ctrl+Cで終了する。オプション付きで実行したい場合は直接 `uv run main.py watch --help` を参照する（`just`の可変長引数はクォーティングが崩れやすいため、`watch`/`report`レシピはオプションなし実行専用にしている）。

### HTMLレポート生成（report）

```bash
just report
```

内部では `uv run main.py report` を実行し、対象セッションの全ターンから外部ネットワーク接続なしで開けるスタンドアロンHTMLレポート（`token-usage-report.html`、積み上げ棒グラフ・累計折れ線グラフ・テーブルビュー・ダーク/ライト切替込み）を生成する。オプション付きで実行したい場合は直接 `uv run main.py report --help` を参照する。

`just` を引数なしで実行するとレシピ一覧が確認できる。

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
just cover-lcov    # カバレッジのlcovレポートを生成（Coverage Gutters拡張向け）
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

## 依存の脆弱性検査

[pip-audit](https://pypi.org/project/pip-audit/) で依存パッケージをPyPA Advisory Database/OSVの脆弱性DBと照合する。

```bash
just audit
```

`pip-audit` はプロジェクトの依存（`uv add --dev`）には加えていない。`pip-audit` 自身が持つ依存（`requests`等）がプロジェクト本体の依存解決に巻き込まれてバージョン競合を起こしうるため、`uvx pip-audit`（隔離された使い捨て環境での実行）に、ロック済み依存を一時的に書き出したファイルを渡す形で検査する。プロジェクトの `.venv` には一切触れない。ネットワークアクセス（PyPI JSON APIへの問い合わせ）が必要。

## サプライチェーン攻撃対策

`pyproject.toml` の `[tool.uv]` で `exclude-newer = "7 days"` を設定している。公開から7日未満のパッケージバージョンは解決対象から除外され、悪意あるバージョンが検知・撤回される猶予を確保する。

これは「まだ誰も気づいていない攻撃を待ち時間でやり過ごす」対策であり、「既に報告済みの脆弱性と照合する」上記の `pip-audit` とは目的が異なる。片方がもう片方の代替にはならないため両方を入れている。
