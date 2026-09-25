# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このプロジェクトについて

Claude Codeのセッショントランスクリプト（`~/.claude/projects/<project>/<session-id>.jsonl`）から、ターン（assistantメッセージ）毎のinput/output/cache_creation/cache_readトークン数を読み取り、計測・可視化するCLIツール。`main.py`単一ファイルで完結する。パッケージ管理・実行は[uv](https://docs.astral.sh/uv/)前提。

## よく使うコマンド

```bash
uv sync              # 依存関係の同期（pyproject.toml変更後に実行）
just watch            # 対象セッションをリアルタイム監視（uv run main.py watch）
just report           # 対象セッションからHTMLレポートを生成（uv run main.py report）
just fmt / fmt-check  # ruff format / ruff format --check
just lint             # ruff check .（docstring必須化・DOC引数名検証も含む）
just test             # uv run pytest
just cover            # カバレッジ計測（未カバー行を表示）
just cover-html       # カバレッジHTMLレポート（htmlcov/index.html）
just doc              # pdocでAPIドキュメント生成（apidocs/）
just audit            # uvx pip-audit経由で依存の脆弱性検査
just markdownlint     # pnpx markdownlint-cli2でMarkdownをlint
```

単体テストを1件だけ実行する場合:

```bash
uv run pytest tests/test_main.py::test_read_turns_uses_final_occurrence_when_usage_differs_across_duplicate_ids -v
```

`watch`/`report`ともオプション付きで実行したい場合は`just`を経由せず直接`uv run main.py watch --help` / `uv run main.py report --help`を参照する（`just`の可変長引数はクォーティングが崩れやすいため、`watch`/`report`レシピはオプションなし実行専用にしている）。

## アーキテクチャ

`resolve_session_file()`が`--file`/`--session`/`--project-dir`/カレントディレクトリから対象セッションJSONLのパスを決定し（既定は`~/.claude/projects/<encoded-cwd>/`配下で最終更新時刻が最も新しいもの）、`watch`/`report`はどちらもこれを起点に共通のコア関数群を共有する。

- **`_parse_assistant_line`/`_read_turns_with_ids`**: 1行ずつ解析して`TurnUsage`を構築する。**重要な不変条件**: 同一`message.id`を持つ行（1回のAPIレスポンスがthinking/text/tool_use等の複数contentブロック行に分かれて書き出されたもの）が複数出現した場合、最初に出現した「位置」を保ったまま、必ず**最後に出現した行のusageで上書きする**（先頭行ではない）。理由は、thinking/tool_useブロックの時点では`output_tokens`等が未確定で、最後のcontentブロックの行で初めて最終値になる場合があるため。この前提を崩す変更（先頭行優先に戻す、件数/バイトオフセットの増分差分だけを拾う実装に戻すなど）は、後から確定する値を静かに取りこぼす回帰につながる（実際に一度このバグで発生し、下記の「動作確認」の手順で発覚した）。
- **サブエージェント集計**（`find_subagent_transcripts`/`_read_agent_type`/`_read_all_subagent_turns`/`read_all_turns`）: `Agent`ツールで起動したサブエージェントの実行結果は、完了後に`<session>/subagents/agent-<hash>.jsonl`（対になる`.meta.json`に`agentType`）として永続化される。`read_all_turns()`はメインセッションとこれを合算しtimestamp昇順に整列する。サブエージェント側は毎回ディレクトリを全体読み直しする実装で、件数ベースの差分ポーリングは採用していない（上記の「後から確定」問題と相性が悪く、更新を取りこぼすため）。
- **`watch()`**: メインJSONLを`readline`でtailし、新規行が無い間隔でサブエージェント分もポーリングして合算する。ライブ更新中の重複行判定にも上記と同じ「最後を採用」ロジックを使う。
- **`report()`**: `read_all_turns()`を1回読み込み、`render_report()`で外部ネットワーク接続不要な単一HTML（インラインSVGチャート+素のJS、ダーク/ライト切替込み）を生成する。配色は`dataviz`スキルの参照パレットに準拠（`PALETTE_LIGHT`/`PALETTE_DARK`）。

## 動作確認

集計ロジック（重複除去・サブエージェント合算など）に変更を加えたときは、テスト・lintが通るだけでなく、**[ccusage](https://github.com/ryoppippi/ccusage)の集計結果との差分が無いことを実データで確認する**こと。ユニットテストだけでは「実際のトランスクリプトの生データに対して正しいか」までは保証されない（`message.id`重複除去を誤って「先頭行優先」にしていたバグは、テストではなくccusageとの突き合わせで初めて発覚した）。

確認手順（**進行中でない、確定済みのセッション**を対象にすること。ライブで書き込み中のセッションを対象にすると、2つのコマンドの実行タイミングがずれて差分が生じる。また、worktree内で作業している場合は現在のセッション自身のトランスクリプトの格納先がcwdに応じて移動していることがあるため、対象には自分自身のライブセッションではなく別の確定済みセッションを選ぶ）:

```bash
uv run main.py report --file ~/.claude/projects/<encoded-project>/<session-id>.jsonl --output /tmp/report.html
ccusage session --id <session-id> --json
```

生成された`report.html`内に埋め込まれた`DATA`配列（各ターンのinput/output/cache_creation/cache_read）の合計と、ccusageの`entries`配列の`inputTokens`/`outputTokens`/`cacheCreationTokens`/`cacheReadTokens`の合計を突き合わせ、件数・4指標すべて差分0であることを確認する。
