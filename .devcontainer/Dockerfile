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
ENV PATH="/home/$USERNAME/.local/bin:$PATH"
RUN curl -fsSL https://claude.ai/install.sh | bash

# just-lsp（justfile用LSPサーバー）の導入
# just本体と違い公式Dockerイメージが無いため、GitHubリリースからバイナリを直接ダウンロードして配置する。
# 公開されているSHA256SUMSで改竄がないことを検証してから展開する（$HOME配下にsudo不要で導入）
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

# Rustツールチェーン（rustup）の導入
# rust-cargo-projectスキルの導入手順（.claude/skills/rust-cargo-project/references/install.md）に準拠し、
# 公式インストーラで$HOME配下にsudo不要で導入する（既定プロファイルにrustfmt/clippyも含まれる）。
# DockerfileのRUNは非対話シェルのため、インストーラが~/.bashrcに追記する行は効かない。
# PATHはこのENVで明示的に通す
ENV PATH="/home/$USERNAME/.cargo/bin:$PATH"
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && mkdir -p /home/$USERNAME/.local/share/bash-completion/completions \
    && rustup completions bash rustup > /home/$USERNAME/.local/share/bash-completion/completions/rustup \
    && rustup completions bash cargo > /home/$USERNAME/.local/share/bash-completion/completions/cargo

# カバレッジ計測用コンポーネントと追加ツール（cargo-llvm-cov・cargo-deny）の導入
# llvm-tools-previewを入れ忘れると`cargo llvm-cov`が実行時エラーになる。
# cargo installはソースからビルドするため数分かかる。--lockedはクレート側のCargo.lockを使わせる指定で、ビルドが壊れにくくなる
RUN rustup component add llvm-tools-preview \
    && cargo install cargo-llvm-cov cargo-deny --locked
