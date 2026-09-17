import json
from pathlib import Path

import pytest

import main
from main import (
    TurnUsage,
    _totals,
    encode_project_dir,
    find_latest_session_file,
    parse_turn,
    read_turns,
    render_report,
    resolve_session_file,
)


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
