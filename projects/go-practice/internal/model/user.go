// Package model はドメインモデルを定義する。
package model

// User はユーザー情報を表す。
type User struct {
	// Email はユーザーの一意な識別子として使うメールアドレス。
	Email string `json:"email"`
	// Username はユーザーの表示名。3文字以上である必要がある。
	Username string `json:"username"`
	// Phone はユーザーの電話番号。10桁以上の数字である必要がある。
	Phone string `json:"phone"`
	// Age はユーザーの年齢。0から150までの範囲である必要がある。
	Age int `json:"age"`
}
