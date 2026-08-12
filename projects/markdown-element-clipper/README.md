# markdown-element-clipper

Chrome / Edge 用のManifest V3拡張機能。ページ上の要素をDevToolsのインスペクタのように選び、その範囲をMarkdownに変換してクリップボードへコピーする。

権限は `activeTab` と `scripting` のみで、`host_permissions` は要求しない。拡張のアイコンをクリックするか、キーボードショートカットを押した「そのタブ」にだけ一時的にアクセスするため、インストール時に「すべてのウェブサイトのデータの読み取り」のような警告は出ない。

## セットアップ

`nvm` が未導入の場合は公式インストーラーで導入する。

```bash
NVM_LATEST=$(curl -fsSL https://api.github.com/repos/nvm-sh/nvm/releases/latest \
  | grep -m1 '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_LATEST}/install.sh" | bash
```

Node.jsランタイムはdistroのパッケージではなく `nvm` に導入・管理させる。

```bash
nvm install --lts
nvm alias default 'lts/*'
```

pnpmはcorepackを使わず、npm経由で10系に固定して導入する。

```bash
npm install -g pnpm@^10
```

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
pnpm dev         # esbuildのwatchモードでビルド(拡張は手動リロードが必要)
pnpm typecheck   # 型チェックのみ(--noEmit)
pnpm test        # vitestでMarkdown変換ロジックの単体テストを実行
pnpm build       # 本番ビルド
```

コードを変更したら、`chrome://extensions` / `edge://extensions` の拡張のリロードボタンを押し、その後対象ページもリロードする（順序が逆だと古いcontent scriptが残る）。

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

## 依存パッケージの追加

```bash
pnpm add <パッケージ名>
```

`pnpm install` / `pnpm add` を実行すると `pnpm-lock.yaml` が生成・更新される。このファイルはコミットしてバージョンを固定する。

## サプライチェーン攻撃対策

`.npmrc` に以下を設定している。

- `ignore-scripts=true`: postinstallなどのライフサイクルスクリプトを実行しない
- `min-release-age=7` / `minimum-release-age=10080`: 公開から7日間は新しいバージョンのインストールをスキップする（npmとpnpmでキー名・単位が異なるため両方指定している）

## 既知の制限

- **iframe内の要素は選べない**: top frameにのみcontent scriptを注入している（`allFrames: true` はフレーム間の座標統合とフォーカス制御が必要になるため対象外）
- **ページ側のclosed shadow DOM内は選べない**
- `chrome://` / `edge://` / 拡張機能ストア / PDFビューアなど、拡張の注入が禁止されているページでは動作しない
- `file://` のページで使うには、拡張の詳細画面で「ファイルのURLへのアクセスを許可する」を有効にする必要がある
- キーボードショートカット(`Alt+Shift+M`)が他の拡張と衝突すると、警告なく未割り当てになる。`chrome://extensions/shortcuts` / `edge://extensions/shortcuts` で確認・変更できる

## トラブルシュート

- **コピーに失敗する**: DevToolsにフォーカスがある状態だと `navigator.clipboard.writeText` が `NotAllowedError: Document is not focused` で失敗する。ページ側をクリックしてフォーカスしてから試す（それでも失敗した場合は `execCommand('copy')` のフォールバックが動く）
- `http://` の非セキュアなページでは `navigator.clipboard`自体が存在しないため、常にフォールバック経路でコピーされる
