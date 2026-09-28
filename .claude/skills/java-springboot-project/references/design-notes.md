# java-springboot-project: 固定条件の理由と検証記録

`SKILL.md` の「このスキルが前提とする条件」に並べた各条件の、採用理由・却下した代替案・検証で見つかった落とし穴。プロジェクトを配置するだけなら読まなくてよい。テンプレートを変更するとき、生成されたプロジェクトを改造するとき、条件を見直すときに参照する。

以下はすべて 2026-08-31 時点で実際に検証して確認した結果に基づく。単なる「Javaの環境を作って」的な
依頼でも省略しない。

## バージョンの選定

- **Spring Boot は 4.1 系を使う（3.x は使わない）**。Spring Boot 3.5 の OSS サポートは
  2026-06-30 に終了しており、start.spring.io からも既に選べない。3.4 以前はさらに前に終了している。
  4.0 系はまだサポート中だが 2026-12-31 で切れるため、2027-07-31 まで持つ 4.1 系を選ぶ。
  ユーザーが明示的に「3系で」と言った場合のみそれに従う（その場合はサポート終了済みであることを伝える）。
- **Java は 21 LTS**。Spring Boot 4.x の下限は Java 17 だが、レコードパターン・仮想スレッドが
  使え、かつ Checkstyle / JaCoCo / google-java-format のどれもが確実に対応している 21 を選ぶ。
- **Gradle は wrapper で 9.7.1 を使う**。Maven ではなく Gradle にしているのは、Spotless・
  SpotBugs・JaCoCo・カバレッジ下限・依存ロックの設定を Kotlin DSL の 1 ファイルにまとめられるため。

## ツールチェーンの導入方針

- **JDK はユーザーローカルに導入する**。sudo やシステム全体へのインストールには依存しない
  （`apt install openjdk-21-jdk` 等は使わない）。これは、このリポジトリのホストが sudo に
  パスワードを要求する構成であり、かつ他の言語向けスキルと同じ「システムに触れずユーザー権限だけで
  開発環境を完結させる」方針に揃えるため。Eclipse Temurin の tar.gz を `~/sdk/` に展開する。
- **SDKMAN! は使わない**。SDKMAN! は `zip` / `unzip` コマンドを必要とするが、このリポジトリの
  ホストにはどちらも入っておらず、導入には sudo が要る。tar.gz を直接展開する方式ならこの制約に
  引っかからない。
- **Gradle 本体はインストールしない**。テンプレートに Gradle wrapper（`gradlew` +
  `gradle/wrapper/gradle-wrapper.jar`）を同梱してあり、初回の `./gradlew` 実行時に Gradle 9.7.1 が
  `~/.gradle/wrapper/dists/` へ自動でダウンロードされる。**wrapper の展開は Java 内蔵の zip 処理で
  行われるため、`unzip` コマンドが無い環境でも動く**（検証済み）。
- `~/.bashrc` は書き換えない。`JAVA_HOME` / `PATH` はコマンド実行時に都度指定するか、
  ユーザーの判断で恒久設定してもらう（ホスト環境に残る変更なので勝手に行わない）。

## プロジェクトの構造

- **ロジックは Controller に直接書かず Service に分離する**。理由は 2 つ。(1) HTTP に依存しない
  ロジックは Spring のコンテキストを起動しない素の JUnit テストで検証でき、実行が数ミリ秒で済む。
  (2) `@WebMvcTest` で Service をモックに差し替えられるので、Web 層のテストが「URL・ステータス
  コード・JSON の形」だけを見る純粋なものになる。
- **テストは 3 層すべてをテンプレートに入れる**。素の JUnit（`GreetingServiceTest`）、
  `@WebMvcTest` のスライステスト（`GreetingControllerTest`）、`@SpringBootTest` の起動テスト
  （`__APP_CLASS__Tests`）。片方だけだと「どのテストをどの層で書くべきか」が身につかない。
  特に `@SpringBootTest` を何にでも使ってしまう失敗が起きやすいので、3 つ並べて速さの差を
  見せることに意味がある。
- **例外ハンドラ（`@RestControllerAdvice`）をテンプレートに入れる**。これが無いと
  `IllegalArgumentException` が 500 になる。入力が悪いのはクライアント側なので 400 を返すのが
  正しく、テンプレートは RFC 9457 の `ProblemDetail` 形式で返す。
- **起動クラス名は必ず `Application` で終わらせる**。`build.gradle.kts` のカバレッジ除外
  (`**/*Application.class`)、`config/spotbugs/exclude.xml` (`~.*Application`)、
  `config/checkstyle/suppressions.xml` (`files="Application\.java$"`) の 3 箇所がこの命名に
  依存している。別の名前にすると、これらの除外が黙って効かなくなる。

## Spring Boot 4 で 3 系から変わっている点（テンプレートはすべて 4 系に対応済み）

3 系向けの記事やサンプルを写すと動かないので、書き換えるときは特に注意する。

- **starter 名**: `spring-boot-starter-web` → **`spring-boot-starter-webmvc`**。
  `spring-boot-starter-test` は用途別に分割され、Web 層のテストには
  **`spring-boot-starter-webmvc-test`** を使う（AssertJ・JUnit 5・Mockito はここから入る）。
- **テスト用アノテーションのパッケージ**: `@WebMvcTest` は
  **`org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`**
  （3 系は `org.springframework.boot.test.autoconfigure.web.servlet`）。
  `@SpringBootTest` は `org.springframework.boot.test.context` のまま変わっていない。
- **`@MockBean` は削除されている**。Spring Boot 4.1.1 の依存ツリー上に存在しない（検証済み）。
  代わりに **`org.springframework.test.context.bean.override.mockito.MockitoBean`** を使う。
- **MockMvc は `MockMvcTester`（AssertJ スタイル）を使う**
  (`org.springframework.test.web.servlet.assertj.MockMvcTester`)。`@WebMvcTest` で自動設定される
  ので `@Autowired` で受け取るだけでよい。

## 整形・静的解析の役割分担

同じことを 2 つのツールに見せると、片方を直したらもう片方が落ちる状態になりやすい。
役割が重ならないように次のとおり分けてある。**この分担を崩さないこと。**

- **整形は Spotless + google-java-format に一本化する**。Checkstyle 側にはインデントや行長の
  ルールを一切入れない。`./gradlew spotlessApply` で自動的に直る。
- **「Javadoc が書かれているか」は Checkstyle が見る**（`MissingJavadocType` /
  `MissingJavadocMethod` / `MissingJavadocPackage` / `JavadocMethod`）。`MissingJavadocMethod` の
  `minLineCount` は **`-1`** にしてある。既定値のままだと 2 行以下のメソッドが免除され、getter や
  1 行メソッドが無コメントで通ってしまう。
- **「Javadoc の中身が正しいか」は javadoc の doclint が見る**。`{@link}` のリンク切れ、実際の
  引数名とずれた `@param`、閉じ忘れた HTML タグを検出する（いずれも検証済み）。
  **doclint 側は `-Xdoclint:all,-missing` にしてある**。`missing` を有効にすると、Spring の
  `@Service` や `@RestControllerAdvice` のようにコンストラクタを明示しないクラスがすべて
  「暗黙のデフォルトコンストラクタにコメントが無い」として落ちる。空のコンストラクタを Javadoc
  付きで書かせるのは Spring の書き方として不自然なので、有無の判定は Checkstyle に任せている。
- **`javadoc` タスクには `-Werror` を付ける**。警告のままだと誰も直さず溜まるため。
- **`JavadocStyle` は Checkstyle 14 で削除されている**。設定に残すと
  `cannot initialize module JavadocStyle` で Checkstyle 自体が起動しない（この失敗は
  「Unable to create Root Module」という分かりにくいメッセージで出る）。代替の `SummaryJavadoc` /
  `JavadocParagraph` は「要約文がピリオドで終わること」を見るもので、句点が「。」の日本語コメントとは
  相性が悪いため入れていない。
- **バグ検出は SpotBugs が担当する**。Checkstyle はソースを、SpotBugs はバイトコードを見るので、
  NullPointerException の疑いのような実行時の問題は SpotBugs 側でしか出ない。
- **`-Xlint:all -Werror` を javac に付ける**。Spring Boot 4.1 + Java 21 のテンプレートは
  この設定で警告ゼロで通ることを確認済み。

## テスト・カバレッジ・ドキュメント

- **`./gradlew check` に整形チェック・Checkstyle・SpotBugs・テスト・カバレッジ下限・Javadoc を集約する**。
  `check` に `jacocoTestReport` / `jacocoTestCoverageVerification` / `javadoc` を追加してあり、
  これ 1 つで全部回る。
- **タスクランナーは just だが、レシピは全て `./gradlew <タスク>` を呼ぶだけの
  薄いラッパーに留める**（Gradle のタスク定義自体を `justfile` 側に持たせず、ロジックの二重管理はしない）。
  狙いは他の言語のプロジェクトと `just test` / `just lint` のような呼び方を揃えることであり、ビルドの実行順序や各タスクの中身は
  `build.gradle.kts` 側が唯一の真実源のまま変わらない。
- **カバレッジの下限は行 80%**。`jacocoTestCoverageVerification` で強制し、下回ると `check` が落ちる。
  これは下限であって目標ではない（目標にすると 80% を超えた瞬間にテストを書かなくなる）。
- **カバレッジ計測から起動クラスを除外する**。`main()` はテストから実行されないため、含めると
  カバレッジが実態より低く出て数字を追う意味が薄れる。除外すると、テンプレートの状態で行カバレッジ
  100%（16/16）になる。
- **JaCoCo のレポートは XML と HTML の両方を出す**。XML は VS Code の Coverage Gutters 拡張が読み、
  HTML は人が読む。Rust スキルの `cargo-llvm-cov` と違い、JaCoCo は 1 回の実行で両形式を同時に
  出力できるので、形式ごとにタスクを分ける必要はない。
- **`./gradlew test` を実行すると `OpenJDK 64-Bit Server VM warning: Sharing is only supported
  for boot loader classes because bootstrap classpath has been appended` が必ず出る**。JaCoCo の
  エージェントを `-javaagent` で差し込むことによる JVM の警告で、異常ではない。テンプレートの
  README にも書いてあるが、動作確認時にこれを見て「失敗した」と誤認しないこと。

## 依存とサプライチェーン対策

- **`gradle.lockfile` をコミットする**。`dependencyLocking { lockAllConfigurations() }` を有効に
  してあり、ロックファイルと実際の解決結果が食い違うとビルドが落ちる（検証済み）。
- **テンプレートには `gradle.lockfile` を含めない**。展開直後に
  `./gradlew dependencies --write-locks` を実行して生成する。Rust スキルの `Cargo.lock` と違い、
  **ロックファイルが無い状態でもビルドは通る**（Gradle の依存ロックはロック情報が存在するときだけ
  検証する）ので、生成を忘れても壊れはしないが、固定の効果が得られないので必ず実行する。
- **`settings.gradle.kts` で取得元を固定する**。`RepositoriesMode.FAIL_ON_PROJECT_REPOS` に
  してあるため、`build.gradle.kts` 側に `repositories {}` を書くとビルドが落ちる（検証済み）。
  これは cargo-deny の `[sources]` に相当する対策で、「いつの間にか知らないリポジトリから依存を
  引いていた」状態を防ぐ。**そのため、依存を追加するときに `build.gradle.kts` へ
  `repositories {}` を足してはいけない。**
- **`gradle-wrapper.properties` に `distributionSha256Sum` を書く**。wrapper がダウンロードする
  Gradle 本体が公式配布物と同一かを検証する。`distributionUrl` を変えるときはこの値も必ず差し替える
  （古いままだと起動できない）。

## このリポジトリ共通のサプライチェーン方針との差分（`AGENTS.md` の一般則参照。必ずユーザーに報告する）

**Gradle には「公開後N日未満を除外する」（npm/pnpmの`minimum-release-age`やuvの`exclude-newer`相当）も「インストール時の任意コード実行の抑制」（npmの`ignore-scripts`相当）も存在しない。** Gradleプラグインはビルド時に任意のコードを実行するのが前提の設計。

代わりに入れている `gradle.lockfile`、`FAIL_ON_PROJECT_REPOS`、`distributionSha256Sum`、バージョンの直書きが何を守り何を守らないのかも、あわせて伝えること。この差分はテンプレートの `README.md` にも表で書いてある。

**猶予7日は人間の運用で担保する。** 依存やプラグインのバージョンを上げるとき（テンプレートの
バージョンを更新するときも含む）は、Maven Central の
`https://repo1.maven.org/maven2/<グループのパス>/<artifact>/<version>/` で公開日を確認し、
公開から7日未満のものは選ばないこと。
