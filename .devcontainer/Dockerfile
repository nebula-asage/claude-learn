FROM ubuntu:24.04

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID
ARG NVM_VERSION=v0.40.6
ARG NODE_MAJOR=24
ARG PNPM_VERSION=10.34.5

ENV DEBIAN_FRONTEND=noninteractive

# ロケール（日本語）とタイムゾーン（Asia/Tokyo）の設定
ENV TZ=Asia/Tokyo
ENV LANG=ja_JP.UTF-8
ENV LANGUAGE=ja_JP:ja
ENV LC_ALL=ja_JP.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
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
    && dpkg-reconfigure -f noninteractive tzdata \
    && rm -rf /var/lib/apt/lists/*

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

# Node.js / npm はLinuxで標準的なnvm(Node Version Manager)で導入する
# (corepackは将来Node.js本体から切り離される方針のため、pnpmの導入手段としては使わない)
# nvmのインストーラーが ~/.bashrc に自動でnvm.sh/bash補完の読み込みを追記するため、
# インタラクティブなbashシェルではnode/npm/pnpmが自動でPATHに載る
ENV NVM_DIR=/home/$USERNAME/.nvm
RUN curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install $NODE_MAJOR \
    && nvm alias default $NODE_MAJOR \
    && npm install -g npm@latest

# pnpmの導入
# pnpmは11系だとユーザー単位のグローバル設定ファイル(config.yaml)の一部設定が
# 未文書化の破壊的変更で効かなくなっているため、.npmrcでの設定が確実に効く
# 10系の最新版にバージョンを固定してインストールする
RUN . "$NVM_DIR/nvm.sh" \
    && npm install -g pnpm@${PNPM_VERSION} \
    && mkdir -p /home/$USERNAME/.local/share/bash-completion/completions \
    && pnpm completion bash > /home/$USERNAME/.local/share/bash-completion/completions/pnpm

# npm/pnpmのサプライチェーン攻撃対策（デフォルトで有効化）
# - min-release-age (npm) / minimum-release-age (pnpm): 公開から7日間は
#   新しいバージョンのインストールをスキップする
# - ignore-scripts: postinstallなどのライフサイクルスクリプトを実行しない
RUN printf 'ignore-scripts=true\nmin-release-age=7\nminimum-release-age=10080\n' > /home/$USERNAME/.npmrc
