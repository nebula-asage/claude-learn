/**
 * ゲーム全体の組み立てとメインループ。
 * @packageDocumentation
 */

/**
 * 指定したcanvas要素でゲームを起動する。
 * @param canvasId 描画先となるcanvas要素のid。
 */
export function startGame(canvasId: string): void {
  const canvas = document.getElementById(canvasId);
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`画面用のcanvas要素が見つかりません: #${canvasId}`);
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2Dコンテキストを取得できません");

  ctx.fillStyle = "#204028";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
