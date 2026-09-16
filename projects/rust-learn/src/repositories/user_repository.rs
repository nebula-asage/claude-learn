//! ユーザーデータの永続化を担うモジュール
//!
//! このモジュールは、JSONファイルを使用してユーザーデータを保存および読み込む機能を提供します。
//! 保存先のファイルパスは環境変数`USER_DATA_FILE`で指定できます。

use crate::models::user::User;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::Path;

#[cfg(test)]
use mockall::automock;

/// ユーザーデータの永続化操作を定義するトレイト
///
/// このトレイトは、ユーザーデータのCRUD操作を定義します。
/// 実装は異なるストレージバックエンドに対して行うことができます。
#[cfg_attr(test, automock)]
pub trait UserRepository {
    /// ユーザーを保存します。
    ///
    /// # 引数
    /// * `user` - 保存するユーザー情報
    ///
    /// # 戻り値
    /// * `Ok(())` - 保存に成功した場合
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * ファイルの読み書きに失敗した場合
    /// * JSONのシリアライズに失敗した場合
    fn save(&self, user: &User) -> Result<(), String>;

    /// 指定されたメールアドレスのユーザーを検索します。
    ///
    /// # 引数
    /// * `email` - 検索するユーザーのメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(Some(User))` - ユーザーが見つかった場合
    /// * `Ok(None)` - ユーザーが見つからなかった場合
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * ファイルの読み込みに失敗した場合
    /// * JSONのデシリアライズに失敗した場合
    fn find_by_email(&self, email: &str) -> Result<Option<User>, String>;

    /// 全てのユーザーを取得します。
    ///
    /// # 戻り値
    /// * `Ok(Vec<User>)` - 全ユーザーのリスト
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * ファイルの読み込みに失敗した場合
    /// * JSONのデシリアライズに失敗した場合
    fn find_all(&self) -> Result<Vec<User>, String>;

    /// 指定されたメールアドレスのユーザーを削除します。
    ///
    /// # 引数
    /// * `email` - 削除するユーザーのメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(true)` - ユーザーが存在し、削除に成功した場合
    /// * `Ok(false)` - ユーザーが存在しなかった場合
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * ファイルの読み書きに失敗した場合
    /// * JSONのシリアライズ/デシリアライズに失敗した場合
    fn delete(&self, email: &str) -> Result<bool, String>;
}

/// JSONファイルベースのユーザーリポジトリの実装
pub struct UserRepositoryImpl {
    /// ユーザーデータを保存するJSONファイルのパス
    file_path: String,
}

impl Default for UserRepositoryImpl {
    fn default() -> Self {
        Self::new()
    }
}

impl UserRepositoryImpl {
    /// 新しいUserRepositoryインスタンスを作成します。
    ///
    /// 環境変数`USER_DATA_FILE`が設定されている場合はその値を、
    /// 設定されていない場合は"userdata.json"をファイルパスとして使用します。
    ///
    /// # 戻り値
    /// * `Self` - 新しいUserRepositoryインスタンス
    pub fn new() -> Self {
        let file_path = env::var("USER_DATA_FILE").unwrap_or_else(|_| "userdata.json".to_string());
        Self { file_path }
    }

    /// JSONファイルからユーザーデータを読み込みます。
    ///
    /// # 戻り値
    /// * `Ok(HashMap<String, User>)` - ユーザーデータのマップ（メールアドレスをキーとする）
    ///
    /// # エラー
    /// * ファイルの読み込みに失敗した場合
    /// * JSONのデシリアライズに失敗した場合
    fn read_users(&self) -> Result<HashMap<String, User>, String> {
        if !Path::new(&self.file_path).exists() {
            return Ok(HashMap::new());
        }

        let content = fs::read_to_string(&self.file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        if content.is_empty() {
            return Ok(HashMap::new());
        }

        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))
    }

    /// ユーザーデータをJSONファイルに書き込みます。
    ///
    /// # 引数
    /// * `users` - 書き込むユーザーデータのマップ
    ///
    /// # 戻り値
    /// * `Ok(())` - 書き込みに成功した場合
    ///
    /// # エラー
    /// * JSONのシリアライズに失敗した場合
    /// * ファイルの書き込みに失敗した場合
    fn write_users(&self, users: &HashMap<String, User>) -> Result<(), String> {
        let content = serde_json::to_string_pretty(users)
            .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

        fs::write(&self.file_path, content).map_err(|e| format!("Failed to write file: {}", e))
    }
}

impl UserRepository for UserRepositoryImpl {
    fn save(&self, user: &User) -> Result<(), String> {
        let mut users = self.read_users()?;
        users.insert(user.email.clone(), user.clone());
        self.write_users(&users)
    }

    fn find_by_email(&self, email: &str) -> Result<Option<User>, String> {
        let users = self.read_users()?;
        Ok(users.get(email).cloned())
    }

    fn find_all(&self) -> Result<Vec<User>, String> {
        let users = self.read_users()?;
        Ok(users.values().cloned().collect())
    }

    fn delete(&self, email: &str) -> Result<bool, String> {
        let mut users = self.read_users()?;
        let existed = users.remove(email).is_some();
        self.write_users(&users)?;
        Ok(existed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    fn create_test_user() -> User {
        User {
            email: "test@example.com".to_string(),
            username: "testuser".to_string(),
            phone: "1234567890".to_string(),
            age: 25,
        }
    }

    #[test]
    fn test_save_and_find_user() {
        let temp_file = NamedTempFile::new().unwrap();
        unsafe {
            env::set_var("USER_DATA_FILE", temp_file.path().to_str().unwrap());
        }

        let repo = UserRepositoryImpl::new();
        let user = create_test_user();

        // Test save
        repo.save(&user).unwrap();

        // Test find
        let found = repo.find_by_email(&user.email).unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap(), user);
    }

    #[test]
    fn test_find_all_users() {
        let temp_file = NamedTempFile::new().unwrap();
        unsafe {
            env::set_var("USER_DATA_FILE", temp_file.path().to_str().unwrap());
        }

        let repo = UserRepositoryImpl::new();
        let user1 = create_test_user();
        let mut user2 = create_test_user();
        user2.email = "test2@example.com".to_string();

        repo.save(&user1).unwrap();
        repo.save(&user2).unwrap();

        let users = repo.find_all().unwrap();
        assert_eq!(users.len(), 2);
    }

    #[test]
    fn test_delete_user() {
        let temp_file = NamedTempFile::new().unwrap();
        unsafe {
            env::set_var("USER_DATA_FILE", temp_file.path().to_str().unwrap());
        }

        let repo = UserRepositoryImpl::new();
        let user = create_test_user();

        repo.save(&user).unwrap();
        assert!(repo.delete(&user.email).unwrap());
        assert!(repo.find_by_email(&user.email).unwrap().is_none());
    }
}
