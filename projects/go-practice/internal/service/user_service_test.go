package service

import (
	"errors"
	"testing"

	"go-practice/internal/model"
)

// fakeUserRepository はUserRepositoryのテスト用スタブ実装。
// 未設定のフィールドを呼び出した場合はテストの誤りとしてパニックする。
type fakeUserRepository struct {
	saveFunc        func(model.User) error
	findByEmailFunc func(string) (model.User, bool, error)
	findAllFunc     func() ([]model.User, error)
	deleteFunc      func(string) (bool, error)
}

func (f *fakeUserRepository) Save(user model.User) error {
	if f.saveFunc == nil {
		panic("saveFunc not set")
	}
	return f.saveFunc(user)
}

func (f *fakeUserRepository) FindByEmail(email string) (model.User, bool, error) {
	if f.findByEmailFunc == nil {
		panic("findByEmailFunc not set")
	}
	return f.findByEmailFunc(email)
}

func (f *fakeUserRepository) FindAll() ([]model.User, error) {
	if f.findAllFunc == nil {
		panic("findAllFunc not set")
	}
	return f.findAllFunc()
}

func (f *fakeUserRepository) Delete(email string) (bool, error) {
	if f.deleteFunc == nil {
		panic("deleteFunc not set")
	}
	return f.deleteFunc(email)
}

func TestCreateUserSuccess(t *testing.T) {
	repo := &fakeUserRepository{
		findByEmailFunc: func(string) (model.User, bool, error) { return model.User{}, false, nil },
		saveFunc:        func(model.User) error { return nil },
	}
	svc := NewUserService(repo)

	if _, err := svc.CreateUser("test@example.com", "testuser", "1234567890", 25); err != nil {
		t.Errorf("CreateUser returned error: %v", err)
	}
}

func TestCreateUserInvalidEmail(t *testing.T) {
	svc := NewUserService(&fakeUserRepository{})

	_, err := svc.CreateUser("invalid-email", "testuser", "1234567890", 25)

	if !errors.Is(err, ErrInvalidEmail) {
		t.Errorf("err = %v, want wrapped %v", err, ErrInvalidEmail)
	}
}

func TestUpdateUserNotFound(t *testing.T) {
	repo := &fakeUserRepository{
		findByEmailFunc: func(string) (model.User, bool, error) { return model.User{}, false, nil },
	}
	svc := NewUserService(repo)

	_, err := svc.UpdateUser("test@example.com", "testuser", "1234567890", 25)

	if !errors.Is(err, ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, ErrUserNotFound)
	}
}

func TestDeleteUserSuccess(t *testing.T) {
	repo := &fakeUserRepository{
		deleteFunc: func(string) (bool, error) { return true, nil },
	}
	svc := NewUserService(repo)

	if err := svc.DeleteUser("test@example.com"); err != nil {
		t.Errorf("DeleteUser returned error: %v", err)
	}
}

func TestGetUserSuccess(t *testing.T) {
	want := model.User{Email: "test@example.com", Username: "testuser", Phone: "1234567890", Age: 25}
	repo := &fakeUserRepository{
		findByEmailFunc: func(string) (model.User, bool, error) { return want, true, nil },
	}
	svc := NewUserService(repo)

	got, err := svc.GetUser("test@example.com")
	if err != nil {
		t.Fatalf("GetUser returned error: %v", err)
	}
	if got != want {
		t.Errorf("GetUser = %+v, want %+v", got, want)
	}
}

func TestGetUserNotFound(t *testing.T) {
	repo := &fakeUserRepository{
		findByEmailFunc: func(string) (model.User, bool, error) { return model.User{}, false, nil },
	}
	svc := NewUserService(repo)

	_, err := svc.GetUser("test@example.com")

	if !errors.Is(err, ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, ErrUserNotFound)
	}
}

func TestListUsersSuccess(t *testing.T) {
	want := []model.User{{Email: "test@example.com", Username: "testuser", Phone: "1234567890", Age: 25}}
	repo := &fakeUserRepository{
		findAllFunc: func() ([]model.User, error) { return want, nil },
	}
	svc := NewUserService(repo)

	got, err := svc.ListUsers()
	if err != nil {
		t.Fatalf("ListUsers returned error: %v", err)
	}
	if len(got) != len(want) {
		t.Errorf("len(ListUsers()) = %d, want %d", len(got), len(want))
	}
}

func TestDeleteUserNotFound(t *testing.T) {
	repo := &fakeUserRepository{
		deleteFunc: func(string) (bool, error) { return false, nil },
	}
	svc := NewUserService(repo)

	err := svc.DeleteUser("test@example.com")

	if !errors.Is(err, ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, ErrUserNotFound)
	}
}

func TestCreateUserRepositoryError(t *testing.T) {
	repoErr := errors.New("disk failure")
	repo := &fakeUserRepository{
		findByEmailFunc: func(string) (model.User, bool, error) { return model.User{}, false, repoErr },
	}
	svc := NewUserService(repo)

	_, err := svc.CreateUser("test@example.com", "testuser", "1234567890", 25)

	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want wrapped %v", err, repoErr)
	}
}

func TestValidateUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		wantErr  error
	}{
		{"3文字のASCII", "abc", nil},
		{"2文字のASCII", "ab", ErrInvalidUsername},
		{"3文字のマルチバイト", "山田太", nil},
		{"2文字のマルチバイト（6バイト）", "山田", ErrInvalidUsername},
		{"前後の空白は数えない", "  ab  ", ErrInvalidUsername},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validateUsername(tt.username); !errors.Is(err, tt.wantErr) {
				t.Errorf("validateUsername(%q) = %v, want %v", tt.username, err, tt.wantErr)
			}
		})
	}
}
