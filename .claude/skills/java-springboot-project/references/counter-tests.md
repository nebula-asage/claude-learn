# lint が本当に効いているかを反証で確かめる

**この反証は`templates/`を変更したときに`template-verifier`が確認する検証項目であり、プロジェクト新規作成のたびに実行する手順ではない。**

設定を書いただけで実は無効、という状態を防ぐため。以下はいずれも検証済みで、確認後は必ず元に戻すこと。

| わざと壊すもの | 落ちるタスク | 出るメッセージ |
| --- | --- | --- |
| `public` メソッドの Javadoc を消す | `checkstyleMain` | `Missing a Javadoc comment for 'greet'. [MissingJavadocMethod]` |
| `{@link}` を存在しない名前に書き換える | `javadoc` | `reference not found` |
| `@param` の名前を実際の引数とずらす | `javadoc` | `@param name not found` |
| インデントや空白を崩す | `spotlessCheck` | `The following files had format violations` |
| 確実に NPE になるコードを書く | `spotbugsMain` | `NP: Null pointer dereference` |
| テストを削ってカバレッジを下げる | `jacocoTestCoverageVerification` | `lines covered ratio is 0.31, but expected minimum is 0.80` |
| `gradle.lockfile` のバージョンを書き換える | どのビルドでも | `Did not resolve '...' which has been forced / substituted to a different version` |
| `build.gradle.kts` に `repositories {}` を足す | どのビルドでも | `Build was configured to prefer settings repositories over project repositories` |
