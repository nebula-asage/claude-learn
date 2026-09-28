# 引数なしで実行された場合、レシピの実行順序を表示する
default: usage

# このプロジェクトで最初に何をすべきか、レシピの実行順序を表示する
usage:
    @echo "cspell        - スペルチェック"
    @echo "markdownlint  - Markdownの構文・スタイルチェック"
    @echo "（両者に依存関係はなく、どちらから実行してもよい）"
    @echo ""
    @echo "レシピ一覧は 'just --list' を参照"

# pnpxでcspellを取得し、スペルチェックを実行する（未知語が出た場合はcspell.jsonのwordsに追記して解消する）
cspell:
    pnpx cspell --no-progress .

# pnpxでmarkdownlint-cli2を取得し、Markdownの構文・スタイルをlintする
markdownlint:
    pnpx markdownlint-cli2 "**/*.md"
