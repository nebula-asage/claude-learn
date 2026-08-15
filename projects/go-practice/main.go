// Package main はgo-practiceの練習用エントリーポイント。
package main

import (
	"fmt"

	"go-practice/internal/greeting"
)

func main() {
	fmt.Println(greeting.Greet("Go"))
}
