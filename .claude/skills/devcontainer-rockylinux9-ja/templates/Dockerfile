# syntax=docker/dockerfile:1

# just（タスクランナー）の導入用。COPY --from=<外部イメージ参照>内でARGを変数展開するには、
# 最初のFROMより前（グローバルスコープ）で宣言したARGしか使えない（BuildKitの制約）ため、
# ここで宣言してjust-binステージのFROMに渡し、本体では名前付きステージからCOPYする
ARG JUST_VERSION=1.58.0
FROM ghcr.io/casey/just:${JUST_VERSION} AS just-bin

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
    jq \
    tar \
    python3 \
    python3-pip \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# just（タスクランナー）の導入
# 公式Dockerイメージ(ghcr.io/casey/just)からバイナリをコピーする公式手順を使う
# （https://github.com/casey/just#docker）。curlでのインストールスクリプト実行と違い
# レジストリ経由でイメージダイジェストが検証されるため、別途チェックサム検証は不要。
# 静的リンクされたバイナリのため、Ubuntu向けと同じ手順のままRHEL系（Rocky Linux）でも動く。
# バージョンを指定するARGはファイル冒頭のグローバルスコープで宣言済み（just-binステージ参照）
COPY --from=just-bin /just /usr/local/bin/
RUN just --completions bash > /etc/bash_completion.d/just

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
#   USER切り替え後（vscode権限）で導入するツールの場合は、下のpnpm補完のように
#   /home/$USERNAME/.local/share/bash-completion/completions/ に配置する（root権限ディレクトリに書けないため）

USER $USERNAME

# pnpm（公式スタンドアロンインストーラで導入する。npm/nvm/corepackいずれにも依存しない。
# $HOME配下にsudo不要で導入され、実行バイナリはnpmレジストリの署名とチェックサムで検証される）
ARG PNPM_VERSION=12
ENV PNPM_HOME=/home/$USERNAME/.local/share/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=${PNPM_VERSION} SHELL=/bin/bash sh - \
    && mkdir -p /home/$USERNAME/.local/share/bash-completion/completions \
    && pnpm completion bash > /home/$USERNAME/.local/share/bash-completion/completions/pnpm

# Node.js（distro提供のnodejsモジュール(dnfモジュールの既定バージョンはNode 16と古くPlaywright
# (要Node20+)が動かない)やnvmには依存せず、pnpm自身のruntime機能で導入・管理する）
# 言語ランタイムは本来このスキルの対象外だが、Playwrightでのブラウザ自動操作・スクリーンショット取得を
# 標準機能として持たせるための例外としてNode.jsのみ導入する（他言語ランタイムは対象外のまま）。
RUN pnpm runtime set node lts -g

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
    && pnpm add -g playwright \
    && pnpm dlx playwright install chromium \
    && sudo chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"

# just-lsp（justfile用LSPサーバー）の導入
# just本体と違い公式Dockerイメージが無いため、GitHubリリースからバイナリを直接ダウンロードして配置する。
# 公開されているSHA256SUMSで改竄がないことを検証してから展開する（$HOME配下にsudo不要で導入）
ENV PATH="/home/$USERNAME/.local/bin:$PATH"
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
