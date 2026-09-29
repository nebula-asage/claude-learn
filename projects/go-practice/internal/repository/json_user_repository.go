// Package repository はデータの永続化を担当する。
package repository

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"slices"

	"go-practice/internal/model"
)

// JSONUserRepository はJSONファイルベースのユーザーリポジトリ実装。
type JSONUserRepository struct {
	filePath string
}

// NewJSONUserRepository は filePath のJSONファイルを読み書きする新しいJSONUserRepositoryを作成する。
// ファイルが存在しない場合は、ユーザーが0件の状態として扱う。
func NewJSONUserRepository(filePath string) *JSONUserRepository {
	return &JSONUserRepository{filePath: filePath}
}

func (r *JSONUserRepository) readUsers() (map[string]model.User, error) {
	content, err := os.ReadFile(r.filePath)
	if errors.Is(err, fs.ErrNotExist) {
		return map[string]model.User{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read user data: %w", err)
	}
	if len(content) == 0 {
		return map[string]model.User{}, nil
	}

	var users map[string]model.User
	if err := json.Unmarshal(content, &users); err != nil {
		return nil, fmt.Errorf("parse user data: %w", err)
	}
	return users, nil
}

func (r *JSONUserRepository) writeUsers(users map[string]model.User) error {
	content, err := json.MarshalIndent(users, "", "  ")
	if err != nil {
		return fmt.Errorf("serialize user data: %w", err)
	}
	if err := os.WriteFile(r.filePath, content, 0o600); err != nil {
		return fmt.Errorf("write user data: %w", err)
	}
	return nil
}

// Save はユーザーを保存する。同じメールアドレスのユーザーが既にいる場合は上書きする。
func (r *JSONUserRepository) Save(user model.User) error {
	users, err := r.readUsers()
	if err != nil {
		return err
	}
	users[user.Email] = user
	return r.writeUsers(users)
}

// FindByEmail は指定されたメールアドレスのユーザーを検索する。
// 見つからなかった場合は2番目の戻り値が false になる。
func (r *JSONUserRepository) FindByEmail(email string) (model.User, bool, error) {
	users, err := r.readUsers()
	if err != nil {
		return model.User{}, false, err
	}
	user, ok := users[email]
	return user, ok, nil
}

// FindAll は全てのユーザーをメールアドレスの昇順で取得する。
func (r *JSONUserRepository) FindAll() ([]model.User, error) {
	users, err := r.readUsers()
	if err != nil {
		return nil, err
	}
	result := make([]model.User, 0, len(users))
	for _, user := range users {
		result = append(result, user)
	}
	// mapの反復順は不定なので、呼び出しごとに表示順が変わらないよう並べ替える
	slices.SortFunc(result, func(a, b model.User) int { return cmp.Compare(a.Email, b.Email) })
	return result, nil
}

// Delete は指定されたメールアドレスのユーザーを削除する。
// ユーザーが存在しなかった場合は1番目の戻り値が false になる。
func (r *JSONUserRepository) Delete(email string) (bool, error) {
	users, err := r.readUsers()
	if err != nil {
		return false, err
	}
	if _, ok := users[email]; !ok {
		return false, nil
	}
	delete(users, email)
	if err := r.writeUsers(users); err != nil {
		return false, err
	}
	return true, nil
}
