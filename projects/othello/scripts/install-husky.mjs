import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import husky from "husky";

// このプロジェクトはmonorepoのサブディレクトリにあり、.gitはリポジトリルート直下にしかない。
// husky() はカレントディレクトリ直下の .git しか認識しないため、
// リポジトリルートに一度cdしてから、このプロジェクト配下の .husky を指定して呼び出す必要がある。
const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// core.hooksPath はリポジトリ全体で共有される設定。git worktree（.gitがディレクトリでなく
// gitdirへのポインタファイルになる作業ツリー）内でこのスクリプトが発火すると、worktree基準の
// パスで上書きしてしまったり、husky() 自体が .git を認識できず失敗したりする。
// メインの作業ディレクトリ以外では何もせず警告を出してスキップする
// （--git-dir と --git-common-dir が一致するのはメインの作業ディレクトリのときだけ）。
const gitDir = path.resolve(
  projectDir,
  execSync("git rev-parse --git-dir", { cwd: projectDir }).toString().trim(),
);
const gitCommonDir = path.resolve(
  projectDir,
  execSync("git rev-parse --git-common-dir", { cwd: projectDir }).toString().trim(),
);
if (gitDir !== gitCommonDir) {
  console.warn(
    "husky - git worktree内での実行を検知したため、core.hooksPathの設定をスキップしました",
  );
  process.exit(0);
}

const gitRoot = execSync("git rev-parse --show-toplevel", { cwd: projectDir }).toString().trim();
// core.hooksPath はリポジトリ全体で共有される設定のため、実行時のcwdに依存しないよう絶対パスで設定する
// （相対パスだと、想定外のcwdから prepare が発火した場合に誤った値で上書きされる）。
const hooksDir = path.join(projectDir, ".husky");

process.chdir(gitRoot);
const result = husky(hooksDir);
if (result) {
  console.error(`husky - ${result}`);
  process.exit(1);
}
