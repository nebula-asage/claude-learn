#!/usr/bin/env python3
"""スキルのテンプレートと配置済みファイルのドリフトを検出する。

`.claude/skills/*/templates/` 配下の各テンプレートについて、リポジトリ内の
git追跡ファイルから対応する配置済みファイルを探し、差分を unified diff で出力する。

配置先の探索は「テンプレートからの相対パスの末尾一致」で行う（配置先ではディレクトリ名の
先頭に `.` が付くことがあるため、各セグメントの先頭ドットは無視して比較する）。
  templates/vscode/settings.json      -> projects/foo/.vscode/settings.json
  templates/devcontainer.json         -> .devcontainer/devcontainer.json
  templates/scripts/install-husky.mjs -> projects/foo/scripts/install-husky.mjs

プレースホルダ（__PROJECT_NAME__ 等）は配置先のパスから推測した値に置換してから比較する。

終了コード: 差分なし=0 / 差分あり=1 / 実行エラー=2
"""

from __future__ import annotations

import argparse
import difflib
import subprocess
import sys
from pathlib import Path

SKILLS_DIR = Path(".claude/skills")

# テンプレート側にだけ存在する一般的すぎるファイル名。単体では配置先を特定できず
# 誤検出（例: templates/README.md がリポジトリルートの README.md にマッチする）に
# なるため、単一セグメントのテンプレートのうちこれらは既定で照合対象から外す。
AMBIGUOUS_BASENAMES = {"README.md", ".gitignore"}


def repo_root() -> Path:
    """gitリポジトリのルートディレクトリを返す。

    Returns:
        リポジトリルートの絶対パス。
    """
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(out.stdout.strip())


def tracked_files(root: Path) -> list[Path]:
    """git追跡下のファイル一覧を、リポジトリルートからの相対パスで返す。

    Args:
        root: リポジトリルート。

    Returns:
        追跡ファイルの相対パスのリスト。
    """
    out = subprocess.run(
        ["git", "-C", str(root), "ls-files"],
        capture_output=True,
        text=True,
        check=True,
    )
    return [Path(line) for line in out.stdout.splitlines() if line]


def segments_match(template_seg: str, deployed_seg: str) -> bool:
    """パスセグメント1つ分が対応するかどうかを判定する。

    配置先ではディレクトリ名の先頭に `.` が付くことがある（`vscode` -> `.vscode`）ため、
    先頭のドットを無視して比較する。

    Args:
        template_seg: テンプレート側のセグメント。
        deployed_seg: 配置先側のセグメント。

    Returns:
        対応していれば True。
    """
    return template_seg.lstrip(".") == deployed_seg.lstrip(".")


def find_deployed(template_rel: Path, candidates: list[Path]) -> list[Path]:
    """テンプレートに対応する配置済みファイルの候補を返す。

    Args:
        template_rel: `templates/` からの相対パス。
        candidates: 追跡ファイルの相対パス一覧。

    Returns:
        対応すると判定した配置済みファイルの相対パス一覧。
    """
    want = template_rel.parts
    found = []
    for cand in candidates:
        if SKILLS_DIR in cand.parents:
            continue
        have = cand.parts
        if len(have) < len(want):
            continue
        tail = have[len(have) - len(want) :]
        if all(segments_match(w, h) for w, h in zip(want, tail)):
            found.append(cand)
    return found


def derive_placeholders(deployed_rel: Path) -> dict[str, str]:
    """配置先のパスからプレースホルダの置換値を推測する。

    Args:
        deployed_rel: 配置済みファイルのリポジトリルートからの相対パス。

    Returns:
        プレースホルダ名 -> 置換値 の辞書。
    """
    parts = deployed_rel.parts
    if "projects" in parts:
        idx = parts.index("projects")
        if idx + 1 < len(parts):
            name = parts[idx + 1]
            return {
                "__PROJECT_NAME__": name,
                "__PROJECT_PATH__": f"projects/{name}",
                "__CONTAINER_NAME__": name,
            }
    return {}


def substitute(text: str, mapping: dict[str, str]) -> str:
    """テンプレート中のプレースホルダを置換する。

    Args:
        text: テンプレートの内容。
        mapping: プレースホルダ名 -> 置換値。

    Returns:
        置換後のテキスト。
    """
    for key, value in mapping.items():
        text = text.replace(key, value)
    return text


def classify(diff_lines: list[str]) -> str:
    """diffの内容から、ドリフトの種類を分類する。

    テンプレート側にあった行が配置済みから欠けている（`-` 行がある）場合は、テンプレートの
    変更が未反映の可能性が高い。配置済みに行が増えているだけ（`+` 行のみ）の場合は、
    プロジェクト固有の意図的な追記である可能性が高い。

    JSON/JSONCに項目を追記すると直前の行の末尾にカンマが付く（`}` -> `},`）ため、
    末尾カンマと前後の空白だけの違いは「削除」として数えない。

    Args:
        diff_lines: unified diff の行リスト。

    Returns:
        分類ラベル。
    """

    def norm(line: str) -> str:
        return line[1:].strip().rstrip(",")

    removed_lines = [
        line for line in diff_lines if line.startswith("-") and not line.startswith("---")
    ]
    added_lines = [line for line in diff_lines if line.startswith("+") and not line.startswith("+++")]
    added_norm = [norm(line) for line in added_lines]
    # 追加側に同じ内容の行があるものは、末尾カンマが付いただけの行とみなす
    real_removed = []
    leftover = list(added_norm)
    for line in removed_lines:
        key = norm(line)
        if key in leftover:
            leftover.remove(key)
        else:
            real_removed.append(line)

    removed = len(real_removed)
    added = len(added_lines)
    if removed and added:
        return f"要確認: テンプレートとの相違（-{removed}/+{added}）"
    if removed:
        return f"要確認: テンプレートの内容が配置済みに無い（-{removed}）"
    return f"追記のみ: プロジェクト固有の拡張の可能性が高い（+{added}）"


def similarity(a: str, b: str) -> float:
    """2つのテキストの類似度を返す。

    通常の類似度（`SequenceMatcher.ratio`）は長さが大きく違うと低く出る。テンプレートに
    コメントや設定を大量に追記した直後は、未反映の配置済みファイルが「別物」と誤判定されて
    検査から漏れるため、短い方がどれだけ長い方に含まれているか（包含率）も併せて見て、
    大きい方を採用する。

    Args:
        a: 比較するテキスト。
        b: 比較するテキスト。

    Returns:
        0.0〜1.0 の類似度。
    """
    matcher = difflib.SequenceMatcher(None, a, b, autojunk=False)
    shorter = min(len(a), len(b))
    if shorter == 0:
        return matcher.ratio()
    matched = sum(block.size for block in matcher.get_matching_blocks())
    return max(matcher.ratio(), matched / shorter)


def read(path: Path) -> str | None:
    """テキストファイルを読む。バイナリや読み取り不能なら None を返す。

    Args:
        path: 読み取り対象。

    Returns:
        ファイル内容。読めなければ None。
    """
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def main() -> int:
    """エントリポイント。

    Returns:
        終了コード。
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skill",
        help="対象スキル名（`.claude/skills/` 直下のディレクトリ名）。省略時は全スキル。",
    )
    parser.add_argument(
        "--path-filter",
        help="配置先のパスに含まれる文字列で絞り込む（例: projects/python-practice）。",
    )
    parser.add_argument(
        "--include-ambiguous",
        action="store_true",
        help=f"既定で除外している一般的すぎるファイル名 {sorted(AMBIGUOUS_BASENAMES)} も照合する。",
    )
    parser.add_argument(
        "--list-unmatched",
        action="store_true",
        help="対応する配置済みファイルが見つからなかったテンプレートも一覧する。",
    )
    parser.add_argument(
        "--only-suspect",
        action="store_true",
        help="「追記のみ」に分類された差分を隠し、テンプレート未反映の疑いがあるものだけ表示する。",
    )
    parser.add_argument(
        "--min-similarity",
        type=float,
        default=0.5,
        help="この類似度を下回るペアは別物とみなして無視する（既定: 0.5）。",
    )
    parser.add_argument(
        "--all-matches",
        action="store_true",
        help="1つの配置済みファイルに複数テンプレートがマッチした場合、最良の1件だけでなく全件表示する。",
    )
    args = parser.parse_args()

    try:
        root = repo_root()
    except subprocess.CalledProcessError:
        print("gitリポジトリ内で実行してください。", file=sys.stderr)
        return 2

    skills_root = root / SKILLS_DIR
    if not skills_root.is_dir():
        print(f"{SKILLS_DIR} が見つかりません。", file=sys.stderr)
        return 2

    skill_dirs = sorted(d for d in skills_root.iterdir() if (d / "templates").is_dir())
    if args.skill:
        skill_dirs = [d for d in skill_dirs if d.name == args.skill]
        if not skill_dirs:
            print(f"テンプレートを持つスキル '{args.skill}' が見つかりません。", file=sys.stderr)
            return 2

    candidates = tracked_files(root)
    drift_count = 0
    same_count = 0
    additive_count = 0
    unmatched: list[str] = []
    # 同じ配置済みファイルに複数スキルのテンプレートがマッチしうるため、
    # いったん全ペアを集めてから配置先ごとに最も似ているものだけを残す。
    pairs: dict[Path, list[tuple[float, Path, Path, str, str]]] = {}

    for skill_dir in skill_dirs:
        templates_dir = skill_dir / "templates"
        for template in sorted(p for p in templates_dir.rglob("*") if p.is_file()):
            rel = template.relative_to(templates_dir)
            if (
                len(rel.parts) == 1
                and rel.name in AMBIGUOUS_BASENAMES
                and not args.include_ambiguous
            ):
                continue

            deployed_list = find_deployed(rel, candidates)
            if args.path_filter:
                deployed_list = [d for d in deployed_list if args.path_filter in str(d)]
            if not deployed_list:
                unmatched.append(f"{skill_dir.name}: templates/{rel}")
                continue

            template_text = read(template)
            if template_text is None:
                continue

            for deployed in deployed_list:
                deployed_text = read(root / deployed)
                if deployed_text is None:
                    continue
                expected = substitute(template_text, derive_placeholders(deployed))
                ratio = similarity(expected, deployed_text)
                if ratio < args.min_similarity:
                    # 別スキル由来・別用途のファイルにたまたま名前が一致しただけとみなす
                    continue
                pairs.setdefault(deployed, []).append(
                    (ratio, skill_dir, rel, expected, deployed_text)
                )

    for deployed in sorted(pairs):
        matches = sorted(pairs[deployed], key=lambda m: m[0], reverse=True)
        if not args.all_matches:
            matches = matches[:1]
        for ratio, skill_dir, rel, expected, deployed_text in matches:
            if expected == deployed_text:
                same_count += 1
                continue

            diff = list(
                difflib.unified_diff(
                    expected.splitlines(keepends=True),
                    deployed_text.splitlines(keepends=True),
                    fromfile=f"template ({skill_dir.name}/templates/{rel})",
                    tofile=f"deployed ({deployed})",
                )
            )
            label = classify(diff)
            if args.only_suspect and label.startswith("追記のみ"):
                additive_count += 1
                continue

            drift_count += 1
            print(f"=== [{label}] 類似度 {ratio:.2f}")
            print(f"    {skill_dir.name}: templates/{rel}  ->  {deployed}")
            sys.stdout.writelines(diff)
            print()

    if args.list_unmatched and unmatched:
        print("=== 配置先が見つからなかったテンプレート")
        for item in unmatched:
            print(f"  {item}")
        print()

    summary = f"一致: {same_count} 件 / 差分あり: {drift_count} 件"
    if additive_count:
        summary += f" /「追記のみ」として非表示: {additive_count} 件"
    print(summary)
    return 1 if drift_count else 0


if __name__ == "__main__":
    sys.exit(main())
