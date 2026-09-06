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

# 追加でプログラムを導入する場合、bash補完に対応していれば有効化すること。
# - aptパッケージ: bash-completion導入済みなら、インストール時に自動配置される補完スクリプトが
#   そのまま有効になる（追加設定は不要）
# - 単体バイナリ導入等で `<コマンド> completion bash` のようなサブコマンドを持つ場合は、
#   例: RUN <コマンド> completion bash > /etc/bash_completion.d/<コマンド>
#   のように生成物を /etc/bash_completion.d/ に配置する（このRUNは USER 切り替えより前、root権限で行う）
#   USER切り替え後（vscode権限）で導入するツールの場合は、下のnpm補完のように
#   /home/$USERNAME/.local/share/bash-completion/completions/ に配置する（root権限ディレクトリに書けないため）

USER $USERNAME

# Node.js / npm はLinuxで標準的なnvm(Node Version Manager)で導入する
# 言語ランタイムは本来このスキルの対象外だが、Playwrightでのブラウザ自動操作・スクリーンショット取得を
# 標準機能として持たせるための例外としてNode.jsのみ導入する（他言語ランタイムは対象外のまま）。
# nvmのインストーラーが ~/.bashrc に自動でnvm.sh/bash補完の読み込みを追記するため、
# インタラクティブなbashシェルではnode/npmが自動でPATHに載る
ARG NVM_VERSION=v0.40.6
ARG NODE_MAJOR=24
ENV NVM_DIR=/home/$USERNAME/.nvm
RUN curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install $NODE_MAJOR \
    && nvm alias default $NODE_MAJOR \
    && npm install -g npm@latest \
    && mkdir -p /home/$USERNAME/.local/share/bash-completion/completions \
    && npm completion > /home/$USERNAME/.local/share/bash-completion/completions/npm

# Playwright(Chromium)の導入
# ブラウザ本体を /opt/ms-playwright に固定する（既定のままだと$HOME配下に入り、
# 他ユーザーや将来のUID変更で読めなくなる可能性があるため。ENVでコンテナ全体に伝播させる）
# OS依存ライブラリの導入(`install --with-deps`)はapt操作を伴うためsudoで実行する。
# sudoは既定でPATHをリセットするため、nvmで通したPATHを`env`で明示的に引き継ぐ必要がある
# （ホスト側の同種のPlaywright導入作業で判明した既知の落とし穴）
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    . "$NVM_DIR/nvm.sh" \
    && npm install -g playwright \
    && sudo env "PATH=$PATH" PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH npx playwright install --with-deps chromium \
    && sudo apt-get install -y --no-install-recommends fonts-noto-cjk \
    && sudo chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"

# Claude Code CLI の導入
# 公式ネイティブインストーラを使う（Node.jsに依存せず、$HOME配下にsudo不要で導入される。
# チェックサム検証込み。CLI自身が自動更新する設計のため、Dockerfileではバージョン固定しない）
ENV PATH="/home/$USERNAME/.local/bin:$PATH"
RUN curl -fsSL https://claude.ai/install.sh | bash
