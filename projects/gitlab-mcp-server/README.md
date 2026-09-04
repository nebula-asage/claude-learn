# gitlab-mcp-server

セルフホストGitLabをAPI経由で操作するMCP（Model Context Protocol）サーバ。パーソナルアクセストークン（PAT）で認証し、リポジトリ参照・Issue・マージリクエスト・CI/パイプライン・グループ/メンバーの5領域をツールとして提供する。

- 実装言語: TypeScript（依存は `@modelcontextprotocol/sdk` と `zod` のみ。GitLab APIはNode組み込みの`fetch`で直接叩く）
- 実行形態: Dockerコンテナ
- トランスポート: `stdio` と Streamable HTTP の両対応（環境変数で切替）

## ツール一覧

`GITLAB_READ_ONLY=true` を設定すると、下表で「書込」に分類したツールはサーバ起動時に登録されず、`tools/list` にも現れない。

### リポジトリ / ファイル参照

| ツール名                      | 種別 | 説明                                                  |
| ----------------------------- | ---- | ----------------------------------------------------- |
| `gitlab_list_projects`        | 読取 | プロジェクトを検索・一覧する                          |
| `gitlab_get_project`          | 読取 | プロジェクト詳細を取得する                            |
| `gitlab_list_repository_tree` | 読取 | ディレクトリ/ファイルツリーを取得する                 |
| `gitlab_get_file_content`     | 読取 | ファイル内容を取得する（base64をデコード済み）        |
| `gitlab_list_branches`        | 読取 | ブランチ一覧を取得する                                |
| `gitlab_list_commits`         | 読取 | コミット履歴を取得する                                |
| `gitlab_search_code`          | 読取 | コードを検索する（プロジェクト内 / インスタンス全体） |

### Issue

| ツール名                   | 種別 | 説明                          |
| -------------------------- | ---- | ----------------------------- |
| `gitlab_list_issues`       | 読取 | Issueを検索・一覧する         |
| `gitlab_get_issue`         | 読取 | Issue詳細を取得する           |
| `gitlab_list_issue_notes`  | 読取 | Issueのコメントを取得する     |
| `gitlab_create_issue`      | 書込 | Issueを作成する               |
| `gitlab_update_issue`      | 書込 | Issueを更新・close/reopenする |
| `gitlab_create_issue_note` | 書込 | Issueにコメントを追加する     |

### マージリクエスト

| ツール名                           | 種別 | 説明                                     |
| ---------------------------------- | ---- | ---------------------------------------- |
| `gitlab_list_merge_requests`       | 読取 | マージリクエストを検索・一覧する         |
| `gitlab_get_merge_request`         | 読取 | マージリクエスト詳細を取得する           |
| `gitlab_get_merge_request_diff`    | 読取 | ファイル差分を取得する                   |
| `gitlab_list_merge_request_notes`  | 読取 | マージリクエストのコメントを取得する     |
| `gitlab_create_merge_request`      | 書込 | マージリクエストを作成する               |
| `gitlab_update_merge_request`      | 書込 | マージリクエストを更新・close/reopenする |
| `gitlab_create_merge_request_note` | 書込 | マージリクエストにコメントを追加する     |

### CI / パイプライン

| ツール名                    | 種別 | 説明                                                 |
| --------------------------- | ---- | ---------------------------------------------------- |
| `gitlab_list_pipelines`     | 読取 | パイプラインを検索・一覧する                         |
| `gitlab_get_pipeline`       | 読取 | パイプライン詳細を取得する                           |
| `gitlab_list_pipeline_jobs` | 読取 | パイプラインのジョブ一覧を取得する                   |
| `gitlab_get_job_log`        | 読取 | ジョブの実行ログを取得する（既定で末尾から切り詰め） |

### グループ / メンバー

| ツール名                     | 種別 | 説明                                         |
| ---------------------------- | ---- | -------------------------------------------- |
| `gitlab_list_groups`         | 読取 | グループを検索・一覧する                     |
| `gitlab_get_group`           | 読取 | グループ詳細を取得する                       |
| `gitlab_list_group_members`  | 読取 | グループのメンバーを検索・一覧する           |
| `gitlab_add_group_member`    | 書込 | グループにメンバーを追加する                 |
| `gitlab_update_group_member` | 書込 | メンバーのアクセスレベル・有効期限を更新する |

マージの実行（`PUT .../merge`）やIssue/MRの削除、グループメンバーの削除など、破壊的度合いが高い操作は今回のスコープに含めていない。

## 環境変数

| 変数                       | 必須 | 既定値      | 説明                                                                           |
| -------------------------- | ---- | ----------- | ------------------------------------------------------------------------------ |
| `GITLAB_BASE_URL`          | ○    | —           | 例 `https://gitlab.example.com`（`/api/v4` は付けない）                        |
| `GITLAB_TOKEN`             | ○    | —           | パーソナルアクセストークン。`PRIVATE-TOKEN`ヘッダで送信する                    |
| `GITLAB_DEFAULT_PROJECT`   | -    | —           | ツール引数 `project` 省略時に使う既定プロジェクト（`group/repo` または数値ID） |
| `GITLAB_READ_ONLY`         | -    | `false`     | `true`で書込系ツールを登録しない                                               |
| `GITLAB_TIMEOUT_MS`        | -    | `30000`     | GitLab APIリクエストのタイムアウト（ミリ秒）                                   |
| `MCP_TRANSPORT`            | -    | `stdio`     | `stdio` または `http`                                                          |
| `MCP_HTTP_HOST`            | -    | `127.0.0.1` | HTTPモードのバインドアドレス                                                   |
| `MCP_HTTP_PORT`            | -    | `3000`      | HTTPモードのポート                                                             |
| `MCP_HTTP_AUTH_TOKEN`      | -    | —           | 設定すると`Authorization: Bearer <token>`を必須にする                          |
| `MCP_HTTP_ALLOWED_ORIGINS` | -    | —           | カンマ区切りの許可Origin一覧（DNSリバインディング対策）                        |

## パーソナルアクセストークンの準備

GitLabの `User Settings > Access Tokens` から発行する。必要なスコープ:

- 読み取り系ツールのみ使う場合: `read_api`
- 書込系ツール（Issue/MR作成・更新・コメント、グループメンバー追加・更新）も使う場合: `api`

## ローカル開発

```bash
pnpm install
pnpm run build
GITLAB_BASE_URL=https://gitlab.example.com GITLAB_TOKEN=glpat-xxxx pnpm start
```

型チェックのみ行う場合は `pnpm run typecheck`。リグレッションテストは `pnpm test`（vitest）で実行する。

カバレッジは `pnpm run test:coverage` で計測する（`coverage/` にHTML・`clover.xml`・`coverage-final.json`を出力）。VS CodeのCoverage Gutters拡張によるガター表示・カバレッジ率表示は、この**CLI実行が生成した `clover.xml` を前提にしている**。Test Explorer（Vitest拡張）の「Run with Coverage」はレポータが `coverage-final.json` のみになり `clover.xml` を生成しないため、Coverage Guttersでは表示されない。エディタ上でカバレッジを確認したい場合は、Test Explorerではなく `pnpm run test:coverage` を実行すること。

### Git hooks（Husky + lint-staged）

`.npmrc` で `ignore-scripts=true`（サプライチェーン攻撃対策）にしているため、`pnpm install` 時に `prepare` スクリプトは自動実行されない。`pnpm install` の後、**初回のみ手動で以下を実行**してGitのpre-commitフックを有効化すること。

```bash
pnpm run prepare
```

これにより、コミット時にステージされた `.ts` ファイルへ `eslint --fix` と `prettier --write` が自動適用される（設定は `package.json` の `lint-staged` フィールド、フック本体は `.husky/pre-commit`）。このプロジェクトはmonorepo（`claude-learn`）のサブディレクトリにあり `.git` はリポジトリルート直下にしか無いため、`scripts/install-husky.mjs` がリポジトリルートを検出したうえで `git config core.hooksPath` をこのプロジェクト配下（`projects/gitlab-mcp-server/.husky/_`）に向けている。`core.hooksPath` はGitのローカル設定でありコミット対象外のため、リポジトリを新しく clone した環境では毎回 `pnpm run prepare` の実行が必要。

`core.hooksPath` はリポジトリ全体で1つしか持てず、このフックはリポジトリ内のどのコミットでも発火する。そのため `.husky/pre-commit` は、ステージされたファイルに `projects/gitlab-mcp-server/` 配下が含まれない場合は何もせずに通し、`node_modules` が未導入の作業ツリー（clone直後や `pnpm install` 前の git worktree）では警告を出してスキップする。これにより、このプロジェクトと無関係な変更や別worktreeからのコミットが巻き添えで失敗することはない。

`pnpm run docs` を実行すると、TypeDocがソースコードのJSDocコメントから開発者向けAPIリファレンス（HTML）を `docs/api/` に生成する。生成物はコミットせず、必要なときに手元で都度生成する運用にしている。ドキュメントの記述漏れだけを（HTMLを出さずに）検証したい場合は `pnpm run docs:check` を使う。

`pnpm test`（ユニットテスト）はGitLab APIへのfetchをモックし、`createServer()` を同一プロセス内で直接呼び出して検証するため、実際のプロセス起動やトランスポート越しの通信は通らない。この境界を自動で検証するE2Eテストが `pnpm run test:e2e` で、`dist/index.js` を実子プロセスとして起動し、本物のJSON-RPC（stdio と Streamable HTTP の両方）+ 実HTTPで下記「テスト環境」の実GitLab（`test-env/`）に対して疎通確認する。実行前に `cd test-env && ./setup.sh` でセルフホストGitLabを起動しておく必要がある（未起動だと明確なエラーで失敗する）。全29ツールの正常系を実GitLabに対して呼び出して検証しており（書込系8ツールも含む）、網羅漏れはE2E側の網羅性ガードで自動的に検出される。作成した使い捨てデータはテスト後に自動で後始末される。

## Dockerビルド

```bash
docker build -t gitlab-mcp-server .
```

`GITLAB_TOKEN` はイメージに焼き込まない。実行時に環境変数として渡すこと。

## Claude Code への登録

### stdioモード

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITLAB_BASE_URL",
        "-e",
        "GITLAB_TOKEN",
        "gitlab-mcp-server"
      ],
      "env": {
        "GITLAB_BASE_URL": "https://gitlab.example.com",
        "GITLAB_TOKEN": "glpat-xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

`docker run` には `-i` が必須（`-t` は付けない）。stdioモードではstdoutをJSON-RPC専用に使うため、`console.log`は使用していない。

### HTTPモード

```bash
cp .env.example .env
# .env を編集して GITLAB_BASE_URL / GITLAB_TOKEN を設定する
docker compose up -d
claude mcp add --transport http gitlab http://127.0.0.1:3000/mcp
```

`docker-compose.yml` はホストの `127.0.0.1:3000` のみにポートを公開する。外部に公開する場合は `MCP_HTTP_AUTH_TOKEN` を設定し、リバースプロキシ配下に置くことを推奨する。

## セルフホストGitLabのTLS証明書（private CA / 自己署名証明書）

```bash
docker run -i --rm \
  -v /path/to/ca.crt:/certs/ca.crt:ro \
  -e NODE_EXTRA_CA_CERTS=/certs/ca.crt \
  -e GITLAB_BASE_URL -e GITLAB_TOKEN \
  gitlab-mcp-server
```

`NODE_TLS_REJECT_UNAUTHORIZED=0` での検証無効化は推奨しない（中間者攻撃に対して無防備になる）。

## 読み取り専用運用

`GITLAB_READ_ONLY=true` を設定すると、Issue/MR の作成・更新・コメント追加ツールとグループメンバーの追加・更新ツールが一切登録されない。閲覧用途のみに使う場合や、権限の弱いPAT（`read_api`スコープのみ）と組み合わせて使う場合はこちらを推奨する。

## テスト環境

`test-env/` に、動作確認用のセルフホストGitLab（GitLab CE + GitLab Runner）をDockerで構築する手順がある。詳細は [`test-env/README.md`](./test-env/README.md) を参照。`pnpm run test:e2e`（上記「ローカル開発」参照）はこの環境に対して実行する。
