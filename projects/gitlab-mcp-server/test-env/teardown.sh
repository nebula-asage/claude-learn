#!/usr/bin/env bash
# test-env のGitLab/Runnerコンテナと、そのnamed volume（データ含む）を全て破棄する。
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "以下を削除します: gitlab-mcp-test のコンテナ・ネットワーク・named volume（GitLabのデータを含む）。"
read -r -p "続行しますか？ [y/N] " answer
case "$answer" in
  y|Y) ;;
  *) echo "中止しました。"; exit 0 ;;
esac

docker compose down -v
rm -f .env.test

echo "test-env を片付けました。"
