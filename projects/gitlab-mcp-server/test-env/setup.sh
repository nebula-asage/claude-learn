#!/usr/bin/env bash
# gitlab-mcp-server の動作確認用に、セルフホストGitLab（CE + Runner）をDockerで起動し、
# PAT発行・Runner登録・テストデータ投入までを自動で行う。ローカル検証専用。
#
# 冪等性: 既に起動済みのGitLabに対して再実行しても、PATは作り直され、
# テストデータ（グループ/プロジェクト/Issue等）は既存のものがあればスキップまたは再利用する。
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

HOST_URL="http://localhost:8929"
INTERNAL_URL="http://gitlab:8929"
NETWORK_NAME="gitlab-mcp-test"
GROUP_PATH="mcp-test"
PROJECT_PATH="demo"
ENV_FILE=".env.test"

log() { echo "[test-env] $*" >&2; }

log "GitLabコンテナを起動します（初回はイメージのpullでも時間がかかります）..."
# runnerはGitLabのヘルスチェック完了を確認してから起動する（後述）。
# GitLab CEは初回起動時に内部サービスの起動順序で一時的に再起動することがあるため、
# ここではgitlabコンテナだけを起動し、docker composeの同期的なヘルス待ちには頼らない。
docker compose up -d gitlab

log "GitLabの起動を待っています（初回は5〜10分程度かかります。初回起動中に一時的にコンテナが再起動することがありますが想定内です。タイムアウトは20分）..."
# 注: /-/health 等の監視用エンドポイントはデフォルトでIPホワイトリスト制限
# （monitoring_whitelist、既定 127.0.0.0/8）があり、環境によってはホストから
# コンテナへのポートフォワーディング経由だと送信元IPがこの範囲に収まらず404になることがある。
# サインインページはこの制限を受けないため、起動確認にはこちらを使う。
elapsed=0
timeout=1200
until curl -fsS "${HOST_URL}/users/sign_in" >/dev/null 2>&1; do
  if [ "$elapsed" -ge "$timeout" ]; then
    log "エラー: ${timeout}秒待ってもGitLabが起動しませんでした。'docker compose logs gitlab' を確認してください。"
    exit 1
  fi
  sleep 10
  elapsed=$((elapsed + 10))
  log "  ...待機中（${elapsed}秒経過）"
done
log "GitLabが起動しました。"

log "Runnerコンテナを起動します..."
docker compose up -d runner

log "PATを発行します..."
PAT_OUTPUT=$(docker compose exec -T gitlab gitlab-rails runner /scripts/create-pat.rb)
TOKEN=$(echo "$PAT_OUTPUT" | grep -oP '(?<=PAT_CREATED=)\S+')
if [ -z "$TOKEN" ]; then
  log "エラー: PATの発行に失敗しました。出力: $PAT_OUTPUT"
  exit 1
fi
log "PATを発行しました。"

api() {
  # api <method> <path> [jsonボディ]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "${HOST_URL}/api/v4${path}" \
      -H "PRIVATE-TOKEN: ${TOKEN}" -H "Content-Type: application/json" -d "$body"
  else
    curl -fsS -X "$method" "${HOST_URL}/api/v4${path}" -H "PRIVATE-TOKEN: ${TOKEN}"
  fi
}

log "Runnerを登録します..."
RUNNER_TOKEN=$(api POST "/user/runners" \
  "{\"runner_type\":\"instance_type\",\"description\":\"mcp-test-runner\",\"run_untagged\":true}" \
  | jq -r '.token')
if [ -z "$RUNNER_TOKEN" ] || [ "$RUNNER_TOKEN" = "null" ]; then
  log "エラー: Runner認証トークンの取得に失敗しました。"
  exit 1
fi

# 既に登録済みなら一旦config.tomlをクリアしてから登録し直す（冪等化）
docker compose exec -T runner sh -c 'rm -f /etc/gitlab-runner/config.toml'
docker compose exec -T runner gitlab-runner register --non-interactive \
  --url "${INTERNAL_URL}" \
  --token "${RUNNER_TOKEN}" \
  --executor docker \
  --docker-image "alpine:3" \
  --docker-network-mode "${NETWORK_NAME}" \
  --docker-volumes "/var/run/docker.sock:/var/run/docker.sock"

# ジョブに渡されるリポジトリURLはexternal_url(http://localhost:8929)ベースになり、
# Runnerコンテナからは解決できないため、内部ネットワークのURLで上書きする。
log "Runnerのclone_urlを内部ネットワーク向けに上書きします..."
docker compose exec -T runner sh -c \
  "sed -i -E 's#^(\\s*)url = \"${INTERNAL_URL}\"#&\\n\\1clone_url = \"${INTERNAL_URL}\"#' /etc/gitlab-runner/config.toml"
docker compose restart runner >/dev/null
log "Runnerの登録が完了しました。"

log "テストデータを投入します..."

# グループ（既にあれば取得）
GROUP_ID=$(api GET "/groups/${GROUP_PATH}" 2>/dev/null | jq -r '.id // empty' || true)
if [ -z "$GROUP_ID" ]; then
  GROUP_ID=$(api POST "/groups" "{\"name\":\"${GROUP_PATH}\",\"path\":\"${GROUP_PATH}\",\"visibility\":\"public\"}" | jq -r '.id')
fi
log "  グループID: ${GROUP_ID}"

# プロジェクト（既にあれば取得）
PROJECT_FULL_PATH="${GROUP_PATH}%2F${PROJECT_PATH}"
PROJECT_JSON=$(api GET "/projects/${PROJECT_FULL_PATH}" 2>/dev/null || true)
PROJECT_ID=$(echo "$PROJECT_JSON" | jq -r '.id // empty' 2>/dev/null || true)
PROJECT_IS_NEW=false
if [ -z "$PROJECT_ID" ]; then
  PROJECT_JSON=$(api POST "/projects" \
    "{\"name\":\"${PROJECT_PATH}\",\"namespace_id\":${GROUP_ID},\"initialize_with_readme\":true,\"default_branch\":\"main\",\"visibility\":\"public\"}")
  PROJECT_ID=$(echo "$PROJECT_JSON" | jq -r '.id')
  PROJECT_IS_NEW=true
  # プロジェクト作成直後はGitalyでのリポジトリ初期化が非同期のため少し待つ
  sleep 5
fi
log "  プロジェクトID: ${PROJECT_ID} (${GROUP_PATH}/${PROJECT_PATH})"

# 以下のIssue/CIファイル/ブランチ+MRの投入は、プロジェクトを新規作成した場合のみ行う。
# 既存プロジェクトに対して無条件で再実行すると、Issueが呼ぶたびに複製され、
# .gitlab-ci.ymlの追加は「同名ファイルが既に存在する」で400エラーになるため。
if [ "$PROJECT_IS_NEW" = "true" ]; then
  # ラベル
  api POST "/projects/${PROJECT_ID}/labels" '{"name":"bug","color":"#d9534f"}' >/dev/null 2>&1 || true
  api POST "/projects/${PROJECT_ID}/labels" '{"name":"enhancement","color":"#5bc0de"}' >/dev/null 2>&1 || true

  # Issue（open x2、うち1件にコメント / closed x1）
  ISSUE1=$(api POST "/projects/${PROJECT_ID}/issues" '{"title":"サンプルIssue: バグ報告","description":"検証用のopenなIssueです。","labels":"bug"}' | jq -r '.iid')
  api POST "/projects/${PROJECT_ID}/issues/${ISSUE1}/notes" '{"body":"検証用コメントです。"}' >/dev/null
  api POST "/projects/${PROJECT_ID}/issues" '{"title":"サンプルIssue: 機能要望","description":"検証用のopenなIssueです。","labels":"enhancement"}' >/dev/null
  ISSUE3=$(api POST "/projects/${PROJECT_ID}/issues" '{"title":"サンプルIssue: 完了済みタスク","description":"検証用のclosedなIssueです。"}' | jq -r '.iid')
  api PUT "/projects/${PROJECT_ID}/issues/${ISSUE3}" '{"state_event":"close"}' >/dev/null
  log "  Issueを3件作成しました。"

  # .gitlab-ci.yml をmainに追加（Runner登録済みなのでパイプラインが自動実行される）
  CI_CONTENT=$(base64 -w0 seed/gitlab-ci.yml)
  api POST "/projects/${PROJECT_ID}/repository/commits" \
    "{\"branch\":\"main\",\"commit_message\":\"Add .gitlab-ci.yml for testing\",\"actions\":[{\"action\":\"create\",\"file_path\":\".gitlab-ci.yml\",\"content\":\"${CI_CONTENT}\",\"encoding\":\"base64\"}]}" >/dev/null
  log "  .gitlab-ci.yml を追加しました（パイプラインが起動します）。"

  # ブランチ + MR
  api POST "/projects/${PROJECT_ID}/repository/branches" "{\"branch\":\"feature/demo\",\"ref\":\"main\"}" >/dev/null
  UPDATED_CONTENT=$(printf '# demo\n\n検証用に変更したREADMEです。\n' | base64 -w0)
  api POST "/projects/${PROJECT_ID}/repository/commits" \
    "{\"branch\":\"feature/demo\",\"commit_message\":\"Update README for demo MR\",\"actions\":[{\"action\":\"update\",\"file_path\":\"README.md\",\"content\":\"${UPDATED_CONTENT}\",\"encoding\":\"base64\"}]}" >/dev/null
  api POST "/projects/${PROJECT_ID}/merge_requests" \
    '{"source_branch":"feature/demo","target_branch":"main","title":"Demo MR: READMEを更新","description":"検証用のマージリクエストです。"}' >/dev/null
  log "  ブランチ feature/demo とマージリクエストを作成しました。"
else
  log "  プロジェクトは既存のため、Issue/CIファイル/ブランチ+MRの投入をスキップします。"
fi

# グループメンバー管理系ツール（gitlab_add_group_member / gitlab_update_group_member）の
# 検証用に、グループにまだ所属していない状態のユーザーを1人用意しておく。
MEMBER_USERNAME="mcp-e2e-member"
MEMBER_USER_ID=$(api GET "/users?username=${MEMBER_USERNAME}" 2>/dev/null | jq -r '.[0].id // empty' || true)
if [ -z "$MEMBER_USER_ID" ]; then
  # GitLabのパスワード強度チェック（辞書語の組み合わせ禁止）に引っかからないよう、
  # 意味を持たない文字列にしている。
  MEMBER_USER_ID=$(api POST "/users" \
    "{\"username\":\"${MEMBER_USERNAME}\",\"name\":\"MCP E2E Member\",\"email\":\"${MEMBER_USERNAME}@example.invalid\",\"password\":\"qX7!vR2z-Kt9#mN4wL\",\"skip_confirmation\":true}" \
    | jq -r '.id')
fi
# 冪等性のため、既にグループメンバーになっていたら外しておく（add系テストが「新規追加」を検証できるように）。
api DELETE "/groups/${GROUP_ID}/members/${MEMBER_USER_ID}" >/dev/null 2>&1 || true
log "  グループメンバーテスト用ユーザーを用意しました: ${MEMBER_USERNAME} (ID: ${MEMBER_USER_ID})"

if [ "$PROJECT_IS_NEW" = "true" ]; then
  log "パイプラインの完了を待っています（最大10分）..."
  elapsed=0
  timeout=600
  pipeline_status=""
  while [ "$elapsed" -lt "$timeout" ]; do
    pipeline_status=$(api GET "/projects/${PROJECT_ID}/pipelines?ref=main&order_by=id&sort=desc&per_page=1" | jq -r '.[0].status // empty')
    case "$pipeline_status" in
      success|failed) break ;;
    esac
    sleep 10
    elapsed=$((elapsed + 10))
  done
  log "  パイプラインステータス: ${pipeline_status:-不明（タイムアウト）}"
fi

cat > "$ENV_FILE" <<EOF
# test-env/setup.sh が生成した接続情報。gitignore対象。ローカル検証専用のためコミットしないこと。
GITLAB_BASE_URL=${HOST_URL}
GITLAB_BASE_URL_INTERNAL=${INTERNAL_URL}
GITLAB_TOKEN=${TOKEN}
GITLAB_DEFAULT_PROJECT=${GROUP_PATH}/${PROJECT_PATH}
GITLAB_TEST_MEMBER_USER_ID=${MEMBER_USER_ID}
EOF

log ""
log "=== セットアップ完了 ==="
log "ホストからのURL:       ${HOST_URL}"
log "コンテナからのURL:     ${INTERNAL_URL}（--network ${NETWORK_NAME} で参加）"
log "root ログイン:         root / Xk9vQ2mBt8pLwZr4!"
log "テスト用PAT:           ${TOKEN}（scope: api, 有効期限365日）"
log "テストプロジェクト:     ${GROUP_PATH}/${PROJECT_PATH}"
log "グループメンバーテスト用ユーザー: ${MEMBER_USERNAME} (ID: ${MEMBER_USER_ID})"
log "接続情報を ${ENV_FILE} に書き出しました。"
log "片付ける場合は ./teardown.sh を実行してください。"
