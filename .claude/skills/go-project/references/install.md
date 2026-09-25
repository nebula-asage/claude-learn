# ユーザーローカルに導入する

**これはホスト環境に実際にソフトウェアを導入する操作であり、`~/.bashrc` へのPATH追記も伴う。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「Go/golangci-lint/gomarkdoc/gcov2lcov/justが入っていないのでユーザーローカルに導入してよいか（sudoは使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。

**Go本体:**

- `https://go.dev/dl/?mode=json` を参照し、`stable: true` かつ `os: linux` / `arch: amd64`（環境に応じて調整）の最新版tarballのファイル名・sha256を確認する。
- tarballをダウンロードし、`sha256sum -c` で公式が公開しているハッシュと一致することを確認してから展開する。ここで検証をスキップしない。

  ```bash
  curl -LsSf -o /tmp/go.tar.gz https://go.dev/dl/<filename>
  echo "<sha256>  /tmp/go.tar.gz" | sha256sum -c -
  mkdir -p ~/sdk
  rm -rf ~/sdk/go
  tar -C ~/sdk -xzf /tmp/go.tar.gz
  ```

- `~/.bashrc` に以下を追記する（`GOPATH` はデフォルトの `~/go` を使う）。

  ```bash
  export GOROOT="$HOME/sdk/go"
  export GOPATH="$HOME/go"
  export PATH="$GOROOT/bin:$GOPATH/bin:$PATH"
  ```

- **注意**: `~/.bashrc` は非対話シェルだと冒頭の `case $- in *i*) ;; *) return;; esac` で早期returnする。そのため、この後の動作確認をシェルツール経由（非対話シェル）で行う際は `source ~/.bashrc` が効かない。動作確認時は `export GOROOT=... GOPATH=... PATH=...` を明示的にそのコマンド内で設定してから実行すること。

**golangci-lint:**

- `https://github.com/golangci/golangci-lint/releases` で最新バージョンを確認する。
- **`install.sh` は使わない**（前述の通り資産選択バグでchecksum検証に失敗する既知の問題があるため）。代わりにGitHub Releasesからtarballと `checksums.txt` を直接取得し、突き合わせる。

  ```bash
  VERSION=<確認したバージョン、例: 2.12.2>
  curl -LsSf -o /tmp/golangci-lint.tar.gz \
    "https://github.com/golangci/golangci-lint/releases/download/v${VERSION}/golangci-lint-${VERSION}-linux-amd64.tar.gz"
  curl -LsSf -o /tmp/golangci-lint-checksums.txt \
    "https://github.com/golangci/golangci-lint/releases/download/v${VERSION}/golangci-lint-${VERSION}-checksums.txt"
  grep "linux-amd64.tar.gz$" /tmp/golangci-lint-checksums.txt | sha256sum -c -
  ```

  （`sha256sum -c` は相対パスで実行するかフルパスを一致させる必要があるので、`/tmp` に `cd` してから実行するとよい）
- 検証が通ったら展開し、`$(go env GOPATH)/bin/golangci-lint` に配置する。

  ```bash
  tar -C /tmp/golangci-lint-extract -xzf /tmp/golangci-lint.tar.gz
  mkdir -p "$(go env GOPATH)/bin"
  cp /tmp/golangci-lint-extract/golangci-lint-${VERSION}-linux-amd64/golangci-lint "$(go env GOPATH)/bin/golangci-lint"
  chmod +x "$(go env GOPATH)/bin/golangci-lint"
  ```

- 一時ファイル（`/tmp/golangci-lint*`）は導入後に削除する。

**gomarkdoc:**

- `go install` で導入する。Goのモジュールシステムが標準でチェックサム検証（GOSUMDB）を行うため、golangci-lintのような追加の手動検証は不要。

  ```bash
  go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest
  ```

- `$(go env GOPATH)/bin/gomarkdoc` に配置される。多数の間接依存（cobra/viper等）を取得するため初回はやや時間がかかる点に留意する。

**gcov2lcov:**

- `go install` で導入する。gomarkdocと同様、GOSUMDBによるチェックサム検証があるため追加の手動検証は不要。

  ```bash
  go install github.com/jandelgado/gcov2lcov@latest
  ```

- `$(go env GOPATH)/bin/gcov2lcov` に配置される。

**just:**

- justはRust製の単体バイナリで、golangci-lintと違い `go install` の対象外。GitHub Releasesにtarballと集約チェックサムファイル（`SHA256SUMS`）が公開されているため、それを取得して照合してから展開する。導入・チェックサム検証・一時ファイルの後片付けは同梱スクリプトに任せる（Goツールチェーンとは無関係のバイナリのため `$(go env GOPATH)/bin` ではなくこのリポジトリ共通の `~/.local/bin` に配置する）。

  ```bash
  VERSION=<GitHub Releasesで確認したバージョン、例: 1.58.0>
  bash .claude/skills/go-project/scripts/install-just.sh "$VERSION"
  ```

- `~/.local/bin` がまだ `PATH` に無い場合、スクリプトはその旨を表示するだけで `~/.bashrc` は変更しない（シェル設定ファイルの変更は事前にユーザー確認が要るため）。追記が必要な場合はユーザーに確認したうえで行う。
