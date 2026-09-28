// Package command はユーザー操作のコマンドライン機能を提供する。
package command

import (
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"go-practice/internal/model"
)

// UserService はUserCommandが必要とするユーザー管理のビジネスロジックを定義する。
//
//go:generate go tool mockgen -source=user_command.go -destination=mock_user_service_test.go -package=command
type UserService interface {
	// CreateUser は新しいユーザーを作成する。
	CreateUser(email, username, phone string, age int) (model.User, error)
	// UpdateUser は既存のユーザー情報を更新する。
	UpdateUser(email, username, phone string, age int) (model.User, error)
	// GetUser は指定されたメールアドレスのユーザー情報を取得する。
	GetUser(email string) (model.User, error)
	// ListUsers は全てのユーザー情報を取得する。
	ListUsers() ([]model.User, error)
	// DeleteUser は指定されたメールアドレスのユーザーを削除する。
	DeleteUser(email string) error
}

// UserCommand はコマンドライン操作を処理するコマンドハンドラ。
type UserCommand struct {
	svc UserService
	out io.Writer
}

// NewUserCommand は svc を使って処理し、結果を out に書き出す新しいUserCommandを作成する。
func NewUserCommand(svc UserService, out io.Writer) *UserCommand {
	return &UserCommand{svc: svc, out: out}
}

// Create は新しいユーザーを作成する。
// argsは[email, username, phone, age]の4要素が必要。
func (c *UserCommand) Create(args []string) error {
	email, username, phone, age, err := parseUserArgs(args, "create")
	if err != nil {
		return err
	}

	user, err := c.svc.CreateUser(email, username, phone, age)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return c.write("User created successfully:\n" + formatUser(user))
}

// Update は既存のユーザー情報を更新する。
// argsは[email, username, phone, age]の4要素が必要。emailは更新対象の特定に使う。
func (c *UserCommand) Update(args []string) error {
	email, username, phone, age, err := parseUserArgs(args, "update")
	if err != nil {
		return err
	}

	user, err := c.svc.UpdateUser(email, username, phone, age)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}
	return c.write("User updated successfully:\n" + formatUser(user))
}

// List は全てのユーザーの一覧を表示する。
func (c *UserCommand) List() error {
	users, err := c.svc.ListUsers()
	if err != nil {
		return fmt.Errorf("list users: %w", err)
	}
	var b strings.Builder
	b.WriteString("User list:\n")
	b.WriteString("Email\t\tUsername\n")
	b.WriteString("------------------------\n")
	for _, user := range users {
		fmt.Fprintf(&b, "%s\t%s\n", user.Email, user.Username)
	}
	return c.write(b.String())
}

// Get は指定されたメールアドレスのユーザー情報を表示する。
// argsは[email]の1要素が必要。
func (c *UserCommand) Get(args []string) error {
	if len(args) != 1 {
		return errors.New("usage: get <email>")
	}
	user, err := c.svc.GetUser(args[0])
	if err != nil {
		return fmt.Errorf("get user: %w", err)
	}
	return c.write(formatUser(user))
}

// Delete は指定されたメールアドレスのユーザーを削除する。
// argsは[email]の1要素が必要。
func (c *UserCommand) Delete(args []string) error {
	if len(args) != 1 {
		return errors.New("usage: delete <email>")
	}
	if err := c.svc.DeleteUser(args[0]); err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	return c.write("User deleted successfully\n")
}

func parseUserArgs(args []string, subcommand string) (email, username, phone string, age int, err error) {
	if len(args) != 4 {
		return "", "", "", 0, fmt.Errorf("usage: %s <email> <username> <phone> <age>", subcommand)
	}
	age, err = strconv.Atoi(args[3])
	if err != nil {
		return "", "", "", 0, fmt.Errorf("invalid age %q: %w", args[3], err)
	}
	return args[0], args[1], args[2], age, nil
}

// write は組み立て済みの出力をまとめて書き出す。書き込みの失敗はコマンドの失敗として返す。
func (c *UserCommand) write(s string) error {
	if _, err := io.WriteString(c.out, s); err != nil {
		return fmt.Errorf("write output: %w", err)
	}
	return nil
}

func formatUser(user model.User) string {
	return fmt.Sprintf("Email: %s\nUsername: %s\nPhone: %s\nAge: %d\n",
		user.Email, user.Username, user.Phone, user.Age)
}
