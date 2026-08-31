//! `__PROJECT_NAME__` の実行可能ファイル。
//!
//! `[lints.rust] missing_docs` は bin クレートに対しても「クレートレベルの
//! ドキュメントが無い」を検出するため、この `//!` を消すと `make lint` が落ちる。

use __PROJECT_NAME_SNAKE__::greeting::greet;

fn main() {
    let name = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "world".to_owned());
    println!("{}", greet(&name));
}
