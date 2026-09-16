use crate::models::user::User;
use crate::repositories::user_repository::UserRepository;
use regex::Regex;

/// ユーザー管理のビジネスロジックを実装するサービス
pub struct UserService<T: UserRepository> {
    /// ユーザーデータの永続化を担当するリポジトリ
    repository: T,
}

/// ユーザー操作に関連するエラー
#[derive(Debug)]
#[allow(dead_code)] // 全てのバリアントがテストで使用されるため
pub enum UserError {
    /// メールアドレスの形式が不正な場合のエラー
    InvalidEmail(String),
    /// ユーザー名が不正な場合のエラー
    InvalidUsername(String),
    /// 電話番号が不正な場合のエラー
    InvalidPhone(String),
    /// 年齢が不正な場合のエラー
    InvalidAge(String),
    /// ユーザーが見つからない場合のエラー
    UserNotFound(String),
    /// リポジトリ操作に失敗した場合のエラー
    RepositoryError(String),
    /// 既に存在するユーザーを作成しようとした場合のエラー
    UserAlreadyExists(String),
}

impl From<String> for UserError {
    fn from(error: String) -> Self {
        UserError::RepositoryError(error)
    }
}

impl<T: UserRepository> UserService<T> {
    /// 新しい`UserService`インスタンスを作成します。
    ///
    /// # 引数
    /// * `repository` - ユーザーデータの永続化を担当するリポジトリ
    ///
    /// # 戻り値
    /// * `Self` - 新しい`UserService`インスタンス
    pub fn new(repository: T) -> Self {
        Self { repository }
    }

    /// 新しいユーザーを作成します。
    ///
    /// # 引数
    /// * `email` - ユーザーのメールアドレス
    /// * `username` - ユーザー名（3文字以上）
    /// * `phone` - 電話番号（10桁以上の数字）
    /// * `age` - 年齢（0-150の範囲）
    ///
    /// # 戻り値
    /// * `Ok(User)` - 作成されたユーザー情報
    ///
    /// # エラー
    /// * `UserError::InvalidEmail` - メールアドレスの形式が不正な場合
    /// * `UserError::InvalidUsername` - ユーザー名が不正な場合
    /// * `UserError::InvalidPhone` - 電話番号が不正な場合
    /// * `UserError::InvalidAge` - 年齢が不正な場合
    /// * `UserError::UserAlreadyExists` - 同じメールアドレスのユーザーが既に存在する場合
    /// * `UserError::RepositoryError` - データの保存に失敗した場合
    ///   新しいユーザーを作成します。
    ///
    /// # 引数
    /// * `email` - メールアドレス
    /// * `username` - ユーザー名
    /// * `phone` - 電話番号
    /// * `age` - 年齢
    ///
    /// # 戻り値
    /// * `Ok(User)` - 作成されたユーザー情報
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * `UserError::InvalidEmail` - メールアドレスの形式が不正な場合
    /// * `UserError::InvalidUsername` - ユーザー名が3文字未満の場合
    /// * `UserError::InvalidPhone` - 電話番号が10桁未満の場合
    /// * `UserError::InvalidAge` - 年齢が150歳を超える場合
    /// * `UserError::UserAlreadyExists` - 同じメールアドレスのユーザーが既に存在する場合
    /// * `UserError::RepositoryError` - データの永続化に失敗した場合
    pub fn create_user(
        &self,
        email: String,
        username: String,
        phone: String,
        age: u32,
    ) -> Result<User, UserError> {
        Self::validate_email(&email)?;
        Self::validate_username(&username)?;
        Self::validate_phone(&phone)?;
        Self::validate_age(age)?;

        // Check if user already exists
        if let Ok(Some(_)) = self.repository.find_by_email(&email) {
            return Err(UserError::UserAlreadyExists(format!(
                "User with email {email} already exists"
            )));
        }

        let user = User {
            email,
            username,
            phone,
            age,
        };

        self.repository
            .save(&user)
            .map_err(UserError::RepositoryError)?;

        Ok(user)
    }

    /// 既存のユーザー情報を更新します。
    ///
    /// # 引数
    /// * `email` - 更新するユーザーのメールアドレス
    /// * `username` - 新しいユーザー名（3文字以上）
    /// * `phone` - 新しい電話番号（10桁以上の数字）
    /// * `age` - 新しい年齢（0-150の範囲）
    ///
    /// # 戻り値
    /// * `Ok(User)` - 更新されたユーザー情報
    ///
    /// # エラー
    /// * `UserError::InvalidUsername` - ユーザー名が不正な場合
    /// * `UserError::InvalidPhone` - 電話番号が不正な場合
    /// * `UserError::InvalidAge` - 年齢が不正な場合
    /// * `UserError::UserNotFound` - 指定されたメールアドレスのユーザーが存在しない場合
    /// * `UserError::RepositoryError` - データの更新に失敗した場合
    ///   既存のユーザー情報を更新します。
    ///
    /// # 引数
    /// * `email` - 更新対象のユーザーのメールアドレス（変更不可）
    /// * `username` - 新しいユーザー名
    /// * `phone` - 新しい電話番号
    /// * `age` - 新しい年齢
    ///
    /// # 戻り値
    /// * `Ok(User)` - 更新されたユーザー情報
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * `UserError::InvalidUsername` - ユーザー名が3文字未満の場合
    /// * `UserError::InvalidPhone` - 電話番号が10桁未満の場合
    /// * `UserError::InvalidAge` - 年齢が150歳を超える場合
    /// * `UserError::UserNotFound` - 指定されたメールアドレスのユーザーが存在しない場合
    /// * `UserError::RepositoryError` - データの永続化に失敗した場合
    pub fn update_user(
        &self,
        email: String,
        username: String,
        phone: String,
        age: u32,
    ) -> Result<User, UserError> {
        Self::validate_username(&username)?;
        Self::validate_phone(&phone)?;
        Self::validate_age(age)?;

        // Check if user exists
        if self.repository.find_by_email(&email)?.is_none() {
            return Err(UserError::UserNotFound(format!(
                "User with email {email} not found"
            )));
        }

        let user = User {
            email,
            username,
            phone,
            age,
        };

        self.repository
            .save(&user)
            .map_err(UserError::RepositoryError)?;

        Ok(user)
    }

    /// 指定されたメールアドレスのユーザー情報を取得します。
    ///
    /// # 引数
    /// * `email` - 検索するユーザーのメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(User)` - ユーザー情報
    ///
    /// # エラー
    /// * `UserError::UserNotFound` - 指定されたメールアドレスのユーザーが存在しない場合
    /// * `UserError::RepositoryError` - データの取得に失敗した場合
    ///   指定されたメールアドレスのユーザー情報を取得します。
    ///
    /// # 引数
    /// * `email` - 検索するユーザーのメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(User)` - 見つかったユーザー情報
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * `UserError::UserNotFound` - 指定されたメールアドレスのユーザーが存在しない場合
    /// * `UserError::RepositoryError` - データの取得に失敗した場合
    pub fn get_user(&self, email: &str) -> Result<User, UserError> {
        self.repository
            .find_by_email(email)?
            .ok_or_else(|| UserError::UserNotFound(format!("User with email {email} not found")))
    }

    /// 全てのユーザー情報を取得します。
    ///
    /// # 戻り値
    /// * `Ok(Vec<User>)` - ユーザー情報のリスト
    ///
    /// # エラー
    /// * `UserError::RepositoryError` - データの取得に失敗した場合
    ///   全てのユーザー情報を取得します。
    ///
    /// # 戻り値
    /// * `Ok(Vec<User>)` - 全てのユーザー情報
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * `UserError::RepositoryError` - データの取得に失敗した場合
    pub fn list_users(&self) -> Result<Vec<User>, UserError> {
        self.repository
            .find_all()
            .map_err(UserError::RepositoryError)
    }

    /// 指定されたメールアドレスのユーザーを削除します。
    ///
    /// # 引数
    /// * `email` - 削除するユーザーのメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(())` - ユーザーの削除に成功した場合
    ///
    /// # エラー
    /// * `UserError::UserNotFound` - 指定されたメールアドレスのユーザーが存在しない場合
    /// * `UserError::RepositoryError` - データの削除に失敗した場合
    ///   指定されたメールアドレスのユーザーを削除します。
    ///
    /// # 引数
    /// * `email` - 削除するユーザーのメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(())` - 削除成功
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * `UserError::UserNotFound` - 指定されたメールアドレスのユーザーが存在しない場合
    /// * `UserError::RepositoryError` - データの削除に失敗した場合
    pub fn delete_user(&self, email: &str) -> Result<(), UserError> {
        if !self
            .repository
            .delete(email)
            .map_err(UserError::RepositoryError)?
        {
            return Err(UserError::UserNotFound(format!(
                "User with email {email} not found"
            )));
        }
        Ok(())
    }

    /// メールアドレスの形式を検証します。
    ///
    /// # 引数
    /// * `email` - 検証するメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(())` - 検証に成功した場合
    ///
    /// # エラー
    /// * `UserError::InvalidEmail` - メールアドレスの形式が不正な場合
    fn validate_email(email: &str) -> Result<(), UserError> {
        // パターンはコンパイル時に固定されたリテラルであり、コンパイル可能であることが
        // 保証されているためunwrapが安全（実行時入力に依存しない）
        #[allow(clippy::unwrap_used)]
        let email_regex = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
        if !email_regex.is_match(email) {
            return Err(UserError::InvalidEmail(format!(
                "Invalid email format: {email}"
            )));
        }
        Ok(())
    }

    /// ユーザー名の長さを検証します。
    ///
    /// # 引数
    /// * `username` - 検証するユーザー名
    ///
    /// # 戻り値
    /// * `Ok(())` - 検証に成功した場合
    ///
    /// # エラー
    /// * `UserError::InvalidUsername` - ユーザー名が3文字未満の場合
    fn validate_username(username: &str) -> Result<(), UserError> {
        if username.trim().is_empty() || username.len() < 3 {
            return Err(UserError::InvalidUsername(
                "Username must be at least 3 characters long".to_string(),
            ));
        }
        Ok(())
    }

    /// 電話番号の形式を検証します。
    ///
    /// # 引数
    /// * `phone` - 検証する電話番号
    ///
    /// # 戻り値
    /// * `Ok(())` - 検証に成功した場合
    ///
    /// # エラー
    /// * `UserError::InvalidPhone` - 電話番号が10桁未満の場合
    fn validate_phone(phone: &str) -> Result<(), UserError> {
        // パターンはコンパイル時に固定されたリテラルであり、コンパイル可能であることが
        // 保証されているためunwrapが安全（実行時入力に依存しない）
        #[allow(clippy::unwrap_used)]
        let phone_regex = Regex::new(r"^\d{10,}$").unwrap();
        if !phone_regex.is_match(phone) {
            return Err(UserError::InvalidPhone(
                "Phone number must be at least 10 digits".to_string(),
            ));
        }
        Ok(())
    }

    /// 年齢の範囲を検証します。
    ///
    /// # 引数
    /// * `age` - 検証する年齢
    ///
    /// # 戻り値
    /// * `Ok(())` - 検証に成功した場合
    ///
    /// # エラー
    /// * `UserError::InvalidAge` - 年齢が150歳を超える場合
    fn validate_age(age: u32) -> Result<(), UserError> {
        if age > 150 {
            return Err(UserError::InvalidAge(
                "Age must be between 0 and 150".to_string(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
// テストコードでは失敗=パニックが正しい挙動のため、慣例的にunwrapを許可する
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::repositories::user_repository::MockUserRepository;

    fn create_mock_repository() -> MockUserRepository {
        MockUserRepository::new()
    }

    #[test]
    fn test_create_user_success() {
        let mut mock_repo = create_mock_repository();
        mock_repo.expect_find_by_email().return_once(|_| Ok(None));
        mock_repo.expect_save().return_once(|_| Ok(()));

        let service = UserService::new(mock_repo);
        let result = service.create_user(
            "test@example.com".to_string(),
            "testuser".to_string(),
            "1234567890".to_string(),
            25,
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_create_user_invalid_email() {
        let mock_repo = create_mock_repository();
        let service = UserService::new(mock_repo);
        let result = service.create_user(
            "invalid-email".to_string(),
            "testuser".to_string(),
            "1234567890".to_string(),
            25,
        );

        assert!(matches!(result, Err(UserError::InvalidEmail(_))));
    }

    #[test]
    fn test_update_user_not_found() {
        let mut mock_repo = create_mock_repository();
        mock_repo.expect_find_by_email().return_once(|_| Ok(None));

        let service = UserService::new(mock_repo);
        let result = service.update_user(
            "test@example.com".to_string(),
            "testuser".to_string(),
            "1234567890".to_string(),
            25,
        );

        assert!(matches!(result, Err(UserError::UserNotFound(_))));
    }

    #[test]
    fn test_delete_user_success() {
        let mut mock_repo = create_mock_repository();
        mock_repo.expect_delete().return_once(|_| Ok(true));

        let service = UserService::new(mock_repo);
        let result = service.delete_user("test@example.com");

        assert!(result.is_ok());
    }
}
