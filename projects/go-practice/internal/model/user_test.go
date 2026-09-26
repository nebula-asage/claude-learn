package model

import (
	"encoding/json"
	"testing"
)

func TestUserCreation(t *testing.T) {
	user := User{
		Email:    "test@example.com",
		Username: "testuser",
		Phone:    "1234567890",
		Age:      25,
	}

	if user.Email != "test@example.com" {
		t.Errorf("Email = %q, want %q", user.Email, "test@example.com")
	}
	if user.Username != "testuser" {
		t.Errorf("Username = %q, want %q", user.Username, "testuser")
	}
	if user.Phone != "1234567890" {
		t.Errorf("Phone = %q, want %q", user.Phone, "1234567890")
	}
	if user.Age != 25 {
		t.Errorf("Age = %d, want %d", user.Age, 25)
	}
}

func TestUserSerialization(t *testing.T) {
	user := User{
		Email:    "test@example.com",
		Username: "testuser",
		Phone:    "1234567890",
		Age:      25,
	}

	data, err := json.Marshal(user)
	if err != nil {
		t.Fatalf("Marshal returned error: %v", err)
	}

	var got User
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal returned error: %v", err)
	}

	if got != user {
		t.Errorf("round-trip = %+v, want %+v", got, user)
	}
}
