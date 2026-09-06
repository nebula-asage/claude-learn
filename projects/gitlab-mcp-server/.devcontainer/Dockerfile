# syntax=docker/dockerfile:1
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
    && locale-gen ja_JP.UTF-8 \
    && update-locale LANG=ja_JP.UTF-8 \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && dpkg-reconfigure -f noninteractive tzdata

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

# Node.js（プロジェクトの実行環境 node:24-bookworm-slim に合わせてメジャーバージョンを揃える）
# NodeSourceのセットアップスクリプトが内部で apt-get update を行うため、上のapt-get installと
# 同じキャッシュマウントを与えてダウンロードを再利用する。
# キャッシュマウント配下は末尾で消してはいけない（次回ビルドのキャッシュごと消えるため）。
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm completion > /etc/bash_completion.d/npm

# pnpm（corepackではなくnpm経由で導入する。プロジェクトのDockerfileと同じ固定方針・バージョン）
ARG PNPM_VERSION=10.34.5
RUN npm install -g pnpm@${PNPM_VERSION} \
    && pnpm completion bash > /etc/bash_completion.d/pnpm

# Playwright(Chromium)の導入
# ブラウザ本体を /opt/ms-playwright に固定する（既定のままだとrootのホーム配下に入り、
# 後で切り替える非rootユーザーvscodeから読めなくなるため。ENVでコンテナ全体に伝播させる）
# ここまでの手順と同じくroot権限のまま導入するため、sudo無しでそのままapt操作できる
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    npm install -g playwright \
    && npx playwright install --with-deps chromium \
    && apt-get install -y --no-install-recommends fonts-noto-cjk \
    && chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"

USER $USERNAME

# Claude Code CLI の導入
# 公式ネイティブインストーラを使う（Node.jsに依存せず、$HOME配下にsudo不要で導入される。
# チェックサム検証込み。CLI自身が自動更新する設計のため、Dockerfileではバージョン固定しない）
ENV PATH="/home/$USERNAME/.local/bin:$PATH"
RUN curl -fsSL https://claude.ai/install.sh | bash
