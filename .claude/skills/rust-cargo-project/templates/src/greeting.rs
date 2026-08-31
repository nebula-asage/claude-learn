//! 挨拶文の組み立てを担当するモジュール。

use std::error::Error;
use std::fmt;

/// 挨拶の相手の名前が空だったことを表すエラー。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmptyNameError;

impl fmt::Display for EmptyNameError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "挨拶する相手の名前が空です")
    }
}

impl Error for EmptyNameError {}

/// `name` に向けた挨拶文を組み立てる。
///
/// 名前が空（または空白のみ）の場合は `world` として扱う。空文字をエラーとして
/// 扱いたい場合は [`try_greet`] を使う。
///
/// # Examples
///
/// ```
/// use __PROJECT_NAME_SNAKE__::greeting::greet;
///
/// assert_eq!(greet("Rust"), "Hello, Rust!");
/// assert_eq!(greet("   "), "Hello, world!");
/// ```
#[must_use]
pub fn greet(name: &str) -> String {
    try_greet(name).unwrap_or_else(|_| format_greeting("world"))
}

/// `name` に向けた挨拶文を組み立て、空の名前はエラーとして返す。
///
/// # Errors
///
/// `name` が空文字、または空白文字のみの場合に [`EmptyNameError`] を返す。
///
/// # Examples
///
/// ```
/// use __PROJECT_NAME_SNAKE__::greeting::{EmptyNameError, try_greet};
///
/// assert_eq!(try_greet("Rust").as_deref(), Ok("Hello, Rust!"));
/// assert_eq!(try_greet(""), Err(EmptyNameError));
/// ```
pub fn try_greet(name: &str) -> Result<String, EmptyNameError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(EmptyNameError);
    }
    Ok(format_greeting(trimmed))
}

/// 挨拶文の書式を 1 箇所にまとめるための内部ヘルパー。
///
/// private なアイテムだが、`clippy::missing_docs_in_private_items` を有効に
/// しているのでこのコメントが無いと `make lint` が落ちる。
fn format_greeting(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg(test)]
mod tests {
    use super::{EmptyNameError, greet, try_greet};

    // `#[cfg(test)]` 配下は clippy の missing_docs_in_private_items の対象外なので、
    // テスト関数にドキュメンテーションコメントを書く必要はない。

    #[test]
    fn greet_uses_the_given_name() {
        assert_eq!(greet("Rust"), "Hello, Rust!");
    }

    #[test]
    fn greet_falls_back_to_world_for_blank_names() {
        assert_eq!(greet(""), "Hello, world!");
        assert_eq!(greet("   "), "Hello, world!");
    }

    #[test]
    fn try_greet_trims_surrounding_whitespace() {
        assert_eq!(try_greet("  Rust  ").as_deref(), Ok("Hello, Rust!"));
    }

    #[test]
    fn try_greet_rejects_blank_names() {
        assert_eq!(try_greet("   "), Err(EmptyNameError));
    }
}
