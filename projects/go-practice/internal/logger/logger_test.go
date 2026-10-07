package logger

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

type nopCloser struct{ io.Writer }

func (nopCloser) Close() error { return nil }

func testMessages(t *testing.T) Messages {
	t.Helper()
	msgs, err := ParseMessages(strings.NewReader("hello=hello %s, age %d\nplain=no params\n"))
	if err != nil {
		t.Fatal(err)
	}
	return msgs
}

// decode は JSON ハンドラが1行ずつ出力したログを map のスライスに変換する。
func decode(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		if line == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatalf("invalid json %q: %v", line, err)
		}
		out = append(out, m)
	}
	return out
}

func newJSONLogger(t *testing.T, buf *bytes.Buffer, level slog.Level) Logger {
	t.Helper()
	return New(slog.NewJSONHandler(buf, &slog.HandlerOptions{Level: level}), testMessages(t))
}

func TestLevelsAndPlaceholders(t *testing.T) {
	var buf bytes.Buffer
	l := newJSONLogger(t, &buf, slog.LevelDebug)

	l.Debug("debug text", "k", "v")
	l.Info("hello", "bob", 30)
	l.Warn("plain")
	l.Error("hello", "eve", 1)

	logs := decode(t, &buf)
	want := []struct{ level, msg string }{
		{"DEBUG", "debug text"},
		{"INFO", "hello bob, age 30"},
		{"WARN", "no params"},
		{"ERROR", "hello eve, age 1"},
	}
	if len(logs) != len(want) {
		t.Fatalf("got %d logs, want %d", len(logs), len(want))
	}
	for i, w := range want {
		if logs[i]["level"] != w.level || logs[i]["msg"] != w.msg {
			t.Errorf("log %d = %v, want level=%s msg=%s", i, logs[i], w.level, w.msg)
		}
	}
	if logs[1][KeyMessageID] != "hello" {
		t.Errorf("msg_id = %v, want hello", logs[1][KeyMessageID])
	}
	if _, ok := logs[1][KeyMessageMissing]; ok {
		t.Error("msg_missing must not be set for a defined id")
	}
}

func TestUnknownIDFallsBackToID(t *testing.T) {
	var buf bytes.Buffer
	l := newJSONLogger(t, &buf, slog.LevelInfo)

	l.Info("no.such.id")

	got := decode(t, &buf)[0]
	if got["msg"] != "no.such.id" || got[KeyMessageMissing] != true {
		t.Errorf("got %v", got)
	}
}

func TestWithAddsCommonAttrsWithoutAffectingParent(t *testing.T) {
	var buf bytes.Buffer
	parent := newJSONLogger(t, &buf, slog.LevelInfo)
	child := parent.With("request_id", "req-1")

	child.Info("plain")
	parent.Info("plain")

	logs := decode(t, &buf)
	if logs[0]["request_id"] != "req-1" {
		t.Errorf("child log = %v, want request_id", logs[0])
	}
	if _, ok := logs[1]["request_id"]; ok {
		t.Errorf("parent log = %v, must not have request_id", logs[1])
	}
}

func TestLevelFiltering(t *testing.T) {
	var buf bytes.Buffer
	l := newJSONLogger(t, &buf, slog.LevelWarn)

	l.Debug("d")
	l.Info("plain")
	l.Warn("plain")

	if got := len(decode(t, &buf)); got != 1 {
		t.Errorf("got %d logs, want 1", got)
	}
}

func TestParseMessages(t *testing.T) {
	msgs, err := ParseMessages(strings.NewReader("# comment\n\n a.b = x=y \nc=\n"))
	if err != nil {
		t.Fatal(err)
	}
	if msgs["a.b"] != "x=y" || msgs["c"] != "" || len(msgs) != 2 {
		t.Errorf("got %v", msgs)
	}

	for name, in := range map[string]string{
		"no equals":     "abc\n",
		"empty key":     "=v\n",
		"duplicate key": "a=1\na=2\n",
	} {
		if _, err := ParseMessages(strings.NewReader(in)); err == nil {
			t.Errorf("%s: want error", name)
		}
	}
}

func TestLoadMessages(t *testing.T) {
	path := filepath.Join(t.TempDir(), "m.properties")
	if err := os.WriteFile(path, []byte("a=1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	msgs, err := LoadMessages(path)
	if err != nil || msgs["a"] != "1" {
		t.Errorf("got %v, %v", msgs, err)
	}
	if _, err := LoadMessages(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Error("want error for missing file")
	}
}

func TestParseOutput(t *testing.T) {
	for in, want := range map[string]Output{
		"": OutputStdout, "stdout": OutputStdout, "file": OutputFile, "syslog": OutputSyslog,
	} {
		got, err := ParseOutput(in)
		if err != nil || got != want {
			t.Errorf("ParseOutput(%q) = %q, %v", in, got, err)
		}
	}
	if _, err := ParseOutput("bogus"); err == nil {
		t.Error("want error")
	}
}

func TestNewFromConfigStdout(t *testing.T) {
	var buf bytes.Buffer
	l, closeFn, err := NewFromConfig(Config{Output: OutputStdout, Level: slog.LevelInfo, JSON: true}, &buf, testMessages(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = closeFn() }()
	l.Info("plain")
	if got := decode(t, &buf)[0]["msg"]; got != "no params" {
		t.Errorf("msg = %v", got)
	}
}

func TestNewFromConfigTextFormat(t *testing.T) {
	var buf bytes.Buffer
	l, _, err := NewFromConfig(Config{Level: slog.LevelInfo}, &buf, testMessages(t))
	if err != nil {
		t.Fatal(err)
	}
	l.Info("plain")
	if !strings.Contains(buf.String(), `msg="no params"`) {
		t.Errorf("got %q", buf.String())
	}
}

func TestNewFromConfigFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.log")
	l, closeFn, err := NewFromConfig(Config{Output: OutputFile, FilePath: path, Level: slog.LevelInfo}, io.Discard, testMessages(t))
	if err != nil {
		t.Fatal(err)
	}
	l.Info("plain")
	if err := closeFn(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || !strings.Contains(string(data), "no params") {
		t.Errorf("file = %q, %v", data, err)
	}
}

func TestOpenWriterErrors(t *testing.T) {
	if _, _, err := OpenWriter(Config{Output: OutputFile}, io.Discard); err == nil {
		t.Error("want error for empty file path")
	}
	bad := filepath.Join(t.TempDir(), "no-dir", "app.log")
	if _, _, err := OpenWriter(Config{Output: OutputFile, FilePath: bad}, io.Discard); err == nil {
		t.Error("want error for file in missing directory")
	}
	if _, _, err := OpenWriter(Config{Output: "bogus"}, io.Discard); err == nil {
		t.Error("want error for unknown output")
	}
	if _, _, err := NewFromConfig(Config{Output: "bogus"}, io.Discard, nil); err == nil {
		t.Error("NewFromConfig must propagate error")
	}
}

// TestSourceIsCaller は AddSource 有効時に、ラッパー内部ではなく呼び出し元の
// 関数名・ファイル名・行番号が記録されることを確認する。
func TestSourceIsCaller(t *testing.T) {
	var buf bytes.Buffer
	l := New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug, AddSource: true}), testMessages(t))

	l.Info("plain")
	l.Warn("plain")
	l.Error("plain")
	l.Debug("d")
	l.With("k", "v").Info("plain")

	for i, log := range decode(t, &buf) {
		src, ok := log["source"].(map[string]any)
		if !ok {
			t.Fatalf("log %d: no source: %v", i, log)
		}
		if file, _ := src["file"].(string); filepath.Base(file) != "logger_test.go" {
			t.Errorf("log %d: file = %v, want logger_test.go", i, src["file"])
		}
		if fn, _ := src["function"].(string); !strings.HasSuffix(fn, ".TestSourceIsCaller") {
			t.Errorf("log %d: function = %v", i, src["function"])
		}
		if line, _ := src["line"].(float64); line == 0 {
			t.Errorf("log %d: line = %v", i, src["line"])
		}
	}
}

// TestConcurrentUse は複数goroutineから同じロガー（および With で派生したロガー）を
// 同時に使っても、データ競合が起きず、ログが1行ずつ壊れずに出力されることを確認する。
// データ競合の検出には go test -race で実行する。
func TestConcurrentUse(t *testing.T) {
	const goroutines, perGoroutine = 16, 50

	var buf bytes.Buffer
	base := newJSONLogger(t, &buf, slog.LevelDebug)

	var wg sync.WaitGroup
	for g := range goroutines {
		wg.Add(1)
		go func() {
			defer wg.Done()
			l := base.With("request_id", g)
			for i := range perGoroutine {
				l.Info("hello", "user", i)
				l.Warn("no.such.id")
				l.With("n", i).Error("plain")
				l.Debug("debug", "i", i)
			}
		}()
	}
	wg.Wait()

	if got, want := len(decode(t, &buf)), goroutines*perGoroutine*4; got != want {
		t.Errorf("got %d logs, want %d", got, want)
	}
}

func TestSyslog(t *testing.T) {
	orig := openSyslog
	t.Cleanup(func() { openSyslog = orig })

	var buf bytes.Buffer
	var gotTag string
	openSyslog = func(tag string) (io.WriteCloser, error) {
		gotTag = tag
		return nopCloser{&buf}, nil
	}

	l, closeFn, err := NewFromConfig(Config{Output: OutputSyslog, Level: slog.LevelInfo}, io.Discard, testMessages(t))
	if err != nil {
		t.Fatal(err)
	}
	l.Info("plain")
	if err := closeFn(); err != nil {
		t.Fatal(err)
	}
	if gotTag != defaultSyslogTag || !strings.Contains(buf.String(), "no params") {
		t.Errorf("tag=%q buf=%q", gotTag, buf.String())
	}

	if _, _, err := OpenWriter(Config{Output: OutputSyslog, SyslogTag: "x"}, io.Discard); err != nil || gotTag != "x" {
		t.Errorf("custom tag: %q, %v", gotTag, err)
	}

	openSyslog = func(string) (io.WriteCloser, error) { return nil, errors.New("down") }
	if _, _, err := OpenWriter(Config{Output: OutputSyslog}, io.Discard); err == nil {
		t.Error("want error when syslog is unavailable")
	}
}
