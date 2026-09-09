---
name: devcontainer-rockylinux9-ja
description: Rocky Linux 9ベース・ロケール日本語(ja_JP.UTF-8)・タイムゾーンAsia/Tokyoのdevcontainer環境を配置するときに使う。Node.jsとPlaywright(Chromium、RHEL系向けに手動で洗い出したOS依存ライブラリ込み)を標準搭載し、ブラウザ自動操作やHTML成果物のスクリーンショット確認がコンテナ内で追加導入なしに行える。「Rocky Linuxのdevcontainer作って」「RockyLinux9のコンテナ環境用意して」「このプロジェクト用にRockyLinux9の開発コンテナを作って」「devcontainerにPlaywrightも入れて」など、このリポジトリでRockyLinux9/日本語ロケール/東京タイムゾーンのdevcontainerを新規作成・再作成したい場合にトリガーする。Ubuntu版のdevcontainerが欲しい場合はこのスキルの対象外。汎用的な他OS・他ロケール向けdevcontainerの相談には使わない。
---

# devcontainer-rockylinux9-ja

Rocky Linux 9 / `ja_JP.UTF-8` / `Asia/Tokyo` 固定構成の devcontainer 一式（`Dockerfile` + `devcontainer.json`）を配置するスキル。パッケージマネージャ（dnf）とロケール導入方法（glibc-langpack-ja、locale-genは不要）をRHEL系ディストリビューションに合わせて固定している。他OS・他ロケールへの一般化は行わない。

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
   - 特定プロジェクト配下（`projects/<name>/`）に置く場合は、**そのプロジェクトディレクトリだけをマウントしてはいけない**。このリポジトリは `.git` がリポジトリルートにしかないmonorepoのため、サブディレクトリだけをbind mountすると `.git` が一切見えず、コンテナ内でgitリポジトリとして認識されない（`git status` が `fatal: not a git repository` になり、VS CodeのSource Controlパネルにも何も表示されない）。代わりにリポジトリルート全体をマウントし、`workspaceFolder` だけを対象プロジェクトのサブパスに向ける。
     ```json
     "workspaceMount": "source=${localWorkspaceFolder}/../..,target=/workspace-root,type=bind",
     "workspaceFolder": "/workspace-root/projects/<name>"
     ```
     `${localWorkspaceFolder}` はコンテナ設定ファイルのある場所（`projects/<name>/`）が基準になるため、リポジトリルートまで `../..` で遡る。この相対パス表記はDocker側で正規化されるため、bind mountの `source` にそのまま使える。

5. **動作確認する**
   - `docker build -t <一時タグ> -f <配置先>/.devcontainer/Dockerfile <配置先>` でビルドできることを確認する。
   - `docker run --rm <一時タグ> bash -c 'date; locale; sudo whoami'` を実行し、日本語日時表示・`LANG=ja_JP.UTF-8`・`Asia/Tokyo`・sudo権限が機能していることを確認する。
   - `docker run --rm <一時タグ> bash -ic '_completion_loader git 2>/dev/null; complete -p git'` などでbash補完が有効になっていることも確認する（bash-completionは動的ロード方式のため、`type _git` は実際に補完を試みるまで関数が定義されず誤ってNG判定になる。`_completion_loader` で明示的にロードしてから `complete -p` で登録有無を見るのが確実）。
   - `workspaceMount` / `workspaceFolder` と同じ設定で `docker run --rm -v <source>:<target> -w <workspaceFolder> <一時タグ> git status` を実行し、`fatal: not a git repository` にならないことを確認する（特にプロジェクト配下に置く場合は必須）。
   - nvmは`~/.bashrc`の**末尾**にPATH設定を追記するため、非対話の`bash -c`では`node`が届かない。検証時は`bash -c '. "$NVM_DIR/nvm.sh" && ...'`のように明示的にnvmをsourceするか、`bash -ic '...'`（対話モード）を使う。
   - `docker run --rm <一時タグ> bash -c '. "$NVM_DIR/nvm.sh" && node -v && npx --no-install playwright --version'` でNode.js/Playwrightが導入されていることを確認する。
   - Chromiumが実際に起動できるかも確認する。Playwrightはnpmグローバルインストールのため、`NODE_PATH=$(npm root -g)` を明示しないと`require('playwright')`が`MODULE_NOT_FOUND`になる点に注意する。
     ```
     docker run --rm <一時タグ> bash -c '. "$NVM_DIR/nvm.sh" && NODE_PATH=$(npm root -g) node -e "require(\"playwright\").chromium.launch().then(async b=>{await b.close();console.log(\"OK\")})"'
     ```
     **これは特に重要な確認項目。** PlaywrightのOS依存ライブラリはDebian/Ubuntu系のみ自動導入に対応しており、Rocky LinuxではDockerfileに手動で列挙したRPMパッケージ一覧が実際に足りているかがこのコマンドでしか分からない。Playwrightのバージョンが上がって必要な共有ライブラリが増えた場合、ここが`error while loading shared libraries`系のエラーで失敗する。失敗したら`ldd <chrome-headless-shellのパス>`（`$PLAYWRIGHT_BROWSERS_PATH`配下）で不足ライブラリ名を特定し、対応するRPMパッケージ名を探して`Dockerfile`のdnfパッケージ一覧に追加する。
   - 確認用に作った一時イメージは `docker rmi <一時タグ>` で削除する。

6. **（追加要求があった場合）追加プログラムのbash補完を有効化する**
   - ユーザーから追加のプログラム導入を頼まれたら、その都度そのプログラムがbash補完に対応しているか確認し、対応していれば必ず有効化する。
   - dnfパッケージの場合: `bash-completion` が導入済みであれば、パッケージが `/usr/share/bash-completion/completions/` 等に配置する補完スクリプトはインストールするだけで自動的に有効になる（追加作業は基本的に不要）。
   - 単体バイナリ導入やnpm/pip/go installなどdnf以外の方法で導入する場合: そのプログラムが `<コマンド> completion bash` のようなサブコマンド／`--completion bash` オプションを持つか確認し、持っていれば生成物を配置する。配置先はインストール権限に合わせて使い分ける。
     - `Dockerfile` の `USER $USERNAME` より前（root権限）で導入するツールの場合: `RUN <コマンド> completion bash > /etc/bash_completion.d/<コマンド>`
     - `USER $USERNAME` 切り替え後（vscodeユーザー権限）で導入するツールの場合: root権限のディレクトリに書き込めないため、`RUN mkdir -p /home/$USERNAME/.local/share/bash-completion/completions && <コマンド> completion bash > /home/$USERNAME/.local/share/bash-completion/completions/<コマンド>`（bash-completionパッケージがXDG準拠でこのディレクトリも自動的に読む）。Node.js/Playwrightのnpm補完はこの形で実装済み
   - 対応方法が不明なツールは、公式ドキュメントを確認するか、ユーザーに確認してから追記する。

## 固定構成の内容（変更しない前提）

- ベースイメージ: `rockylinux/rockylinux:9`（Docker公式イメージではなく、Rocky Linux公式のイメージを使う）
- ロケール: `ja_JP.UTF-8`（`LANG`/`LANGUAGE`/`LC_ALL` すべて設定。`glibc-langpack-ja` を導入すればRHEL系ではlocale-gen不要で使えるようになる）
- タイムゾーン: `Asia/Tokyo`
- 非rootユーザー `vscode`（UID/GID 1000、パスワードなしsudo）。ベースイメージに同じUID/GIDが既にある場合はリネームして再利用する（`useradd`の重複エラー回避）
- 導入パッケージ: `glibc-langpack-ja` `tzdata` `sudo` `git` `curl` `ca-certificates` `bash-completion` `vim` `less` `jq`（すべて必須。ビルドツールチェーン（`gcc`/`gcc-c++`/`make`）はこのスキルの対象外なので含めない。必要な場合は配置後の`Dockerfile`にユーザー自身が追記する。`bash-completion` を外さない）
- `dnf install` はBuildKitのキャッシュマウント（`RUN --mount=type=cache,target=/var/cache/dnf`）でパッケージキャッシュを永続化する前提。`Dockerfile` 先頭の `# syntax=docker/dockerfile:1` は外さない。追記するRUN命令でパッケージを追加インストールする場合も、同様にキャッシュマウントを使う
- **Node.js（`NODE_MAJOR` ARGで指定、既定24系）とPlaywright（Chromium）を標準搭載する。** これは「言語ランタイムは対象外」という下記の原則に対する明示的な例外で、ブラウザ自動操作・HTML成果物のスクリーンショット確認をコンテナ内で追加導入なしに行えるようにするためのもの。distro提供の`nodejs`パッケージはバージョンが古くPlaywrightの要求(Node20+)を満たさないため、Node.jsはnvmで導入する
  - **PlaywrightのOS依存ライブラリ自動導入(`playwright install --with-deps`)はRocky Linuxで使えない**（Debian/Ubuntu系専用の実装で、apt-get前提のコマンドを呼んで失敗する）。そのため必要なRPMパッケージを`Dockerfile`に手動で列挙している（`nss` `nspr` `nss-util` `atk` `at-spi2-atk` `at-spi2-core` `cups-libs` `libX11` `libXcomposite` `libXdamage` `libXext` `libXfixes` `libXrandr` `libxcb` `libxkbcommon` `mesa-libgbm` `alsa-lib` `pango` `cairo` `dbus-libs`。実機でのldd検証により洗い出した最小構成で、Playwrightのバージョンアップで増える可能性があるため、テンプレート変更時は必ず手順5のChromium起動確認を実施する）
  - CJKフォントは`fonts-noto-cjk`(Debian/Ubuntu名)ではなく`google-noto-sans-cjk-ttc-fonts`（RHEL系のパッケージ名）を使う
  - ブラウザ本体は `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` に固定し、非rootユーザー`vscode`が所有者になるよう`chown`してから`playwright install`を実行する（OS依存ライブラリのdnf導入とブラウザダウンロードを分離しているため）

Node.js以外の言語ランタイム（Python/Goなど）はこのスキルの対象外。プロジェクト固有の依存関係が必要な場合は、配置後の `Dockerfile` にユーザー自身が追記する。ただし追記したプログラムがbash補完に対応する場合は、上記手順6に従って有効化すること。
