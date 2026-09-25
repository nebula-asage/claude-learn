# pnpm・Node.jsランタイム・justの導入

## pnpm本体

- `command -v pnpm >/dev/null && [ -n "$PNPM_HOME" ] && echo "$PNPM_HOME"` で確認する。`PNPM_HOME`が空/未設定なら、`pnpm`があってもnpm経由や旧nvm環境に残った導入である可能性が高いので、スタンドアロン化されていないものとして扱う。
- スタンドアロン導入済みならそのバージョンで進めてよい（`pnpm --version`で12系であることを確認する。11系以下なら`PNPM_VERSION=12`を指定して再導入し、12系に上げる）。
- 未導入、またはnpm経由の旧導入が残っている場合は、[公式スタンドアロンインストーラ](https://pnpm.io/ja/installation#on-posix-systems)で導入する。
  ```bash
  curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=12 sh -
  ```
- **これはホスト環境に実際にソフトウェアを導入する操作であり、シェルの設定ファイル（`~/.bashrc`等）への`PNPM_HOME`・PATH追記も伴う（インストーラーが自動で行う）。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「pnpmが入っていないので公式インストーラーで導入してよいか」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
- インストーラーはpnpm実行バイナリをnpmレジストリの公開鍵で署名検証し、チェックサムも照合してから展開する（`install.sh`の実装で確認済み）。ダウンロード元の任意コード実行を心配する必要はない。
- インストール後は新しいシェルを開くかプロファイルを再読込しないと`pnpm`コマンドが見つからないことがある点に注意する（`source ~/.bashrc`等）。
- npm経由で導入した旧いグローバルpnpm（`npm install -g pnpm`で入れたもの）が残っている場合は、`npm uninstall -g pnpm`で削除してよいかユーザーに確認する（PATH上でスタンドアロン版と競合し、意図しない方が呼ばれる可能性があるため）。

## Node.jsランタイム

```bash
pnpm runtime set node lts -g
```
- これでdistro提供のnodeやnvmに頼らず、pnpmが管理するLTSが`PNPM_HOME`配下に置かれ、PATH上で使えるようになる（`pnpm setup`済みのシェルであること）。
- `pnpm env use`は非推奨（`pnpm runtime`に統合された）ため使わない。
- この機能はpnpmをスタンドアロンインストーラで導入した場合のみ使える。npm経由で導入したpnpmで実行すると`PNPM_HOME`が無い旨のエラーになる。

## just（タスクランナー）

- `command -v just` と `just --version` で確認する。導入済みなら次の手順に進んでよい。
- **これはホスト環境に実際にソフトウェアを導入する操作である。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「justが入っていないのでユーザーローカルに導入してよいか（sudoは使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
- justはRust製の単体バイナリで、GitHub Releasesにtarballと集約チェックサムファイル（`SHA256SUMS`）が公開されているため、それを取得して照合してから展開する。
  ```bash
  VERSION=<確認したバージョン、例: 1.58.0>
  curl -LsSf -o /tmp/just.tar.gz \
    "https://github.com/casey/just/releases/download/${VERSION}/just-${VERSION}-x86_64-unknown-linux-musl.tar.gz"
  curl -LsSf -o /tmp/just-SHA256SUMS \
    "https://github.com/casey/just/releases/download/${VERSION}/SHA256SUMS"
  ```
- `sha256sum -c` は相対パスで実行するかフルパスを一致させる必要があるので、`/tmp` に `cd` してから実行する。
  ```bash
  grep "just-${VERSION}-x86_64-unknown-linux-musl.tar.gz$" /tmp/just-SHA256SUMS > /tmp/just-checksum-line.txt
  mkdir -p /tmp/just-extract
  cp /tmp/just.tar.gz "/tmp/just-extract/just-${VERSION}-x86_64-unknown-linux-musl.tar.gz"
  cp /tmp/just-checksum-line.txt /tmp/just-extract/checksum.txt
  cd /tmp/just-extract && sha256sum -c checksum.txt
  ```
- 検証が通ったら展開し、`~/.local/bin/just` に配置する。
  ```bash
  tar -C /tmp/just-extract -xzf "/tmp/just-extract/just-${VERSION}-x86_64-unknown-linux-musl.tar.gz" just
  mkdir -p ~/.local/bin
  mv /tmp/just-extract/just ~/.local/bin/just
  ```
- 一時ファイル（`/tmp/just*`）は導入後に削除する。`~/.local/bin` がまだ `PATH` に無ければ `~/.bashrc` に追記する。

## （任意）bash補完を有効化する

- pnpmの補完はroot権限なしで使えるユーザー単位のディレクトリに配置する:
  ```bash
  mkdir -p ~/.local/share/bash-completion/completions
  pnpm completion bash > ~/.local/share/bash-completion/completions/pnpm
  ```
- これもユーザーのホーム配下にファイルを追加する操作なので、実施してよいか確認してから行う。
