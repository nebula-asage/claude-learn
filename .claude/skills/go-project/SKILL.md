---
name: go-project
description: Go言語の練習・開発プロジェクト一式（go.mod+main.go+internalパッケージ+golangci-lintによるlint+go testでのテスト/カバレッジHTMLレポート+revive/gomarkdocによるドキュメンテーションコメント強制/APIドキュメント生成）をホスト環境に直接構築するスキル。「goの環境/プロジェクトを作って」「golangci-lintを入れて」「goのカバレッジ測定/レポートがほしい」「ドキュメンテーションコメントを強制したい」「APIドキュメントを生成したい」など、Goプロジェクトの新規作成・再作成や、既存プロジェクトへのlint/カバレッジ/ドキュメンテーション環境の追加を頼まれたら、明示的に「go-project」と言われなくても必ず使うこと。Docker/devcontainerには依存せずホストのユーザーローカル環境（sudo不要）に直接導入する。devcontainer自体の構築を頼まれた場合はdevcontainer-ubuntu-jaスキルを使う。
---

# go-project

**Go本体のユーザーローカル導入**、**golangci-lintによる静的解析**、**gomarkdocによるドキュメンテーションコメントのAPIリファレンス生成**を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`projects/go-practice/` で一度構築・検証済みの条件を、コンテナに依存しない形でテンプレート化したもの。

このスキルは [[devcontainer-ubuntu-ja]] などのdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときはそちらのスキルを使うこと。

このスキルが用意するのは、リンター・フォーマッター・テスト・カバレッジ計測・ドキュメンテーションコメント環境が最初から動く**土台（スキャフォールディング）**であり、`main.go`/`internal/greeting/` の中身はテンプレートのサンプル実装（`Greet` 関数）のままである。ユーザーが「HTTPサーバーを書きたい」「CLIツールを作りたい」のように具体的な用途を挙げている場合は、手順4でテンプレートを配置した後、その用途に合わせて中身を実装し直すこと（土台を作って終わりにしない）。

## このスキルが前提とする条件（変更しない）

- **Go本体・golangci-lint・gomarkdocはユーザーローカルに導入する**。sudoやシステム全体へのインストールには依存しない（`apt install golang` 等は使わない）。これは、このリポジトリのホストがsudoにパスワードを要求する構成であり、かつ [[python-uv-project]] や [[pnpm-nvm-project]] と同じ「システムに触れずユーザー権限だけで開発環境を完結させる」方針に揃えるため
- **golangci-lintは公式インストールスクリプト（`install.sh`）を使わない**。導入手順の節で詳しく説明するが、`install.sh` はGitHub Releasesの資産選択ロジックに既知のバグがあり、tarball本体ではなく `.sbom.json` を誤ってダウンロードしてsha256検証に失敗することを確認済み。GitHub Releasesから直接tarballとchecksumsファイルを取得し、自分でsha256sumを照合してから展開する
- **golangci-lintの設定はv2形式**（`version: "2"` をトップに書く新スキーマ）を使う。v1の `linters.enable` フラット形式ではない
- **テスト・カバレッジ計測も標準で組み込む**。`go test` はGo標準ツールチェーンに同梱されているため追加インストールは不要。`Makefile` に `fmt`/`lint`/`test`/`cover`/`cover-html`/`doc`/`doc-report`/`run`/`clean` の各ターゲットを用意し、`go tool cover -html` でHTMLレポート（`coverage.html`）を生成できるようにする
- **ロジックは `main` パッケージに直接書かず、`internal/<パッケージ名>/` に分離する**。理由: golangci-lintのデフォルト有効リンター `revive` の `exported` ルール（exportされた関数・型にドキュメントコメントを必須にするルール）は、`main` パッケージには適用されない仕様になっている（`main` パッケージは外部からimportされる公開APIではないため）。ドキュメンテーションコメントの強制を実際に機能させるには、importable な非mainパッケージが最低1つ必要になる。テンプレートでは `internal/greeting/` にサンプルロジックを置いている
- **ドキュメンテーションコメントは golangci-lint（revive）で強制する**。`.golangci.yml` の `linters.settings.revive.rules` に `package-comments`（パッケージコメント必須）と `exported`（exportされた識別子のコメント必須）を明示的に列挙する。revive は `rules` を指定すると指定したルールだけが有効になる（デフォルトルールセットを暗黙に維持しない）ため、`package-comments` を省略すると `main.go` のパッケージコメント欠落チェックが失われる点に注意する
- **APIドキュメントの生成には `gomarkdoc`（`github.com/princjef/gomarkdoc`）を使う**。Go標準の `godoc` コマンド（`golang.org/x/tools/cmd/godoc`）は非推奨パッケージであり、実際に検証したところGoモジュール対応のパッケージ内容を正しくレンダリングできなかった（ページの外枠だけが返り、関数一覧が表示されない）。`pkgsite`（`golang.org/x/pkgsite/cmd/pkgsite`）もローカルモジュールを直接指定すると `This page is not supported by this datasource.` を返し、単体では動作しなかった。`gomarkdoc` はエクスポートされた識別子のドキュメンテーションコメントから直接Markdownを生成でき、`go install` で導入も容易なため、これを標準採用する
- `main.go` には**パッケージコメントを必ず入れる**。`internal/greeting/greeting.go` にも**パッケージコメントとexportされた関数のコメントを必ず入れる**。どちらも上記のreviveルールに引っかかり、`lint` がエラーで落ちるため

## 手順

1. **Go・golangci-lint・gomarkdocがホストに導入済みか確認する**
   - `command -v go` と `go version` でGo本体を確認する。
   - `command -v golangci-lint` と `golangci-lint version` でgolangci-lintを確認する（v2系であることも確認する。v1系しか入っていない場合は設定ファイルの互換性に注意し、ユーザーに再導入してよいか確認する）。
   - `command -v gomarkdoc` と `gomarkdoc --version` でgomarkdocを確認する。
   - 全て導入済みならステップ3に進んでよい。

2. **未導入の場合、ユーザーローカルに導入する**
   - **これはホスト環境に実際にソフトウェアを導入する操作であり、`~/.bashrc` へのPATH追記も伴う。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「Go/golangci-lint/gomarkdocが入っていないのでユーザーローカルに導入してよいか（sudoは使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。

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

3. **配置先とプロジェクト名を確認する**
   - このリポジトリの `projects/README.md` のルールにより、基本は `projects/<project-name>/` 配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい（例: 「goの練習環境」→ `go-practice`）。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

4. **テンプレートをコピーし、プレースホルダを置換する**
   - `.claude/skills/go-project/templates/go.mod` → `<配置先>/go.mod`（`__PROJECT_NAME__` をGoのモジュール名として妥当な形式に置換。特にホスト先の指定がなければリポジトリ名やディレクトリ名そのままでよい）
   - `.claude/skills/go-project/templates/main.go` → `<配置先>/main.go`（`__PROJECT_NAME__` を置換。importパス `__PROJECT_NAME__/internal/greeting` も含めて置換すること）
   - `.claude/skills/go-project/templates/internal/greeting/greeting.go` → `<配置先>/internal/greeting/greeting.go`
   - `.claude/skills/go-project/templates/internal/greeting/greeting_test.go` → `<配置先>/internal/greeting/greeting_test.go`
   - `.claude/skills/go-project/templates/README.md` → `<配置先>/README.md`（`__PROJECT_NAME__` を置換）
   - `.claude/skills/go-project/templates/.golangci.yml` → `<配置先>/.golangci.yml`（置換不要）
   - `.claude/skills/go-project/templates/Makefile` → `<配置先>/Makefile`（置換不要）
   - `.claude/skills/go-project/templates/.gitignore` → `<配置先>/.gitignore`（置換不要。リポジトリルートの `.gitignore` には既に `# Go` セクションと `/bin/` の除外があるため、ルート側は変更しない）

5. **動作確認する**
   `<配置先>` に移動し、以下を確認する。前述の通り、非対話シェルでは `~/.bashrc` のPATH設定が効かないため、必要なら各コマンドの前に `export GOROOT/GOPATH/PATH` を明示する。確認後、動作確認で生成された `coverage.out` / `coverage.html` / `API.md`（各パッケージディレクトリ配下）は `make clean` で削除し、コミット対象に残さないこと。
   - `make run`（`go run .`）を実行し、正常に動作することを確認する。
   - `make fmt`（`gofmt -l -w .`）を実行し、フォーマットが適用されることを確認する。
   - `make lint`（`golangci-lint run ./...`）が `0 issues.` で終了することを確認する。`main.go`・`internal/greeting/greeting.go` にパッケージコメント／関数コメントが入っているかもここで再確認する。
   - `make test`（`go test ./... -v`）を実行し、テンプレート同梱のサンプルテスト（`internal/greeting/greeting_test.go`）が通ることを確認する。
   - `make cover` を実行し、ターミナルに関数ごとのカバレッジ（`go tool cover -func`）が表示されることを確認する。
   - `make cover-html` を実行し、`coverage.html` が生成されることを確認する。
   - `make doc` を実行し、ドキュメンテーションコメントから生成されたMarkdownがターミナルに表示されることを確認する。
   - `make doc-report` を実行し、`internal/greeting/API.md`（および `main` パッケージ側）にAPIリファレンスが生成されることを確認する。
   - `make clean` で `coverage.out` / `coverage.html` / `API.md` を削除する。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外。コンテナ環境が欲しいと言われたら [[devcontainer-ubuntu-ja]] スキルを使う（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- Go本体・golangci-lint・gomarkdocのユーザーローカル導入方針、`install.sh` を使わない導入手順、golangci-lint v2設定形式、`go test` + `go tool cover` によるテスト・カバレッジ計測環境、`internal/` パッケージ分離とreviveによるドキュメンテーションコメント強制、gomarkdocによるAPIリファレンス生成は、このリポジトリで検証済みの固定条件として扱い、単なる「Go環境を作って」的な依頼でも省略しない。
