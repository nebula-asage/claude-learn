plugins {
    java
    jacoco
    checkstyle
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.diffplug.spotless") version "8.10.0"
    id("com.github.spotbugs") version "6.5.11"
}

group = "__GROUP__"
version = "0.0.1-SNAPSHOT"
description = "__PROJECT_DESCRIPTION__"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

// 依存のバージョンを gradle.lockfile に固定する。
// Gradle には「公開直後のバージョンを避ける」機能が無いため、
// せめて「解決結果が勝手に変わらない」ことだけは保証する。
dependencyLocking {
    lockAllConfigurations()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.compilerArgs.addAll(listOf("-Xlint:all", "-Werror"))
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    testLogging {
        events("passed", "skipped", "failed")
    }
}

// ---- フォーマッタ (Spotless + google-java-format) ----
spotless {
    java {
        googleJavaFormat("1.36.1")
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
    kotlinGradle {
        ktlint()
    }
}

// ---- 静的解析 (Checkstyle: 主に Javadoc の強制) ----
checkstyle {
    toolVersion = "14.0.0"
    configFile = file("config/checkstyle/checkstyle.xml")
    configDirectory = file("config/checkstyle")
    isIgnoreFailures = false
    maxWarnings = 0
}

// ---- バグ検出 (SpotBugs) ----
spotbugs {
    toolVersion = "4.10.4"
    excludeFilter = file("config/spotbugs/exclude.xml")
    ignoreFailures = false
}

// SpotBugs プラグインは既定ではレポートファイルを一切出さず、コンソールに出すだけで終わる。
// 指摘が複数出たときに一覧で追えないので、HTML レポートを明示的に有効にする
// (build/reports/spotbugs/main.html と test.html)。
tasks.withType<com.github.spotbugs.snom.SpotBugsTask>().configureEach {
    reports.create("html") {
        required = true
    }
}

// ---- カバレッジ (JaCoCo) ----
jacoco {
    toolVersion = "0.8.15"
}

// 起動クラスは SpringApplication.run() を呼ぶだけで、テストで実行されることがない。
// 計測対象に残すとカバレッジが実態より低く出て、数字を追う意味が薄れるので除外する。
val coverageExclusions = listOf("**/*Application.class")

tasks.withType<JacocoReportBase>().configureEach {
    dependsOn(tasks.test)
    classDirectories.setFrom(
        files(
            layout.buildDirectory.dir("classes/java/main").map { dir ->
                fileTree(dir) { exclude(coverageExclusions) }
            },
        ),
    )
}

tasks.jacocoTestReport {
    reports {
        // xml は VS Code の Coverage Gutters 拡張が読む。html は人が読む用。
        xml.required = true
        html.required = true
    }
}

tasks.jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                counter = "LINE"
                // 「これを下回ったら落とす」下限であって目標値ではない。
                // 目標にすると 80% を超えた瞬間にテストを書かなくなる。
                minimum = "0.80".toBigDecimal()
            }
        }
    }
}

// ---- Javadoc ----
// 役割分担:
//   「Javadoc が書かれているか」  -> Checkstyle (MissingJavadoc*)
//   「Javadoc の中身が正しいか」  -> ここ (doclint)。{@link} のリンク切れ、実際の引数名と
//                                   ずれた @param、閉じ忘れた HTML タグなどを検出する。
// doclint 側の missing グループを外しているのは、これを有効にすると Spring の @Service や
// @RestControllerAdvice のような「コンストラクタを明示しないクラス」がすべて
// 「暗黙のデフォルトコンストラクタにコメントが無い」として落ちるため。
// 空のコンストラクタを Javadoc 付きで書かせるのは Spring の書き方として不自然なので、
// 有無の判定は Checkstyle に任せ、ここは記述内容の検証に絞る。
tasks.javadoc {
    options {
        this as StandardJavadocDocletOptions
        encoding = "UTF-8"
        charSet = "UTF-8"
        docEncoding = "UTF-8"
        addBooleanOption("Xdoclint:all,-missing", true)
        // 警告を1件でも出したら失敗させる。警告のままだと誰も直さず溜まる。
        addBooleanOption("Werror", true)
    }
}

// ./gradlew check だけで「整形・静的解析・テスト・カバレッジ下限・Javadoc」が全部回るようにする
tasks.check {
    dependsOn(tasks.jacocoTestReport, tasks.jacocoTestCoverageVerification, tasks.javadoc)
}
