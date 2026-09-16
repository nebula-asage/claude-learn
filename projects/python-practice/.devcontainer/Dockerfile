# syntax=docker/dockerfile:1

# just（タスクランナー）の導入用。COPY --from=<外部イメージ参照>内でARGを変数展開するには、
# 最初のFROMより前（グローバルスコープ）で宣言したARGしか使えない（BuildKitの制約）ため、
# ここで宣言してjust-binステージのFROMに渡し、本体では名前付きステージからCOPYする
ARG JUST_VERSION=1.58.0
FROM ghcr.io/casey/just:${JUST_VERSION} AS just-bin

FROM ubuntu:24.04

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

# uv本体を導入する（公式配布イメージからバイナリをコピーするAstral推奨の方法）
# このプロジェクトの主目的であるPythonバージョン管理はuvに任せる（`uv python install`で3.12を導入）。
# OS標準のpython3（apt-get、上記のパッケージリスト参照）はdevcontainer-ubuntu-jaスキルの標準搭載として
# 別途共存させており、uv管理のPythonとは独立したシステムPythonという位置づけ
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# uvはbash補完サブコマンドを持つため、生成物を配置して有効化する（root権限で実施）
RUN uv generate-shell-completion bash > /etc/bash_completion.d/uv

USER $USERNAME

# `uv python install` が導入する実行ファイルへのシンボリックリンク置き場をPATHに追加する
ENV PATH="/home/$USERNAME/.local/bin:$PATH"

# uvにPython 3.12を導入させる（distro提供のpython3には依存しない）
RUN uv python install 3.12

# pnpm（公式スタンドアロンインストーラで導入する。npm/nvm/corepackいずれにも依存しない。
# $HOME配下にsudo不要で導入され、実行バイナリはnpmレジストリの署名とチェックサムで検証される）
# 言語ランタイムは本来devcontainer-ubuntu-jaスキルの対象外だが、Playwrightでのブラウザ自動操作・
# スクリーンショット取得を標準機能として持たせるための例外としてNode.jsを導入する
# （Python3はNode.jsと同様の例外としてdevcontainer-ubuntu-jaが標準搭載。このプロジェクトの主目的である
# Pythonバージョン管理はuv管理のまま、Node.jsはPlaywright専用の付随物という位置づけ）
ARG PNPM_VERSION=12
ENV PNPM_HOME=/home/$USERNAME/.local/share/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=${PNPM_VERSION} SHELL=/bin/bash sh - \
    && mkdir -p /home/$USERNAME/.local/share/bash-completion/completions \
    && pnpm completion bash > /home/$USERNAME/.local/share/bash-completion/completions/pnpm

# Node.js（distro提供のnodejsパッケージやnvmには依存せず、pnpm自身のruntime機能で導入・管理する）
RUN pnpm runtime set node lts -g

# Playwright(Chromium)の導入
# ブラウザ本体を /opt/ms-playwright に固定する（既定のままだと$HOME配下に入り、
# 他ユーザーや将来のUID変更で読めなくなる可能性があるため。ENVでコンテナ全体に伝播させる）
# OS依存ライブラリの導入(`install --with-deps`)はvscodeユーザーのNOPASSWD sudo経由で行われる
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    sudo mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" \
    && sudo chown $USERNAME:$USERNAME "$PLAYWRIGHT_BROWSERS_PATH" \
    && pnpm add -g playwright \
    && pnpm dlx playwright install --with-deps chromium \
    && sudo apt-get install -y --no-install-recommends fonts-noto-cjk \
    && sudo chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"

# Claude Code CLI の導入
# 公式ネイティブインストーラを使う（Node.jsに依存せず、$HOME配下にsudo不要で導入される。
# チェックサム検証込み。CLI自身が自動更新する設計のため、Dockerfileではバージョン固定しない）
RUN curl -fsSL https://claude.ai/install.sh | bash

# just-lsp（justfile用LSPサーバー）の導入
# just本体と違い公式Dockerイメージが無いため、GitHubリリースからバイナリを直接ダウンロードして配置する。
# 公開されているSHA256SUMSで改竄がないことを検証してから展開する（$HOME配下にsudo不要で導入。
# PATHは上記のuv導入時に設定済みの/home/$USERNAME/.local/binをそのまま使う）
ARG JUST_LSP_VERSION=0.8.0
RUN cd /tmp \
    && ARCHIVE="just-lsp-${JUST_LSP_VERSION}-x86_64-unknown-linux-gnu.tar.gz" \
    && curl -fsSLO "https://github.com/terror/just-lsp/releases/download/${JUST_LSP_VERSION}/${ARCHIVE}" \
    && curl -fsSLO "https://github.com/terror/just-lsp/releases/download/${JUST_LSP_VERSION}/SHA256SUMS" \
    && sha256sum --ignore-missing -c SHA256SUMS \
    && tar xzf "$ARCHIVE" \
    && mkdir -p /home/$USERNAME/.local/bin \
    && mv just-lsp /home/$USERNAME/.local/bin/ \
    && rm -f "$ARCHIVE" SHA256SUMS
