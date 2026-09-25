# 動作確認する

`<配置先>` に移動し、動作確認は以下の1本のコマンドにまとめて実行する（成功を前提に連結し、落ちたコマンドだけ個別に切り分ける）。前述の通り、非対話シェルでは `~/.bashrc` のPATH設定が効かないため、必要なら各コマンドの前に `export GOROOT/GOPATH/PATH` を明示する。

```bash
set -e
echo "=== just (list) ==="; just
echo "=== run ==="; just run
echo "=== fmt ==="; just fmt
echo "=== lint ==="; just lint
echo "=== test ==="; just test
echo "=== cover ==="; just cover
echo "=== cover-html ==="; just cover-html
echo "=== cover-lcov ==="; just cover-lcov
echo "=== doc ==="; just doc
echo "=== doc-report ==="; just doc-report
echo "=== clean ==="; just clean
```

手順5でVS Code向け設定を配置していない場合は `cover-lcov` の行を省いてよい。

出力から以下を確認する:

- `just`: レシピ一覧（`just --list`相当）が表示される
- `run`（`go run .`）: 正常に動作する
- `fmt`（`gofmt -l -w .`）: フォーマットが適用される
- `lint`（`golangci-lint run ./...`）: `0 issues.` で終了する。`main.go`・`internal/greeting/greeting.go` にパッケージコメント／関数コメントが入っているかもここで再確認する
- `test`（`go test ./... -v`）: テンプレート同梱のサンプルテスト（`internal/greeting/greeting_test.go`）が通る
- `cover`: ターミナルに関数ごとのカバレッジ（`go tool cover -func`）が表示される
- `cover-html`: `coverage.html` が生成される
- `cover-lcov`: `coverage.lcov` が生成される（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、テストで呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）
- `doc`: ドキュメンテーションコメントから生成されたMarkdownがターミナルに表示される
- `doc-report`: `internal/greeting/API.md`（および `main` パッケージ側）にAPIリファレンスが生成される。`gomarkdoc`自身のテンプレート構文（`{{.Dir}}`）とjustのテンプレート展開が衝突するため、`justfile`側でエスケープしている点に注意する（詳細はjustfileのコメント参照。gomarkdocの出力パス指定を直接書くとjustが`{{.Dir}}`をjust式として解析しようとして構文エラーになる）
- `clean`: `coverage.out` / `coverage.html` / `coverage.lcov` / `API.md` が削除される

途中で失敗したら、そのコマンドだけ単独で再実行して詳細を確認する。

lintの実効性を反証で確かめる場合は `references/counter-tests.md` を参照する。
