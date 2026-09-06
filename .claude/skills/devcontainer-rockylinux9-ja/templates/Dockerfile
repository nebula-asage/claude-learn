# syntax=docker/dockerfile:1
FROM rockylinux/rockylinux:9

# ロケール（日本語）とタイムゾーン（Asia/Tokyo）の設定
ENV TZ=Asia/Tokyo
ENV LANG=ja_JP.UTF-8
ENV LANGUAGE=ja_JP:ja
ENV LC_ALL=ja_JP.UTF-8

# RHEL系はglibc-langpack-jaを入れるだけでロケールが使えるようになる（locale-gen不要）
# --allowerasing: ベースイメージにプリインストールされたcurl-minimalとcurlの衝突を解決するために必要
# dnfのパッケージキャッシュはBuildKitのキャッシュマウントで永続化し、ビルドのたびに再ダウンロードしない。
# キャッシュマウント自体はイメージのレイヤーに含まれないため、dnf clean all / rm -rf /var/cache/dnf は不要
# （むしろ実行するとキャッシュマウントの中身を消してしまい効果がなくなる）。
# --setopt=keepcache=True: dnfはデフォルト（keepcache=0）だとインストール成功後にダウンロード済みRPMを
# 自身で削除してしまい、キャッシュマウントに何も残らず次回ビルドで再ダウンロードが発生する。それを防ぐため必須。
RUN --mount=type=cache,target=/var/cache/dnf,sharing=locked \
    dnf install -y --allowerasing --setopt=keepcache=True \
    glibc-langpack-ja \
    tzdata \
    sudo \
    git \
    curl \
    ca-certificates \
    bash-completion \
    vim \
    less \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# ARGはここで初めて使うRUNの直前で宣言する。dnf installより前で宣言すると、
# USER_UID等のビルドargを変えるたびにdnf installレイヤーのキャッシュまで無効化されてしまうため。
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
# - dnfパッケージ: bash-completion導入済みなら、インストール時に自動配置される補完スクリプトが
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
# distro提供のnodejsパッケージ(dnfモジュールの既定バージョン)はNode 16と古くPlaywright(要Node20+)が
# 動かないため、nvmで最新版を入れる。
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
# PlaywrightのOS依存パッケージ自動導入(`playwright install --with-deps`)はDebian/Ubuntu系専用の
# 実装で、Rocky Linux(RHEL系)では非対応（apt-get前提のコマンドを呼んで失敗する）。そのため
# 必要なRPMパッケージを手動で列挙してdnfで導入する（実機検証でlddの不足ライブラリから洗い出した最小構成。
# Playwrightのバージョンアップで必要ライブラリが増える可能性があるため、Chromium起動確認は必須）。
# ブラウザ本体は /opt/ms-playwright に固定する（既定のままだと$HOME配下に入り、
# 他ユーザーや将来のUID変更で読めなくなる可能性があるため。ENVでコンテナ全体に伝播させる）
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN --mount=type=cache,target=/var/cache/dnf,sharing=locked \
    sudo dnf install -y --allowerasing --setopt=keepcache=True \
    nss nspr nss-util \
    atk at-spi2-atk at-spi2-core \
    cups-libs \
    libX11 libXcomposite libXdamage libXext libXfixes libXrandr \
    libxcb libxkbcommon \
    mesa-libgbm \
    alsa-lib \
    pango cairo \
    dbus-libs \
    liberation-fonts google-noto-sans-cjk-ttc-fonts \
    && sudo mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" \
    && sudo chown $USERNAME:$USERNAME "$PLAYWRIGHT_BROWSERS_PATH" \
    && . "$NVM_DIR/nvm.sh" \
    && npm install -g playwright \
    && npx playwright install chromium \
    && sudo chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"
