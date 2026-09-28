---
name: vscode-settings
description: リポジトリやprojects/<name>/配下に、VS Code用の`.vscode/settings.json`（おすすめ設定）・`.vscode/extensions.json`（おすすめ拡張機能）、`cspell.json`（スペルチェック設定）、markdownlint-cli2の設定（`.markdownlint.jsonc`/`.markdownlint-cli2.jsonc`）、`justfile`の`cspell`/`markdownlint`レシピを配置・更新するときに使う。「VS Codeの環境を作って」「VS Codeのおすすめ設定/拡張機能を追加して」「.vscodeディレクトリを作って」「cspellの設定ファイル作って」「スペルチェックの設定を入れて」「markdownlintを導入して」など、これらの設定を新規作成・更新したい場合は必ずこのスキルを使うこと。devcontainer環境での拡張機能の書き先、設定ファイルの置き場所、既存justfileへの追記マージといった注意点は本文の手順に従う。
---

# vscode-settings

特定のプログラミング言語に依存しない、共通的なVS Codeの`settings.json`（エディタ設定）・`extensions.json`（おすすめ拡張機能）・`cspell.json`（スペルチェック設定）・`.markdownlint.jsonc`/`.markdownlint-cli2.jsonc`（markdownlint-cli2によるMarkdown lint設定）一式を配置するスキル。プロジェクトごとに使用言語が異なる（あるいは混在する）ことを前提に、特定言語のフォーマッタ・リンター設定はここでは扱わず、各プロジェクト側に委ねる。スペルチェックとMarkdown lintはいずれも特定言語に縛られない横断的な関心事なのでこのスキルの範囲に含めるが、プロジェクト固有の語彙（cspell.jsonの`words`）やルールの緩和（markdownlintの無効化ルール）まではここでは先回りで埋めず、配置後に実データ（実際にlintを実行した結果）で検証してもらう前提とする。設定ファイルにはJSONC（コメント付きJSON）の形式でコメントを入れ、それぞれの設定・拡張機能・除外パス・登録語・無効化ルールが何のためにあるかを残す。

## 手順

1. **配置先を確認する**
   - デフォルトはリポジトリルート直下の`.vscode/`（リポジトリ全体向け）。
   - ユーザーが特定のプロジェクト（例: `projects/<name>/`）向けと言っている場合は、そのディレクトリ直下の`.vscode/`に配置する。
   - 既に`.vscode/settings.json`・`.vscode/extensions.json`・`<配置先>/cspell.json`・`<配置先>/.markdownlint.jsonc`・`<配置先>/.markdownlint-cli2.jsonc`が存在する場合は、上書きしてよいか、それとも既存の内容にマージするかを確認する。

2. **配置先がdevcontainer環境かどうか判定する**
   - `<配置先>/.devcontainer/devcontainer.json`の有無を確認する。存在すればdevcontainer環境として扱う。

3. **`settings.json`を配置する（devcontainer環境かどうかに関わらず常にこの手順）**
   - `.claude/skills/vscode-settings/templates/settings.json` → `<配置先>/.vscode/settings.json`
   - このファイルはローカルのVS Codeエディタ設定なので、devcontainer環境であっても`.vscode/settings.json`のまま配置してよい（`devcontainer.json`側には移さない）。

4. **拡張機能のおすすめ設定を配置する**
   - **devcontainer環境でない場合**: `.claude/skills/vscode-settings/templates/extensions.json` → `<配置先>/.vscode/extensions.json`
   - **devcontainer環境の場合**: `.vscode/extensions.json`は作らず、`templates/extensions.json`の`recommendations`配列の中身を`<配置先>/.devcontainer/devcontainer.json`の`customizations.vscode.extensions`配列としてマージする。`devcontainer.json`は手元のEdit/Writeツールで直接編集し、`jq`などJSON専用パーサーへは通さない（後述の理由でコメント入りJSONCをそのまま読み込めないため）。
     - 理由: devcontainer環境では`devcontainer.json`の`customizations.vscode.extensions`に書いた拡張機能はコンテナ起動時に自動インストールされるが、`.vscode/extensions.json`の`recommendations`はあくまで「おすすめ表示」止まりで自動インストールされない。devcontainer環境ではより確実に効く`devcontainer.json`側を使う。
     - 既存の`customizations.vscode.settings`（devcontainer構築時のテンプレートに既に入っている設定など）はそのまま残し、同じ`customizations.vscode`オブジェクトに`extensions`キーを追加する形でマージする。
     - 既に`customizations.vscode.extensions`が存在する場合は、重複を除いて追記する（上書きしない）。

5. **`cspell.json`（スペルチェック設定）を配置する**
   - `.claude/skills/vscode-settings/templates/cspell.json` → `<配置先>/cspell.json`
   - `settings.json`/`extensions.json`とは異なり`.vscode/`配下ではなく`<配置先>`の直下（`package.json`・`go.mod`・`pyproject.toml`等と同じ階層）に置く。cspellおよびCode Spell Checker拡張機能が設定ファイルを探す標準的な置き場所であるため。
   - テンプレートの`words`は空のまま配置する。プロジェクト固有の語彙は実データを見ないと正しく判定できないため、このスキルでは埋めない。
   - 配置後、`<配置先>`で以下のいずれかの方法で実際にcspellを実行し、検出された未知語のうち誤字ではなく正当な語（プロジェクト名・ID・略語・固有名詞等）だけを`words`に1件ずつ追記する（何に由来する語かをインラインコメントで残す。書式は配置した`cspell.json`の`ignorePaths`の書き方に揃える）。誤字を見つけた場合はコメントに追加せず、ユーザーに報告して修正を検討してもらう。
     - pnpmが使える環境であれば追加インストール不要の`pnpx cspell --no-progress .`（`pnpx`が一時的にcspellを取得して実行する。このリポジトリはpnpm専用方針のため`npx`ではなく`pnpx`を使う。プロジェクトの`package.json`にcspellを永続的な依存として追加するかどうかは、そのプロジェクト自身の管理下にあるためこのスキルの対象外）
     - 既にそのプロジェクトにcspellがdevDependency等として導入済みなら、そのプロジェクトのパッケージマネージャ経由（`pnpm exec cspell`等）で実行してもよい
   - `ignorePaths`のうち、配置先のプロジェクトに存在しない言語のビルド生成物・ロックファイルのエントリ（例: Node.jsプロジェクトに対する`.venv/**`や`Cargo.lock`）は害はないが冗長なので、明らかに不要と分かるものは削ってよい。判断に迷う場合は残したままでよい。

6. **`.markdownlint.jsonc`/`.markdownlint-cli2.jsonc`（markdownlint-cli2によるMarkdown lint設定）を配置する**
   - `.claude/skills/vscode-settings/templates/markdownlint.jsonc` → `<配置先>/.markdownlint.jsonc`（ルール設定。VS Code拡張`davidanson.vscode-markdownlint`もこのファイルを自動検出して使う）
   - `.claude/skills/vscode-settings/templates/markdownlint-cli2.jsonc` → `<配置先>/.markdownlint-cli2.jsonc`（検査対象glob・除外パス設定。CLI専用）
   - いずれも`cspell.json`と同様`.vscode/`配下ではなく`<配置先>`の直下に、ファイル名の先頭に`.`を付けて置く（markdownlint-cli2・davidanson.vscode-markdownlintの双方が標準で探す場所・名前であるため）。
   - テンプレートの`.markdownlint.jsonc`は`"default": true`（既定ルールセットそのまま）で配置する。ルールの無効化はここでは先回りで決めず、cspellの`words`と同じく配置後に実際にlintを実行した結果を見てから判断する。
   - 配置後、`<配置先>`で以下のいずれかの方法で実際にmarkdownlintを実行し、検出された指摘を確認する。
     - pnpmが使える環境であれば追加インストール不要の`pnpx markdownlint-cli2 "**/*.md"`（cspellと同じ理由で`npx`ではなく`pnpx`を使う。永続的な依存として追加するかどうかは各プロジェクト自身の管理下にあるためこのスキルの対象外）
     - 既にそのプロジェクトにmarkdownlint-cli2がdevDependency等として導入済みなら、そのプロジェクトのパッケージマネージャ経由（`pnpm exec markdownlint-cli2`等）で実行してもよい
   - 検出された指摘のうち、自動修正可能なものは`pnpx markdownlint-cli2 --fix "**/*.md"`で直接ファイルを修正してよい。残った指摘は個別に内容を見て、実際の誤り（見出しの階層飛びなど）ならMarkdown本文を直接修正し、このモノレポの書き方として妥当な逸脱（例: 長文日本語プローズでの行長制限）だと判断した場合に限り、`.markdownlint.jsonc`にルールを無効化する設定を追記する（どちらの判断も理由をインラインコメントで残す）。誤字脱字ではない指摘を安易にルール無効化で握り潰さないこと。
   - `.markdownlint-cli2.jsonc`の`ignores`のうち、配置先のプロジェクトに存在しない言語のビルド生成物のエントリ（例: Node.jsプロジェクトに対する`.gradle/**`）は害はないが冗長なので、明らかに不要と分かるものは削ってよい。判断に迷う場合は残したままでよい。

7. **`justfile`を配置する**
   - `<配置先>/justfile`が存在しない場合: `.claude/skills/vscode-settings/templates/justfile` → `<配置先>/justfile`（置換不要）。
   - `<配置先>/justfile`が既に存在する場合（言語別のプロジェクトスキルが配置済みの場合を含む）: 上書きせず、テンプレートの`cspell`・`markdownlint`レシピだけを既存ファイルに追記マージする。追記前に既存ファイルに同名のレシピが無いことを確認し、あれば上書きせずユーザーに確認する。
   - このスキルが配置する`justfile`のレシピは`cspell`（スペルチェック実行）・`markdownlint`（Markdown lint実行）のみに限定する。`fmt`/`lint`/`test`等のタスクランナーとしての用途は言語別のプロジェクトスキルの対象であり、このスキルの対象外。

8. **内容を確認する**
   - `settings.json`/`extensions.json`/`cspell.json`/`.markdownlint.jsonc`/`.markdownlint-cli2.jsonc`はいずれもJSONC（コメント付きJSON）として解釈されるファイルで、標準の`jq`ではコメント行があると構文エラーになる。値部分に`//`を含む文字列が無いことを確認したうえで、`sed 's|//.*||' <ファイル> | jq .`のようにコメントを取り除いてから`jq`にかける、または目視でカンマ・かっこの対応を確認する。
     - `cspell.json`の`$schema`はURL（`https://...`）で`//`を含むため、このsedトリックはそのままでは使えない（`https:`の後ろが切れて構文エラーになる）。`cspell.json`は下記の`just cspell`実行による確認で十分なので、無理にjqへ通さなくてよい。
   - devcontainer環境の場合、`devcontainer.json`はもともとコメント無しのJSONだったなら引き続き`jq . <配置先>/.devcontainer/devcontainer.json`でそのまま検証できる。`customizations.vscode`に`settings`と`extensions`の両方が残っていることも確認する。
   - `cspell.json`は`<配置先>`で`just cspell`（`just`が無い環境では直接`pnpx cspell --no-progress .`）を実行し、`Issues found: 0`になることまで確認する（未知語が残ったまま完了にしない）。
   - `.markdownlint.jsonc`/`.markdownlint-cli2.jsonc`は`<配置先>`で`just markdownlint`（`just`が無い環境では直接`pnpx markdownlint-cli2 "**/*.md"`）を実行し、指摘が残っていないことまで確認する（指摘を残したまま完了にしない）。

## おすすめ設定・拡張機能・スペルチェック設定の内容（特定言語に依存しない共通項目のみ）

- `settings.json`: 保存時の最終改行付与・行末空白除去・改行コード統一・文字エンコーディング自動推測、インデント自動検出、ルーラー表示（80桁・120桁）、空白の可視化、差分表示での空白差分の表示、ソース管理ビューのツリー表示、VS Code組み込みAI機能（`chat.disableAIFeatures`）の無効化など。JSON/JSONCはVS Code組み込みフォーマッタで完結するため`[json]`/`[jsonc]`ブロックで保存時フォーマットを有効にするが、それ以外の言語（`[go]`/`[python]`のような言語別ブロックや`go.*`/`python.*`設定など、外部フォーマッタ・リンターが必要なもの）は含めない。
- `extensions.json`: `ms-ceintl.vscode-language-pack-ja`（VS Code UIの日本語化）、`ms-vscode-remote.vscode-remote-extensionpack`（SSH/WSL/コンテナ等のリモート開発をまとめて有効化する拡張機能パック。Dev Containersもこのパックに含まれる）、`eamodio.gitlens`（Git履歴強化）、`streetsidesoftware.code-spell-checker`（スペルチェック）、`yzhang.markdown-all-in-one`・`davidanson.vscode-markdownlint`・`shd101wyy.markdown-preview-enhanced`（Markdown編集支援・lint・数式/図表対応の高機能プレビュー）、`ritwickdey.liveserver`（ローカルサーバーでの即時プレビュー）、`ms-azuretools.vscode-docker`（Docker操作）、`Anthropic.claude-code`（Claude CodeをVS Code上で使うための公式拡張機能）、`nefrob.vscode-just-syntax`（justfileのシンタックスハイライト）。特定言語用の拡張機能（`golang.go`や`ms-python.python`、ESLint/Prettierなど）は含めない。
- `cspell.json`: `language: "en"`をベースに、ひらがな・カタカナ・漢字（CJK統合漢字）・半角カタカナの並びを`ignoreRegExpList`で検査対象から除外する（このモノレポのコメント・ドキュメントが日本語主体のため）。`ignorePaths`には各言語プロジェクトで共通して現れるビルド生成物・キャッシュ・ロックファイル（`node_modules`/`dist`/`build`/`target`/`coverage`/`.venv`/`__pycache__`/`pnpm-lock.yaml`/`Cargo.lock`等）を挙げてある。`words`は空で配置し、手順5の通り配置先で実際にcspellを実行して埋める。
- `.markdownlint.jsonc`: markdownlint-cli2とVS Code拡張`davidanson.vscode-markdownlint`が共有するルール設定ファイル。`"default": true`（既定ルールセットそのまま）で配置し、ルールの無効化は手順6の通り配置先で実際にlintを実行した結果を見てから、理由をコメントに添えて追記する。
- `.markdownlint-cli2.jsonc`: markdownlint-cli2専用の設定ファイル。検査対象glob（`**/*.md`）と、`ignores`（ビルド生成物・依存パッケージ・キャッシュ配下の除外。`node_modules`/`dist`/`build`/`target`/`coverage`/`.venv`/`docs/api`等）を持つ。ルール設定(`config`)はここには書かず、同じディレクトリの`.markdownlint.jsonc`が自動的に検出・適用される。
- `justfile`: `cspell`（スペルチェック実行）・`markdownlint`（Markdown lint実行）の2レシピだけを持つ薄いラッパー（それぞれ`pnpx cspell --no-progress .`・`pnpx markdownlint-cli2 "**/*.md"`を実行するだけ）。他言語別スキルの`justfile`（fmt/lint/test等の一式）とは役割が異なり、このスキルは横断的な検査の実行手段を揃えるためだけに追加する。
- 各設定・拡張機能にはJSONCのコメントで採用理由を書いてある。ユーザーから追加・削除の要望があれば都度応じてよいが、特定言語に依存する項目を追加する場合は必ずコメントを添え、範囲がこのスキルの「共通項目限定」という前提から外れないか確認する。

## このスキルの対象外

- devcontainer環境そのものの構築（`Dockerfile`・`devcontainer.json`の新規作成）は対象外。既に存在する`devcontainer.json`への追記のみを行う。
- 言語ごとのプロジェクト一式（lint/test/ドキュメンテーション環境）の構築は対象外。特定言語のフォーマッタ・リンター設定が必要な場合は、各プロジェクト側の設定で対応する。このスキルが配置する`justfile`も`cspell`/`markdownlint`レシピ限定で、`fmt`/`lint`/`test`等のタスクランナー機能を追加することは対象外。
- `cspell.json`・`.markdownlint.jsonc`・`.markdownlint-cli2.jsonc`をプロジェクトのpackage.json（や同等のビルド設定）に恒久的に組み込むこと（devDependency化・専用スクリプトの追加・Git hooksでの強制等）は対象外。このスキルは設定ファイルの配置とVS Code拡張機能上での動作確認までを担当し、CIやコミット時に強制する仕組みが要る場合は各プロジェクト側で対応する。
