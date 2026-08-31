.PHONY: lock run build fmt fmt-check lint test doctest cover cover-html cover-lcov cover-all doc doc-open deny check clean

# 全コマンドに --locked を付けている。Cargo.lock に記録されたバージョンから
# 暗黙に更新されるのを防ぎ、意図しない依存の入れ替わりを検出するため
# （Cargo.lock の更新が必要な状態だとコマンドがエラーで止まる）。
# 依存を更新したいときは `cargo add` / `cargo update` を明示的に実行する。
CARGO_FLAGS := --locked

# Cargo.lock がまだ無い状態では --locked 付きのコマンドが全て
# 「cannot create the lock file ... because --locked was passed」で失敗する。
# clone 直後やテンプレート展開直後に一度だけ実行すること。
lock:
	cargo generate-lockfile

run:
	cargo run $(CARGO_FLAGS)

build:
	cargo build $(CARGO_FLAGS)

fmt:
	cargo fmt --all

fmt-check:
	cargo fmt --all -- --check

# --all-targets を付けないと tests/ や examples/ が lint 対象から外れる。
# -D warnings で警告をエラーに格上げし、Cargo.toml の [lints] を実質必須化する。
lint:
	cargo clippy $(CARGO_FLAGS) --all-targets --all-features -- -D warnings

test:
	cargo test $(CARGO_FLAGS) --all-features

# ドキュメンテーションコメント内の ``` で囲んだ例（doctest）だけを実行する。
# doctest はライブラリターゲットにしか存在しないため --doc を明示する。
doctest:
	cargo test $(CARGO_FLAGS) --doc

# 注意: cargo llvm-cov は起動のたびに target/llvm-cov/ を作り直すため、
# cover-html の後に cover-lcov を実行すると HTML レポートが消える（逆も同様）。
# 両方が要るときは、計測を1回だけ行って複数形式を書き出す cover-all を使うこと。

# ターミナルにファイルごとのカバレッジと未カバー行番号を表示する。
cover:
	cargo llvm-cov $(CARGO_FLAGS) --all-features --show-missing-lines

# HTML レポートを target/llvm-cov/html/index.html に生成する。
cover-html:
	cargo llvm-cov $(CARGO_FLAGS) --all-features --html
	@echo "レポート: target/llvm-cov/html/index.html"

# VS Code の Coverage Gutters 拡張が読む lcov 形式で出力する。
cover-lcov:
	cargo llvm-cov $(CARGO_FLAGS) --all-features --lcov --output-path lcov.info

# --no-report でテストを実行して計測データだけを残し、`report` サブコマンドで
# そのデータから HTML と lcov の両方を書き出す。テストの実行は1回で済む。
cover-all:
	cargo llvm-cov $(CARGO_FLAGS) --all-features --no-report
	cargo llvm-cov report --lcov --output-path lcov.info
	cargo llvm-cov report --html
	@echo "レポート: target/llvm-cov/html/index.html, lcov.info"

# --no-deps で依存クレートのドキュメントは生成しない（自分のクレートだけで十分かつ高速）。
# --document-private-items で private なアイテムも API リファレンスに含める。
doc:
	cargo doc $(CARGO_FLAGS) --no-deps --document-private-items
	@echo "ドキュメント: target/doc/__PROJECT_NAME_SNAKE__/index.html"

doc-open:
	cargo doc $(CARGO_FLAGS) --no-deps --document-private-items --open

# RustSec 脆弱性DBとの照合・ライセンス検査・依存の取得元制限をまとめて実行する。
deny:
	cargo deny check

# コミット前に一通り回すためのまとめターゲット。
check: fmt-check lint test doctest deny

clean:
	cargo clean
	rm -f lcov.info
