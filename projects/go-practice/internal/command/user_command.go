// Package command はユーザー操作のコマンドライン機能を提供する。
package command

import (
	"fmt"
	"strconv"

	"go-practice/internal/model"
	"go-practice/internal/repository"
	"go-practice/internal/service"
)

// UserCommand はコマンドライン操作を処理するコマンドハンドラ。
type UserCommand struct {
	service *service.UserService
}

// NewUserCommand は新しいUserCommandを作成する。
func NewUserCommand() *UserCommand {
	repo := repository.NewJSONUserRepository()
	return &UserCommand{service: service.NewUserService(repo)}
}

// Create は新しいユーザーを作成する。
// argsは[email, username, phone, age]の4要素が必要。
func (c *UserCommand) Create(args []string) error {
	email, username, phone, age, err := parseUserArgs(args, "create")
	if err != nil {
		return err
	}

	user, err := c.service.CreateUser(email, username, phone, age)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}
	fmt.Println("User created successfully:")
	printUser(user)
	return nil
}

// Update は既存のユーザー情報を更新する。
// argsは[email, username, phone, age]の4要素が必要。emailは更新対象の特定に使う。
func (c *UserCommand) Update(args []string) error {
	email, username, phone, age, err := parseUserArgs(args, "update")
	if err != nil {
		return err
	}

	user, err := c.service.UpdateUser(email, username, phone, age)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	fmt.Println("User updated successfully:")
	printUser(user)
	return nil
}

// List は全てのユーザーの一覧を表示する。
func (c *UserCommand) List() error {
	users, err := c.service.ListUsers()
	if err != nil {
		return fmt.Errorf("failed to list users: %w", err)
	}
	fmt.Println("User list:")
	fmt.Println("Email\t\tUsername")
	fmt.Println("------------------------")
	for _, user := range users {
		fmt.Printf("%s\t%s\n", user.Email, user.Username)
	}
	return nil
}

// Get は指定されたメールアドレスのユーザー情報を表示する。
// argsは[email]の1要素が必要。
func (c *UserCommand) Get(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: get <email>")
	}
	user, err := c.service.GetUser(args[0])
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}
	printUser(user)
	return nil
}

// Delete は指定されたメールアドレスのユーザーを削除する。
// argsは[email]の1要素が必要。
func (c *UserCommand) Delete(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: delete <email>")
	}
	if err := c.service.DeleteUser(args[0]); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	fmt.Println("User deleted successfully")
	return nil
}

func parseUserArgs(args []string, subcommand string) (email, username, phone string, age int, err error) {
	if len(args) != 4 {
		return "", "", "", 0, fmt.Errorf("usage: %s <email> <username> <phone> <age>", subcommand)
	}
	age, err = strconv.Atoi(args[3])
	if err != nil {
		return "", "", "", 0, fmt.Errorf("invalid age format")
	}
	return args[0], args[1], args[2], age, nil
}

func printUser(user model.User) {
	fmt.Printf("Email: %s\n", user.Email)
	fmt.Printf("Username: %s\n", user.Username)
	fmt.Printf("Phone: %s\n", user.Phone)
	fmt.Printf("Age: %d\n", user.Age)
}
