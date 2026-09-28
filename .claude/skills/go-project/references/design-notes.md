# go-project: 固定条件の理由と検証記録

`SKILL.md` の「このスキルが前提とする条件」に並べた各条件の、採用理由・却下した代替案・検証で見つかった落とし穴。プロジェクトを配置するだけなら読まなくてよい。テンプレートを変更するとき、生成されたプロジェクトを改造するとき、条件を見直すときに参照する。

- **Go本体・golangci-lint・gomarkdocはユーザーローカルに導入する**。sudoやシステム全体へのインストールには依存しない（`apt install golang` 等は使わない）。これは、このリポジトリのホストがsudoにパスワードを要求する構成であり、「システムに触れずユーザー権限だけで開発環境を完結させる」というこのリポジトリ全体の固定方針に揃えるため
- **golangci-lintは公式インストールスクリプト（`install.sh`）を使わない**。`references/install.md` で詳しく説明するが、`install.sh` はGitHub Releasesの資産選択ロジックに既知のバグがあり、tarball本体ではなく `.sbom.json` を誤ってダウンロードしてsha256検証に失敗することを確認済み。GitHub Releasesから直接tarballとchecksumsファイルを取得し、自分でsha256sumを照合してから展開する
- **golangci-lintの設定はv2形式**（`version: "2"` をトップに書く新スキーマ）を使う。v1の `linters.enable` フラット形式ではない
- **テスト・カバレッジ計測も標準で組み込む**。`go test` はGo標準ツールチェーンに同梱されているため追加インストールは不要。タスクランナーは **just（`github.com/casey/just`）** で、`justfile` に `fmt`/`lint`/`test`/`cover`/`cover-html`/`cover-lcov`/`doc`/`doc-report`/`run`/`clean` の各レシピを用意し、`go tool cover -html` でHTMLレポート（`coverage.html`）を生成できるようにする
- **ロジックは `main` パッケージに直接書かず、`internal/<パッケージ名>/` に分離する**。理由: golangci-lintのデフォルト有効リンター `revive` の `exported` ルール（exportされた関数・型にドキュメントコメントを必須にするルール）は、`main` パッケージには適用されない仕様になっている（`main` パッケージは外部からimportされる公開APIではないため）。ドキュメンテーションコメントの強制を実際に機能させるには、importable な非mainパッケージが最低1つ必要になる。テンプレートでは `internal/greeting/` にサンプルロジックを置いている
- **ドキュメンテーションコメントは golangci-lint（revive）で強制する**。`.golangci.yml` の `linters.settings.revive.rules` に `package-comments`（パッケージコメント必須）と `exported`（exportされた識別子のコメント必須）を明示的に列挙する。revive は `rules` を指定すると指定したルールだけが有効になる（デフォルトルールセットを暗黙に維持しない）ため、`package-comments` を省略すると `main.go` のパッケージコメント欠落チェックが失われる点に注意する
- **APIドキュメントの生成には `gomarkdoc`（`github.com/princjef/gomarkdoc`）を使う**。Go標準の `godoc` コマンド（`golang.org/x/tools/cmd/godoc`）は非推奨パッケージであり、実際に検証したところGoモジュール対応のパッケージ内容を正しくレンダリングできなかった（ページの外枠だけが返り、関数一覧が表示されない）。`pkgsite`（`golang.org/x/pkgsite/cmd/pkgsite`）もローカルモジュールを直接指定すると `This page is not supported by this datasource.` を返し、単体では動作しなかった。`gomarkdoc` はエクスポートされた識別子のドキュメンテーションコメントから直接Markdownを生成でき、`go install` で導入も容易なため、これを標準採用する
- **VS CodeのCoverage Gutters拡張向けのカバレッジ変換には `gcov2lcov`（`github.com/jandelgado/gcov2lcov`）を使う**。Coverage Gutters拡張はlcov/cobertura/jacoco形式には対応するが、Goの `go test -coverprofile` が出力する独自形式（`coverage.out`）はネイティブ対応していないため、`gcov2lcov` でlcov形式（`coverage.lcov`）に変換してから読み込ませる
- `main.go` には**パッケージコメントを必ず入れる**。`internal/greeting/greeting.go` にも**パッケージコメントとexportされた関数のコメントを必ず入れる**。どちらも上記のreviveルールに引っかかり、`lint` がエラーで落ちるため
