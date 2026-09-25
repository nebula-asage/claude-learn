# ツールチェーンの導入

**これはホスト環境に実際にソフトウェアを導入する操作であり、rustupの場合はシェル設定ファイル（`~/.bashrc` 等）へのPATH追記も伴う。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「Rustツールチェーン/justが入っていないのでユーザーローカルに導入してよいか（sudoは使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。

**rustup（ツールチェーン本体）:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```
- `~/.cargo` と `~/.rustup` に入り、`~/.cargo/env` を読む行が `~/.bashrc` に追記される。
- **注意**: `~/.bashrc` は非対話シェルだと冒頭の `case $- in *i*) ;; *) return;; esac` で早期returnする。そのためシェルツール経由（非対話シェル）で動作確認する際は `source ~/.bashrc` が効かない。`source "$HOME/.cargo/env"` を直接読むか、`export PATH="$HOME/.cargo/bin:$PATH"` をそのコマンド内で明示すること。

**カバレッジ計測用コンポーネントと追加ツール:**
```bash
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov cargo-deny --locked
```
- `llvm-tools-preview` を入れ忘れると `cargo llvm-cov` が実行時にエラーになる。
- `cargo install` はソースからビルドするため、cargo-denyを含めて数分かかる。`--locked` はクレート側の `Cargo.lock` を使わせる指定で、ビルドが壊れにくくなる。
- `~/.cargo/bin/` に配置される（rustupが同じディレクトリをPATHに通しているので追加のPATH設定は不要）。

**just（タスクランナー）:**
- justはRust製の単体バイナリで、`cargo install` の対象にはできるが数分かかるビルドが必要になる。GitHub Releasesにtarballと集約チェックサムファイル（`SHA256SUMS`）が公開されているため、それを取得して照合してから展開する方がはるかに速い。
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
- 検証が通ったら展開し、`~/.local/bin/just` に配置する（rustupのツールチェーンとは無関係のバイナリのため `~/.cargo/bin` ではなくこのリポジトリ共通の `~/.local/bin` を使う）。
  ```bash
  tar -C /tmp/just-extract -xzf "/tmp/just-extract/just-${VERSION}-x86_64-unknown-linux-musl.tar.gz" just
  mkdir -p ~/.local/bin
  mv /tmp/just-extract/just ~/.local/bin/just
  ```
- 一時ファイル（`/tmp/just*`）は導入後に削除する。`~/.local/bin` がまだ `PATH` に無ければ `~/.bashrc` に追記する。
