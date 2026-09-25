import io
import json
import sys
from pathlib import Path

import pytest
from rich.console import Console

import main
from main import (
    TurnUsage,
    _read_agent_type,
    _read_all_subagent_turns,
    _totals,
    build_table,
    encode_project_dir,
    find_latest_session_file,
    find_session_file_by_id,
    find_subagent_dir,
    find_subagent_transcripts,
    parse_turn,
    read_all_turns,
    read_turns,
    render_report,
    resolve_session_file,
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
) -> str:
    return json.dumps(
        {
            "type": "assistant",
            "timestamp": timestamp,
            "message": {
                "id": message_id,
                "model": model,
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cache_creation_input_tokens": cache_creation_input_tokens,
                    "cache_read_input_tokens": cache_read_input_tokens,
                },
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


def test_render_report_embeds_turn_data_and_title() -> None:
    turns = [TurnUsage("2026-09-17T00:00:00.000Z", "claude-sonnet-5", 1, 2, 3, 4)]

    html = render_report(turns, title="my-session")

    assert "my-session" in html
    assert "claude-sonnet-5" in html
    assert "<!doctype html>" in html


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
    assert args.output == "token-usage-report.html"


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
