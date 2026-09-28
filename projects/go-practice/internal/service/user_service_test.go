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

func TestCreateUserInvalidProfile(t *testing.T) {
	repo := NewMockUserRepository(gomock.NewController(t))
	svc := NewUserService(repo)

	_, err := svc.CreateUser("test@example.com", "ab", "1234567890", 25)

	if !errors.Is(err, ErrInvalidUsername) {
		t.Errorf("err = %v, want wrapped %v", err, ErrInvalidUsername)
	}
}

func TestCreateUserAlreadyExists(t *testing.T) {
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, true, nil)
	svc := NewUserService(repo)

	_, err := svc.CreateUser("test@example.com", "testuser", "1234567890", 25)

	if !errors.Is(err, ErrUserAlreadyExists) {
		t.Errorf("err = %v, want wrapped %v", err, ErrUserAlreadyExists)
	}
}

func TestCreateUserSaveError(t *testing.T) {
	repoErr := errors.New("disk failure")
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, false, nil)
	repo.EXPECT().Save(gomock.Any()).Return(repoErr)
	svc := NewUserService(repo)

	_, err := svc.CreateUser("test@example.com", "testuser", "1234567890", 25)

	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want wrapped %v", err, repoErr)
	}
}

func TestUpdateUserSuccess(t *testing.T) {
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, true, nil)
	repo.EXPECT().Save(gomock.Any()).Return(nil)
	svc := NewUserService(repo)

	got, err := svc.UpdateUser("test@example.com", "newuser", "0987654321", 30)
	if err != nil {
		t.Fatalf("UpdateUser returned error: %v", err)
	}
	want := model.User{Email: "test@example.com", Username: "newuser", Phone: "0987654321", Age: 30}
	if got != want {
		t.Errorf("UpdateUser = %+v, want %+v", got, want)
	}
}

func TestUpdateUserInvalidProfile(t *testing.T) {
	repo := NewMockUserRepository(gomock.NewController(t))
	svc := NewUserService(repo)

	_, err := svc.UpdateUser("test@example.com", "testuser", "invalid-phone", 25)

	if !errors.Is(err, ErrInvalidPhone) {
		t.Errorf("err = %v, want wrapped %v", err, ErrInvalidPhone)
	}
}

func TestUpdateUserFindError(t *testing.T) {
	repoErr := errors.New("disk failure")
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, false, repoErr)
	svc := NewUserService(repo)

	_, err := svc.UpdateUser("test@example.com", "testuser", "1234567890", 25)

	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want wrapped %v", err, repoErr)
	}
}

func TestUpdateUserSaveError(t *testing.T) {
	repoErr := errors.New("disk failure")
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, true, nil)
	repo.EXPECT().Save(gomock.Any()).Return(repoErr)
	svc := NewUserService(repo)

	_, err := svc.UpdateUser("test@example.com", "testuser", "1234567890", 25)

	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want wrapped %v", err, repoErr)
	}
}

func TestGetUserFindError(t *testing.T) {
	repoErr := errors.New("disk failure")
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindByEmail("test@example.com").Return(model.User{}, false, repoErr)
	svc := NewUserService(repo)

	_, err := svc.GetUser("test@example.com")

	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want wrapped %v", err, repoErr)
	}
}

func TestListUsersFindAllError(t *testing.T) {
	repoErr := errors.New("disk failure")
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().FindAll().Return(nil, repoErr)
	svc := NewUserService(repo)

	_, err := svc.ListUsers()

	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want wrapped %v", err, repoErr)
	}
}

func TestDeleteUserRepositoryError(t *testing.T) {
	repoErr := errors.New("disk failure")
	repo := NewMockUserRepository(gomock.NewController(t))
	repo.EXPECT().Delete("test@example.com").Return(false, repoErr)
	svc := NewUserService(repo)

	err := svc.DeleteUser("test@example.com")

	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want wrapped %v", err, repoErr)
	}
}

func TestValidatePhone(t *testing.T) {
	tests := []struct {
		name    string
		phone   string
		wantErr error
	}{
		{"10桁の数字", "1234567890", nil},
		{"9桁は不足", "123456789", ErrInvalidPhone},
		{"数字以外を含む", "123456789a", ErrInvalidPhone},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validatePhone(tt.phone); !errors.Is(err, tt.wantErr) {
				t.Errorf("validatePhone(%q) = %v, want %v", tt.phone, err, tt.wantErr)
			}
		})
	}
}

func TestValidateAge(t *testing.T) {
	tests := []struct {
		name    string
		age     int
		wantErr error
	}{
		{"下限", 0, nil},
		{"上限", 150, nil},
		{"下限未満", -1, ErrInvalidAge},
		{"上限超過", 151, ErrInvalidAge},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validateAge(tt.age); !errors.Is(err, tt.wantErr) {
				t.Errorf("validateAge(%d) = %v, want %v", tt.age, err, tt.wantErr)
			}
		})
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
