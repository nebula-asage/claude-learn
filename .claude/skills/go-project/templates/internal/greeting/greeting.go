// Package greeting は挨拶メッセージを組み立てるロジックを提供する。
package greeting

import "fmt"

// Greet は name 向けの挨拶メッセージを返す。name が空文字の場合は "World" を使う。
func Greet(name string) string {
	if name == "" {
		name = "World"
	}
	return fmt.Sprintf("Hello, %s!", name)
}

// NameProvider は挨拶の対象となる名前を供給する。利用側であるこのパッケージで定義し、テストではモックに差し替える。
//
//go:generate go tool mockgen -source=greeting.go -destination=mock_name_provider_test.go -package=greeting
type NameProvider interface {
	// Name は挨拶の対象となる名前を返す。
	Name() (string, error)
}

// GreetFrom は p から取得した名前で挨拶メッセージを返す。名前の取得に失敗した場合はエラーを返す。
func GreetFrom(p NameProvider) (string, error) {
	name, err := p.Name()
	if err != nil {
		return "", fmt.Errorf("名前の取得に失敗: %w", err)
	}
	return Greet(name), nil
}
