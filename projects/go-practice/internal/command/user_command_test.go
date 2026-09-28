package command

import (
	"errors"
	"strconv"
	"strings"
	"testing"

	"go-practice/internal/model"
	"go-practice/internal/service"

	"go.uber.org/mock/gomock"
)

// errWriter は常にエラーを返す io.Writer。write() のエラー分岐を確認するために使う。
type errWriter struct{}

var errWrite = errors.New("write failed")

func (errWriter) Write([]byte) (int, error) {
	return 0, errWrite
}

func newTestCommand(t *testing.T) (*UserCommand, *MockUserService, *strings.Builder) {
	t.Helper()
	svc := NewMockUserService(gomock.NewController(t))
	var out strings.Builder
	return NewUserCommand(svc, &out), svc, &out
}

func TestCreateUserCommand(t *testing.T) {
	cmd, svc, out := newTestCommand(t)
	want := model.User{Email: "test@example.com", Username: "testuser", Phone: "1234567890", Age: 25}
	svc.EXPECT().CreateUser("test@example.com", "testuser", "1234567890", 25).Return(want, nil)

	if err := cmd.Create([]string{"test@example.com", "testuser", "1234567890", "25"}); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if !strings.Contains(out.String(), "User created successfully") {
		t.Errorf("output = %q, want success message", out.String())
	}
}

func TestCreateUserInvalidArgs(t *testing.T) {
	cmd, _, _ := newTestCommand(t)

	if err := cmd.Create([]string{"test@example.com"}); err == nil {
		t.Errorf("Create with invalid args returned no error")
	}
}

func TestCreateUserInvalidAge(t *testing.T) {
	cmd, _, _ := newTestCommand(t)

	err := cmd.Create([]string{"test@example.com", "testuser", "1234567890", "abc"})
	if !errors.Is(err, strconv.ErrSyntax) {
		t.Errorf("err = %v, want wrapped %v", err, strconv.ErrSyntax)
	}
}

func TestCreateUserServiceError(t *testing.T) {
	cmd, svc, _ := newTestCommand(t)
	svcErr := errors.New("already exists")
	svc.EXPECT().CreateUser("test@example.com", "testuser", "1234567890", 25).Return(model.User{}, svcErr)

	err := cmd.Create([]string{"test@example.com", "testuser", "1234567890", "25"})
	if !errors.Is(err, svcErr) {
		t.Errorf("err = %v, want wrapped %v", err, svcErr)
	}
}

func TestCreateUserWriteError(t *testing.T) {
	svc := NewMockUserService(gomock.NewController(t))
	cmd := NewUserCommand(svc, errWriter{})
	svc.EXPECT().CreateUser("test@example.com", "testuser", "1234567890", 25).
		Return(model.User{Email: "test@example.com"}, nil)

	err := cmd.Create([]string{"test@example.com", "testuser", "1234567890", "25"})
	if !errors.Is(err, errWrite) {
		t.Errorf("err = %v, want wrapped %v", err, errWrite)
	}
}

func TestUpdateUserCommand(t *testing.T) {
	cmd, svc, out := newTestCommand(t)
	want := model.User{Email: "test@example.com", Username: "newuser", Phone: "0987654321", Age: 30}
	svc.EXPECT().UpdateUser("test@example.com", "newuser", "0987654321", 30).Return(want, nil)

	if err := cmd.Update([]string{"test@example.com", "newuser", "0987654321", "30"}); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if !strings.Contains(out.String(), "Username: newuser") {
		t.Errorf("output = %q, want updated username", out.String())
	}
}

func TestUpdateUserInvalidArgs(t *testing.T) {
	cmd, _, _ := newTestCommand(t)

	if err := cmd.Update([]string{"test@example.com"}); err == nil {
		t.Errorf("Update with invalid args returned no error")
	}
}

func TestUpdateUserInvalidAge(t *testing.T) {
	cmd, _, _ := newTestCommand(t)

	err := cmd.Update([]string{"test@example.com", "testuser", "1234567890", "abc"})
	if !errors.Is(err, strconv.ErrSyntax) {
		t.Errorf("err = %v, want wrapped %v", err, strconv.ErrSyntax)
	}
}

func TestUpdateUserServiceError(t *testing.T) {
	cmd, svc, _ := newTestCommand(t)
	svc.EXPECT().UpdateUser("nobody@example.com", "testuser", "1234567890", 25).
		Return(model.User{}, service.ErrUserNotFound)

	err := cmd.Update([]string{"nobody@example.com", "testuser", "1234567890", "25"})
	if !errors.Is(err, service.ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, service.ErrUserNotFound)
	}
}

func TestDeleteUserCommand(t *testing.T) {
	cmd, svc, out := newTestCommand(t)
	svc.EXPECT().DeleteUser("test@example.com").Return(nil)

	if err := cmd.Delete([]string{"test@example.com"}); err != nil {
		t.Errorf("Delete returned error: %v", err)
	}
	if !strings.Contains(out.String(), "User deleted successfully") {
		t.Errorf("output = %q, want success message", out.String())
	}
}

func TestDeleteUserCommandInvalidArgs(t *testing.T) {
	cmd, _, _ := newTestCommand(t)

	if err := cmd.Delete(nil); err == nil {
		t.Errorf("Delete with invalid args returned no error")
	}
}

func TestDeleteUserCommandNotFound(t *testing.T) {
	cmd, svc, _ := newTestCommand(t)
	svc.EXPECT().DeleteUser("nobody@example.com").Return(service.ErrUserNotFound)

	err := cmd.Delete([]string{"nobody@example.com"})
	if !errors.Is(err, service.ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, service.ErrUserNotFound)
	}
}

func TestListUserCommand(t *testing.T) {
	cmd, svc, out := newTestCommand(t)
	svc.EXPECT().ListUsers().Return([]model.User{
		{Email: "test@example.com", Username: "testuser", Phone: "1234567890", Age: 25},
	}, nil)

	if err := cmd.List(); err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if !strings.Contains(out.String(), "test@example.com\ttestuser") {
		t.Errorf("output = %q, want listed user", out.String())
	}
}

func TestListUserCommandServiceError(t *testing.T) {
	cmd, svc, _ := newTestCommand(t)
	svcErr := errors.New("disk failure")
	svc.EXPECT().ListUsers().Return(nil, svcErr)

	err := cmd.List()
	if !errors.Is(err, svcErr) {
		t.Errorf("err = %v, want wrapped %v", err, svcErr)
	}
}

func TestGetUserCommand(t *testing.T) {
	cmd, svc, out := newTestCommand(t)
	svc.EXPECT().GetUser("test@example.com").Return(
		model.User{Email: "test@example.com", Username: "testuser", Phone: "1234567890", Age: 25}, nil)

	if err := cmd.Get([]string{"test@example.com"}); err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if !strings.Contains(out.String(), "Email: test@example.com") {
		t.Errorf("output = %q, want user details", out.String())
	}
}

func TestGetUserCommandInvalidArgs(t *testing.T) {
	cmd, _, _ := newTestCommand(t)

	if err := cmd.Get(nil); err == nil {
		t.Errorf("Get with invalid args returned no error")
	}
}

func TestGetUserCommandServiceError(t *testing.T) {
	cmd, svc, _ := newTestCommand(t)
	svc.EXPECT().GetUser("nobody@example.com").Return(model.User{}, service.ErrUserNotFound)

	err := cmd.Get([]string{"nobody@example.com"})
	if !errors.Is(err, service.ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, service.ErrUserNotFound)
	}
}
