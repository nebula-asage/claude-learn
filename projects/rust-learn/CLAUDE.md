# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの位置づけ

このディレクトリは `claude-learn` モノレポ内の1プロジェクト（`projects/rust-learn/`）。Rustの練習用に手書きで構築されたコマンドライン製ユーザー管理システムで、`rust-cargo-project` スキルが生成する標準構成（`justfile`・`deny.toml`・カバレッジ設定）は導入されていない。ビルド・テスト・lintは素の `cargo` コマンドで行う。

## よく使うコマンド

```bash
cargo build              # ビルド
cargo run -- <サブコマンド> <引数...>   # 実行（例: cargo run -- create john@example.com "John Doe" 1234567890 25）
cargo test                # 全テスト実行
cargo test <テスト関数名>  # 単一テストの実行（例: cargo test test_create_user_success）
cargo test --lib <モジュール名>::  # モジュール単位のテスト（例: cargo test services::user_service::)
cargo clippy               # lint（Cargo.tomlの[lints.clippy]でmissing_docs系がwarn設定済み）
cargo fmt                  # フォーマット
```

データ保存先（デフォルト `./userdata.json`）は環境変数 `USER_DATA_FILE` で変更できる。テストは `tempfile::NamedTempFile` でこれを一時ファイルに差し替えている（`src/repositories/user_repository.rs` のテスト参照）。

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
