# gitlab-mcp-server 動作確認用テスト環境

`gitlab-mcp-server` を実際のGitLab APIに対して動作確認するための、セルフホストGitLab（GitLab CE + GitLab Runner）をDockerで構築する手順。**ローカル検証専用**であり、本番運用向けの設定ではない。

## 前提条件（リソース）

- メモリ: GitLab CEは最低4GB、実用上8GB程度の空きRAMを推奨する。WSL2環境では `%UserProfile%\.wslconfig` の `memory=` 設定を確認すること
- ディスク: named volume込みで10GB以上の空き容量を見込む
- 初回起動は**5〜10分**かかる（イメージのpullを含めるとさらに時間がかかる）

## 使い方

```bash
cd test-env
./setup.sh
```

`setup.sh` は冪等に作られており、以下を自動で行う:

1. `docker compose up -d` でGitLab CE + GitLab Runnerを起動
2. GitLabの起動待ち（ヘルスチェック、最大20分）
3. rootユーザーに固定値のPAT（scope: `api`、有効期限365日）を発行
4. GitLab Runner（instance runner、docker executor）を登録
   - ジョブに渡されるリポジトリURLが `external_url`（ホスト向けURL）ベースになりRunnerコンテナから解決できない問題を避けるため、`clone_url` を内部ネットワークのURL（`http://gitlab:8929`）に上書きする
5. テストデータを投入
   - グループ `mcp-test` / プロジェクト `mcp-test/demo`
   - ラベル（`bug`, `enhancement`）
   - Issue 3件（open×2、うち1件にコメント / closed×1）
   - `.gitlab-ci.yml`（`seed/gitlab-ci.yml`）をmainに追加 → パイプラインが自動実行される（成功ジョブ・失敗ジョブの両方を含む）
   - ブランチ `feature/demo` と、mainへのマージリクエスト1件
   - グループメンバー管理系ツール（`gitlab_add_group_member`等）検証用のユーザー `mcp-e2e-member`（`mcp-test`グループには未所属の状態で用意する）
6. `.env.test` に接続情報を書き出す

完了すると、以下のような接続情報が表示される（`.env.test` にも保存される）。

```
GITLAB_BASE_URL=http://localhost:8929           # ホストから使う場合
GITLAB_BASE_URL_INTERNAL=http://gitlab:8929      # gitlab-mcp-serverコンテナから使う場合
GITLAB_TOKEN=glpat-mcptestonly0000000000
GITLAB_DEFAULT_PROJECT=mcp-test/demo
GITLAB_TEST_MEMBER_USER_ID=<mcp-e2e-memberのユーザーID>
```

root のログイン情報: `root` / `Xk9vQ2mBt8pLwZr4!`（`http://localhost:8929` のWeb UIから確認可能）。

## gitlab-mcp-server をこのテスト環境に接続する

### ホストで実行する場合

```bash
cd ..
source test-env/.env.test
pnpm start
```

### Dockerコンテナから接続する場合

テスト環境のDockerネットワーク（`gitlab-mcp-test`）に参加させ、内部URLを使う。

```bash
cd ..
docker run -i --rm --network gitlab-mcp-test \
  -e GITLAB_BASE_URL=http://gitlab:8929 \
  -e GITLAB_TOKEN=<test-env/.env.testのGITLAB_TOKEN> \
  gitlab-mcp-server
```

## 片付け

```bash
cd test-env
./teardown.sh
```

コンテナ・ネットワーク・named volume（GitLabのデータを含む）を全て削除する。確認プロンプトが出る。

## 注意事項

- `.env.test` と発行されるPAT、および `mcp-e2e-member` ユーザーの固定パスワードはローカル検証専用の固定値。**実際のGitLabに対しては絶対に使わない**こと
- `.env.test` は `.gitignore` で除外されている（コミットしないこと）
- GitLab Runnerの docker executor はホストの `/var/run/docker.sock` をマウントする。これはホストへの実質root相当のアクセスを与えるため、この test-env に限定した構成であることを理解した上で使うこと
- `docker-compose.yml` の GitLab CE イメージタグは `latest` ではなく固定バージョンを使っている。更新する場合は明示的にタグを変更すること
