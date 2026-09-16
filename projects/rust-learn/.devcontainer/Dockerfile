FROM ubuntu:24.04 AS rust-builder
RUN apt update && \
    apt install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path --default-toolchain stable

# ============================================================

FROM ubuntu:24.04 AS deveropment

RUN apt update && \
    DEBIAN_FRONTEND=noninteractive \
    apt install -y \
    bash-completion \
    build-essential \
    curl \
    git \
    less \
    sudo \
    wget \
    vim \
    ca-certificates \
    software-properties-common \
    language-pack-ja \
    && rm -rf /var/lib/apt/lists/*

ARG USERNAME=ubuntu
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN echo "${USERNAME} ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME

COPY --from=rust-builder /root/.cargo /home/${USERNAME}/.cargo
COPY --from=rust-builder /root/.rustup /home/${USERNAME}/.rustup
RUN chown -R $USERNAME:$USERNAME /home/$USERNAME/.cargo /home/${USERNAME}/.rustup
ENV PATH="/home/${USERNAME}/.cargo/bin:${PATH}"

USER $USERNAME

RUN mkdir -p /home/${USERNAME}/.local/share/bash-completion/completions && \
    rustup completions bash > /home/${USERNAME}/.local/share/bash-completion/completions/rustup && \
    rustup completions bash cargo > /home/${USERNAME}/.local/share/bash-completion/completions/cargo

ENV LANG=ja_JP.UTF-8 \
    TZ=Asia/Tokyo 


