---
name: devcontainer-rockylinux9-ja
description: Rocky Linux 9ベース・ロケール日本語(ja_JP.UTF-8)・タイムゾーンAsia/Tokyoのdevcontainer環境を配置するときに使う。Node.jsとPlaywright(Chromium、RHEL系向けに手動で洗い出したOS依存ライブラリ込み)、Python3(dnf)、just/just-lspを標準搭載し、ブラウザ自動操作やHTML成果物のスクリーンショット確認、Pythonスクリプトの実行、justfileのタスク実行・エディタ連携がコンテナ内で追加導入なしに行える。「Rocky Linuxのdevcontainer作って」「RockyLinux9のコンテナ環境用意して」「このプロジェクト用にRockyLinux9の開発コンテナを作って」「devcontainerにPlaywrightも入れて」など、このリポジトリでRockyLinux9/日本語ロケール/東京タイムゾーンのdevcontainerを新規作成・再作成したい場合にトリガーする。Ubuntu版のdevcontainerが欲しい場合はこのスキルの対象外。汎用的な他OS・他ロケール向けdevcontainerの相談には使わない。
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
   - `docker run --rm <一時タグ> bash -c 'python3 --version && python3 -m venv /tmp/venvtest && /tmp/venvtest/bin/pip --version'` でPython3・venv・pipが導入されていることを確認する（RHEL系の`python3`パッケージはDebian/Ubuntu系と異なり`venv`モジュールを本体に同梱しているため、`python3-venv`相当の別パッケージ導入は不要）。
   - 上記のvenv経由の`pip --version`はvenvが内部で持つensurepip由来のpipが応答するため、**`python3-pip`パッケージ自体が導入されているかの確認にはならない**（実機の反証テストで確認済み。`python3-pip`を外してビルドしても上記コマンドは成功してしまう）。`docker run --rm <一時タグ> bash -c 'pip3 --version'` でシステム全体向けのpipが導入されていることも別途確認する。
   - `docker run --rm <一時タグ> bash -ic '_completion_loader git 2>/dev/null; complete -p git'` などでbash補完が有効になっていることも確認する（bash-completionは動的ロード方式のため、`type _git` は実際に補完を試みるまで関数が定義されず誤ってNG判定になる。`_completion_loader` で明示的にロードしてから `complete -p` で登録有無を見るのが確実）。
   - `workspaceMount` / `workspaceFolder` と同じ設定で `docker run --rm -v <source>:<target> -w <workspaceFolder> <一時タグ> git status` を実行し、`fatal: not a git repository` にならないことを確認する（特にプロジェクト配下に置く場合は必須）。
   - pnpmは公式インストーラーが`~/.bashrc`の**末尾**にPATH設定を追記するため、非対話の`bash -c`では`pnpm`/`node`が届かない。検証時は`bash -c 'export PATH="$PNPM_HOME/bin:$PATH" && ...'`のように明示的にPATHへ`$PNPM_HOME/bin`を足すか、`bash -ic '...'`（対話モード）を使う。
   - `docker run --rm <一時タグ> bash -c 'export PATH="$PNPM_HOME/bin:$PATH"; pnpm -v && node -v && pnpm exec playwright --version'` でpnpm/Node.js/Playwrightが導入されていることを確認する。
   - Chromiumが実際に起動できるかも確認する。`playwright screenshot`などのCLIコマンド経由（`pnpm exec playwright ...`）で確認すること。pnpm 12はグローバルインストールをハッシュ付きサブディレクトリに分散して保存するため、`NODE_PATH=$(pnpm root -g)`を使ったNode.jsスクリプトからの直接`require('playwright')`は`MODULE_NOT_FOUND`になる（実機検証で判明。`pnpm root -g`が返すパス自体に実体が無い）。`pnpm exec`/CLIコマンド経由なら問題なく解決される。
     ```
     docker run --rm <一時タグ> bash -c 'export PATH="$PNPM_HOME/bin:$PATH"; echo "<h1>ok</h1>" > /tmp/t.html && pnpm exec playwright screenshot /tmp/t.html /tmp/shot.png && ls -la /tmp/shot.png'
     ```
     **これは特に重要な確認項目。** PlaywrightのOS依存ライブラリはDebian/Ubuntu系のみ自動導入に対応しており、Rocky LinuxではDockerfileに手動で列挙したRPMパッケージ一覧が実際に足りているかがこのコマンドでしか分からない。Playwrightのバージョンが上がって必要な共有ライブラリが増えた場合、ここが`error while loading shared libraries`系のエラーで失敗する。失敗したら`ldd <chrome-headless-shellのパス>`（`$PLAYWRIGHT_BROWSERS_PATH`配下）で不足ライブラリ名を特定し、対応するRPMパッケージ名を探して`Dockerfile`のdnfパッケージ一覧に追加する。
   - `docker run --rm <一時タグ> bash -c 'just --version'` でjustが導入されていることを確認する。
   - `docker run --rm <一時タグ> bash -ic 'complete -p just'` でjustのbash補完（`/etc/bash_completion.d/just`）が有効になっていることを確認する。**他のツールと違い`_completion_loader just`を明示的に呼び出してはいけない**（実機検証で判明。`/etc/bash_completion.d/just`は遅延読込用のローダーではなく、対話シェル起動時に毎回そのまま読み込まれる静的な補完スクリプトのため、`_completion_loader`経由で呼ぶと`_minimal`にフォールバックしてしまい誤ってNG判定になる。素の対話シェルなら自動で`_clap_complete_just`が登録される）
   - `docker run --rm <一時タグ> bash -c 'just-lsp --version'` でjust-lspが導入されPATHに乗っていることを確認する（`ENV PATH`にビルド時点で`/home/$USERNAME/.local/bin`が追加済みのため、非対話シェルでも直接実行できるはず）。
   - 確認用に作った一時イメージは `docker rmi <一時タグ>` で削除する。

6. **（追加要求があった場合）追加プログラムのbash補完を有効化する**
   - ユーザーから追加のプログラム導入を頼まれたら、その都度そのプログラムがbash補完に対応しているか確認し、対応していれば必ず有効化する。
   - dnfパッケージの場合: `bash-completion` が導入済みであれば、パッケージが `/usr/share/bash-completion/completions/` 等に配置する補完スクリプトはインストールするだけで自動的に有効になる（追加作業は基本的に不要）。
   - 単体バイナリ導入やnpm/pip/go installなどdnf以外の方法で導入する場合: そのプログラムが `<コマンド> completion bash` のようなサブコマンド／`--completion bash` オプションを持つか確認し、持っていれば生成物を配置する。配置先はインストール権限に合わせて使い分ける。
     - `Dockerfile` の `USER $USERNAME` より前（root権限）で導入するツールの場合: `RUN <コマンド> completion bash > /etc/bash_completion.d/<コマンド>`
     - `USER $USERNAME` 切り替え後（vscodeユーザー権限）で導入するツールの場合: root権限のディレクトリに書き込めないため、`RUN mkdir -p /home/$USERNAME/.local/share/bash-completion/completions && <コマンド> completion bash > /home/$USERNAME/.local/share/bash-completion/completions/<コマンド>`（bash-completionパッケージがXDG準拠でこのディレクトリも自動的に読む）。pnpmの補完はこの形で実装済み
   - 対応方法が不明なツールは、公式ドキュメントを確認するか、ユーザーに確認してから追記する。

## 固定構成の内容（変更しない前提）

- ベースイメージ: `rockylinux/rockylinux:9`（Docker公式イメージではなく、Rocky Linux公式のイメージを使う）
- ロケール: `ja_JP.UTF-8`（`LANG`/`LANGUAGE`/`LC_ALL` すべて設定。`glibc-langpack-ja` を導入すればRHEL系ではlocale-gen不要で使えるようになる）
- タイムゾーン: `Asia/Tokyo`
- 非rootユーザー `vscode`（UID/GID 1000、パスワードなしsudo）。ベースイメージに同じUID/GIDが既にある場合はリネームして再利用する（`useradd`の重複エラー回避）
- 導入パッケージ: `glibc-langpack-ja` `tzdata` `sudo` `git` `curl` `ca-certificates` `bash-completion` `vim` `less` `jq` `tar` `python3` `python3-pip`（すべて必須。`tar`はjust-lspのリリースアーカイブ展開に使う。ビルドツールチェーン（`gcc`/`gcc-c++`/`make`）はこのスキルの対象外なので含めない。必要な場合は配置後の`Dockerfile`にユーザー自身が追記する。`bash-completion` を外さない）
- `dnf install` はBuildKitのキャッシュマウント（`RUN --mount=type=cache,target=/var/cache/dnf`）でパッケージキャッシュを永続化する前提。`Dockerfile` 先頭の `# syntax=docker/dockerfile:1` は外さない。追記するRUN命令でパッケージを追加インストールする場合も、同様にキャッシュマウントを使う
- **pnpm（`PNPM_VERSION` ARGで指定、既定12系。公式スタンドアロンインストーラで導入し、npm/nvm/corepackいずれにも依存しない）とNode.js（pnpm自身の`runtime`機能で導入・管理、既定LTS）、Playwright（Chromium）を標準搭載する。** Node.js/Playwrightの搭載自体は「言語ランタイムは対象外」という下記の原則に対する明示的な例外で、ブラウザ自動操作・HTML成果物のスクリーンショット確認をコンテナ内で追加導入なしに行えるようにするためのもの。distro提供の`nodejs`パッケージ（dnfモジュールの既定バージョン）はNode 16と古くPlaywrightの要求(Node20+)を満たさない
  - **PlaywrightのOS依存ライブラリ自動導入(`playwright install --with-deps`)はRocky Linuxで使えない**（Debian/Ubuntu系専用の実装で、apt-get前提のコマンドを呼んで失敗する）。そのため必要なRPMパッケージを`Dockerfile`に手動で列挙している（`nss` `nspr` `nss-util` `atk` `at-spi2-atk` `at-spi2-core` `cups-libs` `libX11` `libXcomposite` `libXdamage` `libXext` `libXfixes` `libXrandr` `libxcb` `libxkbcommon` `mesa-libgbm` `alsa-lib` `pango` `cairo` `dbus-libs`。実機でのldd検証により洗い出した最小構成で、Playwrightのバージョンアップで増える可能性があるため、テンプレート変更時は必ず手順5のChromium起動確認を実施する）
  - CJKフォントは`fonts-noto-cjk`(Debian/Ubuntu名)ではなく`google-noto-sans-cjk-ttc-fonts`（RHEL系のパッケージ名）を使う
  - ブラウザ本体は `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` に固定し、非rootユーザー`vscode`が所有者になるよう`chown`してから`playwright install`を実行する（OS依存ライブラリのdnf導入とブラウザダウンロードを分離しているため）
- **just（タスクランナー）とjust-lsp（justfile用LSPサーバー）を標準搭載する。**
  - `just`は公式Dockerイメージ（`ghcr.io/casey/just`、`JUST_VERSION` ARGで指定、既定1.58.0）から`COPY --from`でバイナリをコピーする公式手順を使う（https://github.com/casey/just#docker）。静的リンクされたバイナリのためUbuntu向けと同じ手順のままRHEL系でも動く。`/usr/local/bin/`に配置されるため全ユーザーから使え、bash補完も`just --completions bash`の出力を`/etc/bash_completion.d/just`に配置済み
    - **`COPY --from=ghcr.io/casey/just:${JUST_VERSION}`のように外部イメージ参照の中でARGを変数展開する場合、そのARGは最初の`FROM`より前（グローバルスコープ）で宣言したものでなければならない**（BuildKitの制約。ステージ内で`ARG JUST_VERSION=...`と宣言してもCOPY --from側では展開されず`variable expansion is not supported for --from`で即座にビルド失敗する。実機のdocker build検証で判明した）。そのため`Dockerfile`冒頭で`ARG JUST_VERSION=1.58.0`を宣言し、`FROM ghcr.io/casey/just:${JUST_VERSION} AS just-bin`という名前付きステージを立て、本体側では`COPY --from=just-bin /just /usr/local/bin/`のようにステージ名で参照する。このテンプレートを改変する際、ARGをうっかりステージ内に戻すと同じエラーで壊れるので注意する
  - `just-lsp`は公式Dockerイメージが無いため、GitHubリリース（`JUST_LSP_VERSION` ARGで指定、既定0.8.0）からLinux x86_64向けバイナリ（`x86_64-unknown-linux-gnu`）をダウンロードし、公開されている`SHA256SUMS`で検証してから`/home/$USERNAME/.local/bin/`に配置する（展開に`tar`パッケージが必要）
  - どちらもバージョンは`ARG`で固定しており、更新する場合はそれぞれのGitHubリリースページで最新版を確認してARGの既定値を変更する
- **Python3（`dnf`導入、Rocky Linux 9標準の3.9系）を標準搭載する。** これもNode.jsと同様に「言語ランタイムは対象外」という下記の原則に対する明示的な例外で、コンテナ内で追加導入なしにPythonスクリプトを実行できるようにするためのもの。RHEL系の`python3`パッケージは`venv`モジュールを本体に同梱しているため、Debian/Ubuntu系のような`python3-venv`相当の別パッケージ導入は不要。`pip`は別パッケージのため`python3-pip`を導入する。バージョン固定やプロジェクト固有の依存管理（`uv`など）が必要な場合は、配置後の`Dockerfile`にユーザー自身が追記する

Node.js・Python以外の言語ランタイム（Goなど）はこのスキルの対象外。プロジェクト固有の依存関係が必要な場合は、配置後の `Dockerfile` にユーザー自身が追記する。ただし追記したプログラムがbash補完に対応する場合は、上記手順6に従って有効化すること。
