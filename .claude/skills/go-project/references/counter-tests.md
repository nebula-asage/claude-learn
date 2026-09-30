# lintが本当に効いているかを反証で確かめる

**この反証は`templates/`を変更したときに`template-verifier`が確認する検証項目であり、プロジェクト新規作成のたびに実行する手順ではない。**

設定を書いただけで実は無効、という状態を防ぐため。以下はいずれも検証済みで、確認後は必ず元に戻すこと。

- `internal/greeting/greeting.go` の `Greet` 関数のコメントを削ると、`exported: exported function Greet should have comment or be unexported (revive)` が `just lint` で検出される。
- `internal/greeting/greeting.go` または `main.go` 冒頭の `// Package ... は` を削ると、`package-comments: should have a package comment (revive)` が検出される。
- `os.Setenv(...)` のようなエラーを返す呼び出しの戻り値を受け取らずに書くと、`Error return value of ... is not checked (errcheck)` が検出される。
- 使わない変数への再代入を書くと、`ineffectual assignment to result (ineffassign)` が検出される。宣言しただけで一度も使わない変数は `declared and not used` というコンパイルエラーになり ineffassign の検証にならないため、`result := "a"` → `_ = result` → `result = "unused"` のように、最後の再代入だけが違反になる形にする。

## モック（gomock）が効いているかの反証

- `internal/greeting/greeting_test.go` の `TestGreetFrom` から `EXPECT().Name()` の行を削ると、想定外の呼び出しとして `just test` が落ちる。
- 同テストの `Return("Go", nil)` を別の値に変えると、`TestGreetFrom` が落ちる。
- `GreetFrom` の本体で `p.Name()` を呼ばないようにすると、`missing call(s) to Name()` で落ちる。
- `GreetFrom` のドキュメントコメントを削ると、revive の `exported` が `just lint` で検出する。なおインターフェースのメソッド（`Name`）のコメントは revive の `exported` では強制されない。
