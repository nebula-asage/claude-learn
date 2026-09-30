package greeting

import (
	"errors"
	"testing"

	"go.uber.org/mock/gomock"
)

func TestGreet(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"名前あり", "Go", "Hello, Go!"},
		{"空文字はWorld扱い", "", "Hello, World!"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Greet(tt.in); got != tt.want {
				t.Errorf("Greet(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestGreetFrom(t *testing.T) {
	p := NewMockNameProvider(gomock.NewController(t))
	p.EXPECT().Name().Return("Go", nil)

	got, err := GreetFrom(p)
	if err != nil {
		t.Fatalf("GreetFrom() error = %v", err)
	}
	if want := "Hello, Go!"; got != want {
		t.Errorf("GreetFrom() = %q, want %q", got, want)
	}
}

func TestGreetFromError(t *testing.T) {
	errBoom := errors.New("boom")
	p := NewMockNameProvider(gomock.NewController(t))
	p.EXPECT().Name().Return("", errBoom)

	if _, err := GreetFrom(p); !errors.Is(err, errBoom) {
		t.Errorf("GreetFrom() error = %v, want wrapping %v", err, errBoom)
	}
}
