// Package service はアプリケーションのビジネスロジックを実装する。
package service

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"go-practice/internal/model"
)

// 入力値のバリデーションに失敗した場合や、対象ユーザーの有無が期待と異なる場合に返すエラー。
// 呼び出し側は errors.Is で種別を判定する。
var (
	// ErrInvalidEmail はメールアドレスの形式が不正な場合のエラー。
	ErrInvalidEmail = errors.New("invalid email format")
	// ErrInvalidUsername はユーザー名が不正な場合のエラー。
	ErrInvalidUsername = fmt.Errorf("username must be at least %d characters long", minUsernameLength)
	// ErrInvalidPhone は電話番号が不正な場合のエラー。
	ErrInvalidPhone = fmt.Errorf("phone number must be at least %d digits", minPhoneDigits)
	// ErrInvalidAge は年齢が不正な場合のエラー。
	ErrInvalidAge = fmt.Errorf("age must be between %d and %d", minAge, maxAge)
	// ErrUserNotFound はユーザーが見つからない場合のエラー。
	ErrUserNotFound = errors.New("user not found")
	// ErrUserAlreadyExists は既に存在するユーザーを作成しようとした場合のエラー。
	ErrUserAlreadyExists = errors.New("user already exists")
)

const (
	minUsernameLength = 3
	minPhoneDigits    = 10
	minAge            = 0
	maxAge            = 150
)

var (
	emailPattern = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	phonePattern = regexp.MustCompile(fmt.Sprintf(`^\d{%d,}$`, minPhoneDigits))
)

// UserRepository はUserServiceが必要とするユーザーデータの永続化操作を定義する。
type UserRepository interface {
	// Save はユーザーを保存する。同じメールアドレスのユーザーが既にいる場合は上書きする。
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

// UserService はユーザー管理のビジネスロジックを実装する。
type UserService struct {
	repo UserRepository
}

// NewUserService は repo を永続化先とする新しいUserServiceを作成する。
func NewUserService(repo UserRepository) *UserService {
	return &UserService{repo: repo}
}

// CreateUser は新しいユーザーを作成する。
func (s *UserService) CreateUser(email, username, phone string, age int) (model.User, error) {
	if err := validateEmail(email); err != nil {
		return model.User{}, err
	}
	user := model.User{Email: email, Username: username, Phone: phone, Age: age}
	if err := validateProfile(user); err != nil {
		return model.User{}, err
	}

	_, ok, err := s.repo.FindByEmail(email)
	if err != nil {
		return model.User{}, fmt.Errorf("find user: %w", err)
	}
	if ok {
		return model.User{}, fmt.Errorf("%w: %s", ErrUserAlreadyExists, email)
	}

	if err := s.repo.Save(user); err != nil {
		return model.User{}, fmt.Errorf("save user: %w", err)
	}
	return user, nil
}

// UpdateUser は既存のユーザー情報を更新する。email は更新対象の特定に使う。
func (s *UserService) UpdateUser(email, username, phone string, age int) (model.User, error) {
	user := model.User{Email: email, Username: username, Phone: phone, Age: age}
	if err := validateProfile(user); err != nil {
		return model.User{}, err
	}

	_, ok, err := s.repo.FindByEmail(email)
	if err != nil {
		return model.User{}, fmt.Errorf("find user: %w", err)
	}
	if !ok {
		return model.User{}, fmt.Errorf("%w: %s", ErrUserNotFound, email)
	}

	if err := s.repo.Save(user); err != nil {
		return model.User{}, fmt.Errorf("save user: %w", err)
	}
	return user, nil
}

// GetUser は指定されたメールアドレスのユーザー情報を取得する。
func (s *UserService) GetUser(email string) (model.User, error) {
	user, ok, err := s.repo.FindByEmail(email)
	if err != nil {
		return model.User{}, fmt.Errorf("find user: %w", err)
	}
	if !ok {
		return model.User{}, fmt.Errorf("%w: %s", ErrUserNotFound, email)
	}
	return user, nil
}

// ListUsers は全てのユーザー情報を取得する。
func (s *UserService) ListUsers() ([]model.User, error) {
	users, err := s.repo.FindAll()
	if err != nil {
		return nil, fmt.Errorf("find users: %w", err)
	}
	return users, nil
}

// DeleteUser は指定されたメールアドレスのユーザーを削除する。
func (s *UserService) DeleteUser(email string) error {
	existed, err := s.repo.Delete(email)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if !existed {
		return fmt.Errorf("%w: %s", ErrUserNotFound, email)
	}
	return nil
}

// validateProfile はメールアドレス以外の、更新可能な項目を検証する。
func validateProfile(user model.User) error {
	if err := validateUsername(user.Username); err != nil {
		return err
	}
	if err := validatePhone(user.Phone); err != nil {
		return err
	}
	return validateAge(user.Age)
}

func validateEmail(email string) error {
	if !emailPattern.MatchString(email) {
		return fmt.Errorf("%w: %s", ErrInvalidEmail, email)
	}
	return nil
}

func validateUsername(username string) error {
	// len はバイト数を返すため、日本語などのマルチバイト文字でも「文字数」で判定できるよう rune 数を数える
	if utf8.RuneCountInString(strings.TrimSpace(username)) < minUsernameLength {
		return ErrInvalidUsername
	}
	return nil
}

func validatePhone(phone string) error {
	if !phonePattern.MatchString(phone) {
		return ErrInvalidPhone
	}
	return nil
}

func validateAge(age int) error {
	if age < minAge || age > maxAge {
		return ErrInvalidAge
	}
	return nil
}
