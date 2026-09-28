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

`main.go` がエントリーポイントで、サブコマンド（`create`/`update`/`list`/`get`/`delete`）を `internal/command` にディスパッチするだけの薄い層になっている。処理は以下の4層構造。

- `internal/model` — ドメインモデル（`User`）
- `internal/repository` — データ永続化。`UserRepository` インターフェースと、その実装である `JSONUserRepository`（JSONファイルへの読み書き）
- `internal/service` — 入力値のバリデーションとビジネスロジック。`UserRepository` インターフェースに依存し、具象の `JSONUserRepository` には依存しない。エラーは `UserError`（`Kind` によって種別を区別: `ErrInvalidEmail`・`ErrUserNotFound` など）に統一して返す
- `internal/command` — コマンドライン引数のパースと `UserService` の呼び出し、結果の標準出力への整形

依存の向きは `command → service → repository`（インターフェース経由）。`internal/greeting` は上記のユーザー管理ロジックとは独立した挨拶メッセージ生成のみを行うパッケージで、`main` パッケージには `revive` の `exported` ルール（exportされた識別子へのコメント必須）が適用されないため、コメント強制を意味あるものにする目的で分離されている。

### 入力値の制約

- メールアドレス: 標準的なメール形式（`internal/service/user_service.go` の `emailPattern`）
- ユーザー名: 3文字以上
- 電話番号: 10桁以上の数字
- 年齢: 0〜150

## Lint設定

`.golangci.yml` で `revive` の `package-comments` と `exported` ルールを有効化しており、パッケージコメントおよびexportされた識別子のドキュメンテーションコメントが必須。新しいexport識別子を追加する際はコメントを忘れないこと。
