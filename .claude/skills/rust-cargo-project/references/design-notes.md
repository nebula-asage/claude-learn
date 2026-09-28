# rust-cargo-project: 固定条件の理由と検証記録

`SKILL.md` の「このスキルが前提とする条件」に並べた各条件の、採用理由・却下した代替案・検証で見つかった落とし穴。プロジェクトを配置するだけなら読まなくてよい。テンプレートを変更するとき、生成されたプロジェクトを改造するとき、条件を見直すときに参照する。

以下はすべて実際に検証して確認した結果に基づく。単なる「Rust環境を作って」的な依頼でも省略しない。

## ツールチェーンの導入方針

- **rustup・cargo-llvm-cov・cargo-denyはユーザーローカルに導入する**。sudoやシステム全体へのインストールには依存しない（`apt install rustc cargo` 等は使わない）。これは、このリポジトリのホストがsudoにパスワードを要求する構成であり、「システムに触れずユーザー権限だけで開発環境を完結させる」というこのリポジトリ全体の固定方針に揃えるため。rustupの公式インストーラは既定で `~/.cargo` / `~/.rustup` にインストールするので、この方針にそのまま合致する
- **`rustfmt` と `clippy` は追加導入しない**。rustupの既定プロファイル（`default`）に最初から含まれるコンポーネントであり、`cargo fmt` / `cargo clippy` がそのまま使える
- **カバレッジ計測には `cargo-llvm-cov` を使う**（`cargo-tarpaulin` ではない）。LLVMのソースベース計測を使うため行・分岐カバレッジが正確で、ターミナル要約・HTML・lcovの3形式を1つのツールで出力できる。`rustup component add llvm-tools-preview` が別途必要になる点に注意する（これを入れずに実行するとエラーになる）

## プロジェクトの構造

- **ロジックは `src/main.rs` に直接書かず、`src/lib.rs` 側のモジュール（テンプレートでは `src/greeting.rs`）に分離する**。理由: `missing_docs` によるドキュメンテーションコメントの強制と `cargo doc` によるAPIリファレンス生成は、公開API（`pub`）を持つライブラリクレートでないと実質機能しない。bin単体のクレートには外部に公開されるアイテムが無いため、関数レベルのコメント強制がほぼ働かず、`cargo doc` の出力も空に近くなる。加えて、lib側に分離すると `tests/` 配下の統合テストから外部クレートとして `use` でき、「本当に公開APIとして見えているか」をテストできる
- **ユニットテスト（`#[cfg(test)] mod tests`）と統合テスト（`tests/`）の両方をテンプレートに入れる**。前者はprivateな関数にも到達でき、後者は公開APIだけを検証する。Rustではこの2つが別の役割を持つため、片方だけだと片方の書き方が身につかない

## lintの設定

- **lintの設定は `Cargo.toml` の `[lints]` テーブルに集約する**（Rust 1.74以降で安定）。`src/lib.rs` や `src/main.rs` の先頭に `#![warn(missing_docs)]` を書く方式は使わない。`[lints]` ならlibターゲットとbinターゲットの両方に自動で同じ設定が効き、設定がソースに散らばらない
- **`[lints.clippy]` でグループ（`all` / `pedantic`）を指定するときは `priority = -1` を付ける**。グループと個別ルールを同じテーブルに並べたとき、priorityを省略すると cargo が優先順位を決められずエラーになる
- **`clippy::pedantic` を有効にする**。練習用リポジトリとして、慣用的でない書き方を早めに指摘してもらう価値が大きいため。ただしpedanticを入れると、`String` を返す `pub fn` に `#[must_use]` を付けろという `must_use_candidate` が出る。テンプレートの `greet` には `#[must_use]` を付けてあるので、サンプルを書き換えるときも同様に対応すること
- **`missing_docs` は bin クレート（`src/main.rs`）に対しても「クレートレベルのドキュメント（`//!`）が無い」を検出する**。関数レベルのコメントは強制されないが、ファイル冒頭の `//!` は必須になる。テンプレートの `src/main.rs` 冒頭の `//!` を消すと `just lint` が落ちるので、この点はテンプレート内にもコメントで明記してある
- **`clippy::missing_docs_in_private_items` は入れない**。privateなアイテムにまでコメントを強制すると練習用途では過剰なため、`missing_docs`（`pub` のみ対象）と `missing_errors_doc` / `missing_panics_doc` の組み合わせに留める
- **`clippy::missing_errors_doc` / `missing_panics_doc` を明示的に列挙する**。これらは `pedantic` グループにも含まれており指定は重複するが、明示しておけば将来 `pedantic` を外したときにドキュメント強制が黙って失われることがない
- **`rustdoc::broken_intra_doc_links` は `deny`**（warnではない）。`` [`Foo`] `` 形式のリンク切れは放置されると気づかれないまま溜まるため。なおこれは `cargo clippy` ではなく `cargo doc` の実行時に検出される
- **パニックを起こしうる書き方を検出する restriction lint（`unwrap_used` / `expect_used` / `panic` / `unreachable` / `todo` / `unimplemented` / `indexing_slicing` / `arithmetic_side_effects`）を個別に有効化する**。これらは `all` / `pedantic` のどちらのグループにも含まれない

## フォーマッタの設定

- **`rustfmt.toml` にはstableのrustfmtが受け付けるオプションだけを書く**。`group_imports` / `imports_granularity` / `wrap_comments` などは2026年時点でもnightly限定で、stableの `cargo fmt` では「unstable features are only available in nightly」という警告が出たうえで**無視される**。設定したつもりで効いていない状態になりやすいので、テンプレートには入れずコメントで理由を残してある

## テスト・カバレッジ・ドキュメント

- **タスクランナーは just で、`justfile` に入口をまとめる**。`default`（レシピ一覧表示） / `lock` / `run` / `build` / `fmt` / `fmt-check` / `lint` / `test` / `doctest` / `cover` / `cover-html` / `cover-lcov` / `cover-all` / `doc` / `doc-open` / `deny` / `check` / `clean` を用意する。`check` は `fmt-check` → `lint` → `test` → `doctest` → `deny` をまとめて回す
- **`cargo llvm-cov` は起動のたびに `target/llvm-cov/` を作り直す**。そのため `cover-html` の後に `cover-lcov` を実行するとHTMLレポートが消える（逆も同様）。HTMLとlcovの両方が必要な場合のために、`--no-report` でテストを1回だけ実行してから `cargo llvm-cov report --lcov` / `report --html` で両形式を書き出す `cover-all` ターゲットを用意してある
- **`just lint` は `--all-targets` と `-D warnings` を付ける**。`--all-targets` が無いと `tests/` 配下がlint対象から外れる。`-D warnings` が無いと `[lints]` で `warn` にしたルールが警告止まりになり、実質的な強制にならない
- **ドキュメンテーションコメントの例（doctest）を書く**。`` ``` `` で囲んだコード例は `cargo test --doc` で実際にコンパイル・実行されるため、例が古くなった時点で落ちる。テンプレートの `greet` / `try_greet` には `# Examples` セクションを入れてある
- **`cargo doc` は `--no-deps --document-private-items` で実行する**。依存クレートのドキュメントまで生成すると無駄に重く、privateなアイテムも含めた方が練習用途では読み物として有用なため
- **`src/lib.rs` に `#![doc(html_no_source)]` を付け、生成物にソースコードの埋め込み（各アイテムの`[src]`リンクと`target/doc/src/`配下の実体ページ）を含めない**。この属性は安定版のrustdocでも使える（rustdocの不安定機能ではなく`#[doc]`属性そのものは安定機能）。似た効果を持つCLIフラグ`rustdoc --html-no-source`はnightly限定で、実際に検証したところstableのコンパイラでは`the option \`html-no-source\` is only accepted on the nightly compiler`で拒否される。このリポジトリの方針（stableのみ、nightly不要）に合わせ、属性側の方法を採用している。lib/binでクレート名が同じ場合`cargo doc`はlib側だけをドキュメント化するため、`src/main.rs`側には付けない

## 依存とサプライチェーン対策

- **`Cargo.lock` をコミットし、`justfile` の全cargoコマンドに `--locked` を付ける**。依存が暗黙に更新されるのを防ぐ。ライブラリクレートでは `Cargo.lock` をコミットしない慣習もあるが、このリポジトリのプロジェクトはbinを持つ実行可能プロジェクトなのでコミットする
- **`--locked` は `Cargo.lock` が存在しないと `cannot create the lock file ... because --locked was passed` で失敗する**。テンプレートには `Cargo.lock` を含めないので、展開直後は必ず `just lock`（= `cargo generate-lockfile`）を先に実行する。これを飛ばすと `just lint` も `just test` も全部落ちる
- **`cargo-deny`（`deny.toml`）を標準で入れる**。`[advisories]` でRustSec脆弱性DBと照合し、`[licenses]` で許可ライセンスを列挙し、`[bans] wildcards = "deny"` でワイルドカードのバージョン指定を禁止し、`[sources]` で取得元をcrates.ioに限定する（未知のレジストリ・gitリポジトリからの依存を禁止）
- **`deny.toml` には `[licenses.private] ignore = true` が必須**。テンプレートの `Cargo.toml` は `publish = false` かつ `license` フィールドを持たないため、これを設定しないとプロジェクト自身が `error[unlicensed]: ... is unlicensed` として検出され `cargo deny check` が落ちる。あわせて `unused-allowed-license = "allow"` を設定し、許可リストのうち依存ツリーに出てこなかったライセンスについての警告で出力が埋もれないようにする

## このリポジトリ共通のサプライチェーン方針との差分（`AGENTS.md` の一般則参照。必ずユーザーに報告する）

**cargoには「公開後N日未満を除外する」（npm/pnpmの`minimum-release-age`やuvの`exclude-newer`相当）も「インストール時の任意コード実行の抑制」（npmの`ignore-scripts`相当）も存在しない。** cargoは依存クレートの`build.rs`をビルド時に必ず実行する。

代わりに入れている `Cargo.lock` + `--locked`、`[sources]` による取得元の限定、`[advisories]` による脆弱性照合（`cargo deny check advisories`はRustSecに既に報告済みの脆弱性を弾くもので、「まだ誰も気づいていない攻撃を待ち時間でやり過ごす」という`exclude-newer`の目的の代替にはならない）が何を守り何を守らないのかも、あわせて伝えること。この差分はテンプレートの `README.md` にも書いてある。
