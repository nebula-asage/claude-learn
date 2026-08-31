// 依存の取得元をここで固定する。
// build.gradle.kts 側に repositories {} を書かせない（FAIL_ON_PROJECT_REPOS）ことで、
// 「いつの間にか知らないリポジトリから依存を引いていた」という状態を防ぐ。
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        mavenCentral()
    }
}

rootProject.name = "__PROJECT_NAME__"
