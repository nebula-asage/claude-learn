---
name: java-springboot-project
description: Java + Spring Boot の練習・開発プロジェクト一式（JDK 21 LTS + Spring Boot 4.1 + Gradle Kotlin DSL。整形/lint/テスト/カバレッジ/ドキュメント生成/依存固定の環境込み。justによる薄いタスクランナーラッパー込み）をホスト環境に直接構築するスキル。「javaの環境/プロジェクトを作って」「Spring Bootのプロジェクトを作って」「SpringBootでREST APIを作りたい」「Gradleのプロジェクトを作って」「JaCoCoでカバレッジを測りたい」「Checkstyle/SpotBugs/Spotlessを入れて」など、Java/Spring Boot/Gradle プロジェクトの新規作成・再作成や、既存プロジェクトへの整形/lint/テスト/カバレッジ/ドキュメンテーション環境の追加を頼まれたら、明示的に「java-springboot-project」と言われなくても必ず使うこと。配置先が既に VS Code 向けの `.vscode/` ディレクトリを持つ場合は、Extension Pack for Java / Spring Boot Extension Pack 向けの settings.json・拡張機能のおすすめ設定に加え、Coverage Gutters 拡張によるカバレッジのエディタ上可視化設定も追加する。Docker/devcontainer には依存せずホストのユーザーローカル環境（sudo 不要）に直接導入する。devcontainer 自体の構築はこのスキルの対象外。
---

# java-springboot-project

**JDK のユーザーローカル導入**、**Gradle wrapper 同梱による Gradle 本体不要のビルド**、
**Spotless / Checkstyle / SpotBugs / doclint の役割を分けた静的解析**、
**JUnit 5 + スライステストの3層構成**、**JaCoCo によるカバレッジ計測と下限検証**、
**`gradle.lockfile` による依存の固定**を組み込んだ Spring Boot プロジェクト一式を、
Docker/devcontainer に依存せずホスト環境に直接配置するスキル。

このスキルは devcontainer 系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。
devcontainer/コンテナ環境そのものの構築を頼まれたときは別スキルの対象であり、このスキルでは扱わない。

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

### このリポジトリ共通のサプライチェーン方針との差分（`AGENTS.md` の一般則参照。必ずユーザーに報告する）

**Gradle には「公開後N日未満を除外する」（npm/pnpmの`minimum-release-age`やuvの`exclude-newer`相当）も「インストール時の任意コード実行の抑制」（npmの`ignore-scripts`相当）も存在しない。** Gradleプラグインはビルド時に任意のコードを実行するのが前提の設計。

代わりに入れている `gradle.lockfile`、`FAIL_ON_PROJECT_REPOS`、`distributionSha256Sum`、バージョンの直書きが何を守り何を守らないのかも、あわせて伝えること。この差分はテンプレートの `README.md` にも表で書いてある。

**猶予7日は人間の運用で担保する。** 依存やプラグインのバージョンを上げるとき（テンプレートの
バージョンを更新するときも含む）は、Maven Central の
`https://repo1.maven.org/maven2/<グループのパス>/<artifact>/<version>/` で公開日を確認し、
公開から7日未満のものは選ばないこと。

## 手順

1. **JDK・just がホストに導入済みか確認する**
   - `command -v java javac` と `java -version` で確認する。21 系が入っていればJDKの導入は不要。
   - `~/sdk/` 配下に既に JDK を展開してある場合もあるので、`ls ~/sdk` も見る
     （PATH に通っていないだけのことがある）。
   - `command -v just` と `just --version` でjust（タスクランナー）を確認する。
   - **Gradle の有無は確認しなくてよい**。テンプレートの wrapper が本体を自動取得する。
   - 全て導入済みならステップ3に進んでよい。

2. **未導入の場合、ユーザーローカルに導入する**
   - **これはホスト環境に実際にソフトウェアを導入する操作である。** ユーザーが今回の依頼で
     明示的にこの方法を指定していない場合は、実行前に「JDK/just が入っていないのでユーザーローカルに
     導入してよいか（sudo は使わない）」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
   - 具体的な導入コマンド（Eclipse Temurin JDK・just）は `.claude/skills/java-springboot-project/references/install.md` を参照する。

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

   `templates/` の大半（`build.gradle.kts`・`gradle.properties`・`gradlew`・`gradlew.bat`・
   `gradle/wrapper/`・`config/`・`.gitignore`・`justfile`・`README.md` など）は `<配置先>` へそのまま
   1階層でコピーできる。一方 `.claude/skills/java-springboot-project/templates/java/` 配下と `.claude/skills/java-springboot-project/templates/application.yaml` だけは、最終的な配置先
   （`src/main/java/__BASE_PACKAGE_PATH__/...` や `src/main/resources/`）が `__BASE_PACKAGE_PATH__` の
   実際の値に依存するため、テンプレート側では平坦な仮置き構造になっている。そのため
   「一括コピー→パッケージ構造への再配置→プレースホルダ置換」の3段構成にする（`<配置先>` =
   `projects/<project-name>/`、`<base_path>` = `__BASE_PACKAGE_PATH__` の実際の値、`<起動クラス名>` =
   `__APP_CLASS__` の実際の値）。

   ```bash
   mkdir -p "<配置先>"
   cp -a .claude/skills/java-springboot-project/templates/. "<配置先>/"
   rm -rf "<配置先>/vscode"

   mkdir -p "<配置先>/src/main/java/<base_path>/greeting" \
            "<配置先>/src/test/java/<base_path>/greeting" \
            "<配置先>/src/main/resources"
   mv "<配置先>/java/main/__APP_CLASS__.java" "<配置先>/src/main/java/<base_path>/<起動クラス名>.java"
   mv "<配置先>/java/main/package-info.java" "<配置先>/src/main/java/<base_path>/package-info.java"
   mv "<配置先>/java/main/greeting/"*.java "<配置先>/src/main/java/<base_path>/greeting/"
   mv "<配置先>/java/test/__APP_CLASS__Tests.java" "<配置先>/src/test/java/<base_path>/<起動クラス名>Tests.java"
   mv "<配置先>/java/test/greeting/"*.java "<配置先>/src/test/java/<base_path>/greeting/"
   rm -rf "<配置先>/java"
   mv "<配置先>/application.yaml" "<配置先>/src/main/resources/application.yaml"
   ```

   （`.claude/skills/java-springboot-project/templates/vscode/` はここではコピーしない。手順6で扱う。`cp -a` は権限・タイムスタンプを保ったまま
   複製するため、`gradlew`・`gradle-wrapper.jar` を含め個別ファイルの権限調整や「バイナリなのでテキスト
   置換をかけない」といった配慮は不要——置換はこの後の grep で見つかったファイルにしか行わないため
   バイナリが誤って書き換わることもない。）

   再配置後、`grep -rl "__PROJECT_NAME__\|__PROJECT_DESCRIPTION__\|__GROUP__\|__BASE_PACKAGE__\|__BASE_PACKAGE_PATH__\|__APP_CLASS__" "<配置先>"`
   でプレースホルダを含むファイルを洗い出し、その結果に対してだけ Edit系ツールで置換する
   （現時点では `README.md` / `application.yaml` / `settings.gradle.kts` / `build.gradle.kts` と、
   移動後の起動クラス・`package-info.java`・`greeting/` 配下の各 `.java`（main/test 合わせて10ファイル）の
   計14ファイルが該当する。テンプレートが変わった場合はこの一覧ではなく grep の結果を優先すること）。
   `gradle.properties` / `gradlew` / `gradlew.bat` / `gradle-wrapper.jar` / `gradle-wrapper.properties` /
   `checkstyle.xml` / `suppressions.xml` / `exclude.xml` / `.gitignore` / `justfile` にはプレースホルダが
   無いため対象外（`.gitignore` はリポジトリルートの `.gitignore` に Java/Gradle の項目が無いことの確認の
   みで、内容の変更は不要）。

5. **依存をロックし、動作確認する**

   `<配置先>` に移動し、`.claude/skills/java-springboot-project/references/verify.md` の手順に従って確認する。`JAVA_HOME` と `PATH` は都度指定する
   （`~/.bashrc` は非対話シェルだと冒頭で早期 return するため、`source ~/.bashrc` は効かない）。
   lint が本当に効いているかの反証（`.claude/skills/java-springboot-project/references/counter-tests.md`）は、このスキルの`templates/`を
   変更したときに`template-verifier`が確認する検証項目であり、プロジェクト新規作成のたびに実行する
   手順ではない。

6. **配置先が VS Code プロジェクトの場合、Java 向けの VS Code 設定を追加する**
   - 判定は `<配置先>/.vscode/` ディレクトリ（`settings.json` または `extensions.json`）の有無で行う。
     存在しなければ VS Code 向けの設定は持たないプロジェクトとみなし、この手順はスキップする
     （`.vscode/` を新規に作るかどうかはこのスキルの対象外。ユーザーから明示的に依頼があった場合のみ、
     `.vscode/` を新規作成したうえで以下と同じ内容を配置してよい）。
   - **`settings.json` を配置する**: `.claude/skills/java-springboot-project/templates/vscode/settings.json` の内容を
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
       `.claude/skills/java-springboot-project/templates/vscode/extensions.json` の `recommendations` 配列の中身（拡張機能 ID のみ。
       コメントは転記しなくてよい）を `<配置先>/.devcontainer/devcontainer.json` の
       `customizations.vscode.extensions` 配列に Edit 系ツールで直接マージする（重複を除いて追記。
       既存の `customizations.vscode.settings` 等は残す）。
     - `devcontainer.json` が存在しない場合: `.claude/skills/java-springboot-project/templates/vscode/extensions.json` の内容を
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

- Docker/devcontainer 環境の構築自体はこのスキルの対象外（このスキルと組み合わせる必要はなく、独立して
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
