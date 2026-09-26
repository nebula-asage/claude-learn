// Package service はアプリケーションのビジネスロジックを実装する。
package service

import (
	"fmt"
	"regexp"
	"strings"

	"go-practice/internal/model"
	"go-practice/internal/repository"
)

// UserErrorKind はUserErrorの種別を表す。
type UserErrorKind string

const (
	// ErrInvalidEmail はメールアドレスの形式が不正な場合の種別。
	ErrInvalidEmail UserErrorKind = "InvalidEmail"
	// ErrInvalidUsername はユーザー名が不正な場合の種別。
	ErrInvalidUsername UserErrorKind = "InvalidUsername"
	// ErrInvalidPhone は電話番号が不正な場合の種別。
	ErrInvalidPhone UserErrorKind = "InvalidPhone"
	// ErrInvalidAge は年齢が不正な場合の種別。
	ErrInvalidAge UserErrorKind = "InvalidAge"
	// ErrUserNotFound はユーザーが見つからない場合の種別。
	ErrUserNotFound UserErrorKind = "UserNotFound"
	// ErrUserAlreadyExists は既に存在するユーザーを作成しようとした場合の種別。
	ErrUserAlreadyExists UserErrorKind = "UserAlreadyExists"
	// ErrRepository はリポジトリ操作に失敗した場合の種別。
	ErrRepository UserErrorKind = "RepositoryError"
)

// UserError はユーザー操作に関連するエラー。
type UserError struct {
	Kind    UserErrorKind
	Message string
}

// Error はerrorインターフェースを満たす。
func (e *UserError) Error() string {
	return fmt.Sprintf("%s(%q)", e.Kind, e.Message)
}

func newUserError(kind UserErrorKind, message string) *UserError {
	return &UserError{Kind: kind, Message: message}
}

var (
	emailPattern = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	phonePattern = regexp.MustCompile(`^\d{10,}$`)
)

// UserService はユーザー管理のビジネスロジックを実装する。
type UserService struct {
	repository repository.UserRepository
}

// NewUserService は新しいUserServiceを作成する。
func NewUserService(repo repository.UserRepository) *UserService {
	return &UserService{repository: repo}
}

// CreateUser は新しいユーザーを作成する。
func (s *UserService) CreateUser(email, username, phone string, age int) (model.User, error) {
	if err := validateEmail(email); err != nil {
		return model.User{}, err
	}
	if err := validateUsername(username); err != nil {
		return model.User{}, err
	}
	if err := validatePhone(phone); err != nil {
		return model.User{}, err
	}
	if err := validateAge(age); err != nil {
		return model.User{}, err
	}

	if _, ok, err := s.repository.FindByEmail(email); err == nil && ok {
		return model.User{}, newUserError(ErrUserAlreadyExists,
			fmt.Sprintf("User with email %s already exists", email))
	}

	user := model.User{Email: email, Username: username, Phone: phone, Age: age}
	if err := s.repository.Save(user); err != nil {
		return model.User{}, newUserError(ErrRepository, err.Error())
	}
	return user, nil
}

// UpdateUser は既存のユーザー情報を更新する。
func (s *UserService) UpdateUser(email, username, phone string, age int) (model.User, error) {
	if err := validateUsername(username); err != nil {
		return model.User{}, err
	}
	if err := validatePhone(phone); err != nil {
		return model.User{}, err
	}
	if err := validateAge(age); err != nil {
		return model.User{}, err
	}

	_, ok, err := s.repository.FindByEmail(email)
	if err != nil {
		return model.User{}, newUserError(ErrRepository, err.Error())
	}
	if !ok {
		return model.User{}, newUserError(ErrUserNotFound,
			fmt.Sprintf("User with email %s not found", email))
	}

	user := model.User{Email: email, Username: username, Phone: phone, Age: age}
	if err := s.repository.Save(user); err != nil {
		return model.User{}, newUserError(ErrRepository, err.Error())
	}
	return user, nil
}

// GetUser は指定されたメールアドレスのユーザー情報を取得する。
func (s *UserService) GetUser(email string) (model.User, error) {
	user, ok, err := s.repository.FindByEmail(email)
	if err != nil {
		return model.User{}, newUserError(ErrRepository, err.Error())
	}
	if !ok {
		return model.User{}, newUserError(ErrUserNotFound,
			fmt.Sprintf("User with email %s not found", email))
	}
	return user, nil
}

// ListUsers は全てのユーザー情報を取得する。
func (s *UserService) ListUsers() ([]model.User, error) {
	users, err := s.repository.FindAll()
	if err != nil {
		return nil, newUserError(ErrRepository, err.Error())
	}
	return users, nil
}

// DeleteUser は指定されたメールアドレスのユーザーを削除する。
func (s *UserService) DeleteUser(email string) error {
	existed, err := s.repository.Delete(email)
	if err != nil {
		return newUserError(ErrRepository, err.Error())
	}
	if !existed {
		return newUserError(ErrUserNotFound,
			fmt.Sprintf("User with email %s not found", email))
	}
	return nil
}

func validateEmail(email string) error {
	if !emailPattern.MatchString(email) {
		return newUserError(ErrInvalidEmail, fmt.Sprintf("Invalid email format: %s", email))
	}
	return nil
}

func validateUsername(username string) error {
	if strings.TrimSpace(username) == "" || len(username) < 3 {
		return newUserError(ErrInvalidUsername, "Username must be at least 3 characters long")
	}
	return nil
}

func validatePhone(phone string) error {
	if !phonePattern.MatchString(phone) {
		return newUserError(ErrInvalidPhone, "Phone number must be at least 10 digits")
	}
	return nil
}

func validateAge(age int) error {
	if age < 0 || age > 150 {
		return newUserError(ErrInvalidAge, "Age must be between 0 and 150")
	}
	return nil
}
