---
name: devcontainer-ubuntu-ja
description: Ubuntu 24.04ベース・ロケール日本語(ja_JP.UTF-8)・タイムゾーンAsia/Tokyoのdevcontainer環境を配置するときに使う。Node.jsとPlaywright(Chromium、OS依存ライブラリ込み)、Python3(apt-get)、just/just-lspを標準搭載し、ブラウザ自動操作やHTML成果物のスクリーンショット確認、Pythonスクリプトの実行、justfileのタスク実行・エディタ連携がコンテナ内で追加導入なしに行える。「devcontainer作って」「開発コンテナ環境作って」「このプロジェクト用にコンテナ環境を用意して」「devcontainerにPlaywrightも入れて」など、このリポジトリでUbuntu24.04/日本語ロケール/東京タイムゾーンのdevcontainerを新規作成・再作成したい場合にトリガーする。汎用的な他OS/他ロケール向けdevcontainerの相談には使わない。
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
   - `node`/`npm`はnvmが`~/.bashrc`の**末尾**にPATH設定を追記する方式のため、非対話の`bash -c`では届かない（Ubuntu標準の`.bashrc`は先頭で「非対話シェルなら即return」するガードがあるが、これとは別に単純に追記位置の問題でPATHが通らない）。検証時は `bash -c '. "$NVM_DIR/nvm.sh" && ...'` のように明示的にnvmをsourceするか、`bash -ic '...'`（対話モード）を使う。
   - `docker run --rm <一時タグ> bash -c '. "$NVM_DIR/nvm.sh" && node -v && npx --no-install playwright --version'` でNode.js/Playwrightが導入されていることを確認する。
   - Chromiumが実際に起動できるかも確認する。Playwrightはnpmグローバルインストールのため、`NODE_PATH=$(npm root -g)` を明示しないと`require('playwright')`が`MODULE_NOT_FOUND`になる点に注意する。
     ```
     docker run --rm <一時タグ> bash -c '. "$NVM_DIR/nvm.sh" && NODE_PATH=$(npm root -g) node -e "require(\"playwright\").chromium.launch().then(async b=>{await b.close();console.log(\"OK\")})"'
     ```
     Dockerのseccomp/AppArmor設定次第ではChromiumのサンドボックスが使えず`Failed to move to new namespace`系のエラーで失敗する環境がある（Docker 29系・WSL2ホストでの検証では素の設定のまま成功した）。失敗した場合は `chromium.launch({args:['--no-sandbox']})` でも試し、成功するなら「devcontainer内でPlaywrightを使う際は環境によって`chromium.launch({ args: ['--no-sandbox'] })` が必要になることがある」という注意点をユーザーへの報告に添える。
   - `docker run --rm <一時タグ> bash -c 'python3 --version && python3 -m venv /tmp/venvtest && /tmp/venvtest/bin/pip --version'` でPython3・venv・pipが導入されていることを確認する。
   - `docker run --rm <一時タグ> bash -c 'just --version'` でjustが導入されていることを確認する。
   - `docker run --rm <一時タグ> bash -ic 'complete -p just'` でjustのbash補完（`/etc/bash_completion.d/just`）が有効になっていることを確認する。**他のツールと違い`_completion_loader just`を明示的に呼び出してはいけない**（実機検証で判明。`/etc/bash_completion.d/just`は遅延読込用のローダーではなく、対話シェル起動時に毎回そのまま読み込まれる静的な補完スクリプトのため、`_completion_loader`経由で呼ぶと`_minimal`にフォールバックしてしまい誤ってNG判定になる。素の対話シェルなら自動で`_clap_complete_just`が登録される）
   - `docker run --rm <一時タグ> bash -c '. "$NVM_DIR/nvm.sh" 2>/dev/null; export PATH="/home/vscode/.local/bin:$PATH"; just-lsp --version'` でjust-lspが導入されPATHに乗っていることを確認する（`ENV PATH`にビルド時点で`/home/$USERNAME/.local/bin`が追加済みのため、対話シェルでなくても直接実行できるはずだが、念のため`bash -ic`でも確認する）。
   - 確認用に作った一時イメージは `docker rmi <一時タグ>` で削除する。

6. **（追加要求があった場合）追加プログラムのbash補完を有効化する**
   - ユーザーから追加のプログラム導入を頼まれたら、その都度そのプログラムがbash補完に対応しているか確認し、対応していれば必ず有効化する。
   - aptパッケージの場合: `bash-completion` が導入済みであれば、パッケージが `/usr/share/bash-completion/completions/` 等に配置する補完スクリプトはインストールするだけで自動的に有効になる（追加作業は基本的に不要）。
   - 単体バイナリ導入やnpm/pip/go installなどapt以外の方法で導入する場合: そのプログラムが `<コマンド> completion bash` のようなサブコマンド／`--completion bash` オプションを持つか確認し、持っていれば生成物を配置する。配置先はインストール権限に合わせて使い分ける。
     - `Dockerfile` の `USER $USERNAME` より前（root権限）で導入するツールの場合: `RUN <コマンド> completion bash > /etc/bash_completion.d/<コマンド>`
     - `USER $USERNAME` 切り替え後（vscodeユーザー権限）で導入するツールの場合: root権限のディレクトリに書き込めないため、`RUN mkdir -p /home/$USERNAME/.local/share/bash-completion/completions && <コマンド> completion bash > /home/$USERNAME/.local/share/bash-completion/completions/<コマンド>`（bash-completionパッケージがXDG準拠でこのディレクトリも自動的に読む）。Node.js/Playwrightのnpm補完はこの形で実装済み
   - 対応方法が不明なツールは、公式ドキュメントを確認するか、ユーザーに確認してから追記する。

## 固定構成の内容（変更しない前提）

- ベースイメージ: `ubuntu:24.04`
- ロケール: `ja_JP.UTF-8`（`LANG`/`LANGUAGE`/`LC_ALL` すべて設定）
- タイムゾーン: `Asia/Tokyo`
- 非rootユーザー `vscode`（UID/GID 1000、パスワードなしsudo）。ベースイメージに同じUID/GIDが既にある場合はリネームして再利用する（`useradd`の重複エラー回避）
- 導入パッケージ: `locales` `tzdata` `sudo` `git` `curl` `ca-certificates` `bash-completion` `vim` `less` `jq` `python3` `python3-venv` `python3-pip`（すべて必須。ビルドツールチェーン（`build-essential`）はこのスキルの対象外なので含めない。必要な場合は配置後の`Dockerfile`にユーザー自身が追記する。`bash-completion` を外さない）
- `apt-get install` はBuildKitのキャッシュマウント（`RUN --mount=type=cache,target=/var/cache/apt` 等）でパッケージキャッシュを永続化する前提。`Dockerfile` 先頭の `# syntax=docker/dockerfile:1` は外さない。追記するRUN命令でパッケージを追加インストールする場合も、同様にキャッシュマウントを使う
- **Node.js（`NODE_MAJOR` ARGで指定、既定24系）とPlaywright（Chromium、`playwright install --with-deps` によるOS依存ライブラリ込み）を標準搭載する。** これは「言語ランタイムは対象外」という下記の原則に対する明示的な例外で、ブラウザ自動操作・HTML成果物のスクリーンショット確認をコンテナ内で追加導入なしに行えるようにするためのもの。ブラウザ本体は `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` に固定し、非rootユーザー`vscode`からも読めるようパーミッションを揃えてある
  - devcontainer内でヘッドレスブラウザとして日本語を含むページを正確に描画確認したい場合、CJKフォント（`fonts-noto-cjk`、これも標準搭載）が必要（未導入だと文字が豆腐化する）
  - Dockerのseccomp/AppArmor設定次第では`chromium.launch()`がサンドボックス絡みのエラーで失敗し`chromium.launch({ args: ['--no-sandbox'] })`が必要になる環境がある（Docker 29系・WSL2ホストでの検証では素の設定のまま成功しており、常に必要というわけではない）。Dockerfile側では解決できない実行時の制約なので、動作確認時に必ず切り分けてユーザーに伝える（手順5参照）
- **Python3（`apt-get`導入、Ubuntu 24.04標準の3.12系）を標準搭載する。** これもNode.jsと同様に「言語ランタイムは対象外」という原則に対する明示的な例外で、コンテナ内で追加導入なしにPythonスクリプトを実行できるようにするためのもの。`python3` 本体に加え、`venv`モジュールと`pip`が別パッケージに分割されているため `python3-venv` `python3-pip` も導入する。バージョン固定やプロジェクト固有の依存管理（`uv`など）が必要な場合は、配置後の`Dockerfile`にユーザー自身が追記する
- **just（タスクランナー）とjust-lsp（justfile用LSPサーバー）を標準搭載する。**
  - `just`は公式Dockerイメージ（`ghcr.io/casey/just`、`JUST_VERSION` ARGで指定、既定1.58.0）から`COPY --from`でバイナリをコピーする公式手順を使う（https://github.com/casey/just#docker）。`/usr/local/bin/`に配置されるため全ユーザーから使え、bash補完も`just --completions bash`の出力を`/etc/bash_completion.d/just`に配置済み
    - **`COPY --from=ghcr.io/casey/just:${JUST_VERSION}`のように外部イメージ参照の中でARGを変数展開する場合、そのARGは最初の`FROM`より前（グローバルスコープ）で宣言したものでなければならない**（BuildKitの制約。ステージ内で`ARG JUST_VERSION=...`と宣言してもCOPY --from側では展開されず`variable expansion is not supported for --from`で即座にビルド失敗する。実機のdocker build検証で判明した）。そのため`Dockerfile`冒頭で`ARG JUST_VERSION=1.58.0`を宣言し、`FROM ghcr.io/casey/just:${JUST_VERSION} AS just-bin`という名前付きステージを立て、本体側では`COPY --from=just-bin /just /usr/local/bin/`のようにステージ名で参照する。このテンプレートを改変する際、ARGをうっかりステージ内に戻すと同じエラーで壊れるので注意する
  - `just-lsp`は公式Dockerイメージが無いため、GitHubリリース（`JUST_LSP_VERSION` ARGで指定、既定0.8.0）からLinux x86_64向けバイナリ（`x86_64-unknown-linux-gnu`）をダウンロードし、公開されている`SHA256SUMS`で検証してから`/home/$USERNAME/.local/bin/`に配置する
  - どちらもバージョンは`ARG`で固定しており、更新する場合はそれぞれのGitHubリリースページで最新版を確認してARGの既定値を変更する

Node.js・Python以外の言語ランタイム（Goなど）はこのスキルの対象外。プロジェクト固有の依存関係が必要な場合は、配置後の `Dockerfile` にユーザー自身が追記する。ただし追記したプログラムがbash補完に対応する場合は、上記手順6に従って有効化すること。
