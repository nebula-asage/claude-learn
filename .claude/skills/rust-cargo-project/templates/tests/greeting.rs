//! 統合テスト。`src/` 内のユニットテスト（`#[cfg(test)] mod tests`）と違い、
//! ライブラリを外部クレートとして `use` するため、公開 API として本当に見えて
//! いるものだけをテストできる。

use __PROJECT_NAME_SNAKE__::greeting::{EmptyNameError, greet, try_greet};

#[test]
fn greet_is_reachable_as_public_api() {
    assert_eq!(greet("Rust"), "Hello, Rust!");
}

#[test]
fn try_greet_reports_blank_names_as_errors() {
    assert_eq!(try_greet(""), Err(EmptyNameError));
}

#[test]
fn empty_name_error_renders_a_message() {
    assert_eq!(EmptyNameError.to_string(), "挨拶する相手の名前が空です");
}
