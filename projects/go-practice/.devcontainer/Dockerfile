# syntax=docker/dockerfile:1

# just（タスクランナー）の導入用。COPY --from=<外部イメージ参照>内でARGを変数展開するには、
# 最初のFROMより前（グローバルスコープ）で宣言したARGしか使えない（BuildKitの制約）ため、
# ここで宣言してjust-binステージのFROMに渡し、本体では名前付きステージからCOPYする
ARG JUST_VERSION=1.58.0
# just-lsp（justfile用LSPサーバー）のバージョン。取得専用ステージ(just-lsp-bin)で使うためここで宣言する
ARG JUST_LSP_VERSION=0.8.0
FROM ghcr.io/casey/just:${JUST_VERSION} AS just-bin

# ---- just-lsp取得ステージ ----
# just本体と違い公式Dockerイメージが無いため、GitHubリリースからバイナリを直接ダウンロードする。
# 公開されているSHA256SUMSで改竄がないことを検証してから展開する。
# 最終イメージのapt-get等と依存関係がないため、BuildKitが並列にビルドする。
# 検証済みバイナリだけを最終ステージにコピーするので、curlの作業ファイルは最終イメージに残らない
FROM ubuntu:24.04 AS just-lsp-bin
ARG JUST_LSP_VERSION
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update && apt-get install -y --no-install-recommends curl ca-certificates
WORKDIR /tmp/dl
RUN ARCHIVE="just-lsp-${JUST_LSP_VERSION}-x86_64-unknown-linux-gnu.tar.gz" \
    && curl -fsSLO "https://github.com/terror/just-lsp/releases/download/${JUST_LSP_VERSION}/${ARCHIVE}" \
    && curl -fsSLO "https://github.com/terror/just-lsp/releases/download/${JUST_LSP_VERSION}/SHA256SUMS" \
    && sha256sum --ignore-missing -c SHA256SUMS \
    && tar xzf "$ARCHIVE"

# ---- 共通ベースステージ ----
# OSパッケージ・ロケール・just・非rootユーザーまで。以降のツール導入ステージはここから分岐する
FROM ubuntu:24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive

# ロケール（日本語）とタイムゾーン（Asia/Tokyo）の設定
ENV TZ=Asia/Tokyo
ENV LANG=ja_JP.UTF-8
ENV LANGUAGE=ja_JP:ja
ENV LC_ALL=ja_JP.UTF-8

# apt-get用キャッシュはBuildKitのキャッシュマウントで永続化し、ビルドのたびに再ダウンロードしない。
# docker-cleanの無効化はキャッシュマウント配下の.debを消させないために必要（Debian/Ubuntu公式イメージのデフォルト挙動対策）。
# キャッシュマウント自体はイメージのレイヤーに含まれないため、末尾の rm -rf /var/lib/apt/lists/* は不要。
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update && apt-get install -y --no-install-recommends \
    locales \
    tzdata \
    sudo \
    git \
    curl \
    ca-certificates \
    bash-completion \
    vim \
    less \
    jq \
    python3 \
    python3-venv \
    python3-pip \
    && locale-gen ja_JP.UTF-8 \
    && update-locale LANG=ja_JP.UTF-8 \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && dpkg-reconfigure -f noninteractive tzdata

# just（タスクランナー）の導入
# 公式Dockerイメージ(ghcr.io/casey/just)からバイナリをコピーする公式手順を使う
# （https://github.com/casey/just#docker）。curlでのインストールスクリプト実行と違い
# レジストリ経由でイメージダイジェストが検証されるため、別途チェックサム検証は不要。
# バージョンを指定するARGはファイル冒頭のグローバルスコープで宣言済み（just-binステージ参照）
COPY --from=just-bin /just /usr/local/bin/
RUN just --completions bash > /etc/bash_completion.d/just

# ARGはここで初めて使うRUNの直前で宣言する。apt-get installより前で宣言すると、
# USER_UID等のビルドargを変えるたびにapt-get installレイヤーのキャッシュまで無効化されてしまうため。
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# 非rootユーザーを作成し、パスワードなしでsudoを使えるようにする
# （ベースイメージに同じUID/GIDが既に存在する場合はそれを再利用する）
RUN if getent group $USER_GID >/dev/null; then \
        groupmod -n $USERNAME $(getent group $USER_GID | cut -d: -f1); \
    else \
        groupadd --gid $USER_GID $USERNAME; \
    fi \
    && if getent passwd $USER_UID >/dev/null; then \
        usermod -l $USERNAME -d /home/$USERNAME -m -g $USER_GID $(getent passwd $USER_UID | cut -d: -f1); \
    else \
        useradd --uid $USER_UID --gid $USER_GID -m $USERNAME; \
    fi \
    && echo "$USERNAME ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# 追加でプログラムを導入する場合、bash補完に対応していれば有効化すること。
# - aptパッケージ: bash-completion導入済みなら、インストール時に自動配置される補完スクリプトが
#   そのまま有効になる（追加設定は不要）
# - 単体バイナリ導入等で `<コマンド> completion bash` のようなサブコマンドを持つ場合は、
#   例: RUN <コマンド> completion bash > /etc/bash_completion.d/<コマンド>
#   のように生成物を /etc/bash_completion.d/ に配置する（このRUNは USER 切り替えより前、root権限で行う）
#   USER切り替え後（vscode権限）で導入するツールの場合は、下のpnpm補完のように
#   /home/$USERNAME/.local/share/bash-completion/completions/ に配置する（root権限ディレクトリに書けないため）

# ---- Go系ツール導入ステージ（gocomplete）----
# node-tools・claude-cliと互いに依存しないため並列にビルドされる。Go本体は最終ステージにも同じものをCOPYする
FROM base AS go-tools
ARG USERNAME=vscode
COPY --from=golang:1.26-bookworm /usr/local/go /usr/local/go
ENV PATH="/usr/local/go/bin:/home/$USERNAME/go/bin:${PATH}"
USER $USERNAME

# gomarkdoc・gcov2lcovはgo.modのtoolディレクティブで固定し`go tool`で実行するため、ここでは導入しない。
# gocompleteはプロジェクトの依存ではなくシェル補完の仕組み、goplsはエディタ（VS Code）用の
# 言語サーバーでプロジェクトの依存ではないため、どちらもgo installで導入する
# （Goモジュールの標準機能であるGOSUMDBによるチェックサム検証が効くため、追加の手動検証は不要。
# タスクランナーのjustは公式Dockerイメージから導入済み）
RUN go install github.com/posener/complete/v2/gocomplete@latest \
    && go install golang.org/x/tools/gopls@latest

# gocomplete（goコマンドのbash補完）の有効化
# 標準の `COMP_INSTALL=1 gocomplete` は ~/.bashrc を書き換えるため使わず、bash-completionが
# 遅延ロードするディレクトリに `complete -C` 行を直接配置する（pnpm補完と同じ置き場）
RUN mkdir -p /home/$USERNAME/.local/share/bash-completion/completions \
    && echo "complete -C /home/$USERNAME/go/bin/gocomplete go" > /home/$USERNAME/.local/share/bash-completion/completions/go

# ---- Node.js系ツール導入ステージ（pnpm / Node.js / Playwright Chromium本体）----
# claude-cliステージと互いに依存しないため並列にビルドされ、片方の変更でもう片方のキャッシュは無効化されない。
# OS依存ライブラリ(apt)だけは最終ステージで導入する（aptの成果物はステージ間でコピーできないため）
FROM base AS node-tools
ARG USERNAME=vscode
USER $USERNAME

# pnpm（公式スタンドアロンインストーラで導入する。npm/nvm/corepackいずれにも依存しない。
# $HOME配下にsudo不要で導入され、実行バイナリはnpmレジストリの署名とチェックサムで検証される）
ARG PNPM_VERSION=12
ENV PNPM_HOME=/home/$USERNAME/.local/share/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=${PNPM_VERSION} SHELL=/bin/bash sh - \
    && mkdir -p /home/$USERNAME/.local/share/bash-completion/completions \
    && pnpm completion bash > /home/$USERNAME/.local/share/bash-completion/completions/pnpm

# pnpmのサプライチェーン攻撃対策（ユーザー単位のグローバル設定でデフォルト有効化）
# - minimumReleaseAge: 公開から7日間（10080分）は新しいバージョンのインストールをスキップする
# - ignoreScripts: postinstallなどのライフサイクルスクリプトを実行しない
# pnpm 11以降、.npmrcはauth/registry設定専用になり非auth設定は無視される（実機検証で確認済み）ため、
# ユーザー単位のグローバル設定は ~/.config/pnpm/config.yaml（YAML、キャメルケース）に書く
RUN mkdir -p /home/$USERNAME/.config/pnpm \
    && printf 'ignoreScripts: true\nminimumReleaseAge: 10080\n' > /home/$USERNAME/.config/pnpm/config.yaml

# Node.js（distro提供のnodejsパッケージやnvmには依存せず、pnpm自身のruntime機能で導入・管理する）
# 言語ランタイムは本来このスキルの対象外だが、Playwrightでのブラウザ自動操作・スクリーンショット取得を
# 標準機能として持たせるための例外としてNode.jsを導入する（Python3はapt-getで別途標準搭載済み。
# Goなど他言語ランタイムは対象外のまま）。
RUN pnpm runtime set node lts -g

# Playwright(Chromium)のブラウザ本体の導入
# 本体を /opt/ms-playwright に固定する（既定のままだと$HOME配下に入り、
# 他ユーザーや将来のUID変更で読めなくなる可能性があるため。ENVでコンテナ全体に伝播させる）。
# このステージではOS依存ライブラリは入れない（--with-depsなし）。
# ダウンロードしたブラウザはpnpmのストアキャッシュ等と別に /opt に置かれるため、そのまま最終ステージへコピーできる
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN sudo mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" \
    && sudo chown $USERNAME:$USERNAME "$PLAYWRIGHT_BROWSERS_PATH" \
    && pnpm add -g playwright \
    && pnpm dlx playwright install chromium \
    && sudo chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"

# justfileから使うCLIツール（cspell・markdownlint-cli2・marked）のグローバル導入
# justfileのレシピ（cspell / markdownlint / doc-html）が毎回pnpxで取得しないよう、ビルド時に導入しておく。
# 上で書いたグローバル設定（minimumReleaseAge・ignoreScripts）がそのまま効くため、
# サプライチェーン攻撃対策は pnpx 利用時と同じ水準を保つ。バイナリは $PNPM_HOME/bin に入りPATHに乗る
RUN pnpm add -g cspell markdownlint-cli2 marked

# ---- Claude Code CLI 導入ステージ ----
# 公式ネイティブインストーラを使う（Node.jsに依存せず、$HOME配下にsudo不要で導入される。
# チェックサム検証込み。CLI自身が自動更新する設計のため、Dockerfileではバージョン固定しない）
FROM base AS claude-cli
ARG USERNAME=vscode
USER $USERNAME
RUN curl -fsSL https://claude.ai/install.sh | bash

# ---- 最終ステージ ----
# baseに各ステージの成果物をコピーして組み立てる。
# 変更頻度の低いもの（node-tools）から順にCOPYし、頻繁に変わるもの（claude-cli）を後ろに置く
FROM base AS final
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Playwright(Chromium)のOS依存ライブラリと日本語フォント
# OS依存ライブラリの導入(`install-deps`)はNOPASSWD sudo経由で行う（node-toolsからコピーしたplaywrightを使う）
ENV PNPM_HOME=/home/$USERNAME/.local/share/pnpm
ENV PATH="/home/$USERNAME/.local/bin:$PNPM_HOME/bin:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
COPY --from=node-tools --chown=$USERNAME:$USER_GID /home/$USERNAME/.local/share/pnpm /home/$USERNAME/.local/share/pnpm
COPY --from=node-tools --chown=$USERNAME:$USER_GID /home/$USERNAME/.local/share/bash-completion /home/$USERNAME/.local/share/bash-completion
COPY --from=node-tools --chown=$USERNAME:$USER_GID /home/$USERNAME/.config/pnpm /home/$USERNAME/.config/pnpm
COPY --from=node-tools /opt/ms-playwright /opt/ms-playwright
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
    && playwright install-deps chromium \
    && apt-get install -y --no-install-recommends fonts-noto-cjk

# Go本体・golangci-lintの導入
# 言語ランタイムは本来devcontainer-ubuntu-jaスキルの対象外だが、このプロジェクトの主目的がGoの
# 練習環境（go-projectスキル）であるため例外として導入する（Node.jsは上記Playwright専用の付随物という位置づけ）。
# ホスト向け導入手順（go-projectスキル）では手動tarball+sha256検証を使うが、
# Dockerビルドでは公式イメージからバイナリをCOPYする方が保守しやすく、同等以上の検証が効くためこちらを使う。
# golangci-lintは`go install`ではなく公式配布バイナリを使う方針（go-projectスキル参照）に合わせ、
# 公式Dockerイメージ内のバイナリをそのまま使う。
COPY --from=golang:1.26-bookworm /usr/local/go /usr/local/go
COPY --from=golangci/golangci-lint:v2.12.2 /usr/bin/golangci-lint /usr/local/bin/golangci-lint
ENV PATH="/usr/local/go/bin:/home/$USERNAME/go/bin:${PATH}"
RUN golangci-lint completion bash > /etc/bash_completion.d/golangci-lint
COPY --from=go-tools --chown=$USERNAME:$USER_GID /home/$USERNAME/go/bin /home/$USERNAME/go/bin
COPY --from=go-tools --chown=$USERNAME:$USER_GID /home/$USERNAME/.local/share/bash-completion/completions/go /home/$USERNAME/.local/share/bash-completion/completions/go

# Claude Code CLI
# ~/.local/bin/claude は ~/.local/share/claude/versions/<ver> とのハードリンクだが、COPYではハードリンクが
# 保持されず約250MBが二重になるため、実体(versions/)だけコピーしてシンボリックリンクを張り直す
COPY --from=claude-cli --chown=$USERNAME:$USER_GID /home/$USERNAME/.local/share/claude /home/$USERNAME/.local/share/claude
RUN mkdir -p /home/$USERNAME/.local/bin \
    && ln -s "$(ls -d /home/$USERNAME/.local/share/claude/versions/* | head -n 1)" /home/$USERNAME/.local/bin/claude \
    && chown -h $USERNAME:$USER_GID /home/$USERNAME/.local/bin /home/$USERNAME/.local/bin/claude

# just-lsp
COPY --from=just-lsp-bin --chown=$USERNAME:$USER_GID /tmp/dl/just-lsp /home/$USERNAME/.local/bin/just-lsp

USER $USERNAME
