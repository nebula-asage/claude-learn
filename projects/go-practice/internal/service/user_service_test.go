package service

import (
	"errors"
	"testing"

	"go-practice/internal/model"

	"go.uber.org/mock/gomock"
)

func TestCreateUserSuccess(t *testing.T) {
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, false, nil)
	repo.EXPECT().Save(gomock.Any()).Return(nil)
	svc := NewUserService(repo)

	if _, err := svc.CreateUser("test@example.com", "testuser", "1234567890", 25); err != nil {
		t.Errorf("CreateUser returned error: %v", err)
	}
}

func TestCreateUserInvalidEmail(t *testing.T) {
	repo := NewMockUserRepository(gomock.NewController(t))
	svc := NewUserService(repo)

	_, err := svc.CreateUser("invalid-email", "testuser", "1234567890", 25)

	if !errors.Is(err, ErrInvalidEmail) {
		t.Errorf("err = %v, want wrapped %v", err, ErrInvalidEmail)
	}
}

func TestUpdateUserNotFound(t *testing.T) {
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, false, nil)
	svc := NewUserService(repo)

	_, err := svc.UpdateUser("test@example.com", "testuser", "1234567890", 25)

	if !errors.Is(err, ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, ErrUserNotFound)
	}
}

func TestDeleteUserSuccess(t *testing.T) {
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().Delete("test@example.com").Return(true, nil)
	svc := NewUserService(repo)

	if err := svc.DeleteUser("test@example.com"); err != nil {
		t.Errorf("DeleteUser returned error: %v", err)
	}
}

func TestGetUserSuccess(t *testing.T) {
	want := model.User{Email: "test@example.com", Username: "testuser", Phone: "1234567890", Age: 25}
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(want, true, nil)
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
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, false, nil)
	svc := NewUserService(repo)

	_, err := svc.GetUser("test@example.com")

	if !errors.Is(err, ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, ErrUserNotFound)
	}
}

func TestListUsersSuccess(t *testing.T) {
	want := []model.User{{Email: "test@example.com", Username: "testuser", Phone: "1234567890", Age: 25}}
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindAll().Return(want, nil)
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
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().Delete("test@example.com").Return(false, nil)
	svc := NewUserService(repo)

	err := svc.DeleteUser("test@example.com")

	if !errors.Is(err, ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, ErrUserNotFound)
	}
}

func TestCreateUserRepositoryError(t *testing.T) {
	repoErr := errors.New("disk failure")
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, false, repoErr)
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
