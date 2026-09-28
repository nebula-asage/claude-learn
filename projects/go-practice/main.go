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
	"go-practice/internal/repository"
	"go-practice/internal/service"
)

// defaultDataFile は環境変数 USER_DATA_FILE が未設定のときに使うデータファイルのパス。
const defaultDataFile = "userdata.json"

const usage = `Usage:
  create <email> <username> <phone> <age>
  update <email> <username> <phone> <age>
  list
  get <email>
  delete <email>
`

func dataFilePath() string {
	if path := os.Getenv("USER_DATA_FILE"); path != "" {
		return path
	}
	return defaultDataFile
}

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		fmt.Print(usage)
		return
	}

	repo := repository.NewJSONUserRepository(dataFilePath())
	cmd := command.NewUserCommand(service.NewUserService(repo), os.Stdout)

	subcommand, rest := args[0], args[1:]
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
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n%s", subcommand, usage)
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
