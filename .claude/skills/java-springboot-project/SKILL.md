---
name: java-springboot-project
description: Java + Spring Boot の練習・開発プロジェクト一式（JDK 21 LTS + Spring Boot 4.1 + Gradle Kotlin DSL、Gradle wrapper 同梱で Gradle 本体のインストール不要 + Spotless/google-java-format による整形 + Checkstyle による Javadoc 強制 + SpotBugs によるバグ検出 + JUnit 5 と @WebMvcTest のスライステスト + JaCoCo によるカバレッジ HTML/XML レポートと下限検証 + doclint 付き javadoc による API ドキュメント生成 + gradle.lockfile による依存の固定）をホスト環境に直接構築するスキル。「javaの環境/プロジェクトを作って」「Spring Bootのプロジェクトを作って」「SpringBootでREST APIを作りたい」「Gradleのプロジェクトを作って」「JavaのlintとテストとカバレッジをGradleに入れて」「JaCoCoでカバレッジを測りたい」「JavadocでAPIドキュメントを生成したい」「Checkstyle/SpotBugs/Spotlessを入れて」など、Java/Spring Boot/Gradle プロジェクトの新規作成・再作成や、既存プロジェクトへの整形/lint/テスト/カバレッジ/ドキュメンテーション環境の追加を頼まれたら、明示的に「java-springboot-project」と言われなくても必ず使うこと。配置先が既に VS Code 向けの `.vscode/` ディレクトリを持つ場合は、Extension Pack for Java / Spring Boot Extension Pack 向けの settings.json・拡張機能のおすすめ設定に加え、Coverage Gutters 拡張によるカバレッジのエディタ上可視化設定も追加する。Docker/devcontainer には依存せずホストのユーザーローカル環境（sudo 不要）に直接導入する。devcontainer 自体の構築を頼まれた場合は devcontainer-ubuntu-ja スキルを使う。
---

# java-springboot-project

**JDK のユーザーローカル導入**、**Gradle wrapper 同梱による Gradle 本体不要のビルド**、
**Spotless / Checkstyle / SpotBugs / doclint の役割を分けた静的解析**、
**JUnit 5 + スライステストの3層構成**、**JaCoCo によるカバレッジ計測と下限検証**、
**`gradle.lockfile` による依存の固定**を組み込んだ Spring Boot プロジェクト一式を、
Docker/devcontainer に依存せずホスト環境に直接配置するスキル。

このスキルは devcontainer 系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。
devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキル（例: devcontainer-ubuntu-ja）を使うこと。

このスキルが用意するのは、整形・静的解析・テスト・カバレッジ・ドキュメント生成が最初から動く
**土台（スキャフォールディング）** であり、`greeting/` 配下はテンプレートのサンプル実装
（`GET /api/greetings` を返すだけ）のままである。ユーザーが「タスク管理 API を作りたい」
「DB につなぎたい」のように具体的な用途を挙げている場合は、手順4でテンプレートを配置した後、
その用途に合わせて中身を実装し直すこと（土台を作って終わりにしない）。

## このスキルが前提とする条件（変更しない）

以下はすべて 2026-08-31 時点で実際に検証して確認した結果に基づく。単なる「Javaの環境を作って」的な
依頼でも省略しない。

### バージョンの選定

- **Spring Boot は 4.1 系を使う（3.x は使わない）**。Spring Boot 3.5 の OSS サポートは
  2026-06-30 に終了しており、start.spring.io からも既に選べない。3.4 以前はさらに前に終了している。
  4.0 系はまだサポート中だが 2026-12-31 で切れるため、2027-07-31 まで持つ 4.1 系を選ぶ。
  ユーザーが明示的に「3系で」と言った場合のみそれに従う（その場合はサポート終了済みであることを伝える）。
- **Java は 21 LTS**。Spring Boot 4.x の下限は Java 17 だが、レコードパターン・仮想スレッドが
  使え、かつ Checkstyle / JaCoCo / google-java-format のどれもが確実に対応している 21 を選ぶ。
- **Gradle は wrapper で 9.7.1 を使う**。Maven ではなく Gradle にしているのは、Spotless・
  SpotBugs・JaCoCo・カバレッジ下限・依存ロックの設定を Kotlin DSL の 1 ファイルにまとめられるため。

### ツールチェーンの導入方針

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

### プロジェクトの構造

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

### Spring Boot 4 で 3 系から変わっている点（テンプレートはすべて 4 系に対応済み）

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

### 整形・静的解析の役割分担

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

### テスト・カバレッジ・ドキュメント

- **`./gradlew check` を単一の入口にする**。`check` に `jacocoTestReport` /
  `jacocoTestCoverageVerification` / `javadoc` を追加してあり、整形チェック・Checkstyle・SpotBugs・
  テスト・カバレッジ下限・Javadoc がこれ 1 つで全部回る。Makefile は置かない（Gradle のタスクが
  そのまま入口になるため、二重に入口を作らない）。
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

### 依存とサプライチェーン対策

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

### このリポジトリ共通のサプライチェーン方針との差分（必ずユーザーに報告する）

このリポジトリは全プロジェクト共通で「リリース直後のバージョンを使わない（猶予7日）」
「インストール時の任意コード実行を抑制する」の2点を各パッケージマネージャの機能で実現する方針だが、
**Gradle にはどちらの機能も存在しない**。

- **「公開後N日未満を除外する」機能は Gradle に無い**。npm/pnpm の `minimum-release-age` や
  uv の `exclude-newer` に相当する設定は存在しない。
- **「インストール時の任意コード実行の抑制」も Gradle に無い**。npm の `ignore-scripts` に
  相当する設定は無く、Gradle プラグインはビルド時に任意のコードを実行するのが前提の設計。

このスキルを使ってプロジェクトを作ったときは、**この2点が満たせないことを黙って伏せずユーザーに
報告する**（リポジトリの `CLAUDE.md` が「同等の設定があるか調べて適用し、無ければその旨を報告する」
と定めているため）。代わりに入れている `gradle.lockfile`、`FAIL_ON_PROJECT_REPOS`、
`distributionSha256Sum`、バージョンの直書きが何を守り何を守らないのかも、あわせて伝えること。
この差分はテンプレートの `README.md` にも表で書いてある。

**猶予7日は人間の運用で担保する。** 依存やプラグインのバージョンを上げるとき（テンプレートの
バージョンを更新するときも含む）は、Maven Central の
`https://repo1.maven.org/maven2/<グループのパス>/<artifact>/<version>/` で公開日を確認し、
公開から7日未満のものは選ばないこと。

## 手順

1. **JDK がホストに導入済みか確認する**
   - `command -v java javac` と `java -version` で確認する。21 系が入っていればステップ3に進んでよい。
   - `~/sdk/` 配下に既に JDK を展開してある場合もあるので、`ls ~/sdk` も見る
     （PATH に通っていないだけのことがある）。
   - **Gradle の有無は確認しなくてよい**。テンプレートの wrapper が本体を自動取得する。

2. **未導入の場合、ユーザーローカルに導入する**
   - **これはホスト環境に実際にソフトウェアを導入する操作である。** ユーザーが今回の依頼で
     明示的にこの方法を指定していない場合は、実行前に「JDK が入っていないのでユーザーローカルに
     導入してよいか（sudo は使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。

   ```bash
   # 最新の Temurin 21 の URL とチェックサムを取得する
   curl -sS "https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=linux&vendor=eclipse"
   ```

   返ってきた JSON の `binary.package.link`（ダウンロード URL）と `binary.package.checksum`
   （SHA-256）を使って、次のように展開する。

   ```bash
   curl -fsSL -o /tmp/jdk.tar.gz "<binary.package.link>"
   sha256sum /tmp/jdk.tar.gz          # <binary.package.checksum> と一致することを必ず確認する
   mkdir -p ~/sdk
   tar -xzf /tmp/jdk.tar.gz -C ~/sdk  # ~/sdk/jdk-<version>/ ができる
   ```

   - **チェックサムが一致しない場合は絶対に先へ進まない。**
   - `~/.bashrc` は書き換えない。以降のコマンドでは
     `export JAVA_HOME="$HOME/sdk/jdk-<version>"` と `export PATH="$JAVA_HOME/bin:$PATH"` を
     その都度指定する。恒久的に PATH を通したい場合は、ユーザーに確認したうえで行う。
   - 展開が終わったら `/tmp/jdk.tar.gz` を消す。

3. **配置先とプロジェクト名を確認する**
   - このリポジトリの `projects/README.md` のルールにより、基本は `projects/<project-name>/` 配下に
     1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい
     （例:「Spring Boot の練習環境」→ `java-practice`）。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

4. **テンプレートをコピーし、プレースホルダを置換する**

   プレースホルダは6種類。いずれも末尾の `__` まで含めて一致させるため、置換の順序は問わない
   （`__BASE_PACKAGE__` は `__BASE_PACKAGE_PATH__` の部分文字列にはならない）。

   | プレースホルダ | 置換する値 | 例 |
   | --- | --- | --- |
   | `__PROJECT_NAME__` | プロジェクト名。ディレクトリ名そのままでよい | `java-practice` |
   | `__PROJECT_DESCRIPTION__` | プロジェクトの1行説明。用途が指定されていればそれに合わせる | `Spring Boot の練習用プロジェクト` |
   | `__GROUP__` | Gradle の `group`。逆ドメイン形式 | `com.example` |
   | `__BASE_PACKAGE__` | ベースパッケージ。`__GROUP__` + プロジェクト名（記号を除いて小文字化） | `com.example.javapractice` |
   | `__BASE_PACKAGE_PATH__` | `__BASE_PACKAGE__` の `.` を `/` にしたもの | `com/example/javapractice` |
   | `__APP_CLASS__` | 起動クラス名。**必ず `Application` で終わらせる**（除外設定3箇所がこの命名に依存している） | `JavaPracticeApplication` |

   コピーするファイル（`<配置先>` = `projects/<project-name>/`）:

   | テンプレート | 配置先 |
   | --- | --- |
   | `templates/build.gradle.kts` | `<配置先>/build.gradle.kts` |
   | `templates/settings.gradle.kts` | `<配置先>/settings.gradle.kts` |
   | `templates/gradle.properties` | `<配置先>/gradle.properties`（置換不要） |
   | `templates/gradlew` | `<配置先>/gradlew`（置換不要。**実行権限を付ける**） |
   | `templates/gradlew.bat` | `<配置先>/gradlew.bat`（置換不要） |
   | `templates/gradle/wrapper/gradle-wrapper.jar` | `<配置先>/gradle/wrapper/gradle-wrapper.jar`（**バイナリ。テキスト置換をかけない**） |
   | `templates/gradle/wrapper/gradle-wrapper.properties` | `<配置先>/gradle/wrapper/gradle-wrapper.properties`（置換不要） |
   | `templates/config/checkstyle/checkstyle.xml` | `<配置先>/config/checkstyle/checkstyle.xml`（置換不要） |
   | `templates/config/checkstyle/suppressions.xml` | `<配置先>/config/checkstyle/suppressions.xml`（置換不要） |
   | `templates/config/spotbugs/exclude.xml` | `<配置先>/config/spotbugs/exclude.xml`（置換不要） |
   | `templates/.gitignore` | `<配置先>/.gitignore`（置換不要。ルートの `.gitignore` に Java/Gradle の項目は無いので、ルート側は変更しない） |
   | `templates/README.md` | `<配置先>/README.md` |
   | `templates/application.yaml` | `<配置先>/src/main/resources/application.yaml` |
   | `templates/java/main/__APP_CLASS__.java` | `<配置先>/src/main/java/__BASE_PACKAGE_PATH__/<起動クラス名>.java` |
   | `templates/java/main/package-info.java` | `<配置先>/src/main/java/__BASE_PACKAGE_PATH__/package-info.java` |
   | `templates/java/main/greeting/*.java` | `<配置先>/src/main/java/__BASE_PACKAGE_PATH__/greeting/` |
   | `templates/java/test/__APP_CLASS__Tests.java` | `<配置先>/src/test/java/__BASE_PACKAGE_PATH__/<起動クラス名>Tests.java` |
   | `templates/java/test/greeting/*.java` | `<配置先>/src/test/java/__BASE_PACKAGE_PATH__/greeting/` |

   `templates/vscode/` はここではコピーしない（手順6で扱う）。

   **`gradlew` の実行権限を忘れない。** 付け忘れると `bash: ./gradlew: Permission denied` になる。

5. **依存をロックし、動作確認する**

   `<配置先>` に移動し、以下を順に確認する。`JAVA_HOME` と `PATH` は都度指定する
   （`~/.bashrc` は非対話シェルだと冒頭で早期 return するため、`source ~/.bashrc` は効かない）。

   - **`./gradlew dependencies --write-locks` を最初に実行する。** `gradle.lockfile` が生成される。
     これはコミット対象。初回は Gradle 本体（約 130MB）のダウンロードが走るので数分かかることがある。
   - `./gradlew check` が成功することを確認する。テンプレートの状態でテストは合計 11 件
     （`GreetingServiceTest` 7件 = 通常3件 + パラメータ化1件が4パターンに展開、
     `GreetingControllerTest` 3件、`__APP_CLASS__Tests` 1件）が全て通り、
     行カバレッジ 100%（16/16）になる。
   - `check` の後に、レポートが 6 種類すべて生成されていることを確認する。
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
     ./gradlew bootRun &            # または ./gradlew bootJar && java -jar build/libs/*.jar
     curl 'http://localhost:8080/api/greetings'            # {"message":"Hello, world!"}
     curl 'http://localhost:8080/api/greetings?name=Java'  # {"message":"Hello, Java!"}
     curl 'http://localhost:8080/actuator/health'          # {"status":"UP", ...}
     curl "http://localhost:8080/api/greetings?name=$(printf 'a%.0s' $(seq 1 51))"  # 400
     ```

     確認できたら必ずプロセスを止める。
   - 最後に `./gradlew clean` で `build/` を消し、コミット対象に成果物が残っていないことを
     `git status` で確かめる。

   **lint が本当に効いているかを反証で確かめる**（設定を書いただけで実は無効、という状態を防ぐため。
   以下はいずれも検証済みで、確認後は必ず元に戻すこと）:

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

6. **配置先が VS Code プロジェクトの場合、Java 向けの VS Code 設定を追加する**
   - 判定は `<配置先>/.vscode/` ディレクトリ（`settings.json` または `extensions.json`）の有無で行う。
     存在しなければ VS Code 向けの設定は持たないプロジェクトとみなし、この手順はスキップする
     （`.vscode/` を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、
     `.vscode/` を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json` を配置する**: `templates/vscode/settings.json` の内容を
     `<配置先>/.vscode/settings.json` にマージする。既に存在する場合は Edit 系ツールで直接編集し、
     既存のキー（言語非依存の共通設定など）を残したまま `java.*` / `coverage-gutters.*` 系のキーと
     `[java]` / `[yaml]` / `[xml]` ブロックを追加する（同じキーが既にあれば上書きせず、内容を
     確認したうえでユーザーに判断を仰ぐ）。
     - `java.format.enabled` を `false` にしているのは、VS Code 内蔵の Java フォーマッタが
       google-java-format とは別のルールで整形するため。有効なままだと保存のたびに
       `./gradlew spotlessCheck` が落ちる状態になる。整形は `./gradlew spotlessApply` に一本化する。
     - `coverage-gutters.*` は Coverage Gutters 拡張向けで、`./gradlew jacocoTestReport` が生成する
       `build/reports/jacoco/test/jacocoTestReport.xml` を読み、行番号横に被覆行（緑）・未被覆行（赤）を
       表示する。HTML レポートを置き換えるものではなく追加のレポート形式。
   - **拡張機能のおすすめ設定を配置する**: 配置先の判定はさらに
     `<配置先>/.devcontainer/devcontainer.json` の有無で分岐する（この判定も「devcontainer を構築する
     スキルが動いたかどうか」ではなく、あくまでファイルの有無で行う）。
     - `devcontainer.json` が存在する場合: `.vscode/extensions.json` は使わず、
       `templates/vscode/extensions.json` の `recommendations` 配列の中身（拡張機能 ID のみ。
       コメントは転記しなくてよい）を `<配置先>/.devcontainer/devcontainer.json` の
       `customizations.vscode.extensions` 配列に Edit 系ツールで直接マージする（重複を除いて追記。
       既存の `customizations.vscode.settings` 等は残す）。
     - `devcontainer.json` が存在しない場合: `templates/vscode/extensions.json` の内容を
       `<配置先>/.vscode/extensions.json` にマージする（既存の `recommendations` があれば重複を
       除いて追記し、既存の非 Java 系の推奨拡張機能はそのまま残す）。
   - `settings.json` / `extensions.json`（および `devcontainer.json`）は JSONC（コメント付き JSON）
     として解釈されるため、標準の `jq` に通す前にコメント行を取り除くか、目視でカンマ・かっこの
     対応を確認する。
   - **Checkstyle の VS Code 拡張（`shengchen.vscode-checkstyle`）は推奨に入れない。**
     2023年3月から更新が止まっており、Checkstyle 14 に対応していない。Checkstyle は Gradle の
     ビルド側（`./gradlew checkstyleMain`）で動かせば十分なので、拡張は入れない。

7. **サプライチェーン方針の差分を報告する**
   - 「リリース直後のバージョンを使わない」「インストール時の任意コード実行を抑制する」の2点が
     Gradle では機能として実現できないこと、代わりに何を入れたかを、作業の報告に必ず含める
     （上の「このリポジトリ共通のサプライチェーン方針との差分」を参照）。

## このスキルの対象外

- Docker/devcontainer 環境の構築自体はこのスキルの対象外。コンテナ環境が欲しいと言われたら
  別スキル（例: devcontainer-ubuntu-ja）を使う（このスキルと組み合わせる必要はなく、独立して
  使われることを想定している）。
- `.vscode/` ディレクトリが存在しない配置先に、VS Code 向けの設定一式をゼロから新規作成することは
  このスキルの対象外（このスキルが行うのは Java 固有の追加設定のみ）。ユーザーから明示的に
  「VS Code 環境ごと作って」等の依頼があった場合のみ、`.vscode/` を新規作成したうえで Java 向け設定を
  配置してよい。
- Maven（`pom.xml`）構成はこのスキルの対象外。ユーザーが明示的に Maven を求めた場合は、
  このテンプレートは使わず別途構成する。
- Gradle のマルチプロジェクト構成（`include(...)` で複数モジュールを束ねる形）は対象外。
  このリポジトリは `projects/<name>/` ごとに自己完結させる方針なので、単一プロジェクト構成に
  固定している。
- DB 接続（Spring Data JPA / Flyway 等）、セキュリティ（Spring Security）、非同期・メッセージング、
  ネイティブイメージ（GraalVM）、Docker イメージのビルド（`bootBuildImage`）はこのスキルの対象外。
  必要なら土台を作ったうえで別途対応する。
- Git hooks（コミット時の自動 lint/format）の設定はこのスキルの対象外。このリポジトリでは
  `core.hooksPath` がリポジトリ全体で1つしか持てず、プロジェクトごとにフックを設定すると互いに
  上書きし合う問題があるため、Java プロジェクト側では設定しない。
