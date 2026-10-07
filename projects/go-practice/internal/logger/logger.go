// Package logger は log/slog を使い、メッセージIDでメッセージファイルの文言を出力するロガーを提供する。
package logger

import (
	"context"
	"log/slog"
	"runtime"
	"time"
)

// 構造化ログに付与する属性キー。
const (
	// KeyMessageID はメッセージIDを格納する属性キー。
	KeyMessageID = "msg_id"
	// KeyMessageMissing はメッセージIDが未定義だったことを示す属性キー。
	KeyMessageMissing = "msg_missing"
)

// Logger はアプリケーションが依存するロガーのインターフェース。
// テストでは差し替え可能な実装（記録用のフェイクなど）を渡せる。
//
// New / NewFromConfig が返す実装は、複数のgoroutineから同時に呼び出して安全である。
// 実装は構築後に変更されず、With は元のロガーを変更せず新しいロガーを返す。
// 出力時の排他制御は slog のハンドラが行い、With で派生したロガー同士も同じ出力先を安全に共有する。
// params に渡した値を別のgoroutineが書き換えている場合の安全性は、呼び出し側の責任とする。
type Logger interface {
	// Debug は開発用の自由文メッセージを出力する。args は slog と同じ key, value の並び。
	Debug(msg string, args ...any)
	// Info はメッセージID id のメッセージを params を埋め込んで INFO で出力する。
	Info(id string, params ...any)
	// Warn はメッセージID id のメッセージを params を埋め込んで WARN で出力する。
	Warn(id string, params ...any)
	// Error はメッセージID id のメッセージを params を埋め込んで ERROR で出力する。
	Error(id string, params ...any)
	// With は以降の全ログに共通で付与する属性（リクエストIDなど）を加えた新しいロガーを返す。
	With(args ...any) Logger
}

type slogLogger struct {
	l    *slog.Logger
	msgs Messages
}

// New は handler に出力し、msgs からメッセージを引くロガーを返す。
func New(handler slog.Handler, msgs Messages) Logger {
	return &slogLogger{l: slog.New(handler), msgs: msgs}
}

func (s *slogLogger) Debug(msg string, args ...any) {
	s.log(callerPC(), slog.LevelDebug, msg, args)
}

func (s *slogLogger) Info(id string, params ...any) {
	s.logByID(callerPC(), slog.LevelInfo, id, params)
}

func (s *slogLogger) Warn(id string, params ...any) {
	s.logByID(callerPC(), slog.LevelWarn, id, params)
}

func (s *slogLogger) Error(id string, params ...any) {
	s.logByID(callerPC(), slog.LevelError, id, params)
}

// callerPC は Debug/Info/Warn/Error を呼び出した側のプログラムカウンタを返す。
// ラッパー内部ではなく呼び出し元の位置をログの source（AddSource）に記録するために、
// 公開メソッドから直接呼ぶこと（スキップするフレーム数がこの呼び出し位置を前提にしている）。
func callerPC() uintptr {
	var pcs [1]uintptr
	// 0: runtime.Callers, 1: callerPC, 2: Debug/Info/Warn/Error, 3: 呼び出し元
	runtime.Callers(3, pcs[:])
	return pcs[0]
}

func (s *slogLogger) With(args ...any) Logger {
	return &slogLogger{l: s.l.With(args...), msgs: s.msgs}
}

// logByID はメッセージを解決して出力する。IDが未定義のときはIDをメッセージとして出力し、
// ログを失わないようにしつつ KeyMessageMissing で気付けるようにする。
func (s *slogLogger) logByID(pc uintptr, level slog.Level, id string, params []any) {
	msg, found := s.msgs.Format(id, params...)
	attrs := []any{KeyMessageID, id}
	if !found {
		attrs = append(attrs, KeyMessageMissing, true)
	}
	s.log(pc, level, msg, attrs)
}

// log は pc を呼び出し位置として記録を作り、ハンドラに渡す。
func (s *slogLogger) log(pc uintptr, level slog.Level, msg string, args []any) {
	ctx := context.Background()
	if !s.l.Enabled(ctx, level) {
		return
	}
	r := slog.NewRecord(time.Now(), level, msg, pc)
	r.Add(args...)
	_ = s.l.Handler().Handle(ctx, r)
}
