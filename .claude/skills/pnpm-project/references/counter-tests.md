# lint/JSDoc/カバレッジが本当に効いているかを反証で確かめる

設定を書いただけで実は無効、という状態を防ぐため。以下はいずれも検証済みで、確認後は必ず元に戻すこと。

- `src/index.ts`の`greet`関数内に使っていない変数（例: `const unused = 1;`）を追加すると、`just lint`で`'unused' is assigned a value but never used. Allowed unused vars must match /^_/u (@typescript-eslint/no-unused-vars)`が検出される。
- `src/index.ts`にJSDocコメント無しで新しい`export function`を追加すると、`Missing JSDoc comment (jsdoc/require-jsdoc)`が検出される。
- `src/index.ts`冒頭の`@packageDocumentation`を存在しないタグ名（例: `@bogustag`）に書き換えると、`Invalid JSDoc tag name "bogustag" (jsdoc/check-tag-names)`が検出される。
- `src/index.ts`に、JSDoc付きでlintは通るがテストからは一度も呼ばれない`export function`を追加して`just cover`を実行すると、ターミナルのカバレッジサマリでその関数の行が`Uncovered Line #s`に載り、`Functions`列の割合が下がる（`coverage/coverage-final.json`の関数呼び出し回数も0になる）。カバレッジレポートが実際に未カバー行を検出していることの確認であり、閾値による強制（rust/javaにあるようなカバレッジ下限のfail）はこのスキルには無い。
