// Package repository はデータの永続化を担当する。
package repository

import (
	"encoding/json"
	"fmt"
	"os"

	"go-practice/internal/model"
)

// UserRepository はユーザーデータの永続化操作を定義する。
type UserRepository interface {
	// Save はユーザーを保存する。
	Save(user model.User) error
	// FindByEmail は指定されたメールアドレスのユーザーを検索する。
	// 見つからなかった場合は ok が false になる。
	FindByEmail(email string) (user model.User, ok bool, err error)
	// FindAll は全てのユーザーを取得する。
	FindAll() ([]model.User, error)
	// Delete は指定されたメールアドレスのユーザーを削除する。
	// ユーザーが存在しなかった場合は existed が false になる。
	Delete(email string) (existed bool, err error)
}

// JSONUserRepository はJSONファイルベースのユーザーリポジトリ実装。
type JSONUserRepository struct {
	filePath string
}

// NewJSONUserRepository は新しいJSONUserRepositoryを作成する。
//
// 環境変数USER_DATA_FILEが設定されている場合はその値を、
// 設定されていない場合は"userdata.json"をファイルパスとして使用する。
func NewJSONUserRepository() *JSONUserRepository {
	filePath := os.Getenv("USER_DATA_FILE")
	if filePath == "" {
		filePath = "userdata.json"
	}
	return &JSONUserRepository{filePath: filePath}
}

func (r *JSONUserRepository) readUsers() (map[string]model.User, error) {
	content, err := os.ReadFile(r.filePath)
	if os.IsNotExist(err) {
		return map[string]model.User{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	if len(content) == 0 {
		return map[string]model.User{}, nil
	}

	var users map[string]model.User
	if err := json.Unmarshal(content, &users); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}
	return users, nil
}

func (r *JSONUserRepository) writeUsers(users map[string]model.User) error {
	content, err := json.MarshalIndent(users, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize JSON: %w", err)
	}
	if err := os.WriteFile(r.filePath, content, 0o600); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}
	return nil
}

// Save はユーザーを保存する。
func (r *JSONUserRepository) Save(user model.User) error {
	users, err := r.readUsers()
	if err != nil {
		return err
	}
	users[user.Email] = user
	return r.writeUsers(users)
}

// FindByEmail は指定されたメールアドレスのユーザーを検索する。
func (r *JSONUserRepository) FindByEmail(email string) (model.User, bool, error) {
	users, err := r.readUsers()
	if err != nil {
		return model.User{}, false, err
	}
	user, ok := users[email]
	return user, ok, nil
}

// FindAll は全てのユーザーを取得する。
func (r *JSONUserRepository) FindAll() ([]model.User, error) {
	users, err := r.readUsers()
	if err != nil {
		return nil, err
	}
	result := make([]model.User, 0, len(users))
	for _, user := range users {
		result = append(result, user)
	}
	return result, nil
}

// Delete は指定されたメールアドレスのユーザーを削除する。
func (r *JSONUserRepository) Delete(email string) (bool, error) {
	users, err := r.readUsers()
	if err != nil {
		return false, err
	}
	_, existed := users[email]
	delete(users, email)
	if err := r.writeUsers(users); err != nil {
		return false, err
	}
	return existed, nil
}
