# snes-style-city-sim（ドットメトロポリス）

スーパーファミコン期の都市開発シミュレーションの「システム」を再現した、**オリジナルの**都市開発シム。
ブラウザ上で動く TypeScript + Canvas 2D 製で、内部解像度 256x224 を整数倍に拡大して表示する。

> 既存商用ゲームのROM・画像・音源・マップデータ・登場キャラクターは一切使用していない。
> ドット絵・BGM/効果音・シナリオはすべて本プロジェクトで新規に作成したもの。

## 目的

- 都市シミュレーション（電力網・道路網・地価/公害/犯罪・区画の成長と衰退・予算）を自前で実装する練習
- レトロ機風の描画（限定パレット、16x16タイル、8x8ビットマップフォント）の練習

## 実行方法

前提: nvm で導入した Node.js と pnpm 10 系。

```bash
pnpm install
pnpm run dev        # 開発サーバを起動し、表示されたURLをブラウザで開く
```

## 開発コマンド

| コマンド                 | 内容                                               |
| ------------------------ | -------------------------------------------------- |
| `pnpm run dev`           | Vite の開発サーバを起動する                        |
| `pnpm run build`         | `dist/` に本番ビルドを出力する                     |
| `pnpm run preview`       | ビルド結果をローカルで配信して確認する             |
| `pnpm run typecheck`     | 型チェック（本体・テストの両方）                   |
| `pnpm run lint`          | ESLint（JSDoc必須チェックを含む）                  |
| `pnpm run format`        | Prettier で整形する                                |
| `pnpm test`              | Vitest でシミュレーションのユニットテストを実行    |
| `pnpm run test:coverage` | カバレッジHTMLレポートを `coverage/` に生成する    |
| `pnpm run docs`          | TypeDoc のAPIリファレンスを `docs/api/` に生成する |

初回のみ、Git hooks（コミット時の自動lint/format）を有効化するために以下を実行する。
`.npmrc` の `ignore-scripts=true` により `pnpm install` では自動実行されない。

```bash
pnpm run prepare
```

## 構成

- `src/sim/` — シミュレーション本体。**DOM・Canvas・WebAudio に依存させない**（node環境でそのままテストするため）
- `src/render/` — パレット・ドット絵・タイルアトラス・画面描画
- `src/ui/` — 建設ツール、入力、各画面
- `src/audio/` — WebAudio による効果音とBGMの合成
- `test/sim/` — シミュレーションのユニットテスト
