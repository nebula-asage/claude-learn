# __PROJECT_NAME__

Goの練習用プロジェクト。リンター・フォーマッター・単体テスト・カバレッジ計測・ドキュメンテーションコメントの一式を組み込んでいる。

## 構成

- `main.go` — エントリーポイント
- `internal/greeting/` — 挨拶メッセージを組み立てるロジック（`main`パッケージには`revive`の`exported`ルール（exportされた識別子にコメント必須）が適用されないため、コメント強制を意味あるものにするためにロジックを別パッケージへ分離している）

## 前提

- Go 1.26 以上（`go version` で確認）
- [golangci-lint](https://golangci-lint.run/) v2系（`golangci-lint version` で確認）
- [gomarkdoc](https://github.com/princjef/gomarkdoc)・[gcov2lcov](https://github.com/jandelgado/gcov2lcov)（`go.mod` の `tool` ディレクティブでバージョン固定済みのため別途導入は不要。`go tool gomarkdoc` / `go tool gcov2lcov` として実行される）
- [just](https://just.systems/)（`just --version` で確認。GitHub ReleasesのtarballとSHA256SUMSで導入）
- [go.uber.org/mock](https://github.com/uber-go/mock)（単体テストのモック生成。`go.mod` の `tool` ディレクティブでバージョン固定済みのため別途導入は不要。`go tool mockgen` として実行される）

## 実行方法

```sh
just build        # バイナリ __PROJECT_NAME__ を生成
just run          # 実行
just fmt          # gofmtでフォーマット
just fmt-check    # フォーマット崩れの確認のみ（適用しない）
just lint         # golangci-lintで静的解析（exportされた識別子のドキュメントコメント欠落もここで検知）
just test         # go testで単体テスト
just cover        # カバレッジ計測し、ターミナルに未カバー関数を表示
just cover-html   # カバレッジ計測し、coverage.html にHTMLレポートを生成
just doc          # ドキュメンテーションコメントからMarkdown形式のAPIドキュメントをターミナルに出力
just doc-report   # 各パッケージディレクトリに API.md としてAPIドキュメントを生成
just doc-html     # HTML形式のAPIドキュメント api.html を生成（pnpxでmarkedを取得して変換）
just generate     # go:generateディレクティブに従ってモック等の生成コードを再生成
just audit        # 依存の脆弱性をgovulncheckで検査（ネットワークが必要）
just check        # fmt-check・lint・test・auditをまとめて実行
just clean        # カバレッジ・ドキュメント・ビルド生成物を削除
```

`just cover-html` 実行後、`coverage.html` をブラウザで開くと行単位のカバレッジが確認できる。
`just doc-report` 実行後、`internal/greeting/API.md` などにパッケージごとのAPIリファレンスが生成される。
