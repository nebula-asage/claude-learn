# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

セルフホストGitLabをAPI経由で操作するMCP（Model Context Protocol）サーバ。パーソナルアクセストークン（PAT）で認証し、リポジトリ参照・Issue・マージリクエスト・CI/パイプラインの4領域をツールとして提供する。TypeScript製。依存は `@modelcontextprotocol/sdk` と `zod` のみで、GitLab APIはNode組み込みの `fetch` で直接叩く（GitLab用SDKは使わない）。

## コマンド

```bash
pnpm install
pnpm run build       # tsc でビルド（distへ出力）
pnpm run typecheck    # 型チェックのみ（--noEmit）
pnpm run dev          # tsc --watch
GITLAB_BASE_URL=https://gitlab.example.com GITLAB_TOKEN=glpat-xxxx pnpm start   # dist/index.js を起動
```

テスト用のセルフホストGitLab（GitLab CE + GitLab Runner）環境を `test-env/` にDocker Composeで用意している。詳細は `test-env/README.md` を参照。ユニットテストのフレームワークは未導入。

## アーキテクチャ

### レイヤー構成

```
src/index.ts           起動エントリポイント。設定読込 → サーバ生成 → トランスポート起動
src/config.ts          環境変数の読込・検証（loadConfig）。不正時はConfigErrorで即座に落とす
src/server.ts          McpServerを生成し、4つのtoolsモジュールの register関数を呼ぶ
src/gitlab/client.ts   GitLabClient: fetchラッパー、認証ヘッダ付与、ページング処理、エラー変換
src/gitlab/types.ts    GitLab API レスポンスの型定義
src/tools/*.ts         ツール実装（repository/issues/mergeRequests/pipelines）。ドメインごとに1ファイル
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

`GitLabClient.resolveProject(project)` が、ツール引数 `project` 省略時に `config.gitlabDefaultProject`（環境変数 `GITLAB_DEFAULT_PROJECT`）にフォールバックする。どちらもなければ `ToolInputError`。

### トランスポート

- **stdio**: `console.log` は絶対に使わない（stdoutはJSON-RPC専用）。ログは全て `console.error`
- **http**: Streamable HTTP。セッションごとに独立した `McpServer` インスタンスを持ち、`transports` Mapでセッション管理。DNSリバインディング対策として `MCP_HTTP_ALLOWED_ORIGINS` によるOrigin検証があり、Originヘッダ付きリクエストは許可リストに無ければ拒否する

## 実装時の注意

- プロジェクトIDやファイルパスをURLパスに埋め込む際は `GitLabClient.encodeId()` / `GitLabClient.encodePathSegment()` を必ず使う（インジェクション対策）
- マージの実行（`PUT .../merge`）やIssue/MRの削除など、破壊的度合いが高い操作はスコープ外（意図的に未実装）
- 新規ツールを追加したら `README.md` のツール一覧表も更新する
