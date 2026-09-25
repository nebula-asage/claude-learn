# 依存をロックし、動作確認する

`<配置先>` に移動し、以下を順に確認する。`JAVA_HOME` と `PATH` は都度指定する
（`~/.bashrc` は非対話シェルだと冒頭で早期 return するため、`source ~/.bashrc` は効かない）。

- **`just lock`（`./gradlew dependencies --write-locks`）を最初に実行する。** `gradle.lockfile` が生成される。
  これはコミット対象。初回は Gradle 本体（約 130MB）のダウンロードが走るので数分かかることがある。
- 引数なしで `just` を実行し、レシピ一覧（`just --list`相当）が表示されることを確認する。
- `just check`（`./gradlew check`）が成功することを確認する。テンプレートの状態でテストは合計 11 件
  （`GreetingServiceTest` 7件 = 通常3件 + パラメータ化1件が4パターンに展開、
  `GreetingControllerTest` 3件、`__APP_CLASS__Tests` 1件）が全て通り、
  行カバレッジ 100%（16/16）になる。
- `just check` の後に、レポートが 6 種類すべて生成されていることを確認する。
  `build/reports/jacoco/test/html/index.html`、
  `build/reports/jacoco/test/jacocoTestReport.xml`、
  `build/reports/tests/test/index.html`、
  `build/reports/checkstyle/main.html`、
  `build/reports/spotbugs/main.html`、
  `build/docs/javadoc/index.html`。
  **SpotBugs のレポートが出ない場合は `build.gradle.kts` の
  `tasks.withType<SpotBugsTask> { reports.create("html") { required = true } }` が
  消えていないか確認する。** SpotBugs プラグインは既定ではレポートファイルを一切出さず、
  コンソールに出すだけで終わる。
- **アプリを実際に起動して応答を確認する。** ビルドが通ることと動くことは別。

  ```bash
  just run &                     # ./gradlew bootRun。または ./gradlew bootJar && java -jar build/libs/*.jar
  curl 'http://localhost:8080/api/greetings'            # {"message":"Hello, world!"}
  curl 'http://localhost:8080/api/greetings?name=Java'  # {"message":"Hello, Java!"}
  curl 'http://localhost:8080/actuator/health'          # {"status":"UP", ...}
  curl "http://localhost:8080/api/greetings?name=$(printf 'a%.0s' $(seq 1 51))"  # 400
  ```

  確認できたら必ずプロセスを止める。
- 最後に `just clean`（`./gradlew clean`）で `build/` を消し、コミット対象に成果物が残っていないことを
  `git status` で確かめる。

lintが本当に効いているかを反証で確かめる場合は `references/counter-tests.md` を参照する。
