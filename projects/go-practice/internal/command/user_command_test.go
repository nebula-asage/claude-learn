package command

import (
	"bytes"
	"errors"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"go-practice/internal/repository"
	"go-practice/internal/service"
)

func newTestCommand(t *testing.T) (*UserCommand, *bytes.Buffer) {
	t.Helper()
	repo := repository.NewJSONUserRepository(filepath.Join(t.TempDir(), "userdata.json"))
	var out bytes.Buffer
	return NewUserCommand(service.NewUserService(repo), &out), &out
}

func TestCreateUserCommand(t *testing.T) {
	cmd, out := newTestCommand(t)
	args := []string{"test@example.com", "testuser", "1234567890", "25"}

	if err := cmd.Create(args); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if !strings.Contains(out.String(), "User created successfully") {
		t.Errorf("output = %q, want success message", out.String())
	}
}

func TestCreateUserInvalidArgs(t *testing.T) {
	cmd, _ := newTestCommand(t)
	args := []string{"test@example.com"}

	if err := cmd.Create(args); err == nil {
		t.Errorf("Create with invalid args returned no error")
	}
}

func TestCreateUserInvalidAge(t *testing.T) {
	cmd, _ := newTestCommand(t)
	args := []string{"test@example.com", "testuser", "1234567890", "abc"}

	if err := cmd.Create(args); !errors.Is(err, strconv.ErrSyntax) {
		t.Errorf("err = %v, want wrapped %v", err, strconv.ErrSyntax)
	}
}

func TestUpdateUserCommand(t *testing.T) {
	cmd, out := newTestCommand(t)
	createArgs := []string{"test@example.com", "testuser", "1234567890", "25"}
	if err := cmd.Create(createArgs); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	updateArgs := []string{"test@example.com", "newuser", "0987654321", "30"}
	if err := cmd.Update(updateArgs); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if !strings.Contains(out.String(), "Username: newuser") {
		t.Errorf("output = %q, want updated username", out.String())
	}
}

func TestDeleteUserCommand(t *testing.T) {
	cmd, _ := newTestCommand(t)
	createArgs := []string{"test@example.com", "testuser", "1234567890", "25"}
	if err := cmd.Create(createArgs); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	deleteArgs := []string{"test@example.com"}
	if err := cmd.Delete(deleteArgs); err != nil {
		t.Errorf("Delete returned error: %v", err)
	}
}

func TestDeleteUserCommandNotFound(t *testing.T) {
	cmd, _ := newTestCommand(t)

	if err := cmd.Delete([]string{"nobody@example.com"}); !errors.Is(err, service.ErrUserNotFound) {
		t.Errorf("err = %v, want wrapped %v", err, service.ErrUserNotFound)
	}
}

func TestListUserCommand(t *testing.T) {
	cmd, out := newTestCommand(t)
	if err := cmd.Create([]string{"test@example.com", "testuser", "1234567890", "25"}); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	out.Reset()

	if err := cmd.List(); err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if !strings.Contains(out.String(), "test@example.com\ttestuser") {
		t.Errorf("output = %q, want listed user", out.String())
	}
}

func TestGetUserCommand(t *testing.T) {
	cmd, out := newTestCommand(t)
	if err := cmd.Create([]string{"test@example.com", "testuser", "1234567890", "25"}); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	out.Reset()

	if err := cmd.Get([]string{"test@example.com"}); err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if !strings.Contains(out.String(), "Email: test@example.com") {
		t.Errorf("output = %q, want user details", out.String())
	}
}

func TestGetUserCommandInvalidArgs(t *testing.T) {
	cmd, _ := newTestCommand(t)

	if err := cmd.Get(nil); err == nil {
		t.Errorf("Get with invalid args returned no error")
	}
}
