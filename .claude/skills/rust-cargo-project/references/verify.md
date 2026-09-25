# 動作確認する

`<配置先>` に移動し、動作確認は以下の1本のコマンドにまとめて実行する（成功を前提に連結し、落ちたコマンドだけ個別に切り分ける）。非対話シェルでは `~/.bashrc` のPATH設定が効かないため、必要なら `source "$HOME/.cargo/env"` を先頭に入れる。

**`just lock` は必ず単独で先に実行する。** これを飛ばすと以降の `--locked` 付きコマンドが全て `cannot create the lock file` で落ちる。生成された `Cargo.lock` はコミット対象。

```bash
just lock
```

続けて以下をまとめて実行する（手順5でVS Code向け設定を配置していない場合は `cover-all` の行を `cover-html` に置き換える）。

```bash
set -e
echo "=== just (list) ==="; just
echo "=== fmt-check ==="; just fmt-check
echo "=== lint ==="; just lint
echo "=== run ==="; just run
echo "=== test ==="; just test
echo "=== cover ==="; just cover
echo "=== cover-all ==="; just cover-all
echo "=== doc ==="; just doc
echo "=== deny ==="; just deny
echo "=== clean ==="; just clean
echo "=== git status ==="; git status --short
```

出力から以下を確認する:

- `just`: レシピ一覧（`just --list`相当）が表示される
- `fmt-check`: 差分なしで終了する（テンプレートはrustfmt適用済みの状態にしてある）
- `lint`: 警告ゼロで終了する
- `run`: `Hello, world!` が出力される。引数付きの動作は別途 `cargo run --locked -- Rust` で確認できる
- `test`: ユニットテスト4件・統合テスト3件・doctest 2件が全て通る
- `cover`: ファイルごとのカバレッジ表と未カバー行番号が表示される（`src/main.rs` はテストから呼ばれないので0%になるのが正常）
- `cover-all`: `lcov.info` と `target/llvm-cov/html/index.html` が**両方同時に**生成される（`cover-lcov` を単体実行するとHTMLレポート側が消えるため、両方確認したいときは必ず `cover-all` を使う）。VS Code向け設定を配置していない場合は `cover-html` に置き換え、`target/llvm-cov/html/index.html` の生成のみ確認する
- `doc`: `target/doc/<スネークケースのクレート名>/index.html` が生成される
- `deny`: `advisories ok, bans ok, licenses ok, sources ok` と表示される
- `clean`: `target/` と `lcov.info` が削除される
- `git status`: コミット対象に成果物が残っていない（出力が空）

途中で失敗したら、そのコマンドだけ単独で再実行して詳細を確認する。

lintの実効性を反証で確かめる場合は `references/counter-tests.md` を参照する。
