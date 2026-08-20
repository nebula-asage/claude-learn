# syntax=docker/dockerfile:1
FROM ubuntu:24.04

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

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
    build-essential \
    bash-completion \
    && locale-gen ja_JP.UTF-8 \
    && update-locale LANG=ja_JP.UTF-8 \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && dpkg-reconfigure -f noninteractive tzdata

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

USER $USERNAME
