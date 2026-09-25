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

- justはRust製の単体バイナリで、GitHub Releasesにtarballと集約チェックサムファイル（`SHA256SUMS`）が公開されているため、それを取得して照合してから展開する。導入・チェックサム検証・一時ファイルの後片付けは同梱スクリプトに任せる。

  ```bash
  VERSION=<GitHub Releasesで確認したバージョン、例: 1.58.0>
  bash .claude/skills/java-springboot-project/scripts/install-just.sh "$VERSION"
  ```

- `~/.local/bin` がまだ `PATH` に無い場合、スクリプトはその旨を表示するだけで `~/.bashrc` は変更しない（シェル設定ファイルの変更は事前にユーザー確認が要るため）。追記が必要な場合はユーザーに確認したうえで行う。
