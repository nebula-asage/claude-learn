package logger

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"
)

// Messages はメッセージIDからメッセージテンプレートへの対応表。
// テンプレートは fmt.Sprintf と同じ書式のプレースホルダ（%s, %d, %v など）を含められる。
//
// 読み取り（Format）は複数のgoroutineから同時に行えるが、map のため書き込みとの同時実行は安全でない。
// ロガーに渡した後は変更しないこと。
type Messages map[string]string

// ParseMessages は key=value 形式のメッセージ定義を r から読み込む。
//
// 空行と # で始まる行は無視する。キーは最初の = までで、前後の空白は取り除く。
// キーが空の行・= の無い行・キーが重複する行はエラーとし、エラーには行番号を含める。
func ParseMessages(r io.Reader) (Messages, error) {
	msgs := Messages{}
	scanner := bufio.NewScanner(r)
	for lineNo := 1; scanner.Scan(); lineNo++ {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !ok || key == "" {
			return nil, fmt.Errorf("messages line %d: expected key=value", lineNo)
		}
		if _, dup := msgs[key]; dup {
			return nil, fmt.Errorf("messages line %d: duplicate key %q", lineNo, key)
		}
		msgs[key] = strings.TrimSpace(value)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read messages: %w", err)
	}
	return msgs, nil
}

// LoadMessages は path のメッセージファイルを読み込む。
func LoadMessages(path string) (Messages, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open messages file: %w", err)
	}
	defer func() { _ = f.Close() }()
	return ParseMessages(f)
}

// Format は id のテンプレートに params を埋め込んだメッセージを返す。
// id が未定義の場合は id をそのまま返し、found は false になる。
func (m Messages) Format(id string, params ...any) (msg string, found bool) {
	tmpl, ok := m[id]
	if !ok {
		return id, false
	}
	if len(params) == 0 {
		return tmpl, true
	}
	return fmt.Sprintf(tmpl, params...), true
}
