# test-env専用: rootユーザーに固定値のパーソナルアクセストークンを発行する。
# 再実行しても同名の既存トークンを作り直すだけなので冪等。
# ローカル検証専用の手順であり、本番のGitLabに対しては絶対に使わないこと。
#
# 実行方法: docker compose exec -T gitlab gitlab-rails runner /scripts/create-pat.rb

TOKEN_NAME = 'mcp-test-token'.freeze
TOKEN_VALUE = 'glpat-mcptestonly0000000000'.freeze

user = User.find_by_username('root')
raise 'root ユーザーが見つかりません。GitLabの初期化が完了していない可能性があります。' unless user

# 冪等にするため、同名の既存トークンは作り直す
PersonalAccessToken.where(user_id: user.id, name: TOKEN_NAME).delete_all

token = user.personal_access_tokens.create!(
  name: TOKEN_NAME,
  scopes: %w[api],
  expires_at: 365.days.from_now,
)
token.set_token(TOKEN_VALUE)
token.save!

puts "PAT_CREATED=#{TOKEN_VALUE}"
