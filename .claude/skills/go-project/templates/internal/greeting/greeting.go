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
