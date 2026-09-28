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

以下は 2026-08-31 時点の検証に基づく。単なる「Javaの環境を作って」的な依頼でも省略しない。

- Spring Boot 4.1 系・Java 21 LTS・Gradle wrapper 9.7.1（Kotlin DSL）。3.x はユーザーが明示した場合のみ使い、その場合はサポート終了済みであることを伝える
- JDK は Eclipse Temurin の tar.gz を `~/sdk/` に展開する（`apt`・SDKMAN! は使わない）。Gradle 本体は入れず wrapper に任せる。`~/.bashrc` は書き換えず、`JAVA_HOME`/`PATH` は都度指定する
- ロジックは Controller に書かず Service に分離する。テストは素の JUnit・`@WebMvcTest`・`@SpringBootTest` の3層を置き、`@RestControllerAdvice` で `ProblemDetail`（400）を返す
- **起動クラス名は必ず `Application` で終わらせる**（カバレッジ・SpotBugs・Checkstyle の除外設定がこの命名に依存している）
- Spring Boot 4 は 3 系と starter 名・テスト用アノテーションのパッケージが違い、`@MockBean` は無い（`@MockitoBean`・`MockMvcTester` を使う）。3 系向けのサンプルを写さない
- 役割分担を崩さない: 整形は Spotless + google-java-format、Javadoc の有無は Checkstyle（`MissingJavadocMethod` の `minLineCount = -1`）、中身の正しさは doclint（`-Xdoclint:all,-missing`、`-Werror`）、バグ検出は SpotBugs、javac は `-Xlint:all -Werror`。Checkstyle 14 に `JavadocStyle` は無い
- `./gradlew check` に全検査を集約する。just のレシピは `./gradlew <タスク>` を呼ぶだけの薄いラッパーにする
- カバレッジの下限は行 80%（`jacocoTestCoverageVerification`）。起動クラスは計測から除外し、レポートは XML と HTML の両方を出す。`./gradlew test` で出る `Sharing is only supported for boot loader classes` の警告は異常ではない
- `gradle.lockfile` をコミットする（テンプレートには含めず、展開直後に `./gradlew dependencies --write-locks` で生成する）
- 取得元は `settings.gradle.kts` の `FAIL_ON_PROJECT_REPOS` で固定する（`build.gradle.kts` に `repositories {}` を足さない）。`gradle-wrapper.properties` の `distributionSha256Sum` は `distributionUrl` と一緒に更新する
- **サプライチェーン方針との差分（必ずユーザーに報告する）**: Gradle には「公開後N日未満を除外する」機能も「ビルド時の任意コード実行の抑制」も無い。代わりに lockfile・取得元の固定・wrapper のチェックサム・バージョンの直書きを入れていて、それぞれが何を守り何を守らないかも伝える。猶予7日は人手で担保し、バージョンを上げるときは Maven Central で公開日を確認して7日未満のものは選ばない。この差分はテンプレートの `README.md` にも書いてある

各条件の理由・却下した代替案・検証で見つかった落とし穴は `.claude/skills/java-springboot-project/references/design-notes.md` にある。テンプレートを変更するときや、条件を見直すときに読む。

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
