package logger

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"log/syslog"
	"os"
)

// Output はログの出力先。
type Output string

// 選択できる出力先。
const (
	// OutputStdout は標準出力に出す。
	OutputStdout Output = "stdout"
	// OutputFile はファイルに追記する。
	OutputFile Output = "file"
	// OutputSyslog はシスログに送る。
	OutputSyslog Output = "syslog"
)

// defaultSyslogTag は Config.SyslogTag が空のときに使うタグ。
const defaultSyslogTag = "go-practice"

// ParseOutput は文字列を Output に変換する。空文字は OutputStdout とする。
func ParseOutput(s string) (Output, error) {
	switch Output(s) {
	case "", OutputStdout:
		return OutputStdout, nil
	case OutputFile:
		return OutputFile, nil
	case OutputSyslog:
		return OutputSyslog, nil
	default:
		return "", fmt.Errorf("unknown log output %q (want stdout, file or syslog)", s)
	}
}

// Config はロガーの構築設定。
type Config struct {
	// Output は出力先。
	Output Output
	// FilePath は Output が OutputFile のときの出力ファイルパス。
	FilePath string
	// SyslogTag は Output が OutputSyslog のときのタグ。空なら "go-practice"。
	SyslogTag string
	// Level は出力する最低レベル。
	Level slog.Level
	// JSON が true なら JSON 形式、false ならテキスト形式で出力する。
	JSON bool
	// AddSource が true なら、ログを出力した呼び出し元の関数名・ファイル名・行番号を source として出力する。
	AddSource bool
}

// openSyslog はシスログへの接続を開く。テストで差し替える。
var openSyslog = func(tag string) (io.WriteCloser, error) {
	return syslog.New(syslog.LOG_INFO|syslog.LOG_USER, tag)
}

// OpenWriter は設定された出力先の書き込み先を開く。stdout は OutputStdout のときに使う。
// 返す closeFn は出力先を閉じる関数で、標準出力のときは何もしない。
func OpenWriter(cfg Config, stdout io.Writer) (w io.Writer, closeFn func() error, err error) {
	switch cfg.Output {
	case OutputStdout, "":
		return stdout, func() error { return nil }, nil
	case OutputFile:
		if cfg.FilePath == "" {
			return nil, nil, errors.New("log file path is required for file output")
		}
		f, err := os.OpenFile(cfg.FilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
		if err != nil {
			return nil, nil, fmt.Errorf("open log file: %w", err)
		}
		return f, f.Close, nil
	case OutputSyslog:
		tag := cfg.SyslogTag
		if tag == "" {
			tag = defaultSyslogTag
		}
		sw, err := openSyslog(tag)
		if err != nil {
			return nil, nil, fmt.Errorf("connect syslog: %w", err)
		}
		return sw, sw.Close, nil
	default:
		return nil, nil, fmt.Errorf("unknown log output %q", cfg.Output)
	}
}

// NewFromConfig は cfg に従って出力先を開き、ロガーを構築する。
// 返す closeFn はプログラム終了前に呼んで出力先を閉じる。
func NewFromConfig(cfg Config, stdout io.Writer, msgs Messages) (l Logger, closeFn func() error, err error) {
	w, closeFn, err := OpenWriter(cfg, stdout)
	if err != nil {
		return nil, nil, err
	}
	opts := &slog.HandlerOptions{Level: cfg.Level, AddSource: cfg.AddSource}
	var h slog.Handler = slog.NewTextHandler(w, opts)
	if cfg.JSON {
		h = slog.NewJSONHandler(w, opts)
	}
	return New(h, msgs), closeFn, nil
}
