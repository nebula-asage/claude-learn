"""Claude Codeのセッショントランスクリプトからターン毎のトークン使用量を計測・可視化するCLIツール。"""

from __future__ import annotations

import argparse
import json
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


@dataclass
class TurnUsage:
    """1ターン(1回のassistant APIレスポンス)分のトークン使用量。"""

    timestamp: str
    model: str
    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: int
    cache_read_input_tokens: int

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


def parse_turn(line: str) -> TurnUsage | None:
    """トランスクリプトJSONLの1行を解析し、usageを持つassistantターンを抽出する。

    Args:
        line: JSONL形式の1行。

    Returns:
        usageを持つassistantメッセージであればTurnUsage、それ以外はNone。
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
    return TurnUsage(
        timestamp=obj.get("timestamp", ""),
        model=message.get("model", ""),
        input_tokens=usage.get("input_tokens", 0) or 0,
        output_tokens=usage.get("output_tokens", 0) or 0,
        cache_creation_input_tokens=usage.get("cache_creation_input_tokens", 0) or 0,
        cache_read_input_tokens=usage.get("cache_read_input_tokens", 0) or 0,
    )


def read_turns(path: Path) -> list[TurnUsage]:
    """トランスクリプトJSONLファイル全体を読み込み、ターンの一覧を返す。

    Args:
        path: トランスクリプトJSONLファイルのパス。

    Returns:
        ファイル中の全ターンをusageの出現順に並べたリスト。
    """
    turns: list[TurnUsage] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            turn = parse_turn(line)
            if turn is not None:
                turns.append(turn)
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


def build_table(turns: list[TurnUsage], last_n: int = 15) -> Table:
    """直近ターンの一覧と累計を1つのテーブルにまとめる。

    Args:
        turns: これまでに観測した全ターン。
        last_n: 表示する直近ターンの件数。

    Returns:
        rich表示用のTableオブジェクト。
    """
    table = Table(
        title=f"Claude Code トークン使用量(ターン別) — 直近{last_n}件 / 累計{len(turns)}ターン"
    )
    table.add_column("#", justify="right")
    table.add_column("時刻", justify="left")
    table.add_column("モデル", justify="left")
    table.add_column("input", justify="right")
    table.add_column("output", justify="right")
    table.add_column("cache_create", justify="right")
    table.add_column("cache_read", justify="right")
    table.add_column("合計", justify="right", style="bold")

    visible = turns[-last_n:]
    offset = len(turns) - len(visible)
    for i, t in enumerate(visible, start=offset + 1):
        table.add_row(
            str(i),
            t.timestamp,
            t.model,
            f"{t.input_tokens:,}",
            f"{t.output_tokens:,}",
            f"{t.cache_creation_input_tokens:,}",
            f"{t.cache_read_input_tokens:,}",
            f"{t.total_tokens:,}",
        )

    totals = _totals(turns)
    table.add_section()
    table.add_row(
        "累計",
        "",
        "",
        f"{totals.input_tokens:,}",
        f"{totals.output_tokens:,}",
        f"{totals.cache_creation_input_tokens:,}",
        f"{totals.cache_read_input_tokens:,}",
        f"{totals.total_tokens:,}",
        style="bold cyan",
    )
    return table


def watch(path: Path, poll_interval: float = 0.5, last_n: int = 15) -> None:
    """セッションJSONLを末尾から監視し、ターン毎のトークン使用量をライブ表示する。

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

    turns = read_turns(path)
    console.print(f"[dim]{path} を監視中(Ctrl+Cで終了)[/dim]")
    with path.open(encoding="utf-8") as f:
        f.seek(0, 2)  # 既存行は read_turns 済みなので、末尾から追記分だけを追う
        buffer = ""
        with Live(
            build_table(turns, last_n), console=console, refresh_per_second=4
        ) as live:
            try:
                while True:
                    chunk = f.readline()
                    if not chunk:
                        time.sleep(poll_interval)
                        continue
                    buffer += chunk
                    if not buffer.endswith("\n"):
                        continue  # 書き込み途中の行は次回分と結合して再解析する
                    turn = parse_turn(buffer)
                    buffer = ""
                    if turn is not None:
                        turns.append(turn)
                        live.update(build_table(turns, last_n))
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
    series_keys = list(SERIES_LABELS.keys())
    data = [
        {
            "index": i + 1,
            "timestamp": t.timestamp,
            "model": t.model,
            **{k: getattr(t, k) for k in series_keys},
            "total": t.total_tokens,
            "cumulative": sum(getattr(x, "total_tokens") for x in turns[: i + 1]),
        }
        for i, t in enumerate(turns)
    ]
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
  table.data-table th:nth-child(3), table.data-table td:nth-child(3) {{ text-align: left; }}
  table.data-table thead th {{ color: var(--text-secondary); font-weight: 500; }}
  #table-section {{ display: none; }}
</style>
</head>
<body>
<div class="viz-root">
<div class="page">
  <h1>Claude Code トークン使用量レポート</h1>
  <p class="subtitle">セッション: {_escape(title)} ／ 全 {len(turns)} ターン</p>

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
        rows.unshift({{label: "ターン#" + d.index + "  " + (d.timestamp || ""), value: ""}});
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
        showTooltip(evt, [
          {{label: "ターン#" + d.index + "  " + (d.timestamp || ""), value: ""}},
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
    ["#", "時刻", "モデル", "input", "output", "cache_creation", "cache_read", "合計", "累計"].forEach(function (h) {{
      var th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    }});
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    DATA.forEach(function (d) {{
      var tr = document.createElement("tr");
      [d.index, d.timestamp, d.model, fmt(d.input_tokens), fmt(d.output_tokens),
       fmt(d.cache_creation_input_tokens), fmt(d.cache_read_input_tokens), fmt(d.total), fmt(d.cumulative)]
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
    turns = read_turns(path)
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
        "--session", help="セッションID(JSONLファイル名の拡張子抜き)を指定する"
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
    main()
