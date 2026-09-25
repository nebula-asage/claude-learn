# lintが本当に効いているかを反証で確かめる

設定を書いただけで実は無効、という状態を防ぐため。以下はいずれも検証済みで、確認後は必ず元に戻すこと。

- `internal/greeting/greeting.go` の `Greet` 関数のコメントを削ると、`exported: exported function Greet should have comment or be unexported (revive)` が `just lint` で検出される。
- `internal/greeting/greeting.go` または `main.go` 冒頭の `// Package ... は` を削ると、`package-comments: should have a package comment (revive)` が検出される。
- `os.Setenv(...)` のようなエラーを返す呼び出しの戻り値を受け取らずに書くと、`Error return value of ... is not checked (errcheck)` が検出される。
- 使わない変数への再代入（例: 後で上書きされるだけの `result := "unused"`）を書くと、`ineffectual assignment to result (ineffassign)` が検出される。
