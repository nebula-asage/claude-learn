package repository

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"go-practice/internal/model"
)

func newTestRepository(t *testing.T) *JSONUserRepository {
	t.Helper()
	return NewJSONUserRepository(filepath.Join(t.TempDir(), "userdata.json"))
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
	user2.Email = "a-test@example.com"

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
	// map由来の不定な順序ではなく、メールアドレスの昇順で返ること
	want := []model.User{user2, user1}
	if !slices.Equal(all, want) {
		t.Errorf("FindAll = %+v, want %+v", all, want)
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

func TestFindAllEmptyFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "userdata.json")
	if err := os.WriteFile(path, []byte{}, 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	repo := NewJSONUserRepository(path)

	all, err := repo.FindAll()
	if err != nil {
		t.Fatalf("FindAll returned error: %v", err)
	}
	if len(all) != 0 {
		t.Errorf("FindAll = %+v, want empty", all)
	}
}

func TestFindAllInvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "userdata.json")
	if err := os.WriteFile(path, []byte("not json"), 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	repo := NewJSONUserRepository(path)

	if _, err := repo.FindAll(); err == nil {
		t.Errorf("FindAll with invalid JSON returned no error")
	}
}

// pathIsDirectory は filePath がディレクトリの場合に os.ReadFile / os.WriteFile が
// fs.ErrNotExist ではないエラーを返すことを利用して、readUsers / writeUsers の
// 一般エラー分岐を発生させるためのヘルパー。
func pathIsDirectory(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "userdata.json")
	if err := os.Mkdir(path, 0o755); err != nil {
		t.Fatalf("Mkdir returned error: %v", err)
	}
	return path
}

func TestFindByEmailReadError(t *testing.T) {
	repo := NewJSONUserRepository(pathIsDirectory(t))

	if _, _, err := repo.FindByEmail("test@example.com"); err == nil {
		t.Errorf("FindByEmail with unreadable file returned no error")
	}
}

func TestFindAllReadError(t *testing.T) {
	repo := NewJSONUserRepository(pathIsDirectory(t))

	if _, err := repo.FindAll(); err == nil {
		t.Errorf("FindAll with unreadable file returned no error")
	}
}

func TestSaveReadError(t *testing.T) {
	repo := NewJSONUserRepository(pathIsDirectory(t))

	if err := repo.Save(testUser()); err == nil {
		t.Errorf("Save with unreadable file returned no error")
	}
}

func TestDeleteReadError(t *testing.T) {
	repo := NewJSONUserRepository(pathIsDirectory(t))

	if _, err := repo.Delete("test@example.com"); err == nil {
		t.Errorf("Delete with unreadable file returned no error")
	}
}

func TestSaveWriteError(t *testing.T) {
	// 親ディレクトリが存在しないため、readUsersはファイル無し扱いで成功し、
	// writeUsersのos.WriteFileが失敗する。
	path := filepath.Join(t.TempDir(), "no-such-dir", "userdata.json")
	repo := NewJSONUserRepository(path)

	if err := repo.Save(testUser()); err == nil {
		t.Errorf("Save with unwritable path returned no error")
	}
}

func TestDeleteWriteError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "userdata.json")
	repo := NewJSONUserRepository(path)
	user := testUser()
	if err := repo.Save(user); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	if err := os.Chmod(path, 0o400); err != nil {
		t.Fatalf("Chmod returned error: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chmod(path, 0o600)
	})

	if _, err := repo.Delete(user.Email); err == nil {
		t.Errorf("Delete with unwritable file returned no error")
	}
}
