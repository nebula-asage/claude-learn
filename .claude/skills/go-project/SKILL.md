---
name: go-project
description: Go言語の練習・開発プロジェクト一式（go.mod+main.go+internalパッケージ+golangci-lintによるlint+go testでのテスト/カバレッジHTMLレポート+revive/gomarkdocによるドキュメンテーションコメント強制/APIドキュメント生成+justによるタスクランナー）をホスト環境に直接構築するスキル。「goの環境/プロジェクトを作って」「golangci-lintを入れて」「goのカバレッジ測定/レポートがほしい」「ドキュメンテーションコメントを強制したい」「APIドキュメントを生成したい」など、Goプロジェクトの新規作成・再作成や、既存プロジェクトへのlint/カバレッジ/ドキュメンテーション環境の追加を頼まれたら、明示的に「go-project」と言われなくても必ず使うこと。配置先が既にVS Code向けの`.vscode/`ディレクトリを持つ場合は、gopls/golangci-lintに対応したGo向けのsettings.json・拡張機能のおすすめ設定に加え、Coverage Gutters拡張によるカバレッジのエディタ上可視化（被覆/未被覆行のガター色付け。gcov2lcovでcoverage.outをlcov形式に変換）設定も追加する。Docker/devcontainerには依存せずホストのユーザーローカル環境（sudo不要）に直接導入する。devcontainer自体の構築はこのスキルの対象外。
---

# go-project

**Go本体のユーザーローカル導入**、**golangci-lintによる静的解析**、**gomarkdocによるドキュメンテーションコメントのAPIリファレンス生成**を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`projects/go-practice/` で一度構築・検証済みの条件を、コンテナに依存しない形でテンプレート化したもの。

このスキルはdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキルの対象であり、このスキルでは扱わない。

このスキルが用意するのは、リンター・フォーマッター・テスト・カバレッジ計測・ドキュメンテーションコメント環境が最初から動く**土台（スキャフォールディング）**であり、`main.go`/`internal/greeting/` の中身はテンプレートのサンプル実装（`Greet` 関数）のままである。ユーザーが「HTTPサーバーを書きたい」「CLIツールを作りたい」のように具体的な用途を挙げている場合は、手順4でテンプレートを配置した後、その用途に合わせて中身を実装し直すこと（土台を作って終わりにしない）。

## このスキルが前提とする条件（変更しない）

- Go本体・golangci-lint・gomarkdoc・gcov2lcov はユーザーローカルに導入する（sudo・`apt install golang` は使わない）
- golangci-lint は公式 `install.sh` を使わず、GitHub Releases の tarball と checksums を自分で sha256 照合して展開する
- golangci-lint の設定は v2 形式（`version: "2"`）
- テスト・カバレッジは `go test` + `go tool cover`。タスクランナーは just で、`fmt`/`lint`/`test`/`cover`/`cover-html`/`cover-lcov`/`doc`/`doc-report`/`run`/`clean` を用意する
- ロジックは `main` パッケージに書かず `internal/<パッケージ名>/` に分離する（revive の `exported` は `main` に効かないため）
- ドキュメンテーションコメントは revive で強制する。`rules` には `package-comments` と `exported` の両方を明示する（片方を省くとそのチェックが消える）
- `main.go` と `internal/greeting/greeting.go` にはパッケージコメントとexport識別子のコメントを必ず書く（無いと `lint` が落ちる）
- APIドキュメントは gomarkdoc で生成する（`godoc`・`pkgsite` はローカルモジュールで動かなかった）
- Coverage Gutters 向けに gcov2lcov で `coverage.out` を lcov に変換する

各条件の理由・却下した代替案・検証で見つかった落とし穴は `.claude/skills/go-project/references/design-notes.md` にある。テンプレートを変更するときや、条件を見直すときに読む。

## 手順

1. **Go・golangci-lint・gomarkdoc・gcov2lcov・justがホストに導入済みか確認する**
   - `command -v go` と `go version` でGo本体を確認する。
   - `command -v golangci-lint` と `golangci-lint version` でgolangci-lintを確認する（v2系であることも確認する。v1系しか入っていない場合は設定ファイルの互換性に注意し、ユーザーに再導入してよいか確認する）。
   - `command -v gomarkdoc` と `gomarkdoc --version` でgomarkdocを確認する。
   - `command -v gcov2lcov` でgcov2lcov（Coverage Gutters拡張向けのlcov変換ツール）を確認する。
   - `command -v just` と `just --version` でjust（タスクランナー）を確認する。
   - 全て導入済みならステップ3に進んでよい。

2. **未導入の場合、ユーザーローカルに導入する**
   - **これはホスト環境に実際にソフトウェアを導入する操作であり、`~/.bashrc` へのPATH追記も伴う。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「Go/golangci-lint/gomarkdoc/gcov2lcov/justが入っていないのでユーザーローカルに導入してよいか（sudoは使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
   - 具体的な導入コマンド（Go本体・golangci-lint・gomarkdoc・gcov2lcov・just）は `.claude/skills/go-project/references/install.md` を参照する。

3. **配置先とプロジェクト名を確認する**
   - このリポジトリの `projects/README.md` のルールにより、基本は `projects/<project-name>/` 配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい（例: 「goの練習環境」→ `go-practice`）。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

4. **テンプレートをコピーし、プレースホルダを置換する**
   `templates/` 配下は `vscode/` を除きそのまま `<配置先>` へ1階層でコピーできる構成になっているため、
   ファイルを1つずつ Read/Write するのではなく `cp -a` で一括コピーし、そのうえでプレースホルダを含む
   ファイルだけを Edit系ツールで置換する2段構成にする。

   ```bash
   mkdir -p "<配置先>"
   cp -a .claude/skills/go-project/templates/. "<配置先>/"
   rm -rf "<配置先>/vscode"
   ```

   （`.claude/skills/go-project/templates/vscode/` はここではコピーしない。VS Code設定の手順で扱う。）

   コピー後、`grep -rl "__PROJECT_NAME__" "<配置先>"` でプレースホルダを含むファイルを洗い出し、その結果に対してだけ
   Edit系ツールで置換する。テンプレートが変わった場合は下の一覧ではなく grep の結果を優先すること。
   - `go.mod`・`main.go`・`README.md` の `__PROJECT_NAME__` を置換する。Goのモジュール名として妥当な形式にする（特にホスト先の指定がなければリポジトリ名やディレクトリ名そのままでよい）。`main.go` のimportパス `__PROJECT_NAME__/internal/greeting` も含めて置換すること
   - `.gitignore` はそのままでよい（リポジトリルートの `.gitignore` には既に `# Go` セクションと `/bin/` の除外があるため、ルート側は変更しない）

5. **VS Code向けのGo設定を追加する（`.vscode/` が既にある場合のみ）**
   - 判定は `<配置先>/.vscode/`ディレクトリ（`settings.json`または`extensions.json`）の有無で行う。存在しなければVS Code向けの設定は持たないプロジェクトとみなし、この手順はスキップする（`.vscode/`を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、`.vscode/`を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json`を配置する**: `.claude/skills/go-project/templates/vscode/settings.json`の内容を`<配置先>/.vscode/settings.json`にマージする。ファイルが既に存在する場合は、Edit系ツールで直接編集し、既存のキー（言語非依存の共通設定など）を残したまま`go.*`/`coverage-gutters.*`系のキーと`[go]`ブロックを追加する（同じキーが既にあれば上書きせず、内容を確認したうえでユーザーに判断を仰ぐ）。ファイルが無ければ新規作成する。
     - `coverage-gutters.*`の設定はCoverage Gutters拡張（後述）向けで、`just cover-lcov`を実行すると生成される`coverage.lcov`（`coverage.out`をgcov2lcovでlcov形式に変換したもの）を読み込み、エディタの行番号横に被覆行（緑）・未被覆行（赤）を色付け表示する。既存の`cover`/`cover-html`運用に加えて使う追加のレポート形式であり、どちらかを置き換えるものではない。`coverage.lcov`はテスト実行のたびに再生成される成果物なのでコミット対象に含めない（テンプレートの`.gitignore`で除外済み）。
     - `coverage-gutters.remotePathResolve`の`__PROJECT_NAME__`は、配置先ディレクトリ名（`projects/<project-name>/`の`<project-name>`）に置き換えること。gcov2lcovはSF:パスをgitリポジトリルート（モノレポ全体）からの相対パスで出力するため、VS CodeのworkspaceFolder（プロジェクト自身のディレクトリ）とは`projects/<project-name>/`の分だけずれており、この設定で剥がさないとCoverage Guttersがカバレッジを表示しない。
   - **拡張機能のおすすめ設定を配置する**:
     - `devcontainer.json`が存在する場合: `.vscode/extensions.json`は使わず、`.claude/skills/go-project/templates/vscode/extensions.json`の`recommendations`配列の中身を`<配置先>/.devcontainer/devcontainer.json`の`customizations.vscode.extensions`配列にEdit系ツールで直接マージする（重複を除いて追記。既存の`customizations.vscode.settings`等は残す）。
     - `devcontainer.json`が存在しない場合: `.claude/skills/go-project/templates/vscode/extensions.json`の内容を`<配置先>/.vscode/extensions.json`にマージする（既存の`recommendations`があれば重複を除いて追記し、既存の非Go系の推奨拡張機能はそのまま残す）。

6. **動作確認する**
   `<配置先>` に移動し、`.claude/skills/go-project/references/verify.md` の手順に従って確認する。`.claude/skills/go-project/references/install.md` の注意のとおり、非対話シェルでは `~/.bashrc` のPATH設定が効かないため、必要なら各コマンドの前に `export GOROOT/GOPATH/PATH` を明示する。lintが本当に効いているかの反証（`.claude/skills/go-project/references/counter-tests.md`）は、このスキルの`templates/`を変更したときに`template-verifier`が確認する検証項目であり、プロジェクト新規作成のたびに実行する手順ではない。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- 「前提とする条件」に並べた項目は、単なる「Go環境を作って」的な依頼でも省略しない。
- `.vscode/` ディレクトリが存在しない配置先に、VS Code向けの設定一式をゼロから新規作成することはこのスキルの対象外（このスキルが行うのはGo固有の追加設定のみ）。ユーザーから明示的に「VS Code環境ごと作って」等の依頼があった場合のみ、`.vscode/` を新規作成したうえでGo向け設定を配置してよい。
- Git hooks（コミット時の自動lint/format）の設定はこのスキルの対象外。このリポジトリでは `core.hooksPath` がリポジトリ全体で1つしか持てず、プロジェクトごとにフックを設定すると互いに上書きし合う問題があるため、Goプロジェクト側では設定しない。
