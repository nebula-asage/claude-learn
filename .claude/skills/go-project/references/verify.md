# 動作確認する

`<配置先>` に移動し、以下を確認する。前述の通り、非対話シェルでは `~/.bashrc` のPATH設定が効かないため、必要なら各コマンドの前に `export GOROOT/GOPATH/PATH` を明示する。確認後、動作確認で生成された `coverage.out` / `coverage.html` / `coverage.lcov` / `API.md`（各パッケージディレクトリ配下）は `just clean` で削除し、コミット対象に残さないこと。

- 引数なしで `just` を実行し、レシピ一覧（`just --list`相当）が表示されることを確認する。
- `just run`（`go run .`）を実行し、正常に動作することを確認する。
- `just fmt`（`gofmt -l -w .`）を実行し、フォーマットが適用されることを確認する。
- `just lint`（`golangci-lint run ./...`）が `0 issues.` で終了することを確認する。`main.go`・`internal/greeting/greeting.go` にパッケージコメント／関数コメントが入っているかもここで再確認する。
- `just test`（`go test ./... -v`）を実行し、テンプレート同梱のサンプルテスト（`internal/greeting/greeting_test.go`）が通ることを確認する。
- `just cover` を実行し、ターミナルに関数ごとのカバレッジ（`go tool cover -func`）が表示されることを確認する。
- `just cover-html` を実行し、`coverage.html` が生成されることを確認する。
- 手順5でVS Code向け設定を配置した場合は、`just cover-lcov` を実行し、`coverage.lcov` が生成されることも確認する（VS Codeで開いてCoverage Gutters拡張の「Watch」コマンドを実行すると、テストで呼ばれていない行があればエディタのガターに未被覆として表示されるはずだが、これはVS Code上での見た目の確認なので必須ではない）。
- `just doc` を実行し、ドキュメンテーションコメントから生成されたMarkdownがターミナルに表示されることを確認する。
- `just doc-report` を実行し、`internal/greeting/API.md`（および `main` パッケージ側）にAPIリファレンスが生成されることを確認する。`gomarkdoc`自身のテンプレート構文（`{{.Dir}}`）とjustのテンプレート展開が衝突するため、`justfile`側でエスケープしている点に注意する（詳細はjustfileのコメント参照。gomarkdocの出力パス指定を直接書くとjustが`{{.Dir}}`をjust式として解析しようとして構文エラーになる）。
- `just clean` で `coverage.out` / `coverage.html` / `coverage.lcov` / `API.md` を削除する。

lintの実効性を反証で確かめる場合は `references/counter-tests.md` を参照する。
