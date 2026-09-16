# ユーザ管理システム

このプログラムは、コマンドラインでユーザデータを管理するシンプルなシステムです。

## 機能

- ユーザの登録
- ユーザ情報の更新
- ユーザ一覧の表示
- ユーザ詳細の参照
- ユーザの削除

## 使い方

### ユーザの登録

```bash
cargo run create <メールアドレス> <ユーザ名> <電話番号> <年齢>

# 例
cargo run create john@example.com "John Doe" 1234567890 25
```

### ユーザ情報の更新

```bash
cargo run update <メールアドレス> <ユーザ名> <電話番号> <年齢>

# 例
cargo run update john@example.com "John Smith" 9876543210 26
```

### ユーザ一覧の表示

```bash
cargo run list
```

出力例：
```
User list:
Email                   Username
----------------------------------------
john@example.com        John Smith
alice@example.com       Alice Johnson
```

### ユーザ詳細の参照

```bash
cargo run get <メールアドレス>

# 例
cargo run get john@example.com
```

出力例：
```
Email: john@example.com
Username: John Smith
Phone: 9876543210
Age: 26
```

### ユーザの削除

```bash
cargo run delete <メールアドレス>

# 例
cargo run delete john@example.com
```

## 入力値の制限

### メールアドレス
- 標準的なメールアドレスの形式に従う必要があります
- 例: `user@example.com`

### ユーザ名
- 3文字以上である必要があります
- 空文字列は不可

### 電話番号
- 10桁以上の数字である必要があります
- ハイフンなどの区切り文字は使用できません

### 年齢
- 0から150までの整数である必要があります

## データの保存

ユーザデータは JSONファイルとして保存されます。

### 保存先の設定

データの保存先は環境変数`USER_DATA_FILE`で指定できます：

```bash
# 保存先を指定して実行
export USER_DATA_FILE=/path/to/userdata.json
cargo run list
```

指定がない場合は、カレントディレクトリの`userdata.json`が使用されます。

## エラーメッセージ

各種エラーが発生した場合、以下のようなメッセージが表示されます：

- 無効なメールアドレス形式：
  ```
  Error: Failed to create user: InvalidEmail("Invalid email format: ...")
  ```

- 既存ユーザの重複登録：
  ```
  Error: Failed to create user: UserAlreadyExists("User with email ... already exists")
  ```

- 存在しないユーザの参照/更新：
  ```
  Error: Failed to get user: UserNotFound("User with email ... not found")
  ```

## 開発者向け情報

プロジェクトの実装詳細やアーキテクチャについては、[docs/implementation.md](docs/implementation.md)を参照してください。
