# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

Goの練習用プロジェクト。リンター・フォーマッター・単体テスト・カバレッジ計測・ドキュメンテーションコメント生成の一式を組み込んだ、コマンドラインでユーザーデータを管理するシンプルなユーザー管理システム（`../rust-learn` のGo版）。

## よく使うコマンド

`just` タスクランナーを使う。引数なしで `just` を実行すると推奨の実行順序が表示される。

```sh
just fmt          # gofmtでフォーマットを適用
just lint         # golangci-lintで静的解析（exportされた識別子のドキュメントコメント欠落もここで検知）
just test         # go testで単体テスト実行（-v付き）
just cover        # カバレッジ計測し、関数ごとの被覆率をターミナルに表示
just cover-html   # カバレッジ計測し、coverage.html にHTMLレポートを生成
just cover-lcov   # カバレッジ計測し、coverage.lcov（Coverage Gutters拡張向け）を生成
just doc          # ドキュメンテーションコメントからMarkdown形式のAPIドキュメントをターミナルに出力
just doc-report   # 各パッケージディレクトリに API.md としてAPIドキュメントを生成
just generate     # go:generateディレクティブに従ってモック等の生成コードを再生成
just clean        # カバレッジ・ドキュメント生成物を削除
just cspell       # pnpxでcspellを取得し、スペルチェックを実行
just markdownlint # pnpxでmarkdownlint-cli2を取得し、Markdownをlint
```

単体テストのみ実行する場合は `go test` を直接使う。

```sh
go test ./internal/service/...              # パッケージ単位
go test ./internal/service/ -run TestCreate  # 特定のテスト関数のみ
```

アプリケーション本体をCLI引数付きで実行する場合、`just run` は空白入りの引数（ユーザー名等）を正しく渡せないため、`go run .` を直接使う。

```sh
go run . create john@example.com "John Doe" 1234567890 25
go run . list
```

データの保存先は環境変数 `USER_DATA_FILE` で指定でき、未指定時はカレントディレクトリの `userdata.json` を使う。

## アーキテクチャ

`main.go` がエントリーポイントで、環境変数からデータファイルのパスを決めて各層を組み立て（依存の注入）、サブコマンド（`create`/`update`/`list`/`get`/`delete`）を `internal/command` にディスパッチするだけの薄い層になっている。環境変数の読み取りや `os.Stdout` への依存は `main.go` に集め、`internal/` 配下のパッケージはパスや `io.Writer` を引数で受け取る。処理は以下の4層構造。

- `internal/model` — ドメインモデル（`User`）
- `internal/repository` — データ永続化。`JSONUserRepository`（JSONファイルへの読み書き）
- `internal/service` — 入力値のバリデーションとビジネスロジック。必要な永続化操作を `UserRepository` インターフェースとして**利用側であるこのパッケージに**定義し（Goの「インターフェースは使う側で定義する」慣習）、具象の `JSONUserRepository` には依存しない。エラーは `ErrInvalidEmail`・`ErrUserNotFound` などのセンチネルエラーを `%w` でラップして返し、呼び出し側は `errors.Is` で種別を判定する
- `internal/command` — コマンドライン引数のパースと `UserService` の呼び出し、結果の `io.Writer` への整形出力。`service.UserService` が必要とされる操作を `UserService` インターフェースとして**このパッケージ自身に**定義しており、`internal/service` と同じ「インターフェースは使う側で定義する」慣習を踏襲している

依存の向きは `command → service`、`repository` は `service.UserRepository` を、`service.UserService`（具象の `*service.UserService`）は `command.UserService` をそれぞれ満たすだけで、両者を結び付けるのは `main.go`。`internal/greeting` は上記のユーザー管理ロジックとは独立した挨拶メッセージ生成のみを行うパッケージで、`main` パッケージには `revive` の `exported` ルール（exportされた識別子へのコメント必須）が適用されないため、コメント強制を意味あるものにする目的で分離されている。

### 入力値の制約

- メールアドレス: 標準的なメール形式（`internal/service/user_service.go` の `emailPattern`）
- ユーザー名: 3文字以上
- 電話番号: 10桁以上の数字
- 年齢: 0〜150

## Lint設定

`.golangci.yml` で `revive` の `package-comments` と `exported` ルールを有効化しており、パッケージコメントおよびexportされた識別子のドキュメンテーションコメントが必須。新しいexport識別子を追加する際はコメントを忘れないこと。

## モック（go.uber.org/mock）

`internal/service` と `internal/command` の単体テストでは、それぞれが自パッケージに定義したインターフェース（`service.UserRepository` / `command.UserService`）のモックに `go.uber.org/mock`（gomock）を使う。`go.mod` の `tool` ディレクティブでバージョンを固定しており、`go install` 等でのグローバル導入は不要（`go tool mockgen` で実行される）。

- モックの実体は各インターフェース定義ファイルの `//go:generate` ディレクティブから生成される
  - `internal/service/user_service.go` → `internal/service/mock_user_repository_test.go`（`MockUserRepository`）
  - `internal/command/user_command.go` → `internal/command/mock_user_service_test.go`（`MockUserService`）
  - いずれも `_test.go` のため本番ビルドには含まれない
- インターフェースにメソッドを追加・変更した場合は `just generate` で再生成すること。生成後のファイルは手編集しない（`DO NOT EDIT` ヘッダ付き）
- テストでは `NewMockXxx(gomock.NewController(t))` でモックを作り、`repo.EXPECT().FindByEmail(...).Return(...)` のように呼び出しごとの戻り値を設定する。設定していないメソッドが呼ばれた場合はテストが失敗する
- `internal/repository` は永続化層の具象実装そのもののテストであり、モックは使わない（ファイルが存在しない・ディレクトリになっている・読み取り専用になっているといった実際のファイルシステム状態を `t.TempDir()` 配下で作ってエラー分岐を検証する）
