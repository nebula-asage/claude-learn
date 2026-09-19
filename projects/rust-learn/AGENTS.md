# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの位置づけ

このディレクトリは `claude-learn` モノレポ内の1プロジェクト（`projects/rust-learn/`）。Rustの練習用に手書きで構築されたコマンドライン製ユーザー管理システムで、後から `rust-cargo-project` スキルの標準構成（`justfile`・`rustfmt.toml`・`deny.toml`・lint/カバレッジ/ドキュメント生成環境）を追加導入済み。既存の依存関係（`Cargo.toml`の`[dependencies]`）とソース構成はそのまま維持している。

## よく使うコマンド

`justfile` を経由するのが基本（`just` でレシピ一覧を表示）。素の `cargo` を使う場合は全コマンドに `--locked` を付けること（`Cargo.lock` の暗黙な更新を防ぐ方針のため）。

```bash
just build                # ビルド
just test                  # 全テスト実行
just fmt / just fmt-check  # フォーマット / フォーマット差分チェック
just lint                  # clippy（-D warningsで警告をエラー扱いにする）
just cover                 # ターミナルにカバレッジを表示
just cover-html            # HTMLカバレッジレポート生成（target/llvm-cov/html/index.html）
just doc                   # rustdoc生成（target/doc/rust_learn/index.html）
just deny                  # 依存の脆弱性・ライセンス・取得元検査
just check                 # fmt-check → lint → test → doctest → deny をまとめて実行
cargo test --locked <テスト関数名>   # 単一テストの実行（例: cargo test --locked test_create_user_success）
```

CLIとして引数付きで実行する場合は `cargo run --locked -- <サブコマンド> <引数...>` を直接使う（`just run` はjustの可変長引数が空白入りの値を単語分割してしまうため、引数無しのスモークテスト専用。詳細は `README.md` 参照）。

データ保存先（デフォルト `./userdata.json`）は環境変数 `USER_DATA_FILE` で変更できる。テストは `tempfile::NamedTempFile` でこれを一時ファイルに差し替えている（`src/repositories/user_repository.rs` のテスト参照）。

### lintの方針（`Cargo.toml` の `[lints]`）

- `unsafe_code = "deny"`（`"forbid"` ではない）。edition 2024で `std::env::set_var` が `unsafe fn` 化されたため、テストコードで環境変数 `USER_DATA_FILE` を差し替える4箇所が `unsafe` ブロックを必須とする。該当箇所には `#[allow(unsafe_code)]` と理由コメントを付けてある。新規に `unsafe` を書く場合は同様にローカルで明示的に許可すること（`deny` なので無許可では通らない）。
- `clippy::unwrap_used` はテストモジュールでは `#[allow(clippy::unwrap_used)]` を各 `mod tests` に付けて許容している（テストでは失敗=パニックが正しい挙動のため）。本番コード側で `.unwrap()` が必要な場合（`Regex::new` の固定パターンなど）は、その1箇所だけをローカルに `#[allow]` し理由を書くこと。

## アーキテクチャ

4層構成のレイヤードアーキテクチャで、依存方向は上から下の一方向（`commands → services → repositories`、`models` は全層から参照される）。

- **`src/models/user.rs`** — `User` 構造体（`Serialize`/`Deserialize` 実装済み）。純粋なデータ定義のみで、バリデーションロジックは持たない。
- **`src/repositories/user_repository.rs`** — `UserRepository` トレイトと、その実装 `UserRepositoryImpl`（JSONファイルへの読み書き）。トレイトは `#[cfg_attr(test, automock)]` で `mockall` によるモック（`MockUserRepository`）を自動生成しており、サービス層のテストはこのモックに依存する。永続化は「全件読み込み→HashMap上で操作→全件書き込み」という単純な方式（部分更新はしない）。
- **`src/services/user_service.rs`** — `UserService<T: UserRepository>` にビジネスロジック（バリデーション・重複チェック・CRUD制御）を集約。リポジトリ型をジェネリクスで受け取るため、本番では `UserRepositoryImpl`、テストでは `MockUserRepository` を注入できる。エラー型 `UserError` もこのファイルに定義されている（`InvalidEmail` / `InvalidUsername` / `InvalidPhone` / `InvalidAge` / `UserNotFound` / `UserAlreadyExists` / `RepositoryError`）。
- **`src/commands/user_command.rs`** — `UserCommand` がCLI引数のパースと出力フォーマットを担当し、`UserService<UserRepositoryImpl>` を具象型で保持する（DIはここで終端し、これより上位ではジェネリクスを使わない）。
- **`src/main.rs`** — `env::args()` をディスパッチするだけの薄いエントリポイント。

新しいユーザー属性やコマンドを追加する場合は、`models`→`repositories`（トレイトとモック実装の両方）→`services`（バリデーションとエラーバリアント）→`commands`の順に上から下へ変更が波及する点に注意する。

### バリデーションルール（`user_service.rs` に実装）

- メールアドレス: 正規表現 `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
- ユーザー名: 3文字以上（空文字不可）
- 電話番号: 数字のみ10桁以上（正規表現 `^\d{10,}$`）
- 年齢: 0〜150（`u32`のため下限0は型で保証済み、上限のみ検証）

これらの制約や仕様の詳細は `README.md`、設計意図は `docs/implementation.md` にまとまっている。
