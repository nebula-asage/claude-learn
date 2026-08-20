---
name: devcontainer-ubuntu-ja
description: Ubuntu 24.04ベース・ロケール日本語(ja_JP.UTF-8)・タイムゾーンAsia/Tokyoのdevcontainer環境を配置するときに使う。「devcontainer作って」「開発コンテナ環境作って」「このプロジェクト用にコンテナ環境を用意して」など、このリポジトリでUbuntu24.04/日本語ロケール/東京タイムゾーンのdevcontainerを新規作成・再作成したい場合にトリガーする。汎用的な他OS/他ロケール向けdevcontainerの相談には使わない。
---

# devcontainer-ubuntu-ja

Ubuntu 24.04 / `ja_JP.UTF-8` / `Asia/Tokyo` 固定構成の devcontainer 一式（`Dockerfile` + `devcontainer.json`）を配置するスキル。このリポジトリのルートで一度検証済みの構成をテンプレート化したもので、他OS・他ロケールへの一般化は行わない。

## 手順

1. **配置先を確認する**
   - デフォルトはリポジトリルート直下の `.devcontainer/`（リポジトリ全体の開発環境）。
   - ユーザーが特定のプロジェクト（例: `projects/<name>/`）向けと言っている場合は、そのディレクトリ直下の `.devcontainer/` に配置する。
   - 既に `.devcontainer/` が存在する場合は上書きしてよいか必ず確認する。

2. **テンプレートをコピーする**
   - `.claude/skills/devcontainer-ubuntu-ja/templates/Dockerfile` → `<配置先>/.devcontainer/Dockerfile`
   - `.claude/skills/devcontainer-ubuntu-ja/templates/devcontainer.json` → `<配置先>/.devcontainer/devcontainer.json`

3. **`devcontainer.json` の `name` を調整する**
   - `__CONTAINER_NAME__` を配置先ディレクトリ名（リポジトリルートなら親ディレクトリ名、`projects/<name>/` ならそのプロジェクト名）に置き換える。

4. **`workspaceFolder` / `workspaceMount` を配置先に合わせる**
   - リポジトリルートに置く場合はテンプレートのまま（`/workspace` にリポジトリ全体をマウント）でよい。
   - 特定プロジェクト配下に置く場合は、そのプロジェクトディレクトリだけをマウントするよう `workspaceMount` の `source` を調整する（`${localWorkspaceFolder}` はコンテナ設定ファイルのある場所が基準になる点に注意）。

5. **動作確認する**
   - `docker build -t <一時タグ> -f <配置先>/.devcontainer/Dockerfile <配置先>` でビルドできることを確認する。
   - `docker run --rm <一時タグ> bash -c 'date; locale; sudo whoami'` を実行し、日本語日時表示・`LANG=ja_JP.UTF-8`・`Asia/Tokyo`・sudo権限が機能していることを確認する。
   - `docker run --rm <一時タグ> bash -ic '_completion_loader git 2>/dev/null; complete -p git'` などでbash補完が有効になっていることも確認する（bash-completionは動的ロード方式のため、`type _git` は実際に補完を試みるまで関数が定義されず誤ってNG判定になる。`_completion_loader` で明示的にロードしてから `complete -p` で登録有無を見るのが確実）。
   - 確認用に作った一時イメージは `docker rmi <一時タグ>` で削除する。

6. **（追加要求があった場合）追加プログラムのbash補完を有効化する**
   - ユーザーから追加のプログラム導入を頼まれたら、その都度そのプログラムがbash補完に対応しているか確認し、対応していれば必ず有効化する。
   - aptパッケージの場合: `bash-completion` が導入済みであれば、パッケージが `/usr/share/bash-completion/completions/` 等に配置する補完スクリプトはインストールするだけで自動的に有効になる（追加作業は基本的に不要）。
   - 単体バイナリ導入やnpm/pip/go installなどapt以外の方法で導入する場合: そのプログラムが `<コマンド> completion bash` のようなサブコマンド／`--completion bash` オプションを持つか確認し、持っていれば `Dockerfile` の `USER $USERNAME` より前（root権限）で
     ```
     RUN <コマンド> completion bash > /etc/bash_completion.d/<コマンド>
     ```
     のように生成物を配置する。
   - 対応方法が不明なツールは、公式ドキュメントを確認するか、ユーザーに確認してから追記する。

## 固定構成の内容（変更しない前提）

- ベースイメージ: `ubuntu:24.04`
- ロケール: `ja_JP.UTF-8`（`LANG`/`LANGUAGE`/`LC_ALL` すべて設定）
- タイムゾーン: `Asia/Tokyo`
- 非rootユーザー `vscode`（UID/GID 1000、パスワードなしsudo）。ベースイメージに同じUID/GIDが既にある場合はリネームして再利用する（`useradd`の重複エラー回避）
- 導入パッケージ: `locales` `tzdata` `sudo` `git` `curl` `ca-certificates` `build-essential` `bash-completion`（すべて必須。`bash-completion` を外さない）
- `apt-get install` はBuildKitのキャッシュマウント（`RUN --mount=type=cache,target=/var/cache/apt` 等）でパッケージキャッシュを永続化する前提。`Dockerfile` 先頭の `# syntax=docker/dockerfile:1` は外さない。追記するRUN命令でパッケージを追加インストールする場合も、同様にキャッシュマウントを使う

言語ランタイム（Node/Python/Goなど）はこのスキルの対象外。プロジェクト固有の依存関係が必要な場合は、配置後の `Dockerfile` にユーザー自身が追記する。ただし追記したプログラムがbash補完に対応する場合は、上記手順6に従って有効化すること。
