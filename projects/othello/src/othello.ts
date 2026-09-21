/**
 * @packageDocumentation
 * オセロ(リバーシ)のゲームロジック。UIを持たない純粋なボード操作関数群。
 */

/** マスに置かれている石の種類、または空きマス。 */
export type Disc = "black" | "white" | null;

/** 8x8のオセロ盤。`board[row][col]` の順でアクセスする。 */
export type Board = Disc[][];

/** 手番のプレイヤー。 */
export type Player = "black" | "white";

/** 盤面上の位置。 */
export interface Position {
  /** 行インデックス(0始まり、0〜7)。 */
  row: number;
  /** 列インデックス(0始まり、0〜7)。 */
  col: number;
}

/** ゲーム全体の状態。 */
export interface GameState {
  /** 現在の盤面。 */
  board: Board;
  /** 現在の手番。 */
  currentPlayer: Player;
  /** 黒石の数。 */
  blackCount: number;
  /** 白石の数。 */
  whiteCount: number;
  /** 双方が置けずゲームが終了したかどうか。 */
  isGameOver: boolean;
  /** 直前の手番がパス(合法手なし)だったかどうか。 */
  wasPass: boolean;
}

const BOARD_SIZE = 8;

const DIRECTIONS: readonly Position[] = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

/**
 * 相手の色を返す。
 * @param player 基準にするプレイヤー
 */
export function opponentOf(player: Player): Player {
  return player === "black" ? "white" : "black";
}

/**
 * オセロの初期配置(中央4マスに互い違いの石)を持つ盤面を生成する。
 */
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): Disc => null),
  );
  board[3][3] = "white";
  board[3][4] = "black";
  board[4][3] = "black";
  board[4][4] = "white";
  return board;
}

/**
 * 初期状態のゲームを生成する。黒が先手。
 */
export function createInitialGameState(): GameState {
  return {
    board: createInitialBoard(),
    currentPlayer: "black",
    blackCount: 2,
    whiteCount: 2,
    isGameOver: false,
    wasPass: false,
  };
}

function isOnBoard(pos: Position): boolean {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
}

/**
 * 指定したマスに指定したプレイヤーが石を置いた場合に、ひっくり返せる石の位置一覧を返す。
 * 置けない手の場合は空配列を返す。
 * @param board 現在の盤面
 * @param pos 石を置くマス
 * @param player 石を置くプレイヤー
 */
export function getFlips(board: Board, pos: Position, player: Player): Position[] {
  if (!isOnBoard(pos) || board[pos.row][pos.col] !== null) {
    return [];
  }

  const opponent = opponentOf(player);
  const flips: Position[] = [];

  for (const dir of DIRECTIONS) {
    const line: Position[] = [];
    let cur: Position = { row: pos.row + dir.row, col: pos.col + dir.col };

    while (isOnBoard(cur) && board[cur.row][cur.col] === opponent) {
      line.push(cur);
      cur = { row: cur.row + dir.row, col: cur.col + dir.col };
    }

    if (line.length > 0 && isOnBoard(cur) && board[cur.row][cur.col] === player) {
      flips.push(...line);
    }
  }

  return flips;
}

/**
 * 指定したプレイヤーが指定したマスに石を置けるかどうかを判定する。
 * @param board 現在の盤面
 * @param pos 判定するマス
 * @param player 石を置くプレイヤー
 */
export function isValidMove(board: Board, pos: Position, player: Player): boolean {
  return getFlips(board, pos, player).length > 0;
}

/**
 * 指定したプレイヤーが置ける全マスの一覧を返す。
 * @param board 現在の盤面
 * @param player 手番のプレイヤー
 */
export function getValidMoves(board: Board, player: Player): Position[] {
  const moves: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (isValidMove(board, { row, col }, player)) {
        moves.push({ row, col });
      }
    }
  }
  return moves;
}

function countDiscs(board: Board): { blackCount: number; whiteCount: number } {
  let blackCount = 0;
  let whiteCount = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === "black") blackCount++;
      else if (cell === "white") whiteCount++;
    }
  }
  return { blackCount, whiteCount };
}

/**
 * 現在の手番のプレイヤーが指定マスに石を置いた結果の新しいゲーム状態を返す。
 * 合法手でない場合は状態を変更せずそのまま返す。
 * 着手後、次のプレイヤーに合法手が無ければ手番を戻し(パス)、双方とも置けなければゲーム終了とする。
 * @param state 現在のゲーム状態
 * @param pos 石を置くマス
 */
export function applyMove(state: GameState, pos: Position): GameState {
  if (state.isGameOver) {
    return state;
  }

  const flips = getFlips(state.board, pos, state.currentPlayer);
  if (flips.length === 0) {
    return state;
  }

  const board: Board = state.board.map((row) => [...row]);
  board[pos.row][pos.col] = state.currentPlayer;
  for (const flip of flips) {
    board[flip.row][flip.col] = state.currentPlayer;
  }

  return advanceTurn(board, opponentOf(state.currentPlayer));
}

function advanceTurn(board: Board, nextPlayer: Player): GameState {
  const { blackCount, whiteCount } = countDiscs(board);

  if (getValidMoves(board, nextPlayer).length > 0) {
    return {
      board,
      currentPlayer: nextPlayer,
      blackCount,
      whiteCount,
      isGameOver: false,
      wasPass: false,
    };
  }

  const playerAfterPass = opponentOf(nextPlayer);
  if (getValidMoves(board, playerAfterPass).length > 0) {
    return {
      board,
      currentPlayer: playerAfterPass,
      blackCount,
      whiteCount,
      isGameOver: false,
      wasPass: true,
    };
  }

  return {
    board,
    currentPlayer: nextPlayer,
    blackCount,
    whiteCount,
    isGameOver: true,
    wasPass: false,
  };
}

/**
 * 勝敗を判定する。ゲームが終了していない場合は `null` を返す。
 * @param state 現在のゲーム状態
 */
export function getWinner(state: GameState): Player | "draw" | null {
  if (!state.isGameOver) {
    return null;
  }
  if (state.blackCount > state.whiteCount) return "black";
  if (state.whiteCount > state.blackCount) return "white";
  return "draw";
}
