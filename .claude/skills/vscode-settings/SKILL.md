---
name: vscode-settings
description: リポジトリやprojects/<name>/配下にVS Code用の`.vscode/settings.json`（おすすめ設定）と`.vscode/extensions.json`（おすすめ拡張機能）を配置・更新するときに使う。「VS Codeの環境を作って」「VS Codeのおすすめ設定を追加して」「.vscodeディレクトリを作って」「VS Code拡張のおすすめ設定をして」「settings.jsonにおすすめ設定を入れて」など、このリポジトリでVS Code向けのsettings.json/extensions.jsonを新規作成・更新したい場合は必ずこのスキルを使うこと。配置先に`.devcontainer/devcontainer.json`が存在するdevcontainer環境の場合、おすすめ拡張機能は`.vscode/extensions.json`ではなく`devcontainer.json`の`customizations.vscode.extensions`に書く点が通常のVS Code設定と異なるので注意すること。
---

# vscode-settings

特定のプログラミング言語に依存しない、共通的なVS Codeの`settings.json`（エディタ設定）と`extensions.json`（おすすめ拡張機能）一式を配置するスキル。プロジェクトごとに使用言語が異なる（あるいは混在する）ことを前提に、特定言語のフォーマッタ・リンター設定はここでは扱わず、各プロジェクト側に委ねる。設定ファイルにはJSONC（コメント付きJSON）の形式でコメントを入れ、それぞれの設定・拡張機能が何のためにあるかを残す。

## 手順

1. **配置先を確認する**
   - デフォルトはリポジトリルート直下の`.vscode/`（リポジトリ全体向け）。
   - ユーザーが特定のプロジェクト（例: `projects/<name>/`）向けと言っている場合は、そのディレクトリ直下の`.vscode/`に配置する。
   - 既に`.vscode/settings.json`や`.vscode/extensions.json`が存在する場合は、上書きしてよいか、それとも既存の内容にマージするかを確認する。

2. **配置先がdevcontainer環境かどうか判定する**
   - `<配置先>/.devcontainer/devcontainer.json`の有無を確認する。存在すればdevcontainer環境として扱う。

3. **`settings.json`を配置する（devcontainer環境かどうかに関わらず常にこの手順）**
   - `.claude/skills/vscode-settings/templates/settings.json` → `<配置先>/.vscode/settings.json`
   - このファイルはローカルのVS Codeエディタ設定なので、devcontainer環境であっても`.vscode/settings.json`のまま配置してよい（`devcontainer.json`側には移さない）。

4. **拡張機能のおすすめ設定を配置する**
   - **devcontainer環境でない場合**: `.claude/skills/vscode-settings/templates/extensions.json` → `<配置先>/.vscode/extensions.json`
   - **devcontainer環境の場合**: `.vscode/extensions.json`は作らず、`templates/extensions.json`の`recommendations`配列の中身（コメントは転記しなくてよい。拡張機能IDのみでよい）を`<配置先>/.devcontainer/devcontainer.json`の`customizations.vscode.extensions`配列としてマージする。`devcontainer.json`は手元のEdit/Writeツールで直接編集し、`jq`などJSON専用パーサーへは通さない（後述の理由でコメント入りJSONCをそのまま読み込めないため）。
     - 理由: devcontainer環境では`devcontainer.json`の`customizations.vscode.extensions`に書いた拡張機能はコンテナ起動時に自動インストールされるが、`.vscode/extensions.json`の`recommendations`はあくまで「おすすめ表示」止まりで自動インストールされない。devcontainer環境ではより確実に効く`devcontainer.json`側を使う。
     - 既存の`customizations.vscode.settings`（devcontainer構築時のテンプレートに既に入っている設定など）はそのまま残し、同じ`customizations.vscode`オブジェクトに`extensions`キーを追加する形でマージする。
     - 既に`customizations.vscode.extensions`が存在する場合は、重複を除いて追記する（上書きしない）。

5. **内容を確認する**
   - `settings.json`/`extensions.json`はVS CodeがJSONC（コメント付きJSON）として解釈するファイルで、標準の`jq`ではコメント行があると構文エラーになる。値部分に`//`を含む文字列が無いことを確認したうえで、`sed 's|//.*||' <ファイル> | jq .`のようにコメントを取り除いてから`jq`にかける、または目視でカンマ・かっこの対応を確認する。
   - devcontainer環境の場合、`devcontainer.json`はもともとコメント無しのJSONだったなら引き続き`jq . <配置先>/.devcontainer/devcontainer.json`でそのまま検証できる。`customizations.vscode`に`settings`と`extensions`の両方が残っていることも確認する。

## おすすめ設定・拡張機能の内容（特定言語に依存しない共通項目のみ）

- `settings.json`: 保存時の最終改行付与・行末空白除去・改行コード統一・文字エンコーディング自動推測、インデント自動検出、ルーラー表示（80桁・120桁）、空白の可視化、差分表示での空白差分の表示、ソース管理ビューのツリー表示など。JSON/JSONCはVS Code組み込みフォーマッタで完結するため`[json]`/`[jsonc]`ブロックで保存時フォーマットを有効にするが、それ以外の言語（`[go]`/`[python]`のような言語別ブロックや`go.*`/`python.*`設定など、外部フォーマッタ・リンターが必要なもの）は含めない。
- `extensions.json`: `ms-ceintl.vscode-language-pack-ja`（VS Code UIの日本語化）、`ms-vscode-remote.vscode-remote-extensionpack`（SSH/WSL/コンテナ等のリモート開発をまとめて有効化する拡張機能パック。Dev Containersもこのパックに含まれる）、`eamodio.gitlens`（Git履歴強化）、`streetsidesoftware.code-spell-checker`（スペルチェック）、`yzhang.markdown-all-in-one`・`davidanson.vscode-markdownlint`・`shd101wyy.markdown-preview-enhanced`（Markdown編集支援・lint・数式/図表対応の高機能プレビュー）、`ritwickdey.liveserver`（ローカルサーバーでの即時プレビュー）、`ms-azuretools.vscode-docker`（Docker操作）。特定言語用の拡張機能（`golang.go`や`ms-python.python`、ESLint/Prettierなど）は含めない。
- 各設定・拡張機能にはJSONCのコメントで採用理由を書いてある。ユーザーから追加・削除の要望があれば都度応じてよいが、特定言語に依存する項目を追加する場合は必ずコメントを添え、範囲がこのスキルの「共通項目限定」という前提から外れないか確認する。

## このスキルの対象外

- devcontainer環境そのものの構築（`Dockerfile`・`devcontainer.json`の新規作成）は対象外。既に存在する`devcontainer.json`への追記のみを行う。
- 言語ごとのプロジェクト一式（lint/test/ドキュメンテーション環境）の構築は対象外。特定言語のフォーマッタ・リンター設定が必要な場合は、各プロジェクト側の設定で対応する。
