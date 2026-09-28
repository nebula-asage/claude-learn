# 依存をロックし、動作確認する

`<配置先>` に移動し、動作確認は以下のコマンドにまとめて実行する（成功を前提に連結し、落ちたコマンドだけ個別に切り分ける）。`JAVA_HOME` と `PATH` は都度指定する（`~/.bashrc` は非対話シェルだと冒頭で早期 return するため、`source ~/.bashrc` は効かない）。

**`just lock`（`./gradlew dependencies --write-locks`）は必ず単独で先に実行する。** `gradle.lockfile` が生成される。これはコミット対象。初回は Gradle 本体（約 130MB）のダウンロードが走るので数分かかることがある。

```bash
just lock
```

続けて以下をまとめて実行する。

```bash
set -e
echo "=== just (usage) ==="; just
echo "=== just --list ==="; just --list
echo "=== check ==="; just check
echo "=== reports ==="
test -f build/reports/jacoco/test/html/index.html && echo "jacoco html OK"
test -f build/reports/jacoco/test/jacocoTestReport.xml && echo "jacoco xml OK"
test -f build/reports/tests/test/index.html && echo "tests html OK"
test -f build/reports/checkstyle/main.html && echo "checkstyle OK"
test -f build/reports/spotbugs/main.html && echo "spotbugs OK"
test -f build/docs/javadoc/index.html && echo "javadoc OK"
```

出力から以下を確認する:

- `just`: 引数なし実行でレシピの実行順序（`usage`レシピ）が表示される
- `just --list`: レシピ一覧が表示される
- `check`（`./gradlew check`）: 成功する。テンプレートの状態でテストは合計 11 件（`GreetingServiceTest` 7件 = 通常3件 + パラメータ化1件が4パターンに展開、`GreetingControllerTest` 3件、`__APP_CLASS__Tests` 1件）が全て通り、行カバレッジ 100%（16/16）になる
- `reports`: 6種類のレポートが全て `test -f` で存在確認できる。**`spotbugs OK` が出ない場合は `build.gradle.kts` の `tasks.withType<SpotBugsTask> { reports.create("html") { required = true } }` が消えていないか確認する。** SpotBugs プラグインは既定ではレポートファイルを一切出さず、コンソールに出すだけで終わる

**アプリを実際に起動して応答を確認する。** ビルドが通ることと動くことは別。

```bash
just run &                     # ./gradlew bootRun。または ./gradlew bootJar && java -jar build/libs/*.jar
curl 'http://localhost:8080/api/greetings'            # {"message":"Hello, world!"}
curl 'http://localhost:8080/api/greetings?name=Java'  # {"message":"Hello, Java!"}
curl 'http://localhost:8080/actuator/health'          # {"status":"UP", ...}
curl "http://localhost:8080/api/greetings?name=$(printf 'a%.0s' $(seq 1 51))"  # 400
```

確認できたら必ずプロセスを止める。

最後に `just clean`（`./gradlew clean`）で `build/` を消し、コミット対象に成果物が残っていないことを確認する。

```bash
just clean
git status --short
```

途中で失敗したら、そのコマンドだけ単独で再実行して詳細を確認する。

lintが本当に効いているかを反証で確かめる場合は `references/counter-tests.md` を参照する。
