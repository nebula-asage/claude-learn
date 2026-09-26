package repository

import (
	"path/filepath"
	"testing"

	"go-practice/internal/model"
)

func newTestRepository(t *testing.T) *JSONUserRepository {
	t.Helper()
	dataFile := filepath.Join(t.TempDir(), "userdata.json")
	t.Setenv("USER_DATA_FILE", dataFile)
	return NewJSONUserRepository()
}

func testUser() model.User {
	return model.User{
		Email:    "test@example.com",
		Username: "testuser",
		Phone:    "1234567890",
		Age:      25,
	}
}

func TestSaveAndFindUser(t *testing.T) {
	repo := newTestRepository(t)
	user := testUser()

	if err := repo.Save(user); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	found, ok, err := repo.FindByEmail(user.Email)
	if err != nil {
		t.Fatalf("FindByEmail returned error: %v", err)
	}
	if !ok {
		t.Fatalf("FindByEmail did not find saved user")
	}
	if found != user {
		t.Errorf("found = %+v, want %+v", found, user)
	}
}

func TestFindAllUsers(t *testing.T) {
	repo := newTestRepository(t)
	user1 := testUser()
	user2 := testUser()
	user2.Email = "test2@example.com"

	if err := repo.Save(user1); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if err := repo.Save(user2); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	all, err := repo.FindAll()
	if err != nil {
		t.Fatalf("FindAll returned error: %v", err)
	}
	if len(all) != 2 {
		t.Errorf("len(all) = %d, want 2", len(all))
	}
}

func TestDeleteUser(t *testing.T) {
	repo := newTestRepository(t)
	user := testUser()

	if err := repo.Save(user); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	existed, err := repo.Delete(user.Email)
	if err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if !existed {
		t.Errorf("Delete existed = false, want true")
	}

	_, ok, err := repo.FindByEmail(user.Email)
	if err != nil {
		t.Fatalf("FindByEmail returned error: %v", err)
	}
	if ok {
		t.Errorf("FindByEmail found deleted user")
	}
}

func TestDeleteNonExistentUser(t *testing.T) {
	repo := newTestRepository(t)

	existed, err := repo.Delete("nobody@example.com")
	if err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if existed {
		t.Errorf("Delete existed = true, want false")
	}
}
