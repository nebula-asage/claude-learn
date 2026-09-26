"""Claude Codeのセッショントランスクリプトからターン毎のトークン使用量を計測・可視化するCLIツール。"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from rich.console import Console
from rich.live import Live
from rich.table import Table

CLAUDE_PROJECTS_DIR = Path.home() / ".claude" / "projects"

# datavizスキルの参照パレット(references/palette.md)のカテゴリカル配色より、
# 4系列(input/output/cache_creation/cache_read)にslot1〜4を固定順で割り当てる。
PALETTE_LIGHT = {
    "input_tokens": "#2a78d6",
    "output_tokens": "#eb6834",
    "cache_creation_input_tokens": "#1baf7a",
    "cache_read_input_tokens": "#eda100",
}
PALETTE_DARK = {
    "input_tokens": "#3987e5",
    "output_tokens": "#d95926",
    "cache_creation_input_tokens": "#199e70",
    "cache_read_input_tokens": "#c98500",
}
SERIES_LABELS = {
    "input_tokens": "input",
    "output_tokens": "output",
    "cache_creation_input_tokens": "cache_creation",
    "cache_read_input_tokens": "cache_read",
}


def encode_project_dir(cwd: Path) -> str:
    """カレントディレクトリのパスを `~/.claude/projects/` 配下のディレクトリ名に変換する。

    Claude Code本体のエンコード方式に合わせ、パス区切り文字 "/" だけでなく "." も
    "-" に置換する（`.claude/worktrees/` 配下のworktreeパスのように "." を含む
    ディレクトリを対象にすると、"/" のみの置換ではエンコード後の名前が一致しない）。

    Args:
        cwd: エンコード対象のディレクトリパス。

    Returns:
        エンコード済みディレクトリ名。
    """
    return str(cwd).replace("/", "-").replace(".", "-")


_MTOK = 1_000_000

# 日付サフィックス付きモデルID(例: "claude-sonnet-4-5-20250929")の末尾を
# 除去して料金テーブルの正規化キーに揃えるための正規表現。
_MODEL_DATE_SUFFIX_RE = re.compile(r"-\d{8}$")


@dataclass(frozen=True)
class ModelPricing:
    """1トークンあたりの料金レート(USD)。platform.claude.com/docs/en/about-claude/pricing 準拠。"""

    input: float
    output: float
    cache_write_5m: float
    cache_read: float


def _pricing(
    input_per_mtok: float,
    output_per_mtok: float,
    cache_write_5m_per_mtok: float,
    cache_read_per_mtok: float,
) -> ModelPricing:
    """1M tokenあたりの公表レートを1トークンあたりのレートに変換する。

    Args:
        input_per_mtok: inputトークンの1M tokenあたりの価格(USD)。
        output_per_mtok: outputトークンの1M tokenあたりの価格(USD)。
        cache_write_5m_per_mtok: 5分キャッシュ書き込みの1M tokenあたりの価格(USD)。
        cache_read_per_mtok: キャッシュ読み取り(ヒット)の1M tokenあたりの価格(USD)。

    Returns:
        1トークンあたりのレートに変換したModelPricing。
    """
    return ModelPricing(
        input=input_per_mtok / _MTOK,
        output=output_per_mtok / _MTOK,
        cache_write_5m=cache_write_5m_per_mtok / _MTOK,
        cache_read=cache_read_per_mtok / _MTOK,
    )


# キーは日付サフィックスを除いたモデルID。cache writeは既定の5分キャッシュの
# レートを使う(Claude Codeのプロンプトキャッシュは5分TTLのため。1時間キャッシュ
# は使われないので未対応)。
MODEL_PRICING: dict[str, ModelPricing] = {
    "claude-fable-5-1": _pricing(10, 50, 12.50, 0.25),
    "claude-mythos-5-1": _pricing(10, 50, 12.50, 0.25),
    "claude-fable-5": _pricing(10, 50, 12.50, 1),
    "claude-mythos-5": _pricing(10, 50, 12.50, 1),
    "claude-opus-5-5": _pricing(4, 20, 5, 0.20),
    "claude-opus-5": _pricing(5, 25, 6.25, 0.50),
    "claude-opus-4-8": _pricing(5, 25, 6.25, 0.50),
    "claude-opus-4-7": _pricing(5, 25, 6.25, 0.50),
    "claude-opus-4-6": _pricing(5, 25, 6.25, 0.50),
    "claude-opus-4-5": _pricing(5, 25, 6.25, 0.50),
    "claude-opus-4-1": _pricing(15, 75, 18.75, 1.50),
    "claude-opus-4": _pricing(15, 75, 18.75, 1.50),
    "claude-sonnet-5": _pricing(2, 10, 2.50, 0.20),
    "claude-sonnet-4-6": _pricing(3, 15, 3.75, 0.30),
    "claude-sonnet-4-5": _pricing(3, 15, 3.75, 0.30),
    "claude-sonnet-4": _pricing(3, 15, 3.75, 0.30),
    "claude-haiku-4-5": _pricing(1, 5, 1.25, 0.10),
    "claude-3-5-haiku": _pricing(0.80, 4, 1, 0.08),
}


def resolve_model_pricing(model: str) -> ModelPricing | None:
    """モデルIDから料金レートを引く。日付サフィックス付きのモデルIDにも対応する。

    Args:
        model: トランスクリプトの`message.model`(例: "claude-sonnet-5"、
            "claude-haiku-4-5-20251001")。

    Returns:
        対応するModelPricing。料金テーブルに無いモデル(未知・廃止モデル等)はNone。
    """
    return MODEL_PRICING.get(_MODEL_DATE_SUFFIX_RE.sub("", model))


@dataclass
class TurnUsage:
    """1ターン(1回のassistant APIレスポンス)分のトークン使用量。"""

    timestamp: str
    model: str
    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: int
    cache_read_input_tokens: int
    source: str = "main"

    @property
    def total_tokens(self) -> int:
        """4種のトークン数を合計した値を返す。

        Returns:
            input/output/cache_creation/cache_readの合計トークン数。
        """
        return (
            self.input_tokens
            + self.output_tokens
            + self.cache_creation_input_tokens
            + self.cache_read_input_tokens
        )

    @property
    def cost_usd(self) -> float | None:
        """4指標を`model`の料金レートで換算したコスト(USD)を返す。

        Returns:
            換算したコスト。`model`が料金テーブルに無い場合はNone。
        """
        pricing = resolve_model_pricing(self.model)
        if pricing is None:
            return None
        return (
            self.input_tokens * pricing.input
            + self.output_tokens * pricing.output
            + self.cache_creation_input_tokens * pricing.cache_write_5m
            + self.cache_read_input_tokens * pricing.cache_read
        )


def _parse_assistant_line(line: str) -> tuple[str, TurnUsage] | None:
    """トランスクリプトJSONLの1行を解析し、メッセージIDとturnの組を抽出する。

    Claude Codeは1回のAPIレスポンス(thinking/text/tool_useなど複数のcontent
    ブロックを含みうる)を複数のJSONL行に分けて書き出すことがある。各行は
    同一の`message.usage`スナップショットを持つことが多いが、`output_tokens`
    等はcontentブロックが確定するまで値が変わり続け、最後に出現した行で
    初めて最終値になる場合がある。そのため`message.id`を添えて返し、呼び出し
    側で同一IDの行は最後に出現したものを採用できるようにする(ccusageも
    同様にmessage単位で重複除去して集計している)。

    Args:
        line: JSONL形式の1行。

    Returns:
        usageを持つassistantメッセージであれば `(message_id, TurnUsage)`。
        `message.id` が取れない場合 `message_id` は空文字列になる。
        条件を満たさない行はNone。
    """
    line = line.strip()
    if not line:
        return None
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        return None
    if obj.get("type") != "assistant":
        return None
    message = obj.get("message")
    if not isinstance(message, dict):
        return None
    usage = message.get("usage")
    if not isinstance(usage, dict):
        return None
    turn = TurnUsage(
        timestamp=obj.get("timestamp", ""),
        model=message.get("model", ""),
        input_tokens=usage.get("input_tokens", 0) or 0,
        output_tokens=usage.get("output_tokens", 0) or 0,
        cache_creation_input_tokens=usage.get("cache_creation_input_tokens", 0) or 0,
        cache_read_input_tokens=usage.get("cache_read_input_tokens", 0) or 0,
    )
    return message.get("id") or "", turn


def parse_turn(line: str) -> TurnUsage | None:
    """トランスクリプトJSONLの1行を解析し、usageを持つassistantターンを抽出する。

    Args:
        line: JSONL形式の1行。

    Returns:
        usageを持つassistantメッセージであればTurnUsage、それ以外はNone。
    """
    parsed = _parse_assistant_line(line)
    return parsed[1] if parsed is not None else None


def _read_turns_with_ids(
    path: Path, source: str = "main"
) -> tuple[list[TurnUsage], dict[str, int]]:
    """トランスクリプトJSONLファイル全体を読み込み、重複除去済みのターン一覧を返す。

    同一の`message.id`を持つ行が複数ある場合、最初に出現した位置を保ったまま
    最後に出現した行のusageで上書きする(thinking/tool_useブロックの時点では
    `output_tokens`等が未確定で、最後のcontentブロックの行で確定するため)。

    Args:
        path: トランスクリプトJSONLファイルのパス。
        source: 各ターンの `TurnUsage.source` に設定する値
            (メインセッションなら `"main"`、サブエージェントなら`agentType`)。

    Returns:
        `(重複除去済みのターン一覧, message.id→turnsでの位置の対応表)`。
        空文字列のmessage_id(`message.id`が取れなかった行)は重複除去の対象
        にしない。
    """
    turns: list[TurnUsage] = []
    index_by_id: dict[str, int] = {}
    with path.open(encoding="utf-8") as f:
        for line in f:
            parsed = _parse_assistant_line(line)
            if parsed is None:
                continue
            message_id, turn = parsed
            turn.source = source
            if message_id:
                if message_id in index_by_id:
                    turns[index_by_id[message_id]] = turn
                    continue
                index_by_id[message_id] = len(turns)
            turns.append(turn)
    return turns, index_by_id


def read_turns(path: Path, source: str = "main") -> list[TurnUsage]:
    """トランスクリプトJSONLファイル全体を読み込み、ターンの一覧を返す。

    同一の `message.id` を持つ行(1回のAPIレスポンスが複数のcontentブロック
    行に分かれて書き出されたもの)は、最初に出現した位置のまま最後に出現した
    行のusageで上書きする。

    Args:
        path: トランスクリプトJSONLファイルのパス。
        source: 各ターンの `TurnUsage.source` に設定する値
            (メインセッションなら `"main"`、サブエージェントなら`agentType`)。

    Returns:
        ファイル中の重複除去済みターンをusageの出現順に並べたリスト。
    """
    turns, _ = _read_turns_with_ids(path, source)
    return turns


def find_subagent_dir(session_path: Path) -> Path:
    """メインセッションJSONLのパスからサブエージェント格納ディレクトリのパスを返す。

    実在するとは限らない。

    Args:
        session_path: メインセッションJSONLファイルのパス。

    Returns:
        `<session_pathと同じディレクトリ>/<session_pathのstem>/subagents/` のパス。
    """
    return session_path.parent / session_path.stem / "subagents"


def _read_agent_type(meta_path: Path) -> str:
    """サブエージェントの `*.meta.json` から `agentType` を読み取る。

    Args:
        meta_path: サブエージェントのトランスクリプトに対応する `.meta.json` のパス。

    Returns:
        `agentType` の値。ファイルが無い・壊れている・キーが空の場合は `"subagent"`。
    """
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return "subagent"
    return meta.get("agentType") or "subagent"


def find_subagent_transcripts(session_path: Path) -> list[Path]:
    """メインセッションに紐づく、完了済みサブエージェントのトランスクリプト一覧を返す。

    Claude Codeは `Agent` ツールで起動したサブエージェントの実行結果を、完了後に
    `<session>/subagents/agent-<hash>.jsonl` として永続化する(実行中は `/tmp`
    配下の一時ファイルにのみ存在し、このディレクトリには現れない)。

    Args:
        session_path: メインセッションJSONLファイルのパス。

    Returns:
        `<session>/subagents/*.jsonl` にマッチするファイルパスの一覧(ファイル名順)。
        ディレクトリが存在しなければ空リスト。
    """
    subagents_dir = find_subagent_dir(session_path)
    if not subagents_dir.is_dir():
        return []
    return sorted(subagents_dir.glob("*.jsonl"))


def _read_all_subagent_turns(session_path: Path) -> list[TurnUsage]:
    """完了済み全サブエージェントのトランスクリプトを読み直し、現時点の全ターンを返す。

    サブエージェントのトランスクリプトは十分小さいため、呼び出しのたびに
    全体を読み直して最新の状態を得る。バイト位置や件数によるインクリメンタル
    な差分検出は、content-block分割行の`output_tokens`確定タイミングと相性が
    悪く(後から確定した値への更新を取りこぼす)採用しない。

    Args:
        session_path: メインセッションJSONLファイルのパス。

    Returns:
        現時点で完了しているサブエージェント全ターンの一覧(ファイル名順)。
        サブエージェントが1つも無ければ空リスト。
    """
    turns: list[TurnUsage] = []
    for jsonl_path in find_subagent_transcripts(session_path):
        agent_type = _read_agent_type(jsonl_path.with_suffix(".meta.json"))
        turns.extend(read_turns(jsonl_path, source=agent_type))
    return turns


def _find_subagent_dirs(session_id: str, known_dirs: set[Path]) -> list[Path]:
    """このセッションIDのサブエージェント格納ディレクトリを、既知の全ロケーションから横断して集める。

    `EnterWorktree`等でカレントディレクトリが変わると、メインJSONLは新しい
    `~/.claude/projects/<encoded-cwd>/`へOSレベルのrenameで移動する(`watch()`
    がメインターンを追い続けられるのは、最初に開いたファイルディスクリプタが
    renameを跨いで同一inodeを指し続けるため)。一方サブエージェントの完了時
    トランスクリプトは、完了した時点のカレントディレクトリ配下に新規作成
    されるため、移動前に完了した分は旧ディレクトリに、移動後に完了した分は
    新ディレクトリに残る。取りこぼしを避けるため、このセッションIDのメイン
    JSONLまたは`<session_id>/subagents/`が(現在または過去に)存在した全
    ディレクトリを毎回横断して探す。

    Args:
        session_id: 対象セッションのID(JSONLファイル名の拡張子抜き)。
        known_dirs: これまでに見つかった`~/.claude/projects/<encoded-cwd>/`の
            集合。呼び出し側がポーリングをまたいで同じ集合を使い回すことで、
            移動済みで現在は該当しなくなった旧ディレクトリも覚え続ける。
            この関数が新たに見つけたディレクトリも追加で書き込む。

    Returns:
        実在する`subagents`ディレクトリの一覧(ソート済み)。
    """
    known_dirs.update(
        m.parent for m in CLAUDE_PROJECTS_DIR.glob(f"*/{session_id}.jsonl")
    )
    known_dirs.update(
        m.parent.parent for m in CLAUDE_PROJECTS_DIR.glob(f"*/{session_id}/subagents")
    )
    return sorted(
        d / session_id / "subagents"
        for d in known_dirs
        if (d / session_id / "subagents").is_dir()
    )


def _read_subagent_turns_from_dirs(subagent_dirs: list[Path]) -> list[TurnUsage]:
    """指定した`subagents`ディレクトリ群から、完了済み全サブエージェントのターンを読み直す。

    Args:
        subagent_dirs: `<session>/subagents/`ディレクトリのパス一覧。

    Returns:
        各ディレクトリの`*.jsonl`から読み取ったターンを、ディレクトリ・
        ファイル名順に連結した一覧。
    """
    turns: list[TurnUsage] = []
    for subagents_dir in subagent_dirs:
        for jsonl_path in sorted(subagents_dir.glob("*.jsonl")):
            agent_type = _read_agent_type(jsonl_path.with_suffix(".meta.json"))
            turns.extend(read_turns(jsonl_path, source=agent_type))
    return turns


def read_all_turns(session_path: Path) -> list[TurnUsage]:
    """メインセッションと完了済み全サブエージェントを合わせ、timestamp昇順で返す。

    ccusageは `~/.claude/projects/` 配下を再帰的に走査して集計しており、
    サブエージェント分のトランスクリプト(`<session>/subagents/agent-*.jsonl`)も
    その対象に含まれる。この関数はそれに合わせて同じ範囲を集計する。

    Args:
        session_path: 対象のメインセッションJSONLファイルのパス。

    Returns:
        メインセッションと全サブエージェントのターンをtimestamp昇順にまとめたリスト。
        各ターンの `source` には `"main"` または `meta.json` の `agentType` が入る。
    """
    turns = read_turns(session_path, source="main")
    turns.extend(_read_all_subagent_turns(session_path))
    turns.sort(key=lambda t: t.timestamp)
    return turns


def find_latest_session_file(project_dir: Path) -> Path:
    """指定ディレクトリ内で最終更新時刻が最も新しいセッションのJSONLファイルを返す。

    Args:
        project_dir: `~/.claude/projects/<encoded-cwd>/` のディレクトリパス。

    Returns:
        最終更新時刻が最も新しい `.jsonl` ファイルのパス。

    Raises:
        FileNotFoundError: `project_dir` が存在しない、または `.jsonl` ファイルが1つも無い場合。
    """
    if not project_dir.is_dir():
        raise FileNotFoundError(f"{project_dir} が見つかりません")
    candidates = sorted(
        project_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True
    )
    if not candidates:
        raise FileNotFoundError(
            f"{project_dir} にセッションログ(.jsonl)が見つかりません"
        )
    return candidates[0]


def find_session_file_by_id(session: str) -> Path:
    """`~/.claude/projects/` 配下を横断してセッションIDに対応するJSONLファイルを探す。

    セッションの実行中に `EnterWorktree` 等でカレントディレクトリが変わると、
    そのセッションのメインJSONLは実際に新しい`~/.claude/projects/<encoded-cwd>/`
    配下へOSレベルのrenameで移動する(旧パスは消える。実機で
    `os.rename`相当の挙動を確認済み)。`--project-dir`を省略して`--session`
    だけを頼りに横断検索すれば、呼び出し側が現在のカレントディレクトリや
    過去の移動履歴を気にする必要がなくなる。

    Args:
        session: 探索対象のセッションID(JSONLファイル名の拡張子抜き)。

    Returns:
        該当するJSONLファイルのパス。

    Raises:
        FileNotFoundError: 該当ファイルが1件も見つからない、または複数見つかった場合。
    """
    matches = sorted(CLAUDE_PROJECTS_DIR.glob(f"*/{session}.jsonl"))
    if not matches:
        raise FileNotFoundError(
            f"セッションID '{session}' に該当するJSONLファイルが"
            f"{CLAUDE_PROJECTS_DIR} 配下に見つかりません"
        )
    if len(matches) > 1:
        candidates = ", ".join(str(m) for m in matches)
        raise FileNotFoundError(
            f"セッションID '{session}' に該当するJSONLファイルが複数見つかりました"
            f"(--project-dirで絞り込んでください): {candidates}"
        )
    return matches[0]


def resolve_session_file(
    file: str | None, session: str | None, project_dir: str | None
) -> Path:
    """コマンドライン引数から監視/集計対象のセッションJSONLファイルを決定する。

    Args:
        file: `--file` で直接指定されたJSONLファイルパス、またはNone。
        session: `--session` で指定されたセッションID、またはNone。
        project_dir: `--project-dir` で指定されたプロジェクトの実ディレクトリパス、
            またはNone。指定時は `~/.claude/projects/<encoded>/` へエンコードした上で
            検索する(既にエンコード済みのディレクトリ名ではない)。

    Returns:
        監視/集計対象のセッションJSONLファイルのパス。
    """
    if file is not None:
        return Path(file)
    if session is not None and project_dir is None:
        return find_session_file_by_id(session)
    target_dir = (
        Path(project_dir).expanduser().resolve()
        if project_dir is not None
        else Path.cwd()
    )
    base_dir = CLAUDE_PROJECTS_DIR / encode_project_dir(target_dir)
    if session is not None:
        return base_dir / f"{session}.jsonl"
    return find_latest_session_file(base_dir)


def _totals(turns: list[TurnUsage]) -> TurnUsage:
    """複数ターンの4指標を合計した仮想的なTurnUsageを返す。

    Args:
        turns: 合計対象のターン一覧。

    Returns:
        timestamp/modelを空にし、4指標を合計したTurnUsage。
    """
    return TurnUsage(
        timestamp="",
        model="",
        input_tokens=sum(t.input_tokens for t in turns),
        output_tokens=sum(t.output_tokens for t in turns),
        cache_creation_input_tokens=sum(t.cache_creation_input_tokens for t in turns),
        cache_read_input_tokens=sum(t.cache_read_input_tokens for t in turns),
    )


def _cost_summary(turns: list[TurnUsage]) -> tuple[float, int]:
    """料金レートが判明しているターンのコストを合計する。

    Args:
        turns: 合計対象のターン一覧。

    Returns:
        `(既知モデルのコスト合計(USD), 料金テーブルに無いモデルを持つターン数)`。
    """
    total = 0.0
    unresolved = 0
    for t in turns:
        cost = t.cost_usd
        if cost is None:
            unresolved += 1
        else:
            total += cost
    return total, unresolved


def _fmt_cost(cost: float | None) -> str:
    """コスト(USD)をUI表示用の文字列に整形する。

    Args:
        cost: USD金額。料金レートが不明なモデルの場合はNone。

    Returns:
        `$0.1234`形式の文字列。Noneの場合は`"-"`。
    """
    return "-" if cost is None else f"${cost:.4f}"


def build_table(turns: list[TurnUsage], last_n: int = 15) -> Table:
    """直近ターンの一覧と累計を1つのテーブルにまとめる。

    Args:
        turns: これまでに観測した全ターン。
        last_n: 表示する直近ターンの件数。

    Returns:
        rich表示用のTableオブジェクト。
    """
    total_cost, unresolved = _cost_summary(turns)
    unresolved_note = f"(内{unresolved}ターンは料金未対応モデル)" if unresolved else ""
    table = Table(
        title=f"Claude Code トークン使用量(ターン別) — 直近{last_n}件 / 累計{len(turns)}ターン"
        f"{unresolved_note}"
    )
    table.add_column("#", justify="right")
    table.add_column("時刻", justify="left")
    table.add_column("エージェント", justify="left")
    table.add_column("モデル", justify="left")
    table.add_column("input", justify="right")
    table.add_column("output", justify="right")
    table.add_column("cache_create", justify="right")
    table.add_column("cache_read", justify="right")
    table.add_column("合計", justify="right", style="bold")
    table.add_column("$", justify="right")

    visible = turns[-last_n:]
    offset = len(turns) - len(visible)
    for i, t in enumerate(visible, start=offset + 1):
        table.add_row(
            str(i),
            t.timestamp,
            t.source,
            t.model,
            f"{t.input_tokens:,}",
            f"{t.output_tokens:,}",
            f"{t.cache_creation_input_tokens:,}",
            f"{t.cache_read_input_tokens:,}",
            f"{t.total_tokens:,}",
            _fmt_cost(t.cost_usd),
        )

    totals = _totals(turns)
    table.add_section()
    table.add_row(
        "累計",
        "",
        "",
        "",
        f"{totals.input_tokens:,}",
        f"{totals.output_tokens:,}",
        f"{totals.cache_creation_input_tokens:,}",
        f"{totals.cache_read_input_tokens:,}",
        f"{totals.total_tokens:,}",
        _fmt_cost(total_cost),
        style="bold cyan",
    )
    return table


def watch(path: Path, poll_interval: float = 0.5, last_n: int = 15) -> None:
    """セッションJSONLを末尾から監視し、ターン毎のトークン使用量をライブ表示する。

    メインセッションの新規行に加え、`<session>/subagents/` 配下に完了済み
    サブエージェントのトランスクリプトが現れた場合もポーリングで取り込む。

    `EnterWorktree`等でカレントディレクトリが変わると、Claude Code本体は
    このセッションのメインJSONLを新しい`~/.claude/projects/<encoded-cwd>/`
    配下へOSレベルのrenameで移動する。メインターンの読み取りは最初に開いた
    ファイルディスクリプタがrenameを跨いで同一inodeを指し続けるため、パスの
    再解決なしに自動で追従できる(実機で確認済み)。サブエージェントの探索
    だけはパス起点のglobのため、起動時のセッションIDを手がかりに
    `_find_subagent_dirs`で全ロケーションを横断して探す。

    Args:
        path: 監視対象のセッションJSONLファイルのパス。
        poll_interval: 新規行が無いときに待機する秒数。
        last_n: 表示する直近ターンの件数。

    Raises:
        SystemExit: `path` が存在しない場合。
    """
    console = Console()
    if not path.exists():
        console.print(f"[red]{path} が見つかりません[/red]")
        raise SystemExit(1)

    session_id = path.stem
    known_dirs: set[Path] = {path.parent}

    main_turns, index_by_id = _read_turns_with_ids(path)
    subagent_turns = _read_subagent_turns_from_dirs(
        _find_subagent_dirs(session_id, known_dirs)
    )

    def combined_turns() -> list[TurnUsage]:
        merged = main_turns + subagent_turns
        merged.sort(key=lambda t: t.timestamp)
        return merged

    console.print(f"[dim]{path} を監視中(Ctrl+Cで終了)[/dim]")
    with path.open(encoding="utf-8") as f:
        f.seek(0, 2)  # 既存行は読み込み済みなので、末尾から追記分だけを追う
        buffer = ""
        move_notice_shown = False
        with Live(
            build_table(combined_turns(), last_n), console=console, refresh_per_second=4
        ) as live:
            try:
                while True:
                    chunk = f.readline()
                    if not chunk:
                        if not move_notice_shown and not path.exists():
                            move_notice_shown = True
                            live.console.print(
                                f"[dim]{path} が見つからなくなりました"
                                "(worktree移動等でリネームされた可能性)。"
                                "開いたままのファイルディスクリプタで"
                                "メインセッションの追跡は継続します[/dim]"
                            )
                        subagent_turns = _read_subagent_turns_from_dirs(
                            _find_subagent_dirs(session_id, known_dirs)
                        )
                        live.update(build_table(combined_turns(), last_n))
                        time.sleep(poll_interval)
                        continue
                    buffer += chunk
                    if not buffer.endswith("\n"):
                        continue  # 書き込み途中の行は次回分と結合して再解析する
                    parsed = _parse_assistant_line(buffer)
                    buffer = ""
                    if parsed is None:
                        continue
                    message_id, turn = parsed
                    if message_id and message_id in index_by_id:
                        main_turns[index_by_id[message_id]] = turn
                    else:
                        if message_id:
                            index_by_id[message_id] = len(main_turns)
                        main_turns.append(turn)
                    live.update(build_table(combined_turns(), last_n))
            except KeyboardInterrupt:
                pass


def _fmt_int(n: int) -> str:
    """整数を桁区切りカンマ付きの文字列に整形する。

    Args:
        n: 整形対象の整数。

    Returns:
        3桁区切りカンマ付きの文字列。
    """
    return f"{n:,}"


def render_report(turns: list[TurnUsage], title: str) -> str:
    """ターン一覧から単体で開けるスタンドアロンHTMLレポートを生成する。

    Args:
        turns: レポート対象の全ターン。
        title: レポートの見出しに使うセッション名。

    Returns:
        外部ネットワーク接続なしで開けるHTML文字列。
    """
    totals = _totals(turns)
    total_cost, unresolved_cost_count = _cost_summary(turns)
    series_keys = list(SERIES_LABELS.keys())
    data = [
        {
            "index": i + 1,
            "timestamp": t.timestamp,
            "source": t.source,
            "model": t.model,
            **{k: getattr(t, k) for k in series_keys},
            "total": t.total_tokens,
            "cumulative": sum(getattr(x, "total_tokens") for x in turns[: i + 1]),
            "cost": t.cost_usd,
        }
        for i, t in enumerate(turns)
    ]
    subagent_turn_count = sum(1 for t in turns if t.source != "main")
    subagent_note = (
        f"(うちサブエージェント分 {subagent_turn_count} ターン)"
        if subagent_turn_count
        else ""
    )
    cost_note = (
        f"(内{unresolved_cost_count}ターンは料金未対応モデルのため未集計)"
        if unresolved_cost_count
        else ""
    )
    data_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    series_json = json.dumps(
        [{"key": k, "label": SERIES_LABELS[k]} for k in series_keys],
        ensure_ascii=False,
    )
    palette_light_json = json.dumps(PALETTE_LIGHT)
    palette_dark_json = json.dumps(PALETTE_DARK)

    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude Code トークン使用量レポート — {_escape(title)}</title>
<style>
  :root {{
    color-scheme: light;
  }}
  .viz-root {{
    --surface-1: #fcfcfb;
    --page-plane: #f9f9f7;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #898781;
    --gridline: #e1e0d9;
    --baseline: #c3c2b7;
    --border: rgba(11,11,11,0.10);
  }}
  @media (prefers-color-scheme: dark) {{
    :root:where(:not([data-theme="light"])) .viz-root {{
      --surface-1: #1a1a19;
      --page-plane: #0d0d0d;
      --text-primary: #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted: #898781;
      --gridline: #2c2c2a;
      --baseline: #383835;
      --border: rgba(255,255,255,0.10);
    }}
  }}
  :root[data-theme="dark"] .viz-root {{
    --surface-1: #1a1a19;
    --page-plane: #0d0d0d;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #898781;
    --gridline: #2c2c2a;
    --baseline: #383835;
    --border: rgba(255,255,255,0.10);
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--page-plane);
    color: var(--text-primary);
  }}
  .page {{ max-width: 1100px; margin: 0 auto; padding: 32px 24px 64px; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  .subtitle {{ color: var(--text-secondary); font-size: 13px; margin: 0 0 24px; }}
  .toolbar {{ display: flex; gap: 8px; margin-bottom: 20px; }}
  .toolbar button {{
    font: inherit; font-size: 12px; padding: 6px 12px; border-radius: 6px;
    border: 1px solid var(--border); background: var(--surface-1); color: var(--text-primary);
    cursor: pointer;
  }}
  .kpi-row {{ display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }}
  .kpi {{
    flex: 1 1 160px; background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px;
  }}
  .kpi .label {{ font-size: 12px; color: var(--text-secondary); }}
  .kpi .value {{ font-size: 24px; font-weight: 600; margin-top: 4px; }}
  .card {{
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px;
    padding: 20px; margin-bottom: 24px; overflow-x: auto;
  }}
  .card h2 {{ font-size: 14px; margin: 0 0 4px; }}
  .card .desc {{ font-size: 12px; color: var(--text-secondary); margin: 0 0 16px; }}
  .legend {{ display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; font-size: 12px; color: var(--text-secondary); }}
  .legend .item {{ display: flex; align-items: center; gap: 6px; }}
  .legend .swatch {{ width: 10px; height: 10px; border-radius: 2px; display: inline-block; }}
  svg text {{ fill: var(--text-secondary); font-size: 11px; }}
  svg .axis {{ stroke: var(--baseline); stroke-width: 1; }}
  svg .grid {{ stroke: var(--gridline); stroke-width: 1; }}
  .hit-target {{ cursor: pointer; }}
  .tooltip {{
    position: fixed; pointer-events: none; z-index: 10; display: none;
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 10px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    color: var(--text-primary);
  }}
  .tooltip .row {{ display: flex; align-items: center; gap: 6px; justify-content: space-between; gap: 16px; }}
  .tooltip .key {{ display: inline-block; width: 10px; height: 2px; border-radius: 1px; }}
  .tooltip .val {{ font-weight: 600; }}
  table.data-table {{ border-collapse: collapse; width: 100%; font-size: 12px; }}
  table.data-table th, table.data-table td {{
    text-align: right; padding: 4px 8px; border-bottom: 1px solid var(--gridline);
    font-variant-numeric: tabular-nums;
  }}
  table.data-table th:first-child, table.data-table td:first-child,
  table.data-table th:nth-child(2), table.data-table td:nth-child(2),
  table.data-table th:nth-child(3), table.data-table td:nth-child(3),
  table.data-table th:nth-child(4), table.data-table td:nth-child(4) {{ text-align: left; }}
  table.data-table thead th {{ color: var(--text-secondary); font-weight: 500; }}
  #table-section {{ display: none; }}
</style>
</head>
<body>
<div class="viz-root">
<div class="page">
  <h1>Claude Code トークン使用量レポート</h1>
  <p class="subtitle">セッション: {_escape(title)} ／ 全 {len(turns)} ターン{subagent_note}</p>

  <div class="toolbar">
    <button id="theme-toggle" type="button">ダーク/ライト切替</button>
    <button id="table-toggle" type="button">テーブル表示切替</button>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="label">input(累計)</div><div class="value">{_fmt_int(totals.input_tokens)}</div></div>
    <div class="kpi"><div class="label">output(累計)</div><div class="value">{_fmt_int(totals.output_tokens)}</div></div>
    <div class="kpi"><div class="label">cache_creation(累計)</div><div class="value">{_fmt_int(totals.cache_creation_input_tokens)}</div></div>
    <div class="kpi"><div class="label">cache_read(累計)</div><div class="value">{_fmt_int(totals.cache_read_input_tokens)}</div></div>
    <div class="kpi"><div class="label">合計(累計)</div><div class="value">{_fmt_int(totals.total_tokens)}</div></div>
    <div class="kpi"><div class="label">コスト($・累計){_escape(cost_note)}</div><div class="value">{_fmt_cost(total_cost)}</div></div>
  </div>

  <div class="card">
    <h2>ターン別トークン内訳</h2>
    <p class="desc">1ターン(1回のassistant応答)ごとの4指標を積み上げ棒で表示。直近ターンのみ内訳を直接ラベル表示し、それ以外はホバーで確認できる。</p>
    <div class="legend" id="stack-legend"></div>
    <svg id="stack-chart"></svg>
  </div>

  <div class="card">
    <h2>累計トークン数の推移</h2>
    <p class="desc">ターンを追うごとの累計トークン数(4指標の合計)。</p>
    <svg id="line-chart"></svg>
  </div>

  <div class="card" id="table-section">
    <h2>全ターン一覧(テーブル)</h2>
    <table class="data-table" id="data-table"></table>
  </div>
</div>
</div>
<div class="tooltip" id="tooltip"></div>
<script>
(function () {{
  "use strict";
  var DATA = {data_json};
  var SERIES = {series_json};
  var PALETTE_LIGHT = {palette_light_json};
  var PALETTE_DARK = {palette_dark_json};
  var CUMULATIVE_LIGHT = "#2a78d6";
  var CUMULATIVE_DARK = "#3987e5";

  function isDark() {{
    var stamp = document.documentElement.getAttribute("data-theme");
    if (stamp === "dark") return true;
    if (stamp === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }}

  function palette() {{
    return isDark() ? PALETTE_DARK : PALETTE_LIGHT;
  }}

  function cumulativeHue() {{
    return isDark() ? CUMULATIVE_DARK : CUMULATIVE_LIGHT;
  }}

  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs) {{
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }}

  var tooltip = document.getElementById("tooltip");
  function showTooltip(evt, rows) {{
    tooltip.innerHTML = "";
    rows.forEach(function (r) {{
      var row = document.createElement("div");
      row.className = "row";
      var left = document.createElement("span");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "6px";
      if (r.color) {{
        var key = document.createElement("span");
        key.className = "key";
        key.style.background = r.color;
        left.appendChild(key);
      }}
      var label = document.createElement("span");
      label.textContent = r.label;
      left.appendChild(label);
      var val = document.createElement("span");
      val.className = "val";
      val.textContent = r.value;
      row.appendChild(left);
      row.appendChild(val);
      tooltip.appendChild(row);
    }});
    tooltip.style.display = "block";
    tooltip.style.left = (evt.clientX + 14) + "px";
    tooltip.style.top = (evt.clientY + 14) + "px";
  }}
  function hideTooltip() {{
    tooltip.style.display = "none";
  }}

  function fmt(n) {{
    return n.toLocaleString("ja-JP");
  }}

  function fmtCost(v) {{
    return v === null || v === undefined ? "-" : "$" + v.toFixed(4);
  }}

  function drawStackChart() {{
    var svg = document.getElementById("stack-chart");
    svg.innerHTML = "";
    var legend = document.getElementById("stack-legend");
    legend.innerHTML = "";
    var pal = palette();

    SERIES.forEach(function (s) {{
      var item = document.createElement("span");
      item.className = "item";
      var sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = pal[s.key];
      item.appendChild(sw);
      var lb = document.createElement("span");
      lb.textContent = s.label;
      item.appendChild(lb);
      legend.appendChild(item);
    }});

    if (DATA.length === 0) {{
      svg.setAttribute("viewBox", "0 0 400 60");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "60");
      var t = el("text", {{x: 8, y: 30}});
      t.textContent = "データがありません";
      svg.appendChild(t);
      return;
    }}

    var barW = 20, gap = 6, topPad = 16, bottomPad = 32;
    var maxTotal = Math.max.apply(null, DATA.map(function (d) {{ return d.total; }}));
    if (maxTotal <= 0) maxTotal = 1;
    // 目盛/cap直接ラベルの最大文字幅からleftPad/rightPadを算出する(固定値だと桁数の多い値が端で切れる)
    var leftPad = Math.max(40, fmt(maxTotal).length * 7 + 16);
    var rightPad = Math.max(16, fmt(maxTotal).length * 4 + 8);
    var chartH = 260;
    var innerH = chartH - topPad - bottomPad;
    var innerW = DATA.length * (barW + gap);
    var width = leftPad + innerW + rightPad;
    svg.setAttribute("viewBox", "0 0 " + width + " " + chartH);
    svg.setAttribute("width", Math.max(width, 400));
    svg.setAttribute("height", chartH);

    // 目盛(0 / 中間 / 最大, 綺麗な数に丸める)
    var ticks = [0, 0.5, 1].map(function (r) {{ return Math.round(maxTotal * r); }});
    ticks.forEach(function (v) {{
      var y = topPad + innerH - (v / maxTotal) * innerH;
      svg.appendChild(el("line", {{
        x1: leftPad, x2: leftPad + innerW, y1: y, y2: y, "class": "grid",
      }}));
      var tx = el("text", {{x: leftPad - 8, y: y + 4, "text-anchor": "end"}});
      tx.textContent = fmt(v);
      svg.appendChild(tx);
    }});
    svg.appendChild(el("line", {{
      x1: leftPad, x2: leftPad + innerW, y1: topPad + innerH, y2: topPad + innerH, "class": "axis",
    }}));

    var gapPx = 2; // dataviz: セグメント間・隣接バー間の一定幅サーフェスギャップ
    var minLabelH = 16; // これより低いセグメントは文字が収まらないため内部ラベルを省略する
    DATA.forEach(function (d, i) {{
      var x = leftPad + i * (barW + gap);
      var y = topPad + innerH;
      var isLast = i === DATA.length - 1;
      var g = el("g", {{"class": "hit-target"}});
      SERIES.forEach(function (s, si) {{
        var v = d[s.key];
        var h = (v / maxTotal) * innerH;
        if (h <= 0) return;
        var segY = y - h;
        var segH = Math.max(h - gapPx, 0);
        var rect = el("rect", {{
          x: x, y: segY, width: barW, height: segH,
          fill: pal[s.key], rx: si === SERIES.length - 1 ? 4 : 0, ry: si === SERIES.length - 1 ? 4 : 0,
        }});
        g.appendChild(rect);
        // 直近ターンのみ、セグメントに文字が収まる場合に限り内部へ白文字でラベル表示
        // (収まらない場合は省略しツールチップ+テーブルに委ねる。dataviz: 数字は選択的に)
        if (isLast && segH >= minLabelH) {{
          var lt = el("text", {{
            x: x + barW / 2, y: segY + segH / 2 + 4, "text-anchor": "middle", fill: "#ffffff",
          }});
          lt.textContent = fmt(v);
          g.appendChild(lt);
        }}
        y = segY;
      }});
      // 直近ターンのバー上端(cap)に合計値を直接ラベル表示
      if (isLast) {{
        var capLabel = el("text", {{x: x + barW / 2, y: y - 6, "text-anchor": "middle"}});
        capLabel.textContent = fmt(d.total);
        g.appendChild(capLabel);
      }}
      g.addEventListener("pointermove", function (evt) {{
        var rows = SERIES.map(function (s) {{
          return {{label: s.label, value: fmt(d[s.key]), color: pal[s.key]}};
        }});
        rows.push({{label: "合計", value: fmt(d.total)}});
        rows.push({{label: "コスト($)", value: fmtCost(d.cost)}});
        var header = "ターン#" + d.index + "  " + (d.timestamp || "");
        if (d.source && d.source !== "main") header += "  [" + d.source + "]";
        rows.unshift({{label: header, value: ""}});
        showTooltip(evt, rows);
      }});
      g.addEventListener("pointerleave", hideTooltip);
      svg.appendChild(g);
    }});

    // x軸ラベル(最初と最後のターンのみ)
    [0, DATA.length - 1].forEach(function (idx) {{
      if (idx < 0) return;
      var x = leftPad + idx * (barW + gap) + barW / 2;
      var tx = el("text", {{x: x, y: chartH - bottomPad + 16, "text-anchor": "middle"}});
      tx.textContent = "#" + DATA[idx].index;
      svg.appendChild(tx);
    }});
  }}

  function drawLineChart() {{
    var svg = document.getElementById("line-chart");
    svg.innerHTML = "";

    if (DATA.length === 0) {{
      svg.setAttribute("viewBox", "0 0 400 60");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "60");
      return;
    }}

    var topPad = 16, bottomPad = 32;
    var chartH = 220;
    var innerH = chartH - topPad - bottomPad;
    // 累計は全体の推移を一目で見せるのが目的なので、ターン数に関わらずカード幅に収める
    // (ターンごとに横幅を伸ばす積み上げ棒グラフとは異なり、横スクロールにしない)
    var innerW = 900;

    var maxCum = Math.max.apply(null, DATA.map(function (d) {{ return d.cumulative; }}));
    if (maxCum <= 0) maxCum = 1;
    // 目盛/終端直接ラベルの最大文字幅からleftPad/rightPadを算出する(固定値だと桁数の多い値が端で切れる)
    var leftPad = Math.max(40, fmt(maxCum).length * 7 + 16);
    var rightPad = Math.max(16, fmt(maxCum).length * 7 + 16);
    var width = leftPad + innerW + rightPad;
    svg.setAttribute("viewBox", "0 0 " + width + " " + chartH);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";

    var stepX = DATA.length > 1 ? innerW / (DATA.length - 1) : 0;

    var ticks = [0, 0.5, 1].map(function (r) {{ return Math.round(maxCum * r); }});
    ticks.forEach(function (v) {{
      var y = topPad + innerH - (v / maxCum) * innerH;
      svg.appendChild(el("line", {{x1: leftPad, x2: leftPad + innerW, y1: y, y2: y, "class": "grid"}}));
      var tx = el("text", {{x: leftPad - 8, y: y + 4, "text-anchor": "end"}});
      tx.textContent = fmt(v);
      svg.appendChild(tx);
    }});
    svg.appendChild(el("line", {{x1: leftPad, x2: leftPad + innerW, y1: topPad + innerH, y2: topPad + innerH, "class": "axis"}}));

    var hue = cumulativeHue();
    var points = DATA.map(function (d, i) {{
      var x = leftPad + i * stepX;
      var y = topPad + innerH - (d.cumulative / maxCum) * innerH;
      return [x, y];
    }});
    var pathD = points.map(function (p, i) {{ return (i === 0 ? "M" : "L") + p[0] + " " + p[1]; }}).join(" ");
    svg.appendChild(el("path", {{d: pathD, fill: "none", stroke: hue, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"}}));

    points.forEach(function (p, i) {{
      var d = DATA[i];
      var dot = el("circle", {{cx: p[0], cy: p[1], r: 4, fill: hue, stroke: "var(--surface-1)", "stroke-width": 2}});
      var hit = el("circle", {{cx: p[0], cy: p[1], r: 12, fill: "transparent", "class": "hit-target"}});
      hit.addEventListener("pointermove", function (evt) {{
        var header = "ターン#" + d.index + "  " + (d.timestamp || "");
        if (d.source && d.source !== "main") header += "  [" + d.source + "]";
        showTooltip(evt, [
          {{label: header, value: ""}},
          {{label: "累計トークン", value: fmt(d.cumulative), color: hue}},
        ]);
      }});
      hit.addEventListener("pointerleave", hideTooltip);
      svg.appendChild(dot);
      svg.appendChild(hit);
    }});

    // 終端に直接ラベル(dataviz: lineはendに値をラベル)
    var last = points[points.length - 1];
    var lt = el("text", {{x: last[0] + 8, y: last[1] + 4}});
    lt.textContent = fmt(DATA[DATA.length - 1].cumulative);
    svg.appendChild(lt);
  }}

  function buildTable() {{
    var table = document.getElementById("data-table");
    table.innerHTML = "";
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    ["#", "時刻", "エージェント", "モデル", "input", "output", "cache_creation", "cache_read", "合計", "累計", "コスト($)"].forEach(function (h) {{
      var th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    }});
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    DATA.forEach(function (d) {{
      var tr = document.createElement("tr");
      [d.index, d.timestamp, d.source, d.model, fmt(d.input_tokens), fmt(d.output_tokens),
       fmt(d.cache_creation_input_tokens), fmt(d.cache_read_input_tokens), fmt(d.total), fmt(d.cumulative),
       fmtCost(d.cost)]
        .forEach(function (v) {{
          var td = document.createElement("td");
          td.textContent = v;
          tr.appendChild(td);
        }});
      tbody.appendChild(tr);
    }});
    table.appendChild(tbody);
  }}

  function renderAll() {{
    drawStackChart();
    drawLineChart();
    // 積み上げ棒グラフは横スクロールで詳細を追う設計のため、初期表示は最新ターン(右端)を見せる
    var stackScroller = document.getElementById("stack-chart").parentElement;
    if (stackScroller) stackScroller.scrollLeft = stackScroller.scrollWidth;
  }}

  document.getElementById("theme-toggle").addEventListener("click", function () {{
    var cur = document.documentElement.getAttribute("data-theme");
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    renderAll();
  }});
  document.getElementById("table-toggle").addEventListener("click", function () {{
    var sec = document.getElementById("table-section");
    sec.style.display = sec.style.display === "none" || !sec.style.display ? "block" : "none";
  }});

  buildTable();
  renderAll();
}})();
</script>
</body>
</html>
"""


def _escape(s: str) -> str:
    """HTML本文中で安全な文字列にエスケープする。

    Args:
        s: エスケープ対象の文字列。

    Returns:
        `&`/`<`/`>`/`"` をエスケープ済みの文字列。
    """
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def report(path: Path, output: Path) -> None:
    """セッションJSONLを読み込み、スタンドアロンHTMLレポートを生成する。

    メインセッションに加え、完了済みサブエージェントのトランスクリプト
    (`<session>/subagents/agent-*.jsonl`)も合わせて集計する。

    Args:
        path: 集計対象のセッションJSONLファイルのパス。
        output: 生成したHTMLの出力先パス。

    Raises:
        SystemExit: `path` が存在しない場合。
    """
    console = Console()
    if not path.exists():
        console.print(f"[red]{path} が見つかりません[/red]")
        raise SystemExit(1)
    turns = read_all_turns(path)
    html = render_report(turns, title=path.stem)
    output.write_text(html, encoding="utf-8")
    console.print(
        f"[green]{output} に {len(turns)} ターン分のレポートを生成しました[/green]"
    )


def build_arg_parser() -> argparse.ArgumentParser:
    """CLIの引数パーサを構築する。

    Returns:
        `watch`/`report` サブコマンドを持つ ArgumentParser。
    """
    parser = argparse.ArgumentParser(
        prog="claude-token-monitor",
        description="Claude Codeのセッショントランスクリプトからターン毎のトークン使用量を計測・可視化する。",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--file", help="監視/集計対象のJSONLファイルを直接指定する")
    common.add_argument(
        "--session",
        help="セッションID(JSONLファイル名の拡張子抜き)を指定する"
        "(`--project-dir`を省略した場合は`~/.claude/projects/`配下を横断検索するため、"
        "セッション中にカレントディレクトリが変わっても追跡できる)",
    )
    common.add_argument(
        "--project-dir",
        help="カレントディレクトリの代わりに使う対象プロジェクトの実ディレクトリパスを指定する"
        "(`~/.claude/projects/<encoded>/` へのエンコードは自動で行う)",
    )

    watch_parser = subparsers.add_parser(
        "watch",
        parents=[common],
        help="セッションログをリアルタイムで監視し、ターン毎の使用量を表示する",
    )
    watch_parser.add_argument(
        "--last-n", type=int, default=15, help="表示する直近ターンの件数(既定15)"
    )
    watch_parser.add_argument(
        "--interval",
        type=float,
        default=0.5,
        help="新規行が無いときのポーリング間隔秒(既定0.5)",
    )

    report_parser = subparsers.add_parser(
        "report", parents=[common], help="セッションログ全体からHTMLレポートを生成する"
    )
    report_parser.add_argument(
        "--output",
        default="token-usage-report.html",
        help="出力先HTMLファイルパス(既定 token-usage-report.html)",
    )

    return parser


def main() -> None:
    """エントリーポイント。サブコマンドを解釈してwatch/reportを実行する。

    Raises:
        SystemExit: 対象セッションログが解決できない場合。
    """
    parser = build_arg_parser()
    args = parser.parse_args()

    try:
        path = resolve_session_file(args.file, args.session, args.project_dir)
    except FileNotFoundError as e:
        print(f"エラー: {e}", file=sys.stderr)
        raise SystemExit(1) from e

    if args.command == "watch":
        watch(path, poll_interval=args.interval, last_n=args.last_n)
    elif args.command == "report":
        report(path, Path(args.output))


if __name__ == "__main__":
    main()  # pragma: no cover
