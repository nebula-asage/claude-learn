# 動作確認する

`<配置先>` に移動し、以下を順に確認する。非対話シェルでは `~/.bashrc` のPATH設定が効かないため、必要なら `source "$HOME/.cargo/env"` を各コマンドの前に入れる。

- 引数なしで `just` を実行し、レシピ一覧（`just --list`相当）が表示されることを確認する。
- **`just lock` を最初に実行する。** これを飛ばすと以降の `--locked` 付きコマンドが全て `cannot create the lock file` で落ちる。生成された `Cargo.lock` はコミット対象。
- `just fmt-check` が差分なしで終了することを確認する（テンプレートはrustfmt適用済みの状態にしてある）。
- `just lint` が警告ゼロで終了することを確認する。
- `just run` を実行し、`Hello, world!` が出力されることを確認する。引数付きの動作は `cargo run --locked -- Rust` で確認できる。
- `just test` を実行し、ユニットテスト4件・統合テスト3件・doctest 2件が全て通ることを確認する。
- `just cover` を実行し、ファイルごとのカバレッジ表と未カバー行番号が表示されることを確認する（`src/main.rs` はテストから呼ばれないので0%になるのが正常）。
- `just cover-html` を実行し、`target/llvm-cov/html/index.html` が生成されることを確認する。
- 手順5でVS Code向け設定を配置した場合は `just cover-all` を実行し、`lcov.info` と `target/llvm-cov/html/index.html` が**両方同時に**存在することを確認する（`just cover-lcov` を単体で実行するとHTMLレポート側が消えるため、両方を確認したいときは `cover-all` を使う）。
- `just doc` を実行し、`target/doc/<スネークケースのクレート名>/index.html` が生成されることを確認する。
- `just deny` を実行し、`advisories ok, bans ok, licenses ok, sources ok` と表示されることを確認する。
- 最後に `just clean` で `target/` と `lcov.info` を削除し、コミット対象に成果物が残っていないことを `git status` で確かめる。

lintの実効性を反証で確かめる場合は `references/counter-tests.md` を参照する。
