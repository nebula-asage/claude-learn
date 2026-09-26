package command

import (
	"path/filepath"
	"testing"
)

func newTestCommand(t *testing.T) *UserCommand {
	t.Helper()
	dataFile := filepath.Join(t.TempDir(), "userdata.json")
	t.Setenv("USER_DATA_FILE", dataFile)
	return NewUserCommand()
}

func TestCreateUserCommand(t *testing.T) {
	cmd := newTestCommand(t)
	args := []string{"test@example.com", "testuser", "1234567890", "25"}

	if err := cmd.Create(args); err != nil {
		t.Errorf("Create returned error: %v", err)
	}
}

func TestCreateUserInvalidArgs(t *testing.T) {
	cmd := newTestCommand(t)
	args := []string{"test@example.com"}

	if err := cmd.Create(args); err == nil {
		t.Errorf("Create with invalid args returned no error")
	}
}

func TestUpdateUserCommand(t *testing.T) {
	cmd := newTestCommand(t)
	createArgs := []string{"test@example.com", "testuser", "1234567890", "25"}
	if err := cmd.Create(createArgs); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	updateArgs := []string{"test@example.com", "newuser", "0987654321", "30"}
	if err := cmd.Update(updateArgs); err != nil {
		t.Errorf("Update returned error: %v", err)
	}
}

func TestDeleteUserCommand(t *testing.T) {
	cmd := newTestCommand(t)
	createArgs := []string{"test@example.com", "testuser", "1234567890", "25"}
	if err := cmd.Create(createArgs); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	deleteArgs := []string{"test@example.com"}
	if err := cmd.Delete(deleteArgs); err != nil {
		t.Errorf("Delete returned error: %v", err)
	}
}

func TestListUserCommand(t *testing.T) {
	cmd := newTestCommand(t)
	if err := cmd.Create([]string{"test@example.com", "testuser", "1234567890", "25"}); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	if err := cmd.List(); err != nil {
		t.Errorf("List returned error: %v", err)
	}
}

func TestGetUserCommand(t *testing.T) {
	cmd := newTestCommand(t)
	if err := cmd.Create([]string{"test@example.com", "testuser", "1234567890", "25"}); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	if err := cmd.Get([]string{"test@example.com"}); err != nil {
		t.Errorf("Get returned error: %v", err)
	}
}

func TestGetUserCommandInvalidArgs(t *testing.T) {
	cmd := newTestCommand(t)

	if err := cmd.Get(nil); err == nil {
		t.Errorf("Get with invalid args returned no error")
	}
}
