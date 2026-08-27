/**
 * キーボードとマウスの入力状態。
 *
 * canvasは内部解像度のまま置いてCSSで整数倍に拡大しているので、
 * マウス座標は必ず内部解像度（256x224）へ換算してから使う。
 * @packageDocumentation
 */

/** マウスの押下状態と座標。 */
export interface PointerState {
  /** 内部解像度に換算したX座標。 */
  x: number;
  /** 内部解像度に換算したY座標。 */
  y: number;
  /** 左ボタンが押されているか。 */
  down: boolean;
  /** 右ボタンが押されているか。 */
  rightDown: boolean;
  /** 画面上にカーソルがあるか。 */
  inside: boolean;
}

/** 直前のフレームからのマウス移動量。 */
export interface PointerDelta {
  /** 横方向の移動量（ドット）。 */
  x: number;
  /** 縦方向の移動量（ドット）。 */
  y: number;
}

/** 入力状態をまとめて保持する。 */
export class Input {
  /** 現在押されているキーのコード。 */
  private readonly keys = new Set<string>();
  /** このフレームで新たに押されたキーのコード。 */
  private readonly pressed = new Set<string>();
  /** マウスの状態。 */
  readonly pointer: PointerState = { x: 0, y: 0, down: false, rightDown: false, inside: false };
  /** 直前のフレームからのマウス移動量（内部解像度基準）。 */
  readonly pointerDelta: PointerDelta = { x: 0, y: 0 };
  /** このフレームで左ボタンが押された瞬間かどうか。 */
  clicked = false;
  /** このフレームで左ボタンが離された瞬間かどうか。 */
  released = false;
  /** このフレームのホイール回転量。 */
  wheel = 0;

  private lastX = 0;
  private lastY = 0;

  /**
   * @param canvas イベントを受け取るcanvas要素。
   */
  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      // 矢印キーやスペースでページがスクロールしてしまうのを防ぐ。
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("pointermove", (e) => this.updatePointer(e));
    canvas.addEventListener("pointerdown", (e) => {
      this.updatePointer(e);
      if (e.button === 0) {
        this.pointer.down = true;
        this.clicked = true;
        canvas.setPointerCapture(e.pointerId);
      } else if (e.button === 2) {
        this.pointer.rightDown = true;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener("pointerup", (e) => {
      this.updatePointer(e);
      if (e.button === 0) {
        this.pointer.down = false;
        this.released = true;
      } else if (e.button === 2) {
        this.pointer.rightDown = false;
      }
    });
    canvas.addEventListener("pointerleave", () => {
      this.pointer.inside = false;
    });
    canvas.addEventListener("wheel", (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /**
   * ブラウザのイベント座標を内部解像度に換算して取り込む。
   * @param event 位置を持つポインタイベント。
   */
  private updatePointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.pointer.x = Math.floor((event.clientX - rect.left) * scaleX);
    this.pointer.y = Math.floor((event.clientY - rect.top) * scaleY);
    this.pointer.inside = true;
  }

  /** このフレームで何かキーが押されたか。 */
  get anyKeyPressed(): boolean {
    return this.pressed.size > 0;
  }

  /**
   * キーが押されているか。
   * @param code `KeyboardEvent.code` の値。
   */
  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /**
   * 指定したキーのいずれかが押されているか。
   * @param codes `KeyboardEvent.code` の値の並び。
   */
  isAnyDown(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  /**
   * このフレームで押された瞬間かどうか。
   * @param code `KeyboardEvent.code` の値。
   */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** 1フレーム分の入力処理が終わったあとに呼び、単発の状態を消す。 */
  endFrame(): void {
    this.pressed.clear();
    this.clicked = false;
    this.released = false;
    this.wheel = 0;
    this.pointerDelta.x = this.pointer.x - this.lastX;
    this.pointerDelta.y = this.pointer.y - this.lastY;
    this.lastX = this.pointer.x;
    this.lastY = this.pointer.y;
  }
}
