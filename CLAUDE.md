# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの性質

Claudeの練習用モノレポ。特定の技術スタックに縛られず、`projects/` 配下に言語・フレームワークの異なる独立したプロジェクトを追加していく前提の構成。ルートに共通のビルドツールやパッケージマネージャは置かない。

## 構成

- `projects/<project-name>/` — 各プロジェクトはこの配下に1ディレクトリずつ、自己完結した形で追加する（依存関係ファイルも各ディレクトリ直下に置く）
- ルールの詳細は `projects/README.md` を参照

## 新しいプロジェクトを追加するとき

- `projects/` 直下に新しいディレクトリを作成し、その中で完結させる（ルートの設定ファイルに依存させない）
- 各プロジェクトディレクトリに簡単な README を置き、目的と実行方法を書く
- ビルド・テスト・実行コマンドはプロジェクトごとに異なるため、各プロジェクトの README を参照する
