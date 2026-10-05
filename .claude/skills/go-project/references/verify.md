# 動作確認する

`<配置先>` に移動し、動作確認は以下の1本のコマンドにまとめて実行する（成功を前提に連結し、落ちたコマンドだけ個別に切り分ける）。前述の通り、非対話シェルでは `~/.bashrc` のPATH設定が効かないため、必要なら各コマンドの前に `export GOROOT/GOPATH/PATH` を明示する。

```bash
set -e
echo "=== just (usage) ==="; just
echo "=== just --list ==="; just --list
echo "=== build ==="; just build
echo "=== run ==="; just run
echo "=== fmt ==="; just fmt
echo "=== fmt-check ==="; just fmt-check
echo "=== lint ==="; just lint
echo "=== test ==="; just test
echo "=== cover ==="; just cover
echo "=== cover-html ==="; just cover-html
echo "=== cover-lcov ==="; just cover-lcov
echo "=== doc ==="; just doc
echo "=== doc-report ==="; just doc-report
echo "=== doc-html ==="; just doc-html
echo "=== generate ==="; just generate
echo "=== audit ==="; just audit
echo "=== check ==="; just check
echo "=== clean ==="; just clean
```

手順5でVS Code向け設定を配置していない場合は `cover-lcov` の行を省いてよい。

出力から以下を確認する:

- `just`: 引数なし実行でレシピの実行順序（`usage`レシピ）が表示される
- `just --list`: レシピ一覧が表示される
- `build`: バイナリ `<プロジェクト名>` が生成される
- `run`（`go run .`）: 正常に動作する
- `fmt`（`gofmt -l -w .` と `go tool goimports -l -w .`）: フォーマットとimport整理が適用される
- `fmt-check`: 整形済みなら無出力で終了する。gofmt/goimportsのどちらかで崩れたファイルがあると一覧を出して失敗する
- `audit`: `No vulnerabilities found.` で終了する（Go脆弱性DBへのネットワークアクセスが必要）
- `check`: `fmt-check`・`lint`・`test`・`audit` が続けて通る
- `lint`（`golangci-lint run ./...`）: `0 issues.` で終了する。`main.go`・`internal/greeting/greeting.go` にパッケージコメント／関数コメントが入っているかもここで再確認する
- `test`（`go test ./... -v`）: テンプレート同梱のサンプルテスト（`internal/greeting/greeting_test.go`。モックを使う `TestGreetFrom` を含む）が通る
- `cover`: ターミナルに関数ごとのカバレッジ（`go tool cover -func`）が表示される
- `cover-html`: `coverage.html` が生成される
- `cover-lcov`: `coverage.lcov` が生成される（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、テストで呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）
- `doc`: ドキュメンテーションコメントから生成されたMarkdownがターミナルに表示される
- `doc-report`: `internal/greeting/API.md`（および `main` パッケージ側）にAPIリファレンスが生成される。`gomarkdoc`自身のテンプレート構文（`{{.Dir}}`）とjustのテンプレート展開が衝突するため、`justfile`側でエスケープしている点に注意する（詳細はjustfileのコメント参照。gomarkdocの出力パス指定を直接書くとjustが`{{.Dir}}`をjust式として解析しようとして構文エラーになる）
- `doc-html`: `api.html` が生成される（`pnpx` が使えることが前提）
- `generate`: `internal/greeting/greeting.go` の `go:generate` により `mock_name_provider_test.go` が再生成され、`git diff` で差分が出ない
- `clean`: `coverage.out` / `coverage.html` / `coverage.lcov` / `api.html` / ビルドしたバイナリ / `API.md` が削除される

途中で失敗したら、そのコマンドだけ単独で再実行して詳細を確認する。

lintの実効性を反証で確かめる場合は `references/counter-tests.md` を参照する。
