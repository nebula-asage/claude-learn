---
name: rust-cargo-project
description: Rustの練習・開発プロジェクト一式（rustup/cargo前提+Cargo.tomlの[lints]によるclippy/rustfmt設定+cargo testとcargo-llvm-covによるテスト・カバレッジHTML/lcovレポート+missing_docs等によるドキュメンテーションコメント強制とcargo docによるAPIリファレンス生成+cargo-denyによる依存検査）をホスト環境に直接構築するスキル。「rustの環境/プロジェクトを作って」「cargoプロジェクトを作って」「clippyを入れて」「rustのカバレッジを測りたい」「rustdocでAPIドキュメントを生成したい」「Rustの依存の脆弱性/ライセンスを検査したい」など、Rustプロジェクトの新規作成・再作成や、既存プロジェクトへのlint/カバレッジ/ドキュメンテーション/依存検査環境の追加を頼まれたら、明示的に「rust-cargo-project」と言われなくても必ず使うこと。配置先が既にVS Code向けの`.vscode/`ディレクトリを持つ場合は、rust-analyzer（clippy連携）向けのsettings.json・拡張機能のおすすめ設定に加え、Coverage Gutters拡張によるカバレッジのエディタ上可視化設定も追加する。Docker/devcontainerには依存せずホストのユーザーローカル環境（sudo不要）に直接導入する。devcontainer自体の構築はこのスキルの対象外。
---

# rust-cargo-project

**rustupによるツールチェーンのユーザーローカル導入**、**`Cargo.toml` の `[lints]` に集約したclippy/rustdocの静的解析**、**cargo-llvm-covによるカバレッジ計測**、**`cargo doc` によるAPIリファレンス生成**、**cargo-denyによる依存の検査**を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。

このスキルはdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキルの対象であり、このスキルでは扱わない。

このスキルが用意するのは、リンター・フォーマッター・テスト・カバレッジ計測・ドキュメンテーションコメント環境・依存検査が最初から動く**土台（スキャフォールディング）**であり、`src/greeting.rs` の中身はテンプレートのサンプル実装（`greet` / `try_greet`）のままである。ユーザーが「CLIツールを作りたい」「HTTPサーバーを書きたい」のように具体的な用途を挙げている場合は、手順4でテンプレートを配置した後、その用途に合わせて中身を実装し直すこと（土台を作って終わりにしない）。

## このスキルが前提とする条件（変更しない）

以下はすべて実際に検証して確認した結果に基づく。単なる「Rust環境を作って」的な依頼でも省略しない。

### ツールチェーンの導入方針

- **rustup・cargo-llvm-cov・cargo-denyはユーザーローカルに導入する**。sudoやシステム全体へのインストールには依存しない（`apt install rustc cargo` 等は使わない）。これは、このリポジトリのホストがsudoにパスワードを要求する構成であり、「システムに触れずユーザー権限だけで開発環境を完結させる」というこのリポジトリ全体の固定方針に揃えるため。rustupの公式インストーラは既定で `~/.cargo` / `~/.rustup` にインストールするので、この方針にそのまま合致する
- **`rustfmt` と `clippy` は追加導入しない**。rustupの既定プロファイル（`default`）に最初から含まれるコンポーネントであり、`cargo fmt` / `cargo clippy` がそのまま使える
- **カバレッジ計測には `cargo-llvm-cov` を使う**（`cargo-tarpaulin` ではない）。LLVMのソースベース計測を使うため行・分岐カバレッジが正確で、ターミナル要約・HTML・lcovの3形式を1つのツールで出力できる。`rustup component add llvm-tools-preview` が別途必要になる点に注意する（これを入れずに実行するとエラーになる）

### プロジェクトの構造

- **ロジックは `src/main.rs` に直接書かず、`src/lib.rs` 側のモジュール（テンプレートでは `src/greeting.rs`）に分離する**。理由: `missing_docs` によるドキュメンテーションコメントの強制と `cargo doc` によるAPIリファレンス生成は、公開API（`pub`）を持つライブラリクレートでないと実質機能しない。bin単体のクレートには外部に公開されるアイテムが無いため、関数レベルのコメント強制がほぼ働かず、`cargo doc` の出力も空に近くなる。加えて、lib側に分離すると `tests/` 配下の統合テストから外部クレートとして `use` でき、「本当に公開APIとして見えているか」をテストできる
- **ユニットテスト（`#[cfg(test)] mod tests`）と統合テスト（`tests/`）の両方をテンプレートに入れる**。前者はprivateな関数にも到達でき、後者は公開APIだけを検証する。Rustではこの2つが別の役割を持つため、片方だけだと片方の書き方が身につかない

### lintの設定

- **lintの設定は `Cargo.toml` の `[lints]` テーブルに集約する**（Rust 1.74以降で安定）。`src/lib.rs` や `src/main.rs` の先頭に `#![warn(missing_docs)]` を書く方式は使わない。`[lints]` ならlibターゲットとbinターゲットの両方に自動で同じ設定が効き、設定がソースに散らばらない
- **`[lints.clippy]` でグループ（`all` / `pedantic`）を指定するときは `priority = -1` を付ける**。グループと個別ルールを同じテーブルに並べたとき、priorityを省略すると cargo が優先順位を決められずエラーになる
- **`clippy::pedantic` を有効にする**。練習用リポジトリとして、慣用的でない書き方を早めに指摘してもらう価値が大きいため。ただしpedanticを入れると、`String` を返す `pub fn` に `#[must_use]` を付けろという `must_use_candidate` が出る。テンプレートの `greet` には `#[must_use]` を付けてあるので、サンプルを書き換えるときも同様に対応すること
- **`missing_docs` は bin クレート（`src/main.rs`）に対しても「クレートレベルのドキュメント（`//!`）が無い」を検出する**。関数レベルのコメントは強制されないが、ファイル冒頭の `//!` は必須になる。テンプレートの `src/main.rs` 冒頭の `//!` を消すと `just lint` が落ちるので、この点はテンプレート内にもコメントで明記してある
- **`clippy::missing_docs_in_private_items` は入れない**。privateなアイテムにまでコメントを強制すると練習用途では過剰なため、`missing_docs`（`pub` のみ対象）と `missing_errors_doc` / `missing_panics_doc` の組み合わせに留める
- **`clippy::missing_errors_doc` / `missing_panics_doc` を明示的に列挙する**。これらは `pedantic` グループにも含まれており指定は重複するが、明示しておけば将来 `pedantic` を外したときにドキュメント強制が黙って失われることがない
- **`rustdoc::broken_intra_doc_links` は `deny`**（warnではない）。`` [`Foo`] `` 形式のリンク切れは放置されると気づかれないまま溜まるため。なおこれは `cargo clippy` ではなく `cargo doc` の実行時に検出される
- **パニックを起こしうる書き方を検出する restriction lint（`unwrap_used` / `expect_used` / `panic` / `unreachable` / `todo` / `unimplemented` / `indexing_slicing` / `arithmetic_side_effects`）を個別に有効化する**。これらは `all` / `pedantic` のどちらのグループにも含まれない

### フォーマッタの設定

- **`rustfmt.toml` にはstableのrustfmtが受け付けるオプションだけを書く**。`group_imports` / `imports_granularity` / `wrap_comments` などは2026年時点でもnightly限定で、stableの `cargo fmt` では「unstable features are only available in nightly」という警告が出たうえで**無視される**。設定したつもりで効いていない状態になりやすいので、テンプレートには入れずコメントで理由を残してある

### テスト・カバレッジ・ドキュメント

- **タスクランナーには `Makefile` ではなく just を使い、`justfile` に入口をまとめる**。`default`（レシピ一覧表示） / `lock` / `run` / `build` / `fmt` / `fmt-check` / `lint` / `test` / `doctest` / `cover` / `cover-html` / `cover-lcov` / `cover-all` / `doc` / `doc-open` / `deny` / `check` / `clean` を用意する。`check` は `fmt-check` → `lint` → `test` → `doctest` → `deny` をまとめて回す。justは単体バイナリでGitHub Releasesのtarball（`SHA256SUMS`検証込み）からユーザーローカルに導入できるためこのリポジトリのsudo不要方針に合致する
- **`cargo llvm-cov` は起動のたびに `target/llvm-cov/` を作り直す**。そのため `cover-html` の後に `cover-lcov` を実行するとHTMLレポートが消える（逆も同様）。HTMLとlcovの両方が必要な場合のために、`--no-report` でテストを1回だけ実行してから `cargo llvm-cov report --lcov` / `report --html` で両形式を書き出す `cover-all` ターゲットを用意してある
- **`just lint` は `--all-targets` と `-D warnings` を付ける**。`--all-targets` が無いと `tests/` 配下がlint対象から外れる。`-D warnings` が無いと `[lints]` で `warn` にしたルールが警告止まりになり、実質的な強制にならない
- **ドキュメンテーションコメントの例（doctest）を書く**。`` ``` `` で囲んだコード例は `cargo test --doc` で実際にコンパイル・実行されるため、例が古くなった時点で落ちる。テンプレートの `greet` / `try_greet` には `# Examples` セクションを入れてある
- **`cargo doc` は `--no-deps --document-private-items` で実行する**。依存クレートのドキュメントまで生成すると無駄に重く、privateなアイテムも含めた方が練習用途では読み物として有用なため
- **`src/lib.rs` に `#![doc(html_no_source)]` を付け、生成物にソースコードの埋め込み（各アイテムの`[src]`リンクと`target/doc/src/`配下の実体ページ）を含めない**。この属性は安定版のrustdocでも使える（rustdocの不安定機能ではなく`#[doc]`属性そのものは安定機能）。似た効果を持つCLIフラグ`rustdoc --html-no-source`はnightly限定で、実際に検証したところstableのコンパイラでは`the option \`html-no-source\` is only accepted on the nightly compiler`で拒否される。このリポジトリの方針（stableのみ、nightly不要）に合わせ、属性側の方法を採用している。lib/binでクレート名が同じ場合`cargo doc`はlib側だけをドキュメント化するため、`src/main.rs`側には付けない

### 依存とサプライチェーン対策

- **`Cargo.lock` をコミットし、`justfile` の全cargoコマンドに `--locked` を付ける**。依存が暗黙に更新されるのを防ぐ。ライブラリクレートでは `Cargo.lock` をコミットしない慣習もあるが、このリポジトリのプロジェクトはbinを持つ実行可能プロジェクトなのでコミットする
- **`--locked` は `Cargo.lock` が存在しないと `cannot create the lock file ... because --locked was passed` で失敗する**。テンプレートには `Cargo.lock` を含めないので、展開直後は必ず `just lock`（= `cargo generate-lockfile`）を先に実行する。これを飛ばすと `just lint` も `just test` も全部落ちる
- **`cargo-deny`（`deny.toml`）を標準で入れる**。`[advisories]` でRustSec脆弱性DBと照合し、`[licenses]` で許可ライセンスを列挙し、`[bans] wildcards = "deny"` でワイルドカードのバージョン指定を禁止し、`[sources]` で取得元をcrates.ioに限定する（未知のレジストリ・gitリポジトリからの依存を禁止）
- **`deny.toml` には `[licenses.private] ignore = true` が必須**。テンプレートの `Cargo.toml` は `publish = false` かつ `license` フィールドを持たないため、これを設定しないとプロジェクト自身が `error[unlicensed]: ... is unlicensed` として検出され `cargo deny check` が落ちる。あわせて `unused-allowed-license = "allow"` を設定し、許可リストのうち依存ツリーに出てこなかったライセンスについての警告で出力が埋もれないようにする

### このリポジトリ共通のサプライチェーン方針との差分（`AGENTS.md` の一般則参照。必ずユーザーに報告する）

**cargoには「公開後N日未満を除外する」（npm/pnpmの`minimum-release-age`やuvの`exclude-newer`相当）も「インストール時の任意コード実行の抑制」（npmの`ignore-scripts`相当）も存在しない。** cargoは依存クレートの`build.rs`をビルド時に必ず実行する。

代わりに入れている `Cargo.lock` + `--locked`、`[sources]` による取得元の限定、`[advisories]` による脆弱性照合（`cargo deny check advisories`はRustSecに既に報告済みの脆弱性を弾くもので、「まだ誰も気づいていない攻撃を待ち時間でやり過ごす」という`exclude-newer`の目的の代替にはならない）が何を守り何を守らないのかも、あわせて伝えること。この差分はテンプレートの `README.md` にも書いてある。

## 手順

1. **ツールチェーンがホストに導入済みか確認する**
   - `command -v rustup cargo rustc` と `rustc --version` でツールチェーン本体を確認する。
   - `rustup component list --installed` で `rustfmt` と `clippy` が入っているか確認する（rustupの既定プロファイルなら入っている）。`llvm-tools` が入っているかもここで見る。
   - `command -v cargo-llvm-cov cargo-deny` で追加ツールを確認する。
   - `command -v just` と `just --version` でjust（タスクランナー）を確認する。
   - 全て導入済みならステップ3に進んでよい。

2. **未導入の場合、ユーザーローカルに導入する**
   - **これはホスト環境に実際にソフトウェアを導入する操作であり、rustupの場合はシェル設定ファイル（`~/.bashrc` 等）へのPATH追記も伴う。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「Rustツールチェーン/justが入っていないのでユーザーローカルに導入してよいか（sudoは使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
   - 具体的な導入コマンド（rustup・カバレッジ計測用コンポーネント・cargo-llvm-cov・cargo-deny・just）は `references/install.md` を参照する。

3. **配置先とプロジェクト名を確認する**
   - このリポジトリの `projects/README.md` のルールにより、基本は `projects/<project-name>/` 配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい（例: 「rustの練習環境」→ `rust-practice`）。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

4. **テンプレートをコピーし、プレースホルダを置換する**

   プレースホルダは3種類ある。`__PROJECT_NAME__` は `__PROJECT_NAME_SNAKE__` の部分文字列にはならない（末尾の `__` が一致しない）ので、置換の順序は問わない。

   | プレースホルダ | 置換する値 |
   | --- | --- |
   | `__PROJECT_NAME_SNAKE__` | クレート名のRust識別子形（ハイフンをアンダースコアに: `rust-practice` → `rust_practice`）。`use` 文やドキュメントのパスに使う |
   | `__PROJECT_NAME__` | パッケージ名（ディレクトリ名そのままでよい。例: `rust-practice`） |
   | `__PROJECT_DESCRIPTION__` | プロジェクトの1行説明。用途が指定されていればそれに合わせる |

   `templates/` 配下は `vscode/` を除きそのまま `<配置先>` へ1階層でコピーできる構成になっているため、
   ファイルを1つずつ Read/Write するのではなく `cp -a` で一括コピーし、そのうえでプレースホルダを含む
   ファイルだけを Edit系ツールで置換する2段構成にする。

   ```bash
   mkdir -p "<配置先>"
   cp -a .claude/skills/rust-cargo-project/templates/. "<配置先>/"
   rm -rf "<配置先>/vscode"
   ```

   （`templates/vscode/` はここではコピーしない。手順5で扱う。`cp -a` は権限・タイムスタンプを保ったまま
   複製するため、個別ファイルの権限調整は不要。）

   コピー後、`grep -rl "__PROJECT_NAME__\|__PROJECT_NAME_SNAKE__\|__PROJECT_DESCRIPTION__" "<配置先>"`
   でプレースホルダを含むファイルを洗い出し、その結果に対してだけ Edit系ツールで置換する
   （現時点では `Cargo.toml` / `README.md` / `justfile` / `src/main.rs` / `src/lib.rs` / `src/greeting.rs` /
   `tests/greeting.rs` の7ファイルが該当する。テンプレートが変わった場合はこの一覧ではなく grep の結果を
   優先すること）。`rustfmt.toml` / `deny.toml` / `.gitignore` にはプレースホルダが無いため対象外
   （`.gitignore` はリポジトリルートの `.gitignore` にRustの項目が無いことの確認のみで、内容の変更は不要）。

5. **配置先がVS Codeプロジェクトの場合、Rust向けのVS Code設定を追加する**
   - 判定は `<配置先>/.vscode/` ディレクトリ（`settings.json` または `extensions.json`）の有無で行う。存在しなければVS Code向けの設定は持たないプロジェクトとみなし、この手順はスキップする（`.vscode/` を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、`.vscode/` を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json` を配置する**: `templates/vscode/settings.json` の内容を `<配置先>/.vscode/settings.json` にマージする。既に存在する場合はEdit系ツールで直接編集し、既存のキー（言語非依存の共通設定など）を残したまま `rust-analyzer.*` / `coverage-gutters.*` 系のキーと `[rust]` / `[toml]` ブロックを追加する（同じキーが既にあれば上書きせず、内容を確認したうえでユーザーに判断を仰ぐ）。
     - `rust-analyzer.check.command` を `clippy` にしているのは、`Cargo.toml` の `[lints]` で設定したルール違反をエディタ上に直接出すため。既定の `cargo check` のままだとclippyのルールがエディタに出ず、`just lint` で初めて気づくことになる。
     - `coverage-gutters.*` はCoverage Gutters拡張向けで、`just cover-lcov` が生成する `lcov.info` を読み、行番号横に被覆行（緑）・未被覆行（赤）を表示する。`just cover` / `just cover-html` を置き換えるものではなく、追加のレポート形式。`lcov.info` はテストのたびに再生成される成果物なのでコミット対象に含めない（テンプレートの `.gitignore` で除外済み）。
   - **拡張機能のおすすめ設定を配置する**: 配置先の判定はさらに `<配置先>/.devcontainer/devcontainer.json` の有無で分岐する（この判定も「devcontainerを構築するスキルが動いたかどうか」ではなく、あくまでファイルの有無で行う）。
     - `devcontainer.json` が存在する場合: `.vscode/extensions.json` は使わず、`templates/vscode/extensions.json` の `recommendations` 配列の中身（拡張機能IDのみ。コメントは転記しなくてよい）を `<配置先>/.devcontainer/devcontainer.json` の `customizations.vscode.extensions` 配列にEdit系ツールで直接マージする（重複を除いて追記。既存の `customizations.vscode.settings` 等は残す）。
     - `devcontainer.json` が存在しない場合: `templates/vscode/extensions.json` の内容を `<配置先>/.vscode/extensions.json` にマージする（既存の `recommendations` があれば重複を除いて追記し、既存の非Rust系の推奨拡張機能はそのまま残す）。
   - `settings.json` / `extensions.json`（および `devcontainer.json`）はJSONC（コメント付きJSON）として解釈されるため、標準の `jq` に通す前にコメント行を取り除くか、目視でカンマ・かっこの対応を確認する。

6. **動作確認する**

   `<配置先>` に移動し、`references/verify.md` の手順に従って確認する。非対話シェルでは `~/.bashrc` のPATH設定が効かないため、必要なら `source "$HOME/.cargo/env"` を各コマンドの前に入れる。lintが本当に効いているかの反証（`references/counter-tests.md`）は、このスキルの`templates/`を変更したときに`template-verifier`が確認する検証項目であり、プロジェクト新規作成のたびに実行する手順ではない。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- `.vscode/` ディレクトリが存在しない配置先に、VS Code向けの設定一式をゼロから新規作成することはこのスキルの対象外（このスキルが行うのはRust固有の追加設定のみ）。ユーザーから明示的に「VS Code環境ごと作って」等の依頼があった場合のみ、`.vscode/` を新規作成したうえでRust向け設定を配置してよい。
- cargoのワークスペース（複数クレートを1つの `Cargo.toml` で束ねる構成）はこのスキルの対象外。このリポジトリは `projects/<name>/` ごとに自己完結させる方針なので、単一パッケージ（lib + bin）構成に固定している。
- クロスコンパイル、`no_std` 環境、WebAssembly向けビルド、非同期ランタイム（tokio等）の導入はこのスキルの対象外。必要なら土台を作ったうえで別途対応する。
- Git hooks（コミット時の自動lint/format）の設定はこのスキルの対象外。このリポジトリでは `core.hooksPath` がリポジトリ全体で1つしか持てず、プロジェクトごとにフックを設定すると互いに上書きし合う問題があるため、Rustプロジェクト側では設定しない。
