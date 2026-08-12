---
name: pnpm-nvm-project
description: Node.jsの練習・開発プロジェクト一式（pnpm前提のpackage.json + .npmrc + README）をホスト環境に直接構築するときに使う。「pnpmの環境作って」「Node.jsの練習環境作って」「pnpmでプロジェクト作って」「このリポジトリにNode.jsプロジェクト追加して」など、このリポジトリ配下にpnpmベースのNode.jsプロジェクトを新規作成・再作成したい場合にトリガーする。Docker/devcontainerには依存せず、nvm(Node Version Manager)が未導入ならホストに直接導入する。pnpm本体はcorepack(将来Node.js本体から切り離される方針)ではなくnpm経由で導入し、サプライチェーン攻撃対策（ignore-scripts抑制・7日間のリリース遅延）も標準で組み込む。devcontainer/コンテナ環境の構築自体を頼まれた場合はdevcontainer-ubuntu-jaスキルを使うこと（このスキルとは独立で、組み合わせる必要もない）。
---

# pnpm-nvm-project

**nvm + pnpm前提**のNode.js環境構築条件を組み込んだプロジェクト一式を、Docker/devcontainerに依存せずホスト環境に直接配置するスキル。`.devcontainer/`（このリポジトリのdevcontainer環境）で一度構築・検証済みの条件（nvmでのNode.js導入・pnpmのバージョン固定・サプライチェーン攻撃対策）を、コンテナに依存しない形でテンプレート化したもの。

このスキルは [[devcontainer-ubuntu-ja]] などのdevcontainer系スキルとは独立している。前提にもしないし、組み合わせて使う必要もない。devcontainer/コンテナ環境そのものの構築を頼まれたときはそちらのスキルを使うこと。

## このスキルが前提とする条件（変更しない）

- **Node.jsランタイムはnvm(Node Version Manager)で導入・管理する**。distro/システムに入っているnodeパッケージや、apt経由のNodeSourceリポジトリには依存しない
- **パッケージマネージャはpnpm一本**。`npm install`（依存追加）や`yarn`は使わない（pnpm自体の導入にnpmコマンドを使うのは例外）
- **pnpm本体の導入はcorepackを使わず、`npm install -g pnpm@^10`で導入する**。理由は2つ:
  1. corepackはNode.js本体から将来的に切り離される方針であり、長期的な前提にしにくい
  2. pnpm 11系はユーザー単位のグローバル設定ファイル(`config.yaml`)の一部設定が未文書化の破壊的変更で効かなくなっており、後述の`.npmrc`ベースの設定が確実に効く10系に固定する必要がある
  
  この2点の事情（特に2）が解消されたら、`pnpm@^10`固定は見直してよい。
- **サプライチェーン攻撃対策として、プロジェクト直下の`.npmrc`に次を設定する（固定条件）**:
  - `ignore-scripts=true` — postinstallなどのライフサイクルスクリプトを実行しない
  - `min-release-age=7`（npm向け、日単位） / `minimum-release-age=10080`（pnpm向け、分単位で7日分） — 公開から7日間は新しいバージョンのインストールをスキップし、悪意あるバージョンが検知・撤回される猶予を確保する
  - 2つの設定キーが必要なのは、npmとpnpmでキー名・単位が異なるため（`min-release-age`は日、`minimum-release-age`は分）。両方書いても片方のツールにとって未知のキーになるが、動作上問題はない（検証済み）
- `package-lock.json`は作らない。依存関係は`package.json` + `pnpm-lock.yaml`（`pnpm install`で生成、コミット対象）で管理する

## 手順

1. **nvmがホストに導入済みか確認する**
   - `[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm --version` で確認する。
   - 導入済みならそのバージョンで進めてよい。
   - 未導入の場合は、[nvm公式](https://github.com/nvm-sh/nvm)の最新リリースを使ってインストールする。
     ```bash
     NVM_LATEST=$(curl -fsSL https://api.github.com/repos/nvm-sh/nvm/releases/latest \
       | grep -m1 '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
     curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_LATEST}/install.sh" | bash
     ```
   - **これはホスト環境に実際にソフトウェアを導入する操作であり、シェルの設定ファイル（`~/.bashrc`等）へのnvm読み込み・bash補完の追記も伴う（インストーラーが自動で行う）。** ユーザーが今回の依頼で明示的にこの方法を指定していない場合は、実行前に「nvmが入っていないので公式インストーラーで導入してよいか」を確認する。すでに指定・許可されている場合はそのまま進めてよい。
   - インストール後は新しいシェルを開くかプロファイルを再読込しないと`nvm`コマンドが見つからないことがある点に注意する（`source ~/.bashrc`等）。

2. **Node.jsランタイムを導入する**
   ```bash
   . "$HOME/.nvm/nvm.sh"
   nvm install --lts
   nvm alias default 'lts/*'
   ```
   - これでdistro提供のnodeに頼らず、常に最新のLTSがデフォルトになる。

3. **pnpmを導入する**
   ```bash
   npm install -g pnpm@^10
   ```
   - `pnpm@latest`にはしない（前提条件を参照）。`^10`により10系の最新パッチ・マイナーには自動追従する。

4. **配置先とプロジェクト名を確認する**
   - このリポジトリの`projects/README.md`のルールにより、基本は`projects/<project-name>/`配下に1プロジェクトとして自己完結させる。
   - ユーザーがプロジェクト名を明示していなければ、目的から適切な名前を判断してよい。判断に迷う場合だけ確認する。
   - 既に同名のディレクトリが存在する場合は上書きしてよいか必ず確認する。

5. **テンプレートをコピーし、プレースホルダを置換する**
   - `.claude/skills/pnpm-nvm-project/templates/package.json` → `<配置先>/package.json`（`__PROJECT_NAME__`を置換）
   - `.claude/skills/pnpm-nvm-project/templates/.npmrc` → `<配置先>/.npmrc`（置換不要）
   - `.claude/skills/pnpm-nvm-project/templates/index.js` → `<配置先>/index.js`
   - `.claude/skills/pnpm-nvm-project/templates/README.md` → `<配置先>/README.md`（`__PROJECT_NAME__`を置換）
   - `.claude/skills/pnpm-nvm-project/templates/.gitignore` → `<配置先>/.gitignore`（置換不要）

6. **依存関係を同期し、動作確認する**
   `<配置先>`に移動し、以下を確認する。確認後、テストで作った一時的な依存追加や`pnpm-lock.yaml`/`node_modules`は元に戻す/削除すること。
   - `pnpm install`を実行し、`pnpm-lock.yaml`が生成されることを確認する（これはコミット対象）。
   - `pnpm start`（内部で`node index.js`を実行）が動くことを確認する。
   - `pnpm config get minimum-release-age`が`10080`、`npm config get min-release-age`が`7`を返すことを確認する。
   - `ignore-scripts`が効いているかは、postinstallスクリプトを持つ適当なパッケージを試験的に追加し、そのスクリプトのログが出力されないことを確認する。確認後はそのパッケージを取り除く。

7. **（任意）bash補完を有効化する**
   - nvmの補完は公式インストーラーが`~/.bashrc`に自動追記済みのため、追加作業は不要。
   - pnpmの補完はroot権限なしで使えるユーザー単位のディレクトリに配置する:
     ```bash
     mkdir -p ~/.local/share/bash-completion/completions
     pnpm completion bash > ~/.local/share/bash-completion/completions/pnpm
     ```
   - これもユーザーのホーム配下にファイルを追加する操作なので、実施してよいか確認してから行う。

## このスキルの対象外

- Docker/devcontainer環境の構築自体はこのスキルの対象外。コンテナ環境が欲しいと言われたら[[devcontainer-ubuntu-ja]]スキルを使う（このスキルと組み合わせる必要はなく、独立して使われることを想定している）。
- corepackを使わない方針、pnpmを10系に固定する方針、`.npmrc`の3設定はこのリポジトリで検証済みの固定条件として扱い、単なる「pnpm環境作って」的な依頼でも省略しない。
