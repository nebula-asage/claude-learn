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

- justはRust製の単体バイナリで、`cargo install` の対象にはできるが数分かかるビルドが必要になる。GitHub Releasesにtarballと集約チェックサムファイル（`SHA256SUMS`）が公開されているため、それを取得して照合してから展開する方がはるかに速い。導入・チェックサム検証・一時ファイルの後片付けは同梱スクリプトに任せる（rustupのツールチェーンとは無関係のバイナリのため `~/.cargo/bin` ではなくこのリポジトリ共通の `~/.local/bin` に配置する）。

  ```bash
  VERSION=<GitHub Releasesで確認したバージョン、例: 1.58.0>
  bash .claude/skills/rust-cargo-project/scripts/install-just.sh "$VERSION"
  ```

- `~/.local/bin` がまだ `PATH` に無い場合、スクリプトはその旨を表示するだけで `~/.bashrc` は変更しない（シェル設定ファイルの変更は事前にユーザー確認が要るため）。追記が必要な場合はユーザーに確認したうえで行う。
