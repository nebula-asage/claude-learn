# markdown-element-clipper

Chrome / Edge 用のManifest V3拡張機能。ページ上の要素をDevToolsのインスペクタのように選び、その範囲をMarkdownに変換してクリップボードへコピーする。

権限は `activeTab` と `scripting` のみで、`host_permissions` は要求しない。拡張のアイコンをクリックするか、キーボードショートカットを押した「そのタブ」にだけ一時的にアクセスするため、インストール時に「すべてのウェブサイトのデータの読み取り」のような警告は出ない。

## セットアップ

pnpmが未導入の場合は[公式スタンドアロンインストーラー](https://pnpm.io/ja/installation#on-posix-systems)で導入する（npm・nvm・corepackには依存しない）。

```bash
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=12 sh -
```

Node.jsランタイムもdistroのパッケージやnvmではなく、pnpm自身の`runtime`機能で導入・管理する。

```bash
pnpm runtime set node lts -g
```

タスクランナーとして[just](https://just.systems/)も使う（`package.json`の`scripts`を呼ぶ薄いラッパー。無くてもpnpmコマンドを直接呼べば動く。`just`を引数なしで実行するとレシピ一覧を確認できる）。

## 実行方法

```bash
pnpm install
pnpm build
```

`pnpm build` で `dist/` にバンドルされた拡張機能一式が出力される。これをブラウザに読み込む。

**Chrome**: `chrome://extensions` を開く → 右上の「デベロッパー モード」をON → 「パッケージ化されていない拡張機能を読み込む」→ `dist/` を選択

**Edge**: `edge://extensions` を開く → 左下の「開発者モード」をON → 「展開して読み込み」→ 同じく `dist/` を選択

### 使い方

1. ツールバーの拡張アイコンをクリックする、または `Alt+Shift+M` を押す
2. マウスを動かすと要素がハイライトされ、タグ名・サイズがラベル表示される（DevToolsの要素選択と同じ操作感）
3. `↑` / `↓` キーで選択範囲を親要素・子要素へ移動できる
4. クリックまたは `Enter` で確定するとMarkdownに変換され、クリップボードにコピーされる
5. `Esc` でキャンセルする

## 開発

```bash
pnpm dev                 # esbuildのwatchモードでビルド(拡張は手動リロードが必要)
pnpm run typecheck       # 型チェックのみ(--noEmit)
pnpm test                # vitestでMarkdown変換ロジックの単体テストを実行
pnpm run test:coverage   # カバレッジを計測し、coverage/にHTML・clover.xml・coverage-final.jsonを出力
pnpm test:e2e            # Playwrightで実ブラウザに拡張を読み込んで通しテスト
pnpm build               # 本番ビルド
```

`just`を使う場合は `just dev` / `just typecheck` / `just test` / `just cover` / `just build` のように読み替えられる（`just`のみ実行するとレシピ一覧を確認できる）。

コードを変更したら、`chrome://extensions` / `edge://extensions` の拡張のリロードボタンを押し、その後対象ページもリロードする（順序が逆だと古いcontent scriptが残る）。

### Lint / Format / ドキュメント生成

```bash
pnpm run lint          # eslint . (型情報を使った検査を含む)
pnpm run lint:fix      # eslint . --fix
pnpm run format        # prettier --write .
pnpm run format:check  # prettier --check .
pnpm run docs          # TypeDocでAPIドキュメント(HTML)をdocs/apiに生成(生成物はgit管理外)
pnpm run docs:check    # HTMLを出さずドキュメント記述漏れだけ検証する
just cspell            # pnpxでcspellを取得しスペルチェック
just markdownlint      # pnpxでmarkdownlint-cli2を取得しMarkdownをlint
```

`src/**/*.ts`のexportしたシンボルにはJSDocコメントが必須（ESLintの`eslint-plugin-jsdoc`とTypeDocの記述漏れ検証の両方でチェックされる）。

### Git hooks（Husky + lint-staged）

`pnpm-workspace.yaml`の`ignoreScripts: true`（サプライチェーン攻撃対策）により、`pnpm install`時に`prepare`スクリプトは自動実行されない。`pnpm install`の後、**初回のみ手動で以下を実行**してGitのpre-commitフックを有効化すること。

```bash
pnpm run prepare
```

これにより、コミット時にステージされた`.ts`ファイルへ`eslint --fix`と`prettier --write`が、それ以外の対象拡張子には`prettier --write`が自動適用される。このプロジェクトはmonorepo（`claude-learn`）のサブディレクトリにあり`.git`はリポジトリルート直下にしか無いため、clone後の環境では毎回`pnpm run prepare`の実行が必要。

ビルド後、以下のコマンドでturndownがブラウザ向けビルド（Node専用の依存 `@mixmark-io/domino` を含まない版）で正しくバンドルされていることを確認できる。

```bash
grep -ci domino dist/content.js   # 0 であることを確認
```

background scriptのログは `chrome://extensions` の「Service Worker」リンクから、content scriptのログは対象ページのDevToolsコンソールから確認する。

### 手動での動作確認

```bash
cd fixtures && python3 -m http.server 8000
# http://localhost:8000/sample.html を開く
```

`fixtures/sample.html` には、見出し・リスト・テーブル・コードブロック・タスクリスト・相対リンク/画像・非表示要素・`position: fixed` のヘッダー・クリック抑止確認用のリンクとボタン・内部スクロールコンテナを詰め込んである。

### e2eテスト

実ブラウザ(Playwrightのchromium)に拡張を読み込み、`fixtures/sample.html` に対して「ピッカー起動 → ホバー → `↑`/`↓` → 確定 → クリップボード」までを通しで検証する。

```bash
pnpm exec playwright install chromium   # 初回のみ(約115MB)
pnpm test:e2e                           # 実行前に自動で pnpm build 相当が走る
HEADED=1 pnpm test:e2e                  # ブラウザを表示して確認したいとき
pnpm exec playwright test -g "Esc"      # テスト名で絞り込み
```

fixtureは `python3 -m http.server` で `http://localhost:8123` に配信される（Playwrightが自動で起動・停止する）。`https` ではなく `localhost` を使うのは、secure contextになり `navigator.clipboard` が本番同様に使えるため。

`sudo` が使えず `libnss3` / `libnspr4` をシステムに入れられない環境（WSLなど）では、ホームディレクトリに展開しておけば `playwright.config.ts` が自動で `LD_LIBRARY_PATH` に足す。

```bash
cd /tmp && apt-get download libnss3 libnspr4
for f in libnss3*.deb libnspr4*.deb; do dpkg -x "$f" ~/.local/chromedeps; done
```

## 依存パッケージの追加

```bash
pnpm add <パッケージ名>
```

`pnpm install` / `pnpm add` を実行すると `pnpm-lock.yaml` が生成・更新される。このファイルはコミットしてバージョンを固定する。

## サプライチェーン攻撃対策

`pnpm-workspace.yaml` に以下を設定している（pnpm 11以降、`.npmrc`はauth/registry設定専用になり非auth/registry設定は無視されるため、こちらに書く）。

- `ignoreScripts: true`: postinstallなどのライフサイクルスクリプトを実行しない
- `minimumReleaseAge: 10080`: 公開から7日間（10080分）は新しいバージョンのインストールをスキップする

## 既知の制限

- **iframe内の要素は選べない**: top frameにのみcontent scriptを注入している（`allFrames: true` はフレーム間の座標統合とフォーカス制御が必要になるため対象外）
- **ページ側のclosed shadow DOM内は選べない**
- `chrome://` / `edge://` / 拡張機能ストア / PDFビューアなど、拡張の注入が禁止されているページでは動作しない
- `file://` のページで使うには、拡張の詳細画面で「ファイルのURLへのアクセスを許可する」を有効にする必要がある
- キーボードショートカット(`Alt+Shift+M`)が他の拡張と衝突すると、警告なく未割り当てになる。`chrome://extensions/shortcuts` / `edge://extensions/shortcuts` で確認・変更できる

## トラブルシュート

- **コピーに失敗する**: DevToolsにフォーカスがある状態だと `navigator.clipboard.writeText` が `NotAllowedError: Document is not focused` で失敗する。ページ側をクリックしてフォーカスしてから試す（それでも失敗した場合は `execCommand('copy')` のフォールバックが動く）
- `http://` の非セキュアなページでは `navigator.clipboard`自体が存在しないため、常にフォールバック経路でコピーされる
