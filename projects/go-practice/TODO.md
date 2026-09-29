# TODO

## TODO-001: ファイル名を型名に合わせる

- [x] `internal/repository/user_repository.go` → `json_user_repository.go`
  - 型名が `JSONUserRepository` であるにもかかわらず、ファイル名は `user_repository.go` のままで型名と一致していない
  - Goの慣習ではファイル名は主要な型名をスネークケース化したものにするため、型名に忠実な `json_user_repository.go` の方が一貫性がある
  - 併せてテストファイル `user_repository_test.go` も `json_user_repository_test.go` への追従が必要
  - 対応済み: `git mv` で `json_user_repository.go` / `json_user_repository_test.go` へリネーム。`go test`・`golangci-lint` 通過を確認
  - 参考: `Impl` サフィックス(例: `user_service_impl.go`)はJava的な発想でGoでは非推奫。`JSONUserRepository` のように具体的な実装手段を型名の接頭辞にする現行方式の方がGo慣習に沿っている

## TODO-002: HTML形式のAPIドキュメント生成を検討する

- [x] `just doc`/`just doc-report` は `gomarkdoc` によるMarkdown出力(ターミナル表示・各パッケージへの `API.md` 生成)のみで、HTML形式のAPIドキュメントは生成されない
  - HTML版が欲しい場合の選択肢:
    - `godoc -http=:6060` でpkg.go.dev相当のブラウザ閲覧UIをローカルで立てる(別途手動起動が必要、生成物としては残らない)
    - 生成済みの `API.md` をMarkdown→HTML変換する追加レシピを `justfile` に足す
  - 対応済み: 後者を発展させ、`just doc-html` を追加。`gomarkdoc ./...` の出力を `pnpx marked --gfm` でHTMLに変換して `api.html` に書き出す（文字コード宣言を前置）。`clean` の削除対象・`.gitignore`・README/AGENTS.md・`usage` にも反映。`pnpx` は既存の `cspell`/`markdownlint` と同様、`~/.config/pnpm/config.yaml` の `minimumReleaseAge`・`ignoreScripts` が効く
  - `godoc -http` 方式は、生成物が残らず別途手動起動が必要なため採用しなかった

## TODO-003: `just build` レシピを追加する

- [x] `justfile` に `go build .` に相当するビルド用レシピが無く、`run`(`go run .`)のみが用意されている
  - 単一バイナリを生成する `build` レシピ(例: `go build -o go-practice .`)を追加する
  - 生成物(バイナリ)は `clean` レシピでの削除対象にも加える必要がある
  - 対応済み: `build` レシピ（`go build -o go-practice .`）を追加し、`clean` の削除対象・`.gitignore`（`/go-practice`）・README/AGENTS.md・`usage` 表示にも反映。`just build` → `just clean` で生成・削除を確認
  - クロスコンパイル用のレシピ(`GOOS`/`GOARCH` 指定)を用意するかどうかは別途検討
