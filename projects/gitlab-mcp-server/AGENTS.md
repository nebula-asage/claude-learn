# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

セルフホストGitLabをAPI経由で操作するMCP（Model Context Protocol）サーバ。パーソナルアクセストークン（PAT）で認証し、リポジトリ参照・Issue・マージリクエスト・CI/パイプライン・グループ/メンバーの5領域をツールとして提供する。TypeScript製。依存は `@modelcontextprotocol/sdk` と `zod` のみで、GitLab APIはNode組み込みの `fetch` で直接叩く（GitLab用SDKは使わない）。

## 開発環境

このプロジェクトは `.devcontainer/`（Ubuntu 24.04 / ja_JP.UTF-8 / Asia-Tokyo、Node.js 24 + pnpm）を用意している。**E2Eテスト（`pnpm run test:e2e` および `test-env/` 関連の作業）を除く基本的な作業（`pnpm install`、ビルド、型チェック、lint、format、`pnpm test` によるユニットテスト等）はdevcontainer内で実施すること。**

E2Eテストのみ対象外なのは、`test-env/`（セルフホストGitLab CE + GitLab Runner）をDocker Composeで起動する必要があるが、このdevcontainerはDocker-in-Docker構成になっておらずホストのDockerを操作できないため。E2Eテストと `test-env/` のセットアップ（`./setup.sh` / `./teardown.sh` 等）はdevcontainerの外（ホスト側）で実施する。

## コマンド

```bash
pnpm install
pnpm run build        # tsc でビルド（distへ出力）
pnpm run typecheck    # 型チェックのみ（--noEmit）。src と test の両方を対象にする
pnpm run dev          # tsc --watch
pnpm test             # vitest run（リグレッションテスト一式を実行）
pnpm run test:e2e     # build後、dist/index.jsを実子プロセスとして起動し実GitLabと疎通確認（自動E2E）
pnpm run lint         # eslint . （型情報を使った検査を含む）
pnpm run lint:fix     # eslint . --fix
pnpm run format       # prettier --write .
pnpm run format:check # prettier --check .
pnpm run spellcheck   # cspell --no-progress . （設定は cspell.json）
pnpm run docs         # TypeDocでAPIドキュメント(HTML)を docs/api に生成（生成物はgit管理外）
pnpm run docs:check   # HTMLを出さずにドキュメント記述漏れだけ検証する
GITLAB_BASE_URL=https://gitlab.example.com GITLAB_TOKEN=glpat-xxxx pnpm start   # dist/index.js を起動
```

`pnpm-workspace.yaml` の `ignoreScripts: true` により `pnpm install` では `prepare` スクリプト（Husky設定）が自動実行されない。`pnpm install` 後、初回のみ `pnpm run prepare` を手動実行してGitフックを有効化すること（詳細は下記「Git hooks」）。

### Git hooks（Husky + lint-staged）

コミット時、ステージされた `*.ts` に `eslint --fix` → `prettier --write` を自動適用する（lint-staged。設定は `package.json` の `lint-staged` フィールド）。フック本体は `.husky/pre-commit`。

`core.hooksPath` はリポジトリ全体で1つしか持てないため、このフックはリポジトリ内のどのコミットでも発火する。そのため `.husky/pre-commit` は先頭で2つのガードを行う。(1) ステージされたファイルに `projects/gitlab-mcp-server/` 配下が含まれなければ何もせず通す。(2) `node_modules/.bin/lint-staged` が無い作業ツリー（clone直後や `pnpm install` 前の git worktree）では警告を出してスキップする。どちらもコミットを失敗させない。このガードが無いと、このプロジェクトと無関係な変更や別worktreeからのコミットが全て止まる。

このプロジェクトはmonorepo（`claude-learn`）のサブディレクトリにあり `.git` はリポジトリルートにしか存在しないため、Husky標準の `npx husky init` / `husky` コマンド（cwd直下の `.git` しか認識しない）はそのままでは使えない。`scripts/install-husky.mjs` が `git rev-parse --show-toplevel` でリポジトリルートを求め、そこへ `chdir` した上でこのプロジェクト配下 `.husky` を対象に `core.hooksPath` を設定する（`package.json` の `prepare` はこのスクリプトを指す）。`core.hooksPath` はGitのローカル設定でリポジトリには含まれないため、clone後の環境では毎回 `pnpm run prepare` の実行が必要。

### Lint / Format

ESLint（flat config, `eslint.config.js`）は `typescript-eslint` の `recommendedTypeChecked` をベースに、`tsconfig.json` と `tsconfig.test.json` の両方を型情報のソースとして使う。テストコード（`test/**/*.ts`）はモック・フィクスチャで `any` や型アサーションを扱うことが多いため、`no-unsafe-*` 系など一部ルールを緩めている。フォーマットはPrettier（`.prettierrc.json`）で、既存コードに合わせてダブルクォート・セミコロンあり。新規コードを追加したら `pnpm run lint` と `pnpm run format:check` を通すこと。

`src/**/*.ts` には `eslint-plugin-jsdoc`（`flat/recommended-typescript-error`）も適用しており、**exportしたシンボル（クラス・関数・interface・型エイリアス・定数、および interface の各フィールド）にはJSDocが必須**（非exportの内部ヘルパーは対象外）。TypeScriptが型情報を持つため `@param`/`@returns` に型注記は書かない（`jsdoc/no-types` で禁止）。ファイル先頭のモジュールコメントは `@module` ではなく **`@packageDocumentation`** を使うこと（TS環境では `@module` が冗長タグとしてESLintに拒否される上、TypeDocの挙動としても等価）。記述漏れは `pnpm run docs:check` で検出できる。

テスト用のセルフホストGitLab（GitLab CE + GitLab Runner）環境を `test-env/` にDocker Composeで用意している。詳細は `test-env/README.md` を参照。起動は `cd test-env && ./setup.sh`（手動、初回5〜10分）。`pnpm test` のユニットテストはこの環境に依存しないが、`pnpm run test:e2e` の自動E2Eはこの環境（`test-env/.env.test` の接続情報とseedデータ）に依存する。

### ユニットテスト（`test/`、`test/e2e/` を除く）

vitest ^4 を使用。`test/` 配下にドメインごとにテストファイルを置く（`test/config.test.ts`、`test/gitlab/client.test.ts`、`test/tools/*.test.ts`、`test/invariants.test.ts`、`test/transports/http.test.ts`）。fetchは `test/helpers/fetchMock.ts` の `vi.stubGlobal` ベースのモックで差し替える（`test/transports/http.test.ts` だけは実HTTPサーバーを検証するため本物のfetchを使う）。MCPツールの統合テストは `test/helpers/mcp.ts` の `InMemoryTransport` ハーネス経由で `createServer()` に対して行う（同一プロセス内呼び出しのため、実プロセス起動やstdioパイプは通らない）。

- **不変条件を変更する場合は `test/invariants.test.ts` を必ず更新すること**（トークン非漏洩・`console.log`不使用・URLエンコード・破壊的操作の非対応を固定している）
- **新規ツールを追加した場合は `test/invariants.test.ts` の `MINIMAL_ARGS` テーブルと `test/tools/surface.test.ts` のツール名一覧を更新すること**（更新を忘れるとテストが自動的に失敗する設計）
- プロダクションコード側の非exportヘルパー（`issueSummary`等の整形関数、`config.ts`/`client.ts`/`http.ts`の内部関数）はテストのためにexport化しない。公開API（`loadConfig`・`GitLabClient`のpublicメソッド・`tools/call`・実HTTPリクエスト）経由で検証する方針を維持すること

### 自動E2Eテスト（`test/e2e/`）

`vitest.e2e.config.ts` で別実行（`pnpm run test:e2e`。build込みで、`pnpm test` には含まれない）。共通ヘルパーは `test/e2e/helpers/testEnv.ts`（`.env.test`読込、実子プロセス起動、`callTool`/`firstJson`、後始末用の直接GitLab APIリクエスト）に集約している。`dist/index.js` を実子プロセスとして起動し、本物のJSON-RPC + 実HTTPで上記の `test-env/`（実GitLab CE）に対して疎通確認する。接続情報は `test-env/.env.test` から読む。**実行前に `cd test-env && ./setup.sh` でGitLabを起動しておくこと**（未起動・`.env.test`欠落時は明確なエラーメッセージで失敗する。無言でスキップはしない）。config.ts の環境変数読込ミスや起動シーケンスの崩れなど、InMemoryTransport ハーネスでは検出できないプロセス境界の不具合に加え、実GitLab APIとの疎通そのものを検証するのが目的。

- `test/e2e/stdio-process.test.ts`: stdioトランスポートでのプロセス境界の疎通確認（`tools/list`、`gitlab_get_project`等の基本的な読取、トークン誤り・未設定時の起動/呼び出しエラー）
- `test/e2e/read-tools.test.ts`: `stdio-process.test.ts`で未カバーの読取専用ツール（リポジトリツリー・ファイル内容・ブランチ・コミット・コード検索・Issue詳細・MR詳細/diff/コメント一覧・CI/パイプライン一連・グループ一連）を検証する
- `test/e2e/write-tools.test.ts`: 書込系8ツール（create/update/note追加・グループメンバー追加更新）を実際にGitLabへ反映させて検証する。グループメンバー系は `test-env/setup.sh` が用意する `mcp-e2e-member` ユーザー（`GITLAB_TEST_MEMBER_USER_ID`、グループ未所属の状態で用意される）を使う。gitlab-mcp-server自体は削除系ツールを意図的に持たないため、各テストが作った使い捨てのIssue/MR/ブランチ/グループメンバーは、MCPツールではなく `testEnv.ts` の `gitlabCleanup`（直接GitLab APIを叩く）で`afterEach`ごとに後始末し、`test-env/`にゴミが積み上がらないようにしている
- `test/e2e/http-process.test.ts`: `MCP_TRANSPORT=http` で起動した実子プロセスに `StreamableHTTPClientTransport` で接続し、`/healthz`・`tools/list`・読取・書込・`MCP_HTTP_AUTH_TOKEN` による401を検証する。`MCP_HTTP_PORT` は `config.ts` が0以下を弾くため `test/transports/http.test.ts` のような `port: 0` が使えず、`testEnv.ts` の `findFreePort()` で空きポートを先に確保して渡す。起動待ちは固定sleepではなく `/healthz` のポーリング（`startRealHttpProcess()`）
- `test/e2e/coverage.test.ts`: **E2Eの網羅性ガード**。`tools/list` の全ツール名と、`test/e2e/*.test.ts` 内の `callTool(...)` 呼び出しから静的に抽出したツール名が集合として一致することを検証する。**新規ツールを追加してE2Eに正常系呼び出しを書き忘れると、このテストが自動的に失敗する**（`test/invariants.test.ts` の `MINIMAL_ARGS` / `test/tools/surface.test.ts` のツール名一覧と同じ「忘れたら落ちる」設計）。ツール総数をハードコードしている箇所はE2E側には無い（厳密な件数・名前の固定は `test/tools/surface.test.ts` の担当）
- アサーションは `test-env/setup.sh` が投入するseedデータ（グループ `mcp-test`、プロジェクト `mcp-test/demo`、Issue 3件、`.gitlab-ci.yml`によるパイプライン（成功ジョブ・失敗ジョブ含む）、`feature/demo`→`main`のMR、メンバーテスト用ユーザー`mcp-e2e-member`等）に依存する。**seedデータを変更したらこれらのテストも合わせて更新すること**
- `gitlab_search_code` は `project` を省略するとインスタンス全体検索になり、Elasticsearchを使わないGitLab CE（test-env）では400エラーになる。e2eテストでは `project` を明示的に渡すこと
- E2E中に作業ブランチへコミットする場合は、コミットメッセージに `[skip ci]` を付けること。付けないとseedの `.gitlab-ci.yml` が発火してジョブが実際に走る。ただし `[skip ci]` でもGitLabは status=`skipped` のパイプライン記録を作り、ブランチやMRを消してもこれだけが残るため、後始末では `testEnv.ts` の `cleanupPipelinesForRefs()` でブランチ ref と `refs/merge-requests/<iid>/head` のパイプラインも削除する
- `test-env/setup.sh` は冪等に作られているが、Issue/CIファイル/ブランチ+MRの投入は「プロジェクトを新規作成した場合のみ」行う設計（既存プロジェクトに対して無条件で再実行するとIssueが複製され、`.gitlab-ci.yml`追加が400エラーになるため）。seedデータの内容自体を変えたい場合は、一度 `./teardown.sh` してから `./setup.sh` を実行し直すこと

## アーキテクチャ

### レイヤー構成

```text
src/index.ts           起動エントリポイント。設定読込 → サーバ生成 → トランスポート起動
src/config.ts          環境変数の読込・検証（loadConfig）。不正時はConfigErrorで即座に落とす
src/server.ts          McpServerを生成し、5つのtoolsモジュールの register関数を呼ぶ
src/gitlab/client.ts   GitLabClient: fetchラッパー、認証ヘッダ付与、ページング処理、エラー変換
src/gitlab/types.ts    GitLab API レスポンスの型定義
src/tools/*.ts         ツール実装（repository/issues/mergeRequests/pipelines/groups）。ドメインごとに1ファイル
src/tools/shared.ts    ツール共通のヘルパー（エラーハンドリング、ページング引数、切り詰め等）
src/transports/        stdio.ts と http.ts。config.mcpTransport で切替
```

### ツール登録の型

各 `registerXxxTools(server, client, config?)` 関数が `src/server.ts` から呼ばれ、`server.registerTool(name, schema, handler)` でMCPツールを登録する。書込系ツール（create/update系）は各ファイルの最後にまとめられており、`config.gitlabReadOnly` が true の場合は登録関数内で早期returnして一切登録しない（`tools/list` にも現れない）。新しいツールを追加する際はこのパターン（読取系→readOnlyチェック→書込系）を踏襲する。

### エラーハンドリング

- `GitLabApiError`（GitLab APIがエラーを返した場合）と `ToolInputError`（引数不備など到達前のエラー）を `src/gitlab/client.ts` で定義
- 全ツールハンドラは `shared.ts` の `withErrorHandling` でラップし、これら2種は利用者向けメッセージとしてそのまま返し、想定外エラーは一般化したメッセージに変換してスタックは出さない
- `GitLabApiError` のメッセージには `PRIVATE-TOKEN` ヘッダの値を絶対に含めない設計になっている。この不変条件は維持すること

### ページング

一覧系エンドポイントは `GitLabClient.getPaged<T>()` を使う。GitLabのレスポンスヘッダ（`x-page`, `x-total` 等）からページ情報を組み立て、`shared.ts` の `pagedJsonResult()` で `items` + `pageInfo` 形式に統一して返す。

### レスポンスの切り詰め

ファイル内容・差分・ジョブログなど肥大化しやすい応答は `truncateUtf8()`（`gitlab/client.ts`）で切り詰める。ジョブログは失敗原因が末尾に出るため既定で `"tail"`（末尾保持）、ファイル内容は既定で `"head"`。切り詰め有無は `shared.ts` の `truncationNotice()` でレスポンスに明記する。

### デフォルトプロジェクト解決

`GitLabClient.resolveProject(project)` が、ツール引数 `project` 省略時に `config.gitlabDefaultProject`（環境変数 `GITLAB_DEFAULT_PROJECT`）にフォールバックする。どちらもなければ `ToolInputError`。グループ系ツールの `group` 引数には同様のデフォルト解決が無く、常に必須（`shared.ts` の `groupArg`）。

### トランスポート

- **stdio**: `console.log` は絶対に使わない（stdoutはJSON-RPC専用）。ログは全て `console.error`
- **http**: Streamable HTTP。セッションごとに独立した `McpServer` インスタンスを持ち、`transports` Mapでセッション管理。DNSリバインディング対策として `MCP_HTTP_ALLOWED_ORIGINS` によるOrigin検証があり、Originヘッダ付きリクエストは許可リストに無ければ拒否する

## 実装時の注意

- プロジェクトID・グループID・ファイルパスをURLパスに埋め込む際は `GitLabClient.encodeId()` / `GitLabClient.encodePathSegment()` を必ず使う（インジェクション対策）
- マージの実行（`PUT .../merge`）やIssue/MRの削除、グループメンバーの削除など、破壊的度合いが高い操作はスコープ外（意図的に未実装）
- 新規ツールを追加したら `README.md` のツール一覧表も更新する
- 新規にexportを追加したらJSDocを付ける（`pnpm run docs:check` が記述漏れを検出する）
