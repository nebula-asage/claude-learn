//! ユーザデータを表す構造体の定義

use serde::{Deserialize, Serialize};

/// ユーザデータを表す構造体
///
/// この構造体はユーザの基本情報を保持し、JSONとの相互変換が可能です。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct User {
    /// ユーザのメールアドレス（一意な識別子として使用）
    ///
    /// 標準的なメールアドレス形式である必要があります。
    /// 例: "user@example.com"
    ///
    /// # Examples
    /// ```rust,ignore
    /// let user = User {
    ///     email: "user@example.com".to_string(),
    ///     // ... 他のフィールド
    /// };
    /// ```
    ///
    pub email: String,

    /// ユーザの表示名
    ///
    /// 3文字以上の長さが必要です。
    /// 空文字列は許可されません。
    pub username: String,

    /// ユーザの電話番号
    ///
    /// 10桁以上の数字である必要があります。
    /// ハイフンなどの区切り文字は使用できません。
    pub phone: String,

    /// ユーザの年齢
    ///
    /// 0から150までの整数である必要があります。
    pub age: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_creation() {
        let user = User {
            email: "test@example.com".to_string(),
            username: "testuser".to_string(),
            phone: "1234567890".to_string(),
            age: 25,
        };

        assert_eq!(user.email, "test@example.com");
        assert_eq!(user.username, "testuser");
        assert_eq!(user.phone, "1234567890");
        assert_eq!(user.age, 25);
    }

    #[test]
    fn test_user_serialization() {
        let user = User {
            email: "test@example.com".to_string(),
            username: "testuser".to_string(),
            phone: "1234567890".to_string(),
            age: 25,
        };

        let serialized = serde_json::to_string(&user).unwrap();
        let deserialized: User = serde_json::from_str(&serialized).unwrap();

        assert_eq!(user, deserialized);
    }
}
