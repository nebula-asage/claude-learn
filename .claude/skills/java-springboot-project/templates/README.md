# __PROJECT_NAME__

__PROJECT_DESCRIPTION__

Java 21 (LTS) + Spring Boot 4.1 + Gradle (Kotlin DSL) 構成。整形・静的解析・テスト・カバレッジ・
Javadoc 生成が最初から通る状態になっている。

## 前提

- **JDK 21 が入っていること**（`java -version` が 21 系を返す）。
- **Gradle 本体のインストールは不要**。同梱の Gradle wrapper (`./gradlew`) が、初回実行時に
  Gradle 9.7.1 を `~/.gradle/wrapper/dists/` へ自動でダウンロードして使う。

JDK が無い場合は、sudo を使わずユーザーのホーム配下に入れられる。

```bash
# 例: Eclipse Temurin 21 を ~/sdk 配下に展開する
curl -fsSL -o /tmp/jdk.tar.gz \
  'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz'
sha256sum /tmp/jdk.tar.gz   # ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94
mkdir -p ~/sdk && tar -xzf /tmp/jdk.tar.gz -C ~/sdk

export JAVA_HOME="$HOME/sdk/jdk-21.0.12.1+1"
export PATH="$JAVA_HOME/bin:$PATH"
```

最新版とそのチェックサムは <https://adoptium.net/temurin/releases/> で確認できる。

## 最初にやること

依存のバージョンを固定するロックファイルを作る。

```bash
./gradlew dependencies --write-locks
```

生成された `gradle.lockfile` はコミットする。以降、依存を追加・更新したときは同じコマンドを
再実行してロックファイルを更新する（更新せずにバージョンを変えるとビルドが落ちる。これは
「気づかないうちに依存が入れ替わっていた」状態を防ぐための意図した挙動）。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `./gradlew check` | 下記の整形チェック・静的解析・テスト・カバレッジ下限・Javadoc をまとめて実行する |
| `./gradlew bootRun` | アプリを起動する（<http://localhost:8080>） |
| `./gradlew bootJar` | 実行可能 jar を `build/libs/` に作る |
| `./gradlew spotlessApply` | コードを google-java-format で自動整形する |
| `./gradlew spotlessCheck` | 整形されていないファイルがないか確認する（直さない） |
| `./gradlew checkstyleMain checkstyleTest` | Javadoc の有無などを検査する |
| `./gradlew spotbugsMain spotbugsTest` | バイトコードを解析してバグの疑いを検出する |
| `./gradlew test` | テストを実行する |
| `./gradlew jacocoTestReport` | カバレッジレポートを出す（HTML / XML） |
| `./gradlew jacocoTestCoverageVerification` | カバレッジが下限（行 80%）を満たすか検証する |
| `./gradlew javadoc` | API ドキュメントを生成する |
| `./gradlew dependencies --write-locks` | 依存のロックファイルを更新する |
| `./gradlew clean` | 生成物を消す |

**整形が落ちたら `./gradlew spotlessApply` を実行する**。`check` は自動では直さない。

### 生成物の場所

| 種類 | パス |
| --- | --- |
| カバレッジ（HTML） | `build/reports/jacoco/test/html/index.html` |
| カバレッジ（XML、Coverage Gutters 用） | `build/reports/jacoco/test/jacocoTestReport.xml` |
| テスト結果 | `build/reports/tests/test/index.html` |
| Checkstyle | `build/reports/checkstyle/main.html` |
| SpotBugs | `build/reports/spotbugs/main.html` |
| Javadoc | `build/docs/javadoc/index.html` |
| 実行可能 jar | `build/libs/__PROJECT_NAME__-0.0.1-SNAPSHOT.jar` |

いずれも `build/` 配下なのでコミット対象外（`.gitignore` 済み）。

## 動作確認

```bash
./gradlew bootRun

curl 'http://localhost:8080/api/greetings'            # {"message":"Hello, world!"}
curl 'http://localhost:8080/api/greetings?name=Java'  # {"message":"Hello, Java!"}
curl 'http://localhost:8080/actuator/health'          # {"status":"UP", ...}

# 51 文字以上を渡すと 400 (RFC 9457 の ProblemDetail 形式)
curl "http://localhost:8080/api/greetings?name=$(printf 'a%.0s' $(seq 1 51))"
```

## 構成

```
__PROJECT_NAME__/
├── build.gradle.kts              # 依存とツール設定
├── settings.gradle.kts           # 依存の取得元の固定
├── gradle.properties             # Gradle 自体の挙動（キャッシュ・並列実行）
├── gradlew / gradlew.bat         # Gradle wrapper（Gradle 本体は不要）
├── gradle/wrapper/               # wrapper の実体と、取得する Gradle のバージョン指定
├── gradle.lockfile               # 依存バージョンの固定（--write-locks で生成）
├── config/
│   ├── checkstyle/               # Checkstyle のルールと除外設定
│   └── spotbugs/                 # SpotBugs の除外設定
└── src/
    ├── main/java/__BASE_PACKAGE_PATH__/
    │   ├── __APP_CLASS__.java    # 起動クラス
    │   └── greeting/             # Controller / Service / レスポンス record / 例外ハンドラ
    ├── main/resources/
    │   └── application.yaml      # 設定
    └── test/java/__BASE_PACKAGE_PATH__/
        ├── __APP_CLASS__Tests.java   # @SpringBootTest（起動できるか）
        └── greeting/
            ├── GreetingServiceTest.java     # 素の JUnit（Spring を起動しない）
            └── GreetingControllerTest.java  # @WebMvcTest（Web 層だけ起動する）
```

`greeting/` の中身はサンプル実装なので、自分の用途に合わせて書き換えてよい。

### テストの3層

同じ「テスト」でも起動範囲が違い、速さと守備範囲が変わる。

| テスト | 起動するもの | 速さ | 何を守るか |
| --- | --- | --- | --- |
| `GreetingServiceTest` | 何も起動しない（`new` するだけ） | 数 ms | ドメインのルール |
| `GreetingControllerTest` | Web 層だけ（`@WebMvcTest`） | 数百 ms | URL・ステータスコード・JSON の形 |
| `__APP_CLASS__Tests` | アプリ全体（`@SpringBootTest`） | 数秒 | Bean の定義漏れ・設定ファイルの誤り |

下に行くほど遅く、失敗したときの原因の絞り込みも難しくなる。ロジックは
`@SpringBootTest` ではなく一番上の層で検証するのが基本。

## 各ツールの役割

役割が重ならないように分担させてある。同じことを 2 つのツールに見せると、片方だけ直して
もう片方が落ちる状態になりやすい。

| ツール | 担当 |
| --- | --- |
| **Spotless + google-java-format** | 整形（インデント・改行位置・import の順序）。自動で直す |
| **Checkstyle** | Javadoc が**書かれているか**、自動整形では直らない書き方（`==` での文字列比較など） |
| **javadoc の doclint** | Javadoc の**中身が正しいか**（`{@link}` のリンク切れ、実際の引数名とずれた `@param`） |
| **SpotBugs** | バイトコードを解析してのバグ検出（NullPointerException の疑いなど） |
| **JaCoCo** | どの行がテストで実行されたか |

`check` はこれらを全部通す。どれか 1 つでも落ちれば `check` は失敗する。

## サプライチェーン対策と、その限界

このリポジトリは全プロジェクト共通で次の 2 点を方針にしている。

1. リリース直後のバージョンを使わない（公開後 7 日の猶予を置く）
2. インストール時の任意コード実行を抑制する

**Gradle にはこのどちらの機能も無い。** npm/pnpm の `minimum-release-age` や uv の
`exclude-newer` に相当する設定は存在せず、`ignore-scripts` に相当する仕組みも無い
（Gradle プラグインはビルド時に任意のコードを実行するのが前提の設計）。

そのため、このプロジェクトでは代わりに次の 4 つを組み合わせている。

| 対策 | 何を守るか | 守らないこと |
| --- | --- | --- |
| `gradle.lockfile`（依存ロック） | 一度確定した依存バージョンが黙って入れ替わらない | ロックした時点で既に汚染されていた場合 |
| `settings.gradle.kts` の `FAIL_ON_PROJECT_REPOS` | 取得元が Maven Central / Gradle Plugin Portal 以外に増えない | 正規リポジトリ上の悪意あるパッケージ |
| `gradle-wrapper.properties` の `distributionSha256Sum` | ダウンロードする Gradle 本体のすり替え | — |
| バージョンの直書き（`build.gradle.kts` のプラグイン版・ツール版） | 更新のタイミングを人間が握れる | 更新時に新しさを判断するのは人間の責任 |

**「公開直後の版を避ける」は自動化できないので、依存やプラグインのバージョンを上げるときは
公開日を確認し、公開から 7 日未満のものは避けること。** Maven Central の公開日は
`https://repo1.maven.org/maven2/<グループのパス>/<artifact>/<version>/` を見れば分かる。

## Gradle wrapper の出所

`gradle/wrapper/gradle-wrapper.jar` はバイナリなので、出所を明記しておく。

- Gradle 9.7.1 の公式配布物と同一。SHA-256 は
  `7a9ce74cff467ca1bf60a4fcd9f05185acceda4d0f382434d393e17864262c5d`
- 上記は <https://services.gradle.org/distributions/gradle-9.7.1-wrapper.jar.sha256> で公開されている値。
- 手元で確認する場合:
  ```bash
  sha256sum gradle/wrapper/gradle-wrapper.jar
  curl -s https://services.gradle.org/distributions/gradle-9.7.1-wrapper.jar.sha256
  ```

## 知っておくと迷わないこと

- **`./gradlew test` を実行すると `OpenJDK 64-Bit Server VM warning: Sharing is only supported
  for boot loader classes because bootstrap classpath has been appended` が出る。**
  JaCoCo のエージェントを `-javaagent` で差し込むことによる JVM の警告で、テスト結果には影響しない。
- **Spring Boot 4 では starter の名前が 3 系から変わっている。** `spring-boot-starter-web` は
  `spring-boot-starter-webmvc` に、`spring-boot-starter-test` は用途別
  （`spring-boot-starter-webmvc-test` など）に分割された。3 系向けの記事をそのまま写すと
  依存が解決できない。
- **テスト用アノテーションのパッケージも変わっている。** `@WebMvcTest` は
  `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`（3 系は
  `org.springframework.boot.test.autoconfigure.web.servlet`）。`@SpringBootTest` は
  `org.springframework.boot.test.context` のまま。
- **`@MockBean` は廃止されている。** 代わりに `@MockitoBean`
  (`org.springframework.test.context.bean.override.mockito.MockitoBean`) を使う。
