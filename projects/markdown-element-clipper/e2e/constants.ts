// e2eの固定値。playwright.config.ts とテスト側の両方から参照する。

/** fixtures/ を配信する静的サーバのポート。他プロジェクトと衝突しにくい値にしている。 */
export const FIXTURE_PORT = 8123;

/**
 * fixtureの配信元。localhostはsecure contextとして扱われるため、
 * `navigator.clipboard` が存在する状態(=本番相当の経路)でテストできる。
 */
export const FIXTURE_ORIGIN = `http://localhost:${FIXTURE_PORT}`;

/** 動作確認用ページのURL。 */
export const SAMPLE_URL = `${FIXTURE_ORIGIN}/sample.html`;
