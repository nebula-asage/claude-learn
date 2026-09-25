# uv・justの導入

**これはホスト環境に実際にソフトウェアを導入する操作であり、シェルの設定ファイル（`~/.bashrc` 等）へのPATH追記も伴う。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「uv/justが入っていないのでユーザーローカルに導入してよいか」を確認する。すでに指定・許可されている場合はそのまま進めてよい。

## uv

- [uv公式が推奨するインストーラー](https://docs.astral.sh/uv/getting-started/installation/)を使う。
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
- インストール後は新しいシェルを開くかプロファイルを再読込しないと `uv` コマンドが見つからないことがある点に注意する（`source ~/.bashrc` 等、あるいはインストーラーが出力するPATHの案内に従う）。
- 続けて `uv python install 3.12` を実行する。これでdistro提供のpythonに頼らず、uvが管理するPythonが使えるようになる。

## just（タスクランナー）

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

- uvは `uv generate-shell-completion bash` でbash補完スクリプトを生成できる。ホスト環境ではroot権限で `/etc/bash_completion.d/` に置く方法は使えないことが多いので、ユーザー単位で有効化する。
  ```bash
  echo 'eval "$(uv generate-shell-completion bash)"' >> ~/.bashrc
  ```
- これもユーザーのシェル設定ファイルを変更する操作なので、追加してよいか確認してから実施する。
