use crate::models::user::User;
use crate::repositories::user_repository::UserRepositoryImpl;
use crate::services::user_service::UserService;

/// コマンドライン操作を処理するコマンドハンドラ
pub struct UserCommand {
    /// ユーザー操作のビジネスロジックを実装するサービス
    service: UserService<UserRepositoryImpl>,
}

impl Default for UserCommand {
    fn default() -> Self {
        Self::new()
    }
}

impl UserCommand {
    /// 新しいUserCommandインスタンスを作成します。
    ///
    /// # 戻り値
    /// * `Self` - 新しいUserCommandインスタンス
    ///
    /// # Errors
    /// このメソッドはエラーを返しません。
    pub fn new() -> Self {
        let repository = UserRepositoryImpl::new();
        let service = UserService::new(repository);
        Self { service }
    }

    /// 新しいユーザーを作成します。
    ///
    /// # 引数
    /// * `args` - コマンドライン引数のスライス。4つの要素が必要です：
    ///   * `email` - ユーザーのメールアドレス
    ///   * `username` - ユーザー名
    ///   * `phone` - 電話番号
    ///   * `age` - 年齢
    ///
    /// # 戻り値
    /// * `Ok(())` - ユーザーの作成に成功した場合
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * 引数の数が不正な場合（"Usage: create \<email\> \<username\> \<phone\> \<age\>"）
    /// * 年齢の形式が不正な場合（"Invalid age format"）
    /// * メールアドレス、ユーザー名、電話番号、年齢のバリデーションに失敗した場合
    /// * ユーザーの保存に失敗した場合
    pub fn create(&self, args: &[String]) -> Result<(), String> {
        if args.len() != 4 {
            return Err("Usage: create <email> <username> <phone> <age>".to_string());
        }

        let email = &args[0];
        let username = &args[1];
        let phone = &args[2];
        let age = args[3].parse::<u32>().map_err(|_| "Invalid age format")?;

        match self.service.create_user(
            email.to_string(),
            username.to_string(),
            phone.to_string(),
            age,
        ) {
            Ok(user) => {
                println!("User created successfully:");
                self.print_user(&user);
                Ok(())
            }
            Err(e) => Err(format!("Failed to create user: {:?}", e)),
        }
    }

    /// 既存のユーザー情報を更新します。
    ///
    /// # 引数
    /// * `args` - コマンドライン引数のスライス。4つの要素が必要です：
    ///   * `email` - ユーザーのメールアドレス（既存のユーザーを特定するために使用）
    ///   * `username` - 新しいユーザー名
    ///   * `phone` - 新しい電話番号
    ///   * `age` - 新しい年齢
    ///
    /// # 戻り値
    /// * `Ok(())` - ユーザーの更新に成功した場合
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * 引数の数が不正な場合（"Usage: update \<email\> \<username\> \<phone\> \<age\>"）
    /// * 年齢の形式が不正な場合（"Invalid age format"）
    /// * 指定されたメールアドレスのユーザーが存在しない場合
    /// * メールアドレス、ユーザー名、電話番号、年齢のバリデーションに失敗した場合
    /// * ユーザーの保存に失敗した場合
    pub fn update(&self, args: &[String]) -> Result<(), String> {
        if args.len() != 4 {
            return Err("Usage: update <email> <username> <phone> <age>".to_string());
        }

        let email = &args[0];
        let username = &args[1];
        let phone = &args[2];
        let age = args[3].parse::<u32>().map_err(|_| "Invalid age format")?;

        match self.service.update_user(
            email.to_string(),
            username.to_string(),
            phone.to_string(),
            age,
        ) {
            Ok(user) => {
                println!("User updated successfully:");
                self.print_user(&user);
                Ok(())
            }
            Err(e) => Err(format!("Failed to update user: {:?}", e)),
        }
    }

    /// 全てのユーザーの一覧を表示します。
    ///
    /// # 戻り値
    /// * `Ok(())` - ユーザー一覧の表示に成功した場合
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * ユーザー一覧の取得に失敗した場合（"Failed to list users: ..."）
    pub fn list(&self) -> Result<(), String> {
        match self.service.list_users() {
            Ok(users) => {
                println!("User list:");
                println!("Email\t\tUsername");
                println!("------------------------");
                for user in users {
                    println!("{}\t{}", user.email, user.username);
                }
                Ok(())
            }
            Err(e) => Err(format!("Failed to list users: {:?}", e)),
        }
    }

    /// 指定されたメールアドレスのユーザー情報を表示します。
    ///
    /// # 引数
    /// * `args` - コマンドライン引数のスライス。1つの要素が必要です：
    ///   * `email` - 検索するユーザーのメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(())` - ユーザー情報の表示に成功した場合
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * 引数の数が不正な場合（"Usage: get \<email\>"）
    /// * 指定されたメールアドレスのユーザーが存在しない場合
    /// * ユーザー情報の取得に失敗した場合（"Failed to get user: ..."）
    pub fn get(&self, args: &[String]) -> Result<(), String> {
        if args.len() != 1 {
            return Err("Usage: get <email>".to_string());
        }

        let email = &args[0];
        match self.service.get_user(email) {
            Ok(user) => {
                self.print_user(&user);
                Ok(())
            }
            Err(e) => Err(format!("Failed to get user: {:?}", e)),
        }
    }

    /// 指定されたメールアドレスのユーザーを削除します。
    ///
    /// # 引数
    /// * `args` - コマンドライン引数のスライス。1つの要素が必要です：
    ///   * `email` - 削除するユーザーのメールアドレス
    ///
    /// # 戻り値
    /// * `Ok(())` - ユーザーの削除に成功した場合
    ///
    /// # Errors
    /// 以下の場合にエラーを返します：
    /// * 引数の数が不正な場合（"Usage: delete \<email\>"）
    /// * 指定されたメールアドレスのユーザーが存在しない場合
    /// * ユーザーの削除に失敗した場合（"Failed to delete user: ..."）
    pub fn delete(&self, args: &[String]) -> Result<(), String> {
        if args.len() != 1 {
            return Err("Usage: delete <email>".to_string());
        }

        let email = &args[0];
        match self.service.delete_user(email) {
            Ok(()) => {
                println!("User deleted successfully");
                Ok(())
            }
            Err(e) => Err(format!("Failed to delete user: {:?}", e)),
        }
    }

    /// ユーザー情報を標準出力に整形して表示します。
    ///
    /// # 引数
    /// * `user` - 表示するユーザー情報
    ///   ユーザー情報を標準出力に整形して表示します。
    ///
    /// # 引数
    /// * `user` - 表示するユーザー情報
    ///
    /// 以下の形式で表示されます：
    /// ```text
    /// Email: user@example.com
    /// Username: username
    /// Phone: 1234567890
    /// Age: 25
    /// ```
    fn print_user(&self, user: &User) {
        println!("Email: {}", user.email);
        println!("Username: {}", user.username);
        println!("Phone: {}", user.phone);
        println!("Age: {}", user.age);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use tempfile::NamedTempFile;

    fn setup() -> UserCommand {
        let temp_file = NamedTempFile::new().unwrap();
        unsafe {
            env::set_var("USER_DATA_FILE", temp_file.path().to_str().unwrap());
        }
        UserCommand::new()
    }

    #[test]
    fn test_create_user_command() {
        let command = setup();
        let args = vec![
            "test@example.com".to_string(),
            "testuser".to_string(),
            "1234567890".to_string(),
            "25".to_string(),
        ];

        let result = command.create(&args);
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_user_invalid_args() {
        let command = setup();
        let args = vec!["test@example.com".to_string()];

        let result = command.create(&args);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_user_command() {
        let command = setup();
        let create_args = vec![
            "test@example.com".to_string(),
            "testuser".to_string(),
            "1234567890".to_string(),
            "25".to_string(),
        ];
        command.create(&create_args).unwrap();

        let update_args = vec![
            "test@example.com".to_string(),
            "newuser".to_string(),
            "0987654321".to_string(),
            "30".to_string(),
        ];
        let result = command.update(&update_args);
        assert!(result.is_ok());
    }

    #[test]
    fn test_delete_user_command() {
        let command = setup();
        let create_args = vec![
            "test@example.com".to_string(),
            "testuser".to_string(),
            "1234567890".to_string(),
            "25".to_string(),
        ];
        command.create(&create_args).unwrap();

        let delete_args = vec!["test@example.com".to_string()];
        let result = command.delete(&delete_args);
        assert!(result.is_ok());
    }
}
