# 引数なしで実行された場合、レシピ一覧を表示する
default:
    @just --list

# pnpxでcspellを取得し、スペルチェックを実行する（未知語が出た場合はcspell.jsonのwordsに追記して解消する）
cspell:
    pnpx cspell --no-progress .

# pnpxでmarkdownlint-cli2を取得し、Markdownの構文・スタイルをlintする
markdownlint:
    pnpx markdownlint-cli2 "**/*.md"
