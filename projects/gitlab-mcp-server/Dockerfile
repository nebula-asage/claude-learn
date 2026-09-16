# gitlab-mcp-server の配布用イメージ。
# 開発用devcontainer（Ubuntu24.04/ja_JPロケール）とは別物で、MCPサーバの実行だけに最適化した
# 軽量なランタイムイメージ（node:slim）を使う。

# ---- builder: TypeScript をビルドする ----
FROM node:24-bookworm-slim AS builder
ARG PNPM_VERSION=12.4.2
WORKDIR /app

# corepackではなくnpm経由でpnpmを導入する（リポジトリ全体の固定方針）
RUN npm install -g pnpm@${PNPM_VERSION}

COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ---- runtime: 本番実行用の最小構成 ----
FROM node:24-bookworm-slim AS runtime
ARG PNPM_VERSION=12.4.2
ENV NODE_ENV=production
WORKDIR /app

RUN npm install -g pnpm@${PNPM_VERSION}

COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

COPY --from=builder /app/dist ./dist

# node:slim イメージには非rootの `node` ユーザーが既に存在する
USER node

ENV MCP_TRANSPORT=stdio
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=3000

EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
