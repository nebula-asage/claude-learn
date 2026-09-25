#!/usr/bin/env bash
# just（タスクランナー）をユーザーローカルに導入する。
# 使い方: install-just.sh <VERSION>（例: install-just.sh 1.58.0。事前にGitHub Releasesで確認したバージョンを渡す）
#
# ~/.bashrc 等のシェル設定ファイルはここでは変更しない（変更にはユーザーの事前確認が要るため）。
# ~/.local/bin が PATH に無い場合は、その旨を表示するだけに留める。
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <VERSION>" >&2
  exit 1
fi

VERSION="$1"
ASSET="just-${VERSION}-x86_64-unknown-linux-musl.tar.gz"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

curl -LsSf -o "$WORKDIR/$ASSET" \
  "https://github.com/casey/just/releases/download/${VERSION}/${ASSET}"
curl -LsSf -o "$WORKDIR/SHA256SUMS" \
  "https://github.com/casey/just/releases/download/${VERSION}/SHA256SUMS"

grep "${ASSET}\$" "$WORKDIR/SHA256SUMS" > "$WORKDIR/checksum.txt"
(cd "$WORKDIR" && sha256sum -c checksum.txt)

tar -C "$WORKDIR" -xzf "$WORKDIR/$ASSET" just
mkdir -p ~/.local/bin
mv "$WORKDIR/just" ~/.local/bin/just

echo "just ${VERSION} を ~/.local/bin/just に導入しました。"

case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo "注意: ~/.local/bin が PATH に見当たりません。~/.bashrc への追記が必要な場合はユーザーに確認のうえ行ってください（このスクリプトはシェル設定ファイルを変更しません）。" ;;
esac
