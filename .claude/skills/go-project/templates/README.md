# __PROJECT_NAME__

Goの練習用プロジェクト。リンター・フォーマッター・単体テスト・カバレッジ計測・ドキュメンテーションコメントの一式を組み込んでいる。

## 構成

- `main.go` — エントリーポイント
- `internal/greeting/` — 挨拶メッセージを組み立てるロジック（`main`パッケージには`revive`の`exported`ルール（exportされた識別子にコメント必須）が適用されないため、コメント強制を意味あるものにするためにロジックを別パッケージへ分離している）

## 前提

- Go 1.26 以上（`go version` で確認）
- [golangci-lint](https://golangci-lint.run/) v2系（`golangci-lint version` で確認）
- [gomarkdoc](https://github.com/princjef/gomarkdoc)（`gomarkdoc --version` で確認。`go install github.com/princjef/gomarkdoc/cmd/gomarkdoc@latest` で導入）
- [Task](https://taskfile.dev/)（`task --version` で確認。`go install github.com/go-task/task/v3/cmd/task@latest` で導入）

## 実行方法

```sh
task run          # 実行
task fmt          # gofmtでフォーマット
task lint         # golangci-lintで静的解析（exportされた識別子のドキュメントコメント欠落もここで検知）
task test         # go testで単体テスト
task cover        # カバレッジ計測し、ターミナルに未カバー関数を表示
task cover-html   # カバレッジ計測し、coverage.html にHTMLレポートを生成
task doc          # ドキュメンテーションコメントからMarkdown形式のAPIドキュメントをターミナルに出力
task doc-report   # 各パッケージディレクトリに API.md としてAPIドキュメントを生成
task clean        # カバレッジ・ドキュメント生成物を削除
```

`task cover-html` 実行後、`coverage.html` をブラウザで開くと行単位のカバレッジが確認できる。
`task doc-report` 実行後、`internal/greeting/API.md` などにパッケージごとのAPIリファレンスが生成される。
