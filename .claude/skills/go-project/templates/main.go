// Package main は__PROJECT_NAME__の練習用エントリーポイント。
package main

import (
	"fmt"

	"__PROJECT_NAME__/internal/greeting"
)

func main() {
	fmt.Println(greeting.Greet("Go"))
}
