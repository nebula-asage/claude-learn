---
name: devcontainer-rockylinux9-ja
description: Rocky Linux 9ベース・ロケール日本語(ja_JP.UTF-8)・タイムゾーンAsia/Tokyoのdevcontainer環境を配置するときに使う。「Rocky Linuxのdevcontainer作って」「RockyLinux9のコンテナ環境用意して」「このプロジェクト用にRockyLinux9の開発コンテナを作って」など、このリポジトリでRockyLinux9/日本語ロケール/東京タイムゾーンのdevcontainerを新規作成・再作成したい場合にトリガーする。Ubuntu版が欲しい場合はdevcontainer-ubuntu-jaスキルを使うこと。汎用的な他OS・他ロケール向けdevcontainerの相談には使わない。
---

# devcontainer-rockylinux9-ja

Rocky Linux 9 / `ja_JP.UTF-8` / `Asia/Tokyo` 固定構成の devcontainer 一式（`Dockerfile` + `devcontainer.json`）を配置するスキル。[[devcontainer-ubuntu-ja]] のRocky Linux 9版で、パッケージマネージャ（dnf）とロケール導入方法（glibc-langpack-ja、locale-genは不要）のみディストリビューション差分に合わせて調整している。他OS・他ロケールへの一般化は行わない。

## 手順

1. **配置先を確認する**
   - デフォルトはリポジトリルート直下の `.devcontainer/`（リポジトリ全体の開発環境）。
   - ユーザーが特定のプロジェクト（例: `projects/<name>/`）向けと言っている場合は、そのディレクトリ直下の `.devcontainer/` に配置する。
   - 既に `.devcontainer/` が存在する場合は上書きしてよいか必ず確認する。

2. **テンプレートをコピーする**
   - `.claude/skills/devcontainer-rockylinux9-ja/templates/Dockerfile` → `<配置先>/.devcontainer/Dockerfile`
   - `.claude/skills/devcontainer-rockylinux9-ja/templates/devcontainer.json` → `<配置先>/.devcontainer/devcontainer.json`

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
   - dnfパッケージの場合: `bash-completion` が導入済みであれば、パッケージが `/usr/share/bash-completion/completions/` 等に配置する補完スクリプトはインストールするだけで自動的に有効になる（追加作業は基本的に不要）。
   - 単体バイナリ導入やnpm/pip/go installなどdnf以外の方法で導入する場合: そのプログラムが `<コマンド> completion bash` のようなサブコマンド／`--completion bash` オプションを持つか確認し、持っていれば `Dockerfile` の `USER $USERNAME` より前（root権限）で
     ```
     RUN <コマンド> completion bash > /etc/bash_completion.d/<コマンド>
     ```
     のように生成物を配置する。
   - 対応方法が不明なツールは、公式ドキュメントを確認するか、ユーザーに確認してから追記する。

## 固定構成の内容（変更しない前提）

- ベースイメージ: `rockylinux/rockylinux:9`（Docker公式イメージではなく、Rocky Linux公式のイメージを使う）
- ロケール: `ja_JP.UTF-8`（`LANG`/`LANGUAGE`/`LC_ALL` すべて設定。`glibc-langpack-ja` を導入すればRHEL系ではlocale-gen不要で使えるようになる）
- タイムゾーン: `Asia/Tokyo`
- 非rootユーザー `vscode`（UID/GID 1000、パスワードなしsudo）。ベースイメージに同じUID/GIDが既にある場合はリネームして再利用する（`useradd`の重複エラー回避）
- 導入パッケージ: `glibc-langpack-ja` `tzdata` `sudo` `git` `curl` `ca-certificates` `bash-completion`（すべて必須。ビルドツールチェーン（`gcc`/`gcc-c++`/`make`）はこのスキルの対象外なので含めない。必要な場合は配置後の`Dockerfile`にユーザー自身が追記する。`bash-completion` を外さない）

言語ランタイム（Node/Python/Goなど）はこのスキルの対象外。プロジェクト固有の依存関係が必要な場合は、配置後の `Dockerfile` にユーザー自身が追記する。ただし追記したプログラムがbash補完に対応する場合は、上記手順6に従って有効化すること。
