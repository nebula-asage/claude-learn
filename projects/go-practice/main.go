// Package main はユーザー管理コマンドラインアプリケーションのエントリーポイント。
//
// 以下の操作が可能:
//   - ユーザーの作成
//   - ユーザー情報の更新
//   - ユーザー一覧の表示
//   - 特定ユーザーの情報表示
//   - ユーザーの削除
package main

import (
	"fmt"
	"os"

	"go-practice/internal/command"
)

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  create <email> <username> <phone> <age>")
	fmt.Println("  update <email> <username> <phone> <age>")
	fmt.Println("  list")
	fmt.Println("  get <email>")
	fmt.Println("  delete <email>")
}

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		printUsage()
		return
	}

	subcommand, rest := args[0], args[1:]
	cmd := command.NewUserCommand()

	var err error
	switch subcommand {
	case "create":
		err = cmd.Create(rest)
	case "update":
		err = cmd.Update(rest)
	case "list":
		err = cmd.List()
	case "get":
		err = cmd.Get(rest)
	case "delete":
		err = cmd.Delete(rest)
	default:
		printUsage()
		return
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
