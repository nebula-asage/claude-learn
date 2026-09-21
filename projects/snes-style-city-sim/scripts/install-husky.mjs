import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import husky from "husky";

// このプロジェクトはmonorepoのサブディレクトリにあり、.gitはリポジトリルート直下にしかない。
// husky() はカレントディレクトリ直下の .git しか認識しないため、
// リポジトリルートに一度cdしてから、このプロジェクト配下の .husky を指定して呼び出す必要がある。
const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gitRoot = execSync("git rev-parse --show-toplevel", { cwd: projectDir }).toString().trim();
const hooksDir = path.relative(gitRoot, path.join(projectDir, ".husky"));

process.chdir(gitRoot);
const result = husky(hooksDir);
if (result) {
  console.error(`husky - ${result}`);
  process.exit(1);
}
