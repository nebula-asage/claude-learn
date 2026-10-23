# dev-hub

nginx をリバースプロキシにして、Redmine(+PostgreSQL)・Jenkins・Subversion を1つのポートで公開する Docker Compose 構成。**認証は Redmine のアカウントに一本化**している。

| パス | サービス | 認証 |
| --- | --- | --- |
| `/redmine` | Redmine ([sameersbn/redmine](https://github.com/sameersbn/docker-redmine)) + PostgreSQL | Redmine 自身のログイン画面 |
| `/jenkins` | Jenkins LTS | nginx が Redmine で Basic 認証 → `X-Forwarded-User` で Jenkins に渡す |
| `/svn` | Subversion (Apache mod_dav_svn) | nginx が Redmine で Basic 認証 |

## 起動

```sh
cp .env.example .env     # DB_PASS と REDMINE_SECRET_TOKEN を埋める（コマンドは .env.example 内に記載）
docker compose up -d --build
```

- 初回は Redmine のDBマイグレーションで数分かかる。`http://localhost:8080/redmine/` が開けば完了
- Redmine の初期管理者は `admin` / `admin`。**初回ログイン時にパスワード変更が必須**で、変更するまでは Jenkins / svn にも入れない
- Jenkins は `http://localhost:8080/jenkins/`、svn は `http://localhost:8080/svn/main`（初回起動時に空のリポジトリ `main` を自動作成）

## 認証の仕組み

1. nginx は `/jenkins` と `/svn` へのリクエストごとに `auth_request` で Redmine の `/redmine/users/current.json` に Basic 認証ヘッダを転送して検証する（Redmine の REST API を有効化する設定は `redmine-enable-rest-api` サービスが DB へ投入する）
2. 成功したら Jenkins には認証済みユーザー名を `X-Forwarded-User` で渡す（Reverse Proxy Auth プラグイン。クライアントが送った同名ヘッダは必ず上書きされる）。svn はコミットの作者名として使う
3. Jenkins / svn のコンテナは公開ポートを持たず、nginx 経由でしか到達できない（これが前提。ポートを公開するとヘッダ偽装で認証を迂回できる）

## 制約・注意

- **認可は未連携**。Redmine にログインできるユーザーなら誰でも Jenkins の全操作(`loggedInUsersCanDoAnything`)と svn の全リポジトリの読み書きができる。プロジェクト単位の権限が要る場合は Redmine 付属の `Redmine.pm`（Apache の Perl 認証モジュール）への切り替えが必要
- Basic 認証のため平文でパスワードが流れる。LAN外に出すなら nginx に TLS を追加すること
- ブラウザで Jenkins / svn を開くと Basic 認証のダイアログが出る（Redmine のログイン画面とのセッション共有はしない）
- 設定を変えて `nginx.conf` を編集したら `docker compose up -d --force-recreate nginx` で再作成する（単一ファイルの bind mount は編集でinodeが変わると `restart` では反映されない）
- イメージは公開から7日以上経ったバージョンに固定している。更新するときも同じ基準で選ぶ

## 後片付け

```sh
docker compose down -v   # ボリューム（Redmine/DB/Jenkins/svn のデータ）も削除
```
