# projects/

このディレクトリ配下に、独立したプロジェクトを1つずつサブディレクトリとして追加します。

## ルール

- 1プロジェクト = 1ディレクトリ（例: `projects/hello-python/`, `projects/todo-cli-go/`）
- 各プロジェクトは自己完結させる。依存関係の管理ファイル（`package.json` / `requirements.txt` / `go.mod` など）はプロジェクトディレクトリの直下に置き、ルートに共通のビルド設定は持たない
- 各プロジェクトに簡単な `README.md` を置き、目的・実行方法を書く
- 言語・技術スタックはプロジェクトごとに自由（JS/TS, Python, Go など混在可）
- VS Code向けの設定（`settings.json`/`extensions.json`）はルートにはまとめず、各プロジェクト直下の `.vscode/` に置く
- devcontainer環境（`.devcontainer/devcontainer.json` を持つプロジェクト）では、推奨拡張機能は `.vscode/extensions.json` ではなく `devcontainer.json` の `customizations.vscode.extensions` に書く（`.vscode/extensions.json` は作らない）
- ビルド・テスト・lint等で生成される成果物（カバレッジレポート、APIドキュメント、`node_modules/`、`dist/` など）はコミットせず、各プロジェクトの `.gitignore` に列挙して管理する
