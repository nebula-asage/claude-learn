# JDK・justの導入

**これはホスト環境に実際にソフトウェアを導入する操作である。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「JDK/just が入っていないのでユーザーローカルに導入してよいか（sudo は使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。

## JDK

```bash
# 最新の Temurin 21 の URL とチェックサムを取得する
curl -sS "https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=linux&vendor=eclipse"
```

返ってきた JSON の `binary.package.link`（ダウンロード URL）と `binary.package.checksum`
（SHA-256）を使って、次のように展開する。

```bash
curl -fsSL -o /tmp/jdk.tar.gz "<binary.package.link>"
sha256sum /tmp/jdk.tar.gz          # <binary.package.checksum> と一致することを必ず確認する
mkdir -p ~/sdk
tar -xzf /tmp/jdk.tar.gz -C ~/sdk  # ~/sdk/jdk-<version>/ ができる
```

- **チェックサムが一致しない場合は絶対に先へ進まない。**
- `~/.bashrc` は書き換えない。以降のコマンドでは
  `export JAVA_HOME="$HOME/sdk/jdk-<version>"` と `export PATH="$JAVA_HOME/bin:$PATH"` を
  その都度指定する。恒久的に PATH を通したい場合は、ユーザーに確認したうえで行う。
- 展開が終わったら `/tmp/jdk.tar.gz` を消す。

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
