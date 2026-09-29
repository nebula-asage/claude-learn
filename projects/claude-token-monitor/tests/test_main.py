import csv
import io
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pytest
from rich.console import Console

import main
from main import (
    TurnUsage,
    _cost_summary,
    _fallback_timestamp,
    _find_subagent_dirs,
    _fmt_cost,
    _read_agent_type,
    _read_all_subagent_turns,
    _read_subagent_turns_from_dirs,
    _totals,
    build_sessions_table,
    build_table,
    encode_project_dir,
    find_latest_session_file,
    find_session_file_by_id,
    find_subagent_dir,
    find_subagent_transcripts,
    list_all_session_files,
    list_session_files,
    list_session_summaries,
    parse_turn,
    read_all_turns,
    read_turns,
    render_report,
    resolve_model_pricing,
    resolve_project_dir,
    resolve_session_file,
    sessions_command,
    summarize_session,
)


def _render(table) -> str:
    console = Console(file=io.StringIO(), width=200)
    console.print(table)
    return console.file.getvalue()


def _assistant_line(
    input_tokens: int = 1,
    output_tokens: int = 2,
    cache_creation_input_tokens: int = 3,
    cache_read_input_tokens: int = 4,
    timestamp: str = "2026-09-17T00:00:00.000Z",
    model: str = "claude-sonnet-5",
    message_id: str = "",
    cache_creation_1h_input_tokens: int | None = None,
) -> str:
    usage = {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_creation_input_tokens": cache_creation_input_tokens,
        "cache_read_input_tokens": cache_read_input_tokens,
    }
    if cache_creation_1h_input_tokens is not None:
        usage["cache_creation"] = {
            "ephemeral_5m_input_tokens": cache_creation_input_tokens
            - cache_creation_1h_input_tokens,
            "ephemeral_1h_input_tokens": cache_creation_1h_input_tokens,
        }
    return json.dumps(
        {
            "type": "assistant",
            "timestamp": timestamp,
            "message": {
                "id": message_id,
                "model": model,
                "usage": usage,
            },
        }
    )


def test_parse_turn_extracts_usage_from_assistant_message() -> None:
    turn = parse_turn(_assistant_line(input_tokens=10, output_tokens=20))

    assert turn is not None
    assert turn.input_tokens == 10
    assert turn.output_tokens == 20
    assert turn.total_tokens == 10 + 20 + 3 + 4


def test_parse_turn_ignores_non_assistant_lines() -> None:
    line = json.dumps({"type": "user", "message": {"content": "hi"}})

    assert parse_turn(line) is None


def test_parse_turn_ignores_assistant_message_without_usage() -> None:
    line = json.dumps({"type": "assistant", "message": {"model": "x"}})

    assert parse_turn(line) is None


def test_parse_turn_ignores_assistant_line_with_non_dict_message() -> None:
    line = json.dumps({"type": "assistant", "message": "not-a-dict"})

    assert parse_turn(line) is None


def test_parse_turn_ignores_assistant_line_missing_message() -> None:
    line = json.dumps({"type": "assistant"})

    assert parse_turn(line) is None


def test_parse_turn_ignores_malformed_json() -> None:
    assert parse_turn("{not valid json") is None


def test_parse_turn_ignores_blank_line() -> None:
    assert parse_turn("   \n") is None


def test_read_turns_skips_non_usage_lines(tmp_path: Path) -> None:
    log = tmp_path / "session.jsonl"
    log.write_text(
        "\n".join(
            [
                _assistant_line(input_tokens=1),
                json.dumps({"type": "user", "message": {}}),
                _assistant_line(input_tokens=2),
                "",
            ]
        ),
        encoding="utf-8",
    )

    turns = read_turns(log)

    assert [t.input_tokens for t in turns] == [1, 2]


def test_read_turns_deduplicates_lines_sharing_message_id(tmp_path: Path) -> None:
    """1回のAPIレスポンスがthinking/text/tool_use等の複数行に分割され、各行が
    同一usageスナップショットを持つ場合でも二重集計しないことを確認する
    (ccusageと同様にmessage.id単位で重複除去する)。"""
    log = tmp_path / "session.jsonl"
    log.write_text(
        "\n".join(
            [
                _assistant_line(input_tokens=10, message_id="msg_1"),
                _assistant_line(input_tokens=10, message_id="msg_1"),
                _assistant_line(input_tokens=10, message_id="msg_1"),
                _assistant_line(input_tokens=20, message_id="msg_2"),
                "",
            ]
        ),
        encoding="utf-8",
    )

    turns = read_turns(log)

    assert [t.input_tokens for t in turns] == [10, 20]


def test_read_turns_uses_final_occurrence_when_usage_differs_across_duplicate_ids(
    tmp_path: Path,
) -> None:
    """thinking/tool_useブロックの時点ではoutput_tokens等が未確定で、最後の
    contentブロックの行で確定する場合がある(実際にAgentツールのサブエージェント
    出力で観測された)。この場合、最後に出現した行のusageを採用しないと
    ccusageの集計値より少なく数えてしまう。"""
    log = tmp_path / "session.jsonl"
    log.write_text(
        "\n".join(
            [
                _assistant_line(output_tokens=1, message_id="msg_1"),
                _assistant_line(output_tokens=330, message_id="msg_1"),
                "",
            ]
        ),
        encoding="utf-8",
    )

    turns = read_turns(log)

    assert [t.output_tokens for t in turns] == [330]


def test_read_turns_keeps_original_position_when_id_repeats_later(
    tmp_path: Path,
) -> None:
    """同一message_idの行が離れた位置で再出現しても、ターンの並び順は最初に
    出現した位置のまま(値だけ最後の行で上書きされる)ことを確認する。"""
    log = tmp_path / "session.jsonl"
    log.write_text(
        "\n".join(
            [
                _assistant_line(input_tokens=1, message_id="msg_1"),
                _assistant_line(input_tokens=2, message_id="msg_2"),
                _assistant_line(input_tokens=99, message_id="msg_1"),
                "",
            ]
        ),
        encoding="utf-8",
    )

    turns = read_turns(log)

    assert [t.input_tokens for t in turns] == [99, 2]


def test_read_turns_keeps_lines_without_message_id(tmp_path: Path) -> None:
    """message.idが取れない行同士は重複とみなさず、そのまま両方採用する。"""
    log = tmp_path / "session.jsonl"
    log.write_text(
        "\n".join(
            [
                _assistant_line(input_tokens=1, message_id=""),
                _assistant_line(input_tokens=2, message_id=""),
                "",
            ]
        ),
        encoding="utf-8",
    )

    turns = read_turns(log)

    assert [t.input_tokens for t in turns] == [1, 2]


def test_encode_project_dir_replaces_path_separators() -> None:
    assert encode_project_dir(Path("/home/user/repo")) == "-home-user-repo"


def test_encode_project_dir_replaces_dots_in_worktree_paths() -> None:
    assert (
        encode_project_dir(Path("/home/user/repo/.claude/worktrees/feature"))
        == "-home-user-repo--claude-worktrees-feature"
    )


def test_find_latest_session_file_picks_most_recently_modified(tmp_path: Path) -> None:
    older = tmp_path / "aaa.jsonl"
    newer = tmp_path / "bbb.jsonl"
    older.write_text("{}", encoding="utf-8")
    newer.write_text("{}", encoding="utf-8")
    import os
    import time

    time.sleep(0.01)
    now = time.time()
    os.utime(newer, (now + 10, now + 10))

    assert find_latest_session_file(tmp_path) == newer


def test_find_latest_session_file_raises_when_no_jsonl(tmp_path: Path) -> None:
    import pytest

    with pytest.raises(FileNotFoundError):
        find_latest_session_file(tmp_path)


def test_find_latest_session_file_raises_when_dir_missing(tmp_path: Path) -> None:
    import pytest

    with pytest.raises(FileNotFoundError):
        find_latest_session_file(tmp_path / "missing")


def test_resolve_session_file_prefers_explicit_file() -> None:
    resolved = resolve_session_file("/tmp/explicit.jsonl", None, None)

    assert resolved == Path("/tmp/explicit.jsonl")


def test_resolve_session_file_builds_path_from_session_id(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    real_project_dir = tmp_path / "actual-project"
    encoded_dir = tmp_path / encode_project_dir(real_project_dir)
    encoded_dir.mkdir()

    resolved = resolve_session_file(None, "abc123", str(real_project_dir))

    assert resolved == encoded_dir / "abc123.jsonl"


def test_resolve_session_file_falls_back_to_latest(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    real_project_dir = tmp_path / "actual-project"
    encoded_dir = tmp_path / encode_project_dir(real_project_dir)
    encoded_dir.mkdir()
    only = encoded_dir / "only.jsonl"
    only.write_text("{}", encoding="utf-8")

    resolved = resolve_session_file(None, None, str(real_project_dir))

    assert resolved == only


def test_find_session_file_by_id_searches_across_all_project_dirs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    other_dir = tmp_path / "-home-user-other-project"
    other_dir.mkdir()
    target = other_dir / "abc123.jsonl"
    target.write_text("{}", encoding="utf-8")

    assert find_session_file_by_id("abc123") == target


def test_find_session_file_by_id_raises_when_not_found(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    (tmp_path / "-home-user-other-project").mkdir()

    with pytest.raises(FileNotFoundError):
        find_session_file_by_id("missing")


def test_find_session_file_by_id_raises_when_ambiguous(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    dir_a = tmp_path / "-home-user-project-a"
    dir_b = tmp_path / "-home-user-project-b"
    dir_a.mkdir()
    dir_b.mkdir()
    (dir_a / "dup123.jsonl").write_text("{}", encoding="utf-8")
    (dir_b / "dup123.jsonl").write_text("{}", encoding="utf-8")

    with pytest.raises(FileNotFoundError):
        find_session_file_by_id("dup123")


def test_resolve_session_file_searches_globally_when_project_dir_omitted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    other_dir = tmp_path / "-home-user-moved-away-project"
    other_dir.mkdir()
    target = other_dir / "abc123.jsonl"
    target.write_text("{}", encoding="utf-8")

    resolved = resolve_session_file(None, "abc123", None)

    assert resolved == target


def test_totals_sums_each_metric_across_turns() -> None:
    turns = [
        TurnUsage("t1", "m", 1, 2, 3, 4),
        TurnUsage("t2", "m", 10, 20, 30, 40),
    ]

    totals = _totals(turns)

    assert totals.input_tokens == 11
    assert totals.output_tokens == 22
    assert totals.cache_creation_input_tokens == 33
    assert totals.cache_read_input_tokens == 44
    assert totals.total_tokens == 110


def test_resolve_model_pricing_matches_exact_model_id() -> None:
    pricing = resolve_model_pricing("claude-sonnet-5")

    assert pricing is not None
    assert pricing.input == pytest.approx(2 / 1_000_000)
    assert pricing.output == pytest.approx(10 / 1_000_000)
    assert pricing.cache_write_5m == pytest.approx(2.50 / 1_000_000)
    assert pricing.cache_read == pytest.approx(0.20 / 1_000_000)


def test_resolve_model_pricing_distinguishes_sonnet_5_5_from_sonnet_5() -> None:
    pricing = resolve_model_pricing("claude-sonnet-5-5")

    assert pricing is not None
    assert pricing.input == pytest.approx(2 / 1_000_000)
    assert pricing.output == pytest.approx(10 / 1_000_000)
    assert pricing.cache_write_5m == pytest.approx(2.50 / 1_000_000)
    assert pricing.cache_write_1h == pytest.approx(4 / 1_000_000)
    assert pricing.cache_read == pytest.approx(0.20 / 1_000_000)


def test_resolve_model_pricing_strips_date_suffix() -> None:
    dated = resolve_model_pricing("claude-haiku-4-5-20251001")
    undated = resolve_model_pricing("claude-haiku-4-5")

    assert dated is not None
    assert dated == undated


def test_resolve_model_pricing_returns_none_for_unknown_model() -> None:
    assert resolve_model_pricing("claude-does-not-exist") is None


def test_turn_usage_cost_usd_computes_weighted_sum_for_known_model() -> None:
    turn = TurnUsage(
        "t1",
        "claude-sonnet-5",
        input_tokens=1_000_000,
        output_tokens=1_000_000,
        cache_creation_input_tokens=1_000_000,
        cache_read_input_tokens=1_000_000,
    )

    assert turn.cost_usd == pytest.approx(2 + 10 + 2.50 + 0.20)


def test_turn_usage_cost_usd_splits_cache_creation_between_5m_and_1h_rates() -> None:
    """`cache_creation_input_tokens`の一部が1時間キャッシュの場合、その分は
    5分キャッシュのレート(1.25倍)ではなく1時間キャッシュのレート(2倍)で
    計算されることを確認する(ccusageとの突き合わせで発覚した回帰)。"""
    turn = TurnUsage(
        "t1",
        "claude-sonnet-5",
        input_tokens=0,
        output_tokens=0,
        cache_creation_input_tokens=1_000_000,
        cache_read_input_tokens=0,
        cache_creation_1h_input_tokens=1_000_000,
    )

    assert turn.cost_usd == pytest.approx(4.0)  # 1M token * $4/MTok(1hキャッシュ)


def test_parse_turn_extracts_cache_creation_1h_breakdown() -> None:
    turn = parse_turn(
        _assistant_line(
            cache_creation_input_tokens=100, cache_creation_1h_input_tokens=30
        )
    )

    assert turn is not None
    assert turn.cache_creation_input_tokens == 100
    assert turn.cache_creation_1h_input_tokens == 30


def test_parse_turn_defaults_cache_creation_1h_to_zero_when_absent() -> None:
    turn = parse_turn(_assistant_line())

    assert turn is not None
    assert turn.cache_creation_1h_input_tokens == 0


def test_turn_usage_cost_usd_is_none_for_unknown_model() -> None:
    turn = TurnUsage("t1", "claude-does-not-exist", 1, 1, 1, 1)

    assert turn.cost_usd is None


def test_cost_summary_sums_known_models_and_counts_unresolved() -> None:
    turns = [
        TurnUsage("t1", "claude-sonnet-5", 1_000_000, 0, 0, 0),
        TurnUsage("t2", "claude-does-not-exist", 1_000_000, 0, 0, 0),
    ]

    total, unresolved = _cost_summary(turns)

    assert total == pytest.approx(2.0)
    assert unresolved == 1


def test_fmt_cost_formats_known_and_unknown() -> None:
    assert _fmt_cost(1.5) == "$1.5000"
    assert _fmt_cost(None) == "-"


def test_build_table_shows_cost_column_and_unresolved_note() -> None:
    turns = [
        TurnUsage("t1", "claude-sonnet-5", 1_000_000, 0, 0, 0),
        TurnUsage("t2", "claude-does-not-exist", 1_000_000, 0, 0, 0),
    ]

    output = _render(build_table(turns, last_n=15))

    assert "$2.0000" in output
    assert "内1ターンは料金未対応モデル" in output


def test_build_table_shows_local_time_instead_of_raw_utc_timestamp() -> None:
    raw_timestamp = "2026-09-17T00:00:00.000Z"
    turns = [TurnUsage(raw_timestamp, "claude-sonnet-5", 1, 1, 1, 1)]

    output = _render(build_table(turns, last_n=15))

    assert main._to_local_display(raw_timestamp) in output
    assert raw_timestamp not in output


def test_render_report_embeds_turn_data_and_title() -> None:
    turns = [TurnUsage("2026-09-17T00:00:00.000Z", "claude-sonnet-5", 1, 2, 3, 4)]

    html = render_report(turns, title="my-session")

    assert "my-session" in html
    assert "claude-sonnet-5" in html
    assert "<!doctype html>" in html


def test_render_report_embeds_per_turn_cost_and_total() -> None:
    turns = [
        TurnUsage("2026-09-17T00:00:00.000Z", "claude-sonnet-5", 1_000_000, 0, 0, 0)
    ]

    html = render_report(turns, title="my-session")

    assert '"cost": 2.0' in html
    assert "$2.0000" in html


def test_render_report_notes_unresolved_cost_models() -> None:
    turns = [
        TurnUsage(
            "2026-09-17T00:00:00.000Z", "claude-does-not-exist", 1_000_000, 0, 0, 0
        )
    ]

    html = render_report(turns, title="my-session")

    assert "内1ターンは料金未対応モデルのため未集計" in html


def test_render_report_localizes_timestamp_display_via_js() -> None:
    turns = [TurnUsage("2026-09-17T00:00:00.000Z", "claude-sonnet-5", 1, 2, 3, 4)]

    html = render_report(turns, title="my-session")

    assert "function fmtTime(" in html
    assert 'header = "ターン#" + d.index + "  " + fmtTime(d.timestamp);' in html
    assert "[d.index, fmtTime(d.timestamp), d.source, d.model" in html


def test_render_report_handles_empty_turns() -> None:
    html = render_report([], title="empty-session")

    assert "empty-session" in html
    assert "<!doctype html>" in html


def test_turn_usage_defaults_source_to_main() -> None:
    turn = parse_turn(_assistant_line())

    assert turn is not None
    assert turn.source == "main"


def test_find_subagent_dir_derives_path_from_session_stem(tmp_path: Path) -> None:
    session_path = tmp_path / "abc123.jsonl"

    assert find_subagent_dir(session_path) == tmp_path / "abc123" / "subagents"


def test_find_subagent_transcripts_returns_empty_when_dir_missing(
    tmp_path: Path,
) -> None:
    session_path = tmp_path / "abc123.jsonl"
    session_path.write_text("{}", encoding="utf-8")

    assert find_subagent_transcripts(session_path) == []


def test_find_subagent_transcripts_lists_jsonl_files(tmp_path: Path) -> None:
    session_path = tmp_path / "abc123.jsonl"
    session_path.write_text("{}", encoding="utf-8")
    subagents_dir = tmp_path / "abc123" / "subagents"
    subagents_dir.mkdir(parents=True)
    (subagents_dir / "agent-b.jsonl").write_text("{}", encoding="utf-8")
    (subagents_dir / "agent-a.jsonl").write_text("{}", encoding="utf-8")
    (subagents_dir / "agent-a.meta.json").write_text("{}", encoding="utf-8")

    found = find_subagent_transcripts(session_path)

    assert found == [subagents_dir / "agent-a.jsonl", subagents_dir / "agent-b.jsonl"]


def test_read_agent_type_reads_agent_type_from_meta(tmp_path: Path) -> None:
    meta_path = tmp_path / "agent-a.meta.json"
    meta_path.write_text(json.dumps({"agentType": "git-merger"}), encoding="utf-8")

    assert _read_agent_type(meta_path) == "git-merger"


def test_read_agent_type_falls_back_when_meta_missing(tmp_path: Path) -> None:
    assert _read_agent_type(tmp_path / "missing.meta.json") == "subagent"


def test_read_agent_type_falls_back_when_meta_malformed(tmp_path: Path) -> None:
    meta_path = tmp_path / "agent-a.meta.json"
    meta_path.write_text("{not valid json", encoding="utf-8")

    assert _read_agent_type(meta_path) == "subagent"


def test_read_all_turns_merges_main_and_subagent_turns_sorted_by_timestamp(
    tmp_path: Path,
) -> None:
    session_path = tmp_path / "abc123.jsonl"
    session_path.write_text(
        "\n".join(
            [
                _assistant_line(input_tokens=1, timestamp="2026-09-17T00:00:00.000Z"),
                _assistant_line(input_tokens=4, timestamp="2026-09-17T00:03:00.000Z"),
                "",
            ]
        ),
        encoding="utf-8",
    )
    subagents_dir = tmp_path / "abc123" / "subagents"
    subagents_dir.mkdir(parents=True)
    (subagents_dir / "agent-a.meta.json").write_text(
        json.dumps({"agentType": "git-merger"}), encoding="utf-8"
    )
    (subagents_dir / "agent-a.jsonl").write_text(
        _assistant_line(input_tokens=2, timestamp="2026-09-17T00:01:00.000Z")
        + "\n"
        + _assistant_line(input_tokens=3, timestamp="2026-09-17T00:02:00.000Z"),
        encoding="utf-8",
    )

    turns = read_all_turns(session_path)

    assert [t.input_tokens for t in turns] == [1, 2, 3, 4]
    assert [t.source for t in turns] == ["main", "git-merger", "git-merger", "main"]


def test_read_all_turns_skips_main_only_when_subagents_dir_missing(
    tmp_path: Path,
) -> None:
    session_path = tmp_path / "abc123.jsonl"
    session_path.write_text(_assistant_line(input_tokens=1), encoding="utf-8")

    turns = read_all_turns(session_path)

    assert [t.input_tokens for t in turns] == [1]
    assert turns[0].source == "main"


def test_render_report_notes_subagent_turn_count() -> None:
    turns = [
        TurnUsage("2026-09-17T00:00:00.000Z", "claude-sonnet-5", 1, 2, 3, 4, "main"),
        TurnUsage(
            "2026-09-17T00:01:00.000Z",
            "claude-haiku-4-5",
            1,
            2,
            3,
            4,
            "git-merger",
        ),
    ]

    html = render_report(turns, title="my-session")

    assert "うちサブエージェント分 1 ターン" in html
    assert "git-merger" in html


def test_render_report_omits_subagent_note_when_all_main() -> None:
    turns = [TurnUsage("2026-09-17T00:00:00.000Z", "claude-sonnet-5", 1, 2, 3, 4)]

    html = render_report(turns, title="my-session")

    assert "うちサブエージェント分" not in html


def test_read_all_subagent_turns_returns_empty_when_dir_missing(
    tmp_path: Path,
) -> None:
    session_path = tmp_path / "abc123.jsonl"
    session_path.write_text("{}", encoding="utf-8")

    assert _read_all_subagent_turns(session_path) == []


def test_read_all_subagent_turns_rereads_full_file_on_every_call(
    tmp_path: Path,
) -> None:
    """新しく確定したusage(content-block分割行の最終値)を次回呼び出しで
    取りこぼさないことを確認する。バイト位置や件数によるインクリメンタルな
    差分検出ではなく、毎回全体を読み直す設計であることの裏付け。"""
    session_path = tmp_path / "abc123.jsonl"
    session_path.write_text("{}", encoding="utf-8")
    subagents_dir = tmp_path / "abc123" / "subagents"
    subagents_dir.mkdir(parents=True)
    (subagents_dir / "agent-a.meta.json").write_text(
        json.dumps({"agentType": "reviewer-helper"}), encoding="utf-8"
    )
    jsonl_path = subagents_dir / "agent-a.jsonl"
    jsonl_path.write_text(
        _assistant_line(output_tokens=1, message_id="msg_1"), encoding="utf-8"
    )

    first = _read_all_subagent_turns(session_path)
    assert [t.output_tokens for t in first] == [1]
    assert [t.source for t in first] == ["reviewer-helper"]

    with jsonl_path.open("a", encoding="utf-8") as f:
        f.write("\n" + _assistant_line(output_tokens=330, message_id="msg_1"))
    second = _read_all_subagent_turns(session_path)
    assert [t.output_tokens for t in second] == [330]


def test_read_all_subagent_turns_picks_up_newly_created_file(
    tmp_path: Path,
) -> None:
    session_path = tmp_path / "abc123.jsonl"
    session_path.write_text("{}", encoding="utf-8")
    subagents_dir = tmp_path / "abc123" / "subagents"
    subagents_dir.mkdir(parents=True)

    assert _read_all_subagent_turns(session_path) == []

    (subagents_dir / "agent-b.meta.json").write_text(
        json.dumps({"agentType": "reviewer-helper"}), encoding="utf-8"
    )
    (subagents_dir / "agent-b.jsonl").write_text(
        _assistant_line(input_tokens=9), encoding="utf-8"
    )

    assert [t.input_tokens for t in _read_all_subagent_turns(session_path)] == [9]


def test_find_subagent_dirs_finds_dir_via_known_dirs_even_when_main_jsonl_absent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """メインJSONLが既に移動済みで実体が無くなったディレクトリでも、
    `known_dirs`に覚えている限りそこのsubagentsディレクトリは探し続けることを
    確認する(worktree移動後、旧ディレクトリに残った完了済みサブエージェント
    を取りこぼさないための挙動)。"""
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    old_dir = tmp_path / "old-encoded-cwd"
    subagents_dir = old_dir / "abc123" / "subagents"
    subagents_dir.mkdir(parents=True)
    (subagents_dir / "agent-a.jsonl").write_text("{}", encoding="utf-8")

    found = _find_subagent_dirs("abc123", {old_dir})

    assert found == [subagents_dir]


def test_find_subagent_dirs_discovers_new_dir_from_relocated_main_jsonl(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`known_dirs`に含まれていない新しいディレクトリでも、メインJSONLの
    横断globで新ディレクトリを発見できることを確認する(worktree移動直後、
    まだ`known_dirs`に登録されていない新ディレクトリを見つける挙動)。"""
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    new_dir = tmp_path / "new-encoded-cwd"
    new_dir.mkdir()
    (new_dir / "abc123.jsonl").write_text("{}", encoding="utf-8")
    subagents_dir = new_dir / "abc123" / "subagents"
    subagents_dir.mkdir(parents=True)
    (subagents_dir / "agent-a.jsonl").write_text("{}", encoding="utf-8")

    known_dirs: set[Path] = set()
    found = _find_subagent_dirs("abc123", known_dirs)

    assert found == [subagents_dir]
    assert new_dir in known_dirs


def test_find_subagent_dirs_discovers_new_dir_when_main_jsonl_already_gone(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """メインJSONLが既に別の場所へ再移動済みでも、`subagents`ディレクトリ
    自体の横断globで発見できることを確認する。"""
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    stale_dir = tmp_path / "stale-encoded-cwd"
    subagents_dir = stale_dir / "abc123" / "subagents"
    subagents_dir.mkdir(parents=True)
    (subagents_dir / "agent-a.jsonl").write_text("{}", encoding="utf-8")

    found = _find_subagent_dirs("abc123", set())

    assert found == [subagents_dir]


def test_read_subagent_turns_from_dirs_merges_across_dirs(tmp_path: Path) -> None:
    dir_a = tmp_path / "dirA" / "subagents"
    dir_a.mkdir(parents=True)
    (dir_a / "agent-a.meta.json").write_text(
        json.dumps({"agentType": "git-merger"}), encoding="utf-8"
    )
    (dir_a / "agent-a.jsonl").write_text(
        _assistant_line(input_tokens=1), encoding="utf-8"
    )
    dir_b = tmp_path / "dirB" / "subagents"
    dir_b.mkdir(parents=True)
    (dir_b / "agent-b.meta.json").write_text(
        json.dumps({"agentType": "workspace-auditor"}), encoding="utf-8"
    )
    (dir_b / "agent-b.jsonl").write_text(
        _assistant_line(input_tokens=2), encoding="utf-8"
    )

    turns = _read_subagent_turns_from_dirs([dir_a, dir_b])

    assert [t.input_tokens for t in turns] == [1, 2]
    assert [t.source for t in turns] == ["git-merger", "workspace-auditor"]


def test_build_table_shows_only_last_n_turns_and_running_totals() -> None:
    turns = [
        TurnUsage("t1", "claude-sonnet-5", 1, 1, 1, 1),
        TurnUsage("t2", "claude-sonnet-5", 2, 2, 2, 2),
        TurnUsage("t3", "claude-sonnet-5", 3, 3, 3, 3),
    ]

    output = _render(build_table(turns, last_n=2))

    assert "t1" not in output
    assert "t2" in output
    assert "t3" in output
    assert "直近2件" in output
    assert "累計3ターン" in output


def test_build_table_handles_empty_turns() -> None:
    output = _render(build_table([], last_n=15))

    assert "累計0ターン" in output


def test_watch_raises_system_exit_when_file_missing(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        main.watch(tmp_path / "missing.jsonl")


def test_watch_appends_new_turn_before_interrupt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """新規行の到着(492-506行)と行が無い間のポーリング(486-491行)の両方を
    通過させ、最終的に統合済みターン一覧に反映されることを確認する。"""
    log = tmp_path / "session.jsonl"
    log.write_text(
        _assistant_line(input_tokens=1, message_id="msg_1") + "\n", encoding="utf-8"
    )

    captured: list[list[int]] = []
    original_build_table = main.build_table

    def spy_build_table(turns: list[TurnUsage], last_n: int = 15):
        captured.append([t.input_tokens for t in turns])
        return original_build_table(turns, last_n)

    monkeypatch.setattr(main, "build_table", spy_build_table)

    calls = {"n": 0}

    def fake_sleep(_seconds: float) -> None:
        calls["n"] += 1
        if calls["n"] == 1:
            with log.open("a", encoding="utf-8") as f:
                f.write(_assistant_line(input_tokens=2, message_id="msg_2") + "\n")
            return
        raise KeyboardInterrupt

    monkeypatch.setattr(main.time, "sleep", fake_sleep)

    main.watch(log, poll_interval=0)

    assert captured[-1] == [1, 2]


def test_watch_updates_existing_turn_when_message_id_repeats(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """output_tokens等が後続行で確定する場合、同一message_idの既存ターンを
    上書きすることを確認する(500-501行)。"""
    log = tmp_path / "session.jsonl"
    log.write_text(
        _assistant_line(output_tokens=1, message_id="msg_1") + "\n", encoding="utf-8"
    )

    captured: list[list[int]] = []
    original_build_table = main.build_table

    def spy_build_table(turns: list[TurnUsage], last_n: int = 15):
        captured.append([t.output_tokens for t in turns])
        return original_build_table(turns, last_n)

    monkeypatch.setattr(main, "build_table", spy_build_table)

    calls = {"n": 0}

    def fake_sleep(_seconds: float) -> None:
        calls["n"] += 1
        if calls["n"] == 1:
            with log.open("a", encoding="utf-8") as f:
                f.write(_assistant_line(output_tokens=330, message_id="msg_1") + "\n")
            return
        raise KeyboardInterrupt

    monkeypatch.setattr(main.time, "sleep", fake_sleep)

    main.watch(log, poll_interval=0)

    assert captured[-1] == [330]


def test_watch_reassembles_line_written_in_partial_chunks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """書き込み途中(改行なし)の行は次回分と結合してから解析することを
    確認する(493-494行)。"""
    log = tmp_path / "session.jsonl"
    log.write_text("", encoding="utf-8")
    full_line = _assistant_line(input_tokens=7, message_id="msg_1")
    head, tail = full_line[:5], full_line[5:]

    captured: list[list[int]] = []
    original_build_table = main.build_table

    def spy_build_table(turns: list[TurnUsage], last_n: int = 15):
        captured.append([t.input_tokens for t in turns])
        return original_build_table(turns, last_n)

    monkeypatch.setattr(main, "build_table", spy_build_table)

    calls = {"n": 0}

    def fake_sleep(_seconds: float) -> None:
        calls["n"] += 1
        if calls["n"] == 1:
            with log.open("a", encoding="utf-8") as f:
                f.write(head)
            return
        if calls["n"] == 2:
            with log.open("a", encoding="utf-8") as f:
                f.write(tail + "\n")
            return
        raise KeyboardInterrupt

    monkeypatch.setattr(main.time, "sleep", fake_sleep)

    main.watch(log, poll_interval=0)

    assert captured[-1] == [7]


def test_watch_ignores_new_line_without_usable_usage(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """新規行がusageを持たないassistant以外の行の場合、無視して継続することを
    確認する(497-498行)。"""
    log = tmp_path / "session.jsonl"
    log.write_text(
        _assistant_line(input_tokens=1, message_id="msg_1") + "\n", encoding="utf-8"
    )

    captured: list[list[int]] = []
    original_build_table = main.build_table

    def spy_build_table(turns: list[TurnUsage], last_n: int = 15):
        captured.append([t.input_tokens for t in turns])
        return original_build_table(turns, last_n)

    monkeypatch.setattr(main, "build_table", spy_build_table)

    calls = {"n": 0}

    def fake_sleep(_seconds: float) -> None:
        calls["n"] += 1
        if calls["n"] == 1:
            with log.open("a", encoding="utf-8") as f:
                f.write(json.dumps({"type": "user", "message": {}}) + "\n")
            return
        raise KeyboardInterrupt

    monkeypatch.setattr(main.time, "sleep", fake_sleep)

    main.watch(log, poll_interval=0)

    assert captured[-1] == [1]


def test_watch_follows_session_relocated_to_another_project_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`EnterWorktree`等でカレントディレクトリが変わり、メインJSONLが別の
    `~/.claude/projects/<encoded-cwd>/`へOSレベルのrenameで移動した後も、
    (1)開いたままのファイルディスクリプタでメインターンの追記を追跡し続け、
    (2)移動後に新ディレクトリ配下へ作られたサブエージェントのトランスクリプト
    も取り込むことを確認する(実機でのrename挙動を検証した上での回帰テスト)。
    """
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    session_id = "sess123"
    old_dir = tmp_path / "old-encoded-cwd"
    old_dir.mkdir()
    log = old_dir / f"{session_id}.jsonl"
    log.write_text(
        _assistant_line(
            input_tokens=1, message_id="msg_1", timestamp="2026-09-25T00:00:00.000Z"
        )
        + "\n",
        encoding="utf-8",
    )
    new_dir = tmp_path / "new-encoded-cwd"
    new_dir.mkdir()

    captured: list[tuple[list[int], list[str]]] = []
    original_build_table = main.build_table

    def spy_build_table(turns: list[TurnUsage], last_n: int = 15):
        captured.append(([t.input_tokens for t in turns], [t.source for t in turns]))
        return original_build_table(turns, last_n)

    monkeypatch.setattr(main, "build_table", spy_build_table)

    calls = {"n": 0}

    def fake_sleep(_seconds: float) -> None:
        calls["n"] += 1
        if calls["n"] == 1:
            new_log = new_dir / f"{session_id}.jsonl"
            log.rename(new_log)  # worktree移動を模したメインJSONLのOS rename
            with new_log.open("a", encoding="utf-8") as writer:
                writer.write(
                    _assistant_line(
                        input_tokens=2,
                        message_id="msg_2",
                        timestamp="2026-09-25T00:01:00.000Z",
                    )
                    + "\n"
                )
            # 移動後に完了したサブエージェントは新ディレクトリ配下に作られる
            subagents_dir = new_dir / session_id / "subagents"
            subagents_dir.mkdir(parents=True)
            (subagents_dir / "agent-a.meta.json").write_text(
                json.dumps({"agentType": "git-merger"}), encoding="utf-8"
            )
            (subagents_dir / "agent-a.jsonl").write_text(
                _assistant_line(input_tokens=3, timestamp="2026-09-25T00:00:30.000Z"),
                encoding="utf-8",
            )
            return
        raise KeyboardInterrupt

    monkeypatch.setattr(main.time, "sleep", fake_sleep)

    main.watch(log, poll_interval=0)

    final_inputs, final_sources = captured[-1]
    assert final_inputs == [1, 3, 2]
    assert final_sources == ["main", "git-merger", "main"]


def test_report_raises_system_exit_when_file_missing(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        main.report(tmp_path / "missing.jsonl", tmp_path / "out.html")


def test_report_generates_html_file_and_prints_summary(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    session = tmp_path / "session.jsonl"
    session.write_text(_assistant_line(input_tokens=5) + "\n", encoding="utf-8")
    output = tmp_path / "out.html"

    main.report(session, output)

    assert output.exists()
    html = output.read_text(encoding="utf-8")
    assert "<!doctype html>" in html
    captured = capsys.readouterr()
    flattened = captured.out.replace("\n", "")
    assert "1 ターン分のレポートを生成しました" in flattened


def test_sanitize_filename_component_replaces_unsafe_characters() -> None:
    assert main._sanitize_filename_component("foo/bar baz:qux") == "foo_bar_baz_qux"
    assert main._sanitize_filename_component("  日本語タイトル  ") == "日本語タイトル"


def test_extract_session_title_prefers_ai_title_over_summary(tmp_path: Path) -> None:
    session = tmp_path / "session.jsonl"
    session.write_text(
        _assistant_line()
        + "\n"
        + json.dumps({"type": "summary", "summary": "要約タイトル"})
        + "\n"
        + json.dumps({"type": "ai-title", "aiTitle": "AI生成タイトル"})
        + "\n",
        encoding="utf-8",
    )

    assert main._extract_session_title(session) == "AI生成タイトル"


def test_extract_session_title_uses_last_ai_title_when_repeated(
    tmp_path: Path,
) -> None:
    session = tmp_path / "session.jsonl"
    session.write_text(
        json.dumps({"type": "ai-title", "aiTitle": "古いタイトル"})
        + "\n"
        + json.dumps({"type": "ai-title", "aiTitle": "新しいタイトル"})
        + "\n",
        encoding="utf-8",
    )

    assert main._extract_session_title(session) == "新しいタイトル"


def test_extract_session_title_falls_back_to_summary_when_no_ai_title(
    tmp_path: Path,
) -> None:
    session = tmp_path / "session.jsonl"
    session.write_text(
        _assistant_line()
        + "\n"
        + json.dumps({"type": "summary", "summary": "テストタイトル"})
        + "\n",
        encoding="utf-8",
    )

    assert main._extract_session_title(session) == "テストタイトル"


def test_extract_session_title_returns_none_when_absent(
    tmp_path: Path,
) -> None:
    session = tmp_path / "session.jsonl"
    session.write_text(_assistant_line() + "\n", encoding="utf-8")

    assert main._extract_session_title(session) is None


def test_default_report_filename_includes_timestamp_session_id_and_title(
    tmp_path: Path,
) -> None:
    session = tmp_path / "abc-123.jsonl"
    session.write_text(
        _assistant_line(timestamp="2026-09-17T01:02:03.000Z")
        + "\n"
        + json.dumps({"type": "ai-title", "aiTitle": "重要な調査"})
        + "\n",
        encoding="utf-8",
    )
    turns = main.read_all_turns(session)

    filename = main.default_report_filename(session, turns)

    local = datetime.fromisoformat("2026-09-17T01:02:03+00:00").astimezone()
    expected_timestamp = local.strftime("%Y%m%d_%H%M%S")
    assert (
        filename == f"{expected_timestamp}_abc-123_重要な調査_token-usage-report.html"
    )


def test_default_report_filename_omits_title_when_absent(tmp_path: Path) -> None:
    session = tmp_path / "abc-123.jsonl"
    session.write_text(
        _assistant_line(timestamp="2026-09-17T01:02:03.000Z") + "\n",
        encoding="utf-8",
    )
    turns = main.read_all_turns(session)

    filename = main.default_report_filename(session, turns)

    local = datetime.fromisoformat("2026-09-17T01:02:03+00:00").astimezone()
    expected_timestamp = local.strftime("%Y%m%d_%H%M%S")
    assert filename == f"{expected_timestamp}_abc-123_token-usage-report.html"


def test_default_report_filename_falls_back_to_mtime_when_no_turns(
    tmp_path: Path,
) -> None:
    session = tmp_path / "abc-123.jsonl"
    session.write_text("", encoding="utf-8")
    turns: list[main.TurnUsage] = []

    filename = main.default_report_filename(session, turns)

    assert filename.endswith("_abc-123_token-usage-report.html")
    assert re.match(r"^\d{8}_\d{6}_abc-123_token-usage-report\.html$", filename)


def test_report_uses_default_filename_when_output_omitted(tmp_path: Path) -> None:
    session = tmp_path / "abc-123.jsonl"
    session.write_text(
        _assistant_line(timestamp="2026-09-17T01:02:03.000Z") + "\n",
        encoding="utf-8",
    )
    original_cwd = Path.cwd()
    os.chdir(tmp_path)
    try:
        main.report(session)
    finally:
        os.chdir(original_cwd)

    local = datetime.fromisoformat("2026-09-17T01:02:03+00:00").astimezone()
    expected_timestamp = local.strftime("%Y%m%d_%H%M%S")
    expected = tmp_path / f"{expected_timestamp}_abc-123_token-usage-report.html"
    assert expected.exists()


def test_build_arg_parser_watch_defaults() -> None:
    parser = main.build_arg_parser()

    args = parser.parse_args(["watch"])

    assert args.command == "watch"
    assert args.file is None
    assert args.last_n == 15
    assert args.interval == 0.5


def test_build_arg_parser_report_defaults() -> None:
    parser = main.build_arg_parser()

    args = parser.parse_args(["report"])

    assert args.command == "report"
    assert args.output is None


def test_build_arg_parser_accepts_common_options() -> None:
    parser = main.build_arg_parser()

    args = parser.parse_args(
        ["watch", "--session", "abc123", "--project-dir", "/tmp/x", "--last-n", "5"]
    )

    assert args.session == "abc123"
    assert args.project_dir == "/tmp/x"
    assert args.last_n == 5


def test_build_arg_parser_requires_a_command() -> None:
    parser = main.build_arg_parser()

    with pytest.raises(SystemExit):
        parser.parse_args([])


def _run_argcomplete(comp_line: str) -> list[str]:
    """`comp_line`をbash補完プロトコルで送り込み、候補一覧を返す。

    argcomplete.autocomplete()はfd操作を伴うため、同一プロセス内(pytest実行プロセス自体)で
    直接呼び出すとpytestのfaulthandlerが使うファイルディスクリプタを巻き込んで壊れる。
    そのため必ず別プロセスで実行する。

    Args:
        comp_line: 補完対象のコマンドライン全体(末尾が補完位置)。

    Returns:
        argcompleteが返した補完候補のリスト。
    """
    project_root = Path(__file__).resolve().parent.parent
    env = {
        **os.environ,
        "_ARGCOMPLETE": "1",
        "COMP_LINE": comp_line,
        "COMP_POINT": str(len(comp_line)),
        "_ARGCOMPLETE_COMP_WORDBREAKS": " ",
    }
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys, argcomplete, main\n"
            "argcomplete.autocomplete(\n"
            "    main.build_arg_parser(),\n"
            "    output_stream=sys.stdout,\n"
            "    exit_method=lambda code=0: None,\n"
            ")\n",
        ],
        cwd=project_root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.split("\x0b")


def test_autocomplete_lists_subcommands() -> None:
    candidates = _run_argcomplete("claude-token-monitor ")

    assert "watch" in candidates
    assert "report" in candidates


def test_autocomplete_lists_report_options() -> None:
    candidates = _run_argcomplete("claude-token-monitor report --")

    assert "--output" in candidates
    assert "--file" in candidates


def test_main_dispatches_to_report(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = tmp_path / "session.jsonl"
    session.write_text("{}", encoding="utf-8")
    output = tmp_path / "out.html"
    called: dict[str, Path] = {}

    def fake_report(path: Path, output_path: Path) -> None:
        called["path"] = path
        called["output"] = output_path

    monkeypatch.setattr(main, "report", fake_report)
    monkeypatch.setattr(
        sys,
        "argv",
        ["prog", "report", "--file", str(session), "--output", str(output)],
    )

    main.main()

    assert called == {"path": session, "output": output}


def test_main_dispatches_to_watch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = tmp_path / "session.jsonl"
    session.write_text("{}", encoding="utf-8")
    called: dict[str, object] = {}

    def fake_watch(path: Path, poll_interval: float, last_n: int) -> None:
        called.update(path=path, poll_interval=poll_interval, last_n=last_n)

    monkeypatch.setattr(main, "watch", fake_watch)
    monkeypatch.setattr(
        sys,
        "argv",
        ["prog", "watch", "--file", str(session), "--interval", "1.5", "--last-n", "5"],
    )

    main.main()

    assert called == {"path": session, "poll_interval": 1.5, "last_n": 5}


def test_main_exits_when_session_file_cannot_be_resolved(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["prog", "report", "--file", "/nonexistent.jsonl"])

    def fake_resolve(*_args: object, **_kwargs: object) -> Path:
        raise FileNotFoundError("boom")

    monkeypatch.setattr(main, "resolve_session_file", fake_resolve)

    with pytest.raises(SystemExit):
        main.main()

    captured = capsys.readouterr()
    assert "エラー: boom" in captured.err


def test_list_session_files_sorts_by_mtime_descending(tmp_path: Path) -> None:
    import time

    older = tmp_path / "aaa.jsonl"
    newer = tmp_path / "bbb.jsonl"
    older.write_text("{}", encoding="utf-8")
    newer.write_text("{}", encoding="utf-8")
    now = time.time()
    os.utime(older, (now, now))
    os.utime(newer, (now + 10, now + 10))

    assert list_session_files(tmp_path) == [newer, older]


def test_list_session_files_returns_empty_when_dir_missing(tmp_path: Path) -> None:
    assert list_session_files(tmp_path / "missing") == []


def test_resolve_project_dir_uses_cwd_when_omitted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", Path("/base"))
    monkeypatch.setattr(Path, "cwd", lambda: Path("/home/user/repo"))

    assert resolve_project_dir(None) == Path("/base/-home-user-repo")


def test_resolve_project_dir_encodes_explicit_path(tmp_path: Path) -> None:
    target = tmp_path / "actual-project"
    target.mkdir()

    result = resolve_project_dir(str(target))

    assert result.name == encode_project_dir(target)


def test_summarize_session_builds_summary_from_turns(tmp_path: Path) -> None:
    log = tmp_path / "session.jsonl"
    log.write_text(
        "\n".join(
            [
                _assistant_line(input_tokens=10, timestamp="2026-09-17T00:00:00.000Z"),
                _assistant_line(input_tokens=20, timestamp="2026-09-17T00:05:00.000Z"),
                "",
            ]
        ),
        encoding="utf-8",
    )

    summary = summarize_session(log)

    assert summary.session_id == "session"
    assert summary.first_timestamp == "2026-09-17T00:00:00.000Z"
    assert summary.last_timestamp == "2026-09-17T00:05:00.000Z"
    assert summary.turn_count == 2
    assert summary.totals.input_tokens == 30
    assert summary.title is None
    assert summary.unresolved_cost_turn_count == 0


def test_summarize_session_falls_back_to_mtime_when_no_turns(tmp_path: Path) -> None:
    log = tmp_path / "session.jsonl"
    log.write_text("{}", encoding="utf-8")

    summary = summarize_session(log)

    assert summary.turn_count == 0
    assert summary.first_timestamp == _fallback_timestamp(log)
    assert summary.last_timestamp == _fallback_timestamp(log)


def test_list_session_summaries_sorts_by_last_timestamp_descending(
    tmp_path: Path,
) -> None:
    older = tmp_path / "older.jsonl"
    newer = tmp_path / "newer.jsonl"
    older.write_text(
        _assistant_line(timestamp="2026-09-01T00:00:00.000Z") + "\n",
        encoding="utf-8",
    )
    newer.write_text(
        _assistant_line(timestamp="2026-09-20T00:00:00.000Z") + "\n",
        encoding="utf-8",
    )

    summaries = list_session_summaries(list_session_files(tmp_path))

    assert [s.session_id for s in summaries] == ["newer", "older"]


def test_list_all_session_files_searches_across_all_project_dirs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    dir_a = tmp_path / "project-a"
    dir_b = tmp_path / "project-b"
    dir_a.mkdir()
    dir_b.mkdir()
    (dir_a / "sess1.jsonl").write_text("{}", encoding="utf-8")
    (dir_b / "sess2.jsonl").write_text("{}", encoding="utf-8")
    # サブエージェント分は対象に含めない(<session>/subagents/配下は3階層目)
    (dir_a / "sess1" / "subagents").mkdir(parents=True)
    (dir_a / "sess1" / "subagents" / "agent-x.jsonl").write_text("{}", encoding="utf-8")

    found = list_all_session_files()

    assert sorted(found) == sorted([dir_a / "sess1.jsonl", dir_b / "sess2.jsonl"])


def test_to_local_display_converts_utc_to_local_timezone() -> None:
    displayed = main._to_local_display("2026-09-17T00:00:00.000Z")

    parsed_utc = datetime.fromisoformat("2026-09-17T00:00:00+00:00")
    expected = parsed_utc.astimezone().strftime("%Y-%m-%d %H:%M:%S")
    assert displayed == expected


def test_to_local_display_returns_input_unchanged_when_unparseable() -> None:
    assert main._to_local_display("not-a-timestamp") == "not-a-timestamp"


def test_build_sessions_table_renders_session_id_and_title(tmp_path: Path) -> None:
    log = tmp_path / "abc123.jsonl"
    log.write_text(_assistant_line(input_tokens=5) + "\n", encoding="utf-8")
    summary = summarize_session(log)

    rendered = _render(build_sessions_table([summary]))

    assert "abc123" in rendered
    assert "1" in rendered  # ターン数


def test_build_sessions_table_shows_project_column_when_requested(
    tmp_path: Path,
) -> None:
    log = tmp_path / "abc123.jsonl"
    log.write_text(_assistant_line(input_tokens=5) + "\n", encoding="utf-8")
    summary = summarize_session(log)

    rendered = _render(build_sessions_table([summary], show_project=True))

    assert "プロジェクト" in rendered
    assert tmp_path.name in rendered


def test_sessions_command_exits_when_no_sessions(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    with pytest.raises(SystemExit):
        sessions_command(tmp_path / "missing", output_format="table")


def test_sessions_command_exits_when_project_dir_none_and_no_sessions(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)

    with pytest.raises(SystemExit):
        sessions_command(None, output_format="table")


def test_sessions_command_prints_json(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    log = tmp_path / "abc123.jsonl"
    log.write_text(_assistant_line(input_tokens=5) + "\n", encoding="utf-8")

    sessions_command(tmp_path, output_format="json")

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload[0]["session_id"] == "abc123"
    assert payload[0]["input_tokens"] == 5


def test_sessions_command_prints_table(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    log = tmp_path / "abc123.jsonl"
    log.write_text(_assistant_line(input_tokens=5) + "\n", encoding="utf-8")

    sessions_command(tmp_path, output_format="table")

    captured = capsys.readouterr()
    assert "abc123" in captured.out


def test_sessions_command_prints_csv(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    log = tmp_path / "abc123.jsonl"
    log.write_text(_assistant_line(input_tokens=5) + "\n", encoding="utf-8")

    sessions_command(tmp_path, output_format="csv")

    captured = capsys.readouterr()
    rows = list(csv.DictReader(io.StringIO(captured.out)))
    assert rows[0]["session_id"] == "abc123"
    assert rows[0]["input_tokens"] == "5"


def test_sessions_command_searches_all_projects_when_project_dir_none(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(main, "CLAUDE_PROJECTS_DIR", tmp_path)
    project_dir = tmp_path / "some-project"
    project_dir.mkdir()
    (project_dir / "abc123.jsonl").write_text(
        _assistant_line(input_tokens=5) + "\n", encoding="utf-8"
    )

    sessions_command(None, output_format="json")

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload[0]["session_id"] == "abc123"
    assert payload[0]["project_dir_name"] == "some-project"


def test_main_dispatches_to_sessions_with_explicit_project_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    called: dict[str, object] = {}

    def fake_sessions_command(project_dir: Path | None, output_format: str) -> None:
        called.update(project_dir=project_dir, output_format=output_format)

    monkeypatch.setattr(main, "sessions_command", fake_sessions_command)
    monkeypatch.setattr(main, "resolve_project_dir", lambda project_dir: tmp_path)
    monkeypatch.setattr(
        sys, "argv", ["prog", "sessions", "--project-dir", "/some/dir", "--json"]
    )

    main.main()

    assert called == {"project_dir": tmp_path, "output_format": "json"}


def test_main_dispatches_to_sessions_with_none_when_project_dir_omitted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called: dict[str, object] = {}

    def fake_sessions_command(project_dir: Path | None, output_format: str) -> None:
        called.update(project_dir=project_dir, output_format=output_format)

    monkeypatch.setattr(main, "sessions_command", fake_sessions_command)
    monkeypatch.setattr(sys, "argv", ["prog", "sessions"])

    main.main()

    assert called == {"project_dir": None, "output_format": "table"}


def test_main_dispatches_to_sessions_with_csv(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called: dict[str, object] = {}

    def fake_sessions_command(project_dir: Path | None, output_format: str) -> None:
        called.update(project_dir=project_dir, output_format=output_format)

    monkeypatch.setattr(main, "sessions_command", fake_sessions_command)
    monkeypatch.setattr(sys, "argv", ["prog", "sessions", "--csv"])

    main.main()

    assert called == {"project_dir": None, "output_format": "csv"}


def test_sessions_json_and_csv_are_mutually_exclusive(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["prog", "sessions", "--json", "--csv"])

    with pytest.raises(SystemExit):
        main.main()

    captured = capsys.readouterr()
    assert "not allowed with argument" in captured.err
