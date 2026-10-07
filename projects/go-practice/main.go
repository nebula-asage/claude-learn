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
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"strconv"

	"go-practice/internal/command"
	"go-practice/internal/logger"
	"go-practice/internal/repository"
	"go-practice/internal/service"
)

// defaultDataFile は環境変数 USER_DATA_FILE が未設定のときに使うデータファイルのパス。
const defaultDataFile = "userdata.json"

const (
	// defaultMessagesFile は環境変数 LOG_MESSAGES_FILE が未設定のときに使うメッセージファイルのパス。
	defaultMessagesFile = "messages.properties"
	// defaultLogFile は LOG_OUTPUT=file で LOG_FILE が未設定のときに使う出力先。
	defaultLogFile = "go-practice.log"
)

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

// envOr は環境変数 key が設定されていればその値を、未設定なら def を返す。
func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// newLogger は環境変数からログ設定を読み取りロガーを構築する。
//
//   - LOG_OUTPUT: stdout（既定）/ file / syslog
//   - LOG_FILE: LOG_OUTPUT=file のときの出力先（既定 go-practice.log）
//   - LOG_LEVEL: debug / info（既定）/ warn / error
//   - LOG_FORMAT: text（既定）/ json
//   - LOG_SOURCE: true にすると呼び出し元の関数名・ファイル名・行番号を出力（既定 false）
//   - LOG_MESSAGES_FILE: メッセージファイル（既定 messages.properties）
//
// ログが標準出力に混ざらないよう、LOG_OUTPUT=stdout のときは標準エラー出力へ書く。
func newLogger() (logger.Logger, func() error, error) {
	output, err := logger.ParseOutput(os.Getenv("LOG_OUTPUT"))
	if err != nil {
		return nil, nil, err
	}
	var level slog.Level
	if err := level.UnmarshalText([]byte(envOr("LOG_LEVEL", "info"))); err != nil {
		return nil, nil, fmt.Errorf("invalid LOG_LEVEL: %w", err)
	}
	msgs, err := logger.LoadMessages(envOr("LOG_MESSAGES_FILE", defaultMessagesFile))
	if err != nil {
		return nil, nil, err
	}
	addSource, _ := strconv.ParseBool(os.Getenv("LOG_SOURCE"))
	cfg := logger.Config{
		Output:   output,
		FilePath: envOr("LOG_FILE", defaultLogFile),
		Level:    level,
		JSON:     os.Getenv("LOG_FORMAT") == "json",
		// 値は strconv.ParseBool が受け付ける形式（1, true など）。不正な値は無効として扱う。
		AddSource: addSource,
	}
	return logger.NewFromConfig(cfg, os.Stderr, msgs)
}

func main() {
	os.Exit(run(os.Args[1:]))
}

// run はサブコマンドを実行し、終了コードを返す（deferを確実に実行するため main から分離している）。
func run(args []string) int {
	if len(args) == 0 {
		fmt.Print(usage)
		return 0
	}

	log, closeLog, err := newLogger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	defer func() { _ = closeLog() }()
	log = log.With("request_id", newRequestID())

	repo := repository.NewJSONUserRepository(dataFilePath())
	cmd := command.NewUserCommand(service.NewUserService(repo), os.Stdout)

	subcommand, rest := args[0], args[1:]
	log.Info("app.start", subcommand)
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
		log.Error("app.unknown_subcommand", subcommand)
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n%s", subcommand, usage)
		return 2
	}

	if err != nil {
		log.Error("app.failed", err)
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	log.Info("app.finish", subcommand)
	return 0
}

// newRequestID は1回のコマンド実行を識別するIDを生成する。
func newRequestID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}
