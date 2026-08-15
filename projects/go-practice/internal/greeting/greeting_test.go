package greeting

import "testing"

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
