# __PROJECT_NAME__

__PROJECT_DESCRIPTION__

Rust の練習・開発用プロジェクト。lint（clippy）・フォーマット（rustfmt）・テスト・
カバレッジ計測・ドキュメンテーションコメントの強制・API リファレンス生成・
依存の検査（cargo-deny）が最初から動く状態になっている。

## 構成

```
.
├── Cargo.toml           # パッケージ定義と [lints] による lint 設定
├── Cargo.lock           # 依存バージョンの固定（コミット対象）
├── rustfmt.toml         # フォーマッタ設定
├── deny.toml            # cargo-deny の設定（脆弱性・ライセンス・取得元）
├── Makefile             # 各種コマンドの入口
├── src/
│   ├── lib.rs           # ライブラリクレートの入口
│   ├── greeting.rs      # ロジック本体（サンプル実装）
│   └── main.rs          # 実行可能ファイル（薄い入口）
└── tests/
    └── greeting.rs      # 統合テスト
```

ロジックを `src/main.rs` に直接書かず `src/lib.rs` 側のモジュールに置いているのは、
`missing_docs` によるドキュメンテーションコメントの強制と `cargo doc` による
API リファレンス生成が、公開 API を持つライブラリクレートでないと実質機能しないため。

## 必要なもの

| ツール | 用途 | 導入方法 |
| --- | --- | --- |
| rustup / cargo / rustc | ツールチェーン本体 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| rustfmt / clippy | フォーマット・lint | rustup の既定コンポーネント（通常は導入済み） |
| llvm-tools-preview | カバレッジ計測 | `rustup component add llvm-tools-preview` |
| cargo-llvm-cov | カバレッジ計測 | `cargo install cargo-llvm-cov --locked` |
| cargo-deny | 依存の検査 | `cargo install cargo-deny --locked` |

いずれも `~/.cargo/` 配下へのユーザーローカル導入で、`sudo` は不要。

## コマンド

clone 直後は `Cargo.lock` が無いため、まず一度だけ `make lock` を実行すること
（`Makefile` の各コマンドは `--locked` 付きで cargo を呼ぶので、`Cargo.lock` が
無いと `cannot create the lock file ... because --locked was passed` で失敗する）。

| コマンド | 内容 |
| --- | --- |
| `make lock` | `Cargo.lock` を生成する（clone 直後に一度だけ） |
| `make run` | 実行する（`make run` は引数なし。引数を渡すなら `cargo run --locked -- <名前>`） |
| `make build` | ビルドする |
| `make fmt` | rustfmt で整形する |
| `make fmt-check` | 整形済みかどうかだけを検査する（書き換えない） |
| `make lint` | clippy を警告もエラー扱い（`-D warnings`）で実行する |
| `make test` | ユニットテスト・統合テストを実行する |
| `make doctest` | ドキュメンテーションコメント内の例（doctest）だけを実行する |
| `make cover` | カバレッジをターミナルに表示する（未カバー行番号つき） |
| `make cover-html` | HTML レポートを `target/llvm-cov/html/index.html` に生成する |
| `make cover-lcov` | `lcov.info` を生成する（VS Code の Coverage Gutters 用） |
| `make cover-all` | HTML と `lcov.info` を1回の計測から両方生成する |
| `make doc` | API リファレンスを `target/doc/` に生成する |
| `make doc-open` | API リファレンスを生成してブラウザで開く |
| `make deny` | cargo-deny で脆弱性・ライセンス・依存の取得元を検査する |
| `make check` | `fmt-check` → `lint` → `test` → `doctest` → `deny` をまとめて実行する |
| `make clean` | ビルド成果物と `lcov.info` を削除する |

`cargo llvm-cov` は起動のたびに `target/llvm-cov/` を作り直すため、`make cover-html`
の後に `make cover-lcov` を実行すると HTML レポートが消える（逆も同様）。両方が要る
ときは `make cover-all` を使うこと。

## ドキュメンテーションコメントについて

`Cargo.toml` の `[lints]` で、コメントの書き漏らしが `make lint` で落ちるようにしてある。

- `missing_docs` — 公開アイテム（`pub`）にコメントを必須にする。**`src/main.rs` に対しても
  クレートレベルのコメント（`//!`）を必須にする**点に注意
- `clippy::missing_errors_doc` / `missing_panics_doc` — `Result` を返す関数には
  `# Errors`、panic しうる関数には `# Panics` セクションを必須にする
- `rustdoc::broken_intra_doc_links` — `[`Foo`]` 形式のリンク切れを検出する（`deny`）

コメント内に ` ``` ` で囲んだコード例を書くと doctest として実際に実行され、
例が古くなってコンパイルが通らなくなった時点で `make doctest` が落ちる。

## パニックを起こしうる書き方について

`[lints.clippy]` で、`all` / `pedantic` には含まれない restriction 系のlintを
個別に有効化し、パニックを起こしうる書き方を `make lint` で検出できるようにしてある。

- `unwrap_used` / `expect_used` — `.unwrap()` / `.expect()` の呼び出し
- `panic` / `unreachable` / `todo` / `unimplemented` — 明示的にパニックするマクロ呼び出し
- `indexing_slicing` — `v[i]` のような境界チェック無しのインデックスアクセス
- `arithmetic_side_effects` — オーバーフロー時にパニックしうる算術演算

回避する場合は `?` によるエラー伝播や `get` / `checked_*` 系のメソッドを使う。

## サプライチェーン対策について

このリポジトリの共通方針である「公開直後のバージョンを使わない（猶予 7 日）」に
**cargo は対応する機能を持たない**。npm/pnpm の `minimum-release-age` や uv の
`exclude-newer` に相当する設定は cargo に存在せず、`cargo-deny` の脆弱性 DB 照合は
「既に報告済みの問題を弾く」ものなので代替にはならない。

同様に、「インストール時の任意コード実行の抑制」（npm の `ignore-scripts` 相当）も
cargo には無い。cargo は依存クレートの `build.rs` をビルド時に必ず実行するため、
これを止める設定は存在しない。

そのうえで、cargo で実効性のある対策として以下を入れている。

- `Cargo.lock` をコミットし、全コマンドに `--locked` を付ける（`Makefile` で設定済み）。
  依存が暗黙に更新されるのを防ぎ、更新が必要な状態ならコマンドが止まる
- `deny.toml` の `[sources]` で取得元を crates.io に限定し、未知のレジストリや
  git リポジトリからの依存を禁止する
- `deny.toml` の `[advisories]` で RustSec 脆弱性データベースと照合する
- `deny.toml` の `[bans] wildcards = "deny"` でワイルドカードのバージョン指定を禁止する

依存を追加したら `make deny` を実行すること。
