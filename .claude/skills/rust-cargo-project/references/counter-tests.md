# lintが本当に効いているかを反証で確かめる

設定を書いただけで実は無効、という状態を防ぐため。以下はいずれも検証済みで、確認後は必ず元に戻すこと。

- `src/greeting.rs` の `///` コメントを削ると、`missing documentation for a struct` / `missing documentation for a function`（いずれも `pub` なアイテム）と `docs for function returning \`Result\` missing \`# Errors\` section` が `just lint` で検出される。private な `format_greeting` にはドキュメンテーションコメントを強制していないので、そちらのコメントを削っても `just lint` は落ちない。
- `src/main.rs` 冒頭の `//!` を削ると `missing documentation for the crate` が検出される。
- `src/greeting.rs` の `` [`try_greet`] `` を存在しない名前に書き換えると、`just doc` が `unresolved link to ...` で落ちる（`just lint` では検出されない。rustdocのlintなので `cargo doc` 側で出る）。
- `Cargo.toml` の依存を `foo = "*"` のようなワイルドカード指定にすると `just deny` が `error[wildcard]` で落ちる。`cargo add <crate> --git <URL>` でgit依存を足すと `error[source-not-allowed]` で落ちる。
- `src/greeting.rs` の `try_greet(name).unwrap_or_else(...)` を `try_greet(name).unwrap()` に書き換えると `used \`unwrap()\` on a \`Result\` value` が `just lint` で検出される。
