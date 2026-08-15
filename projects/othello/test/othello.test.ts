import { describe, expect, it } from "vitest";
import {
  applyMove,
  createInitialBoard,
  createInitialGameState,
  getValidMoves,
  getWinner,
  opponentOf,
  type Board,
} from "../src/othello.ts";

describe("opponentOf", () => {
  it("returns white for black and black for white", () => {
    expect(opponentOf("black")).toBe("white");
    expect(opponentOf("white")).toBe("black");
  });
});

describe("createInitialBoard", () => {
  it("places the standard four starting discs in the center", () => {
    const board = createInitialBoard();
    expect(board[3][3]).toBe("white");
    expect(board[3][4]).toBe("black");
    expect(board[4][3]).toBe("black");
    expect(board[4][4]).toBe("white");
  });

  it("leaves every other square empty", () => {
    const board = createInitialBoard();
    let filled = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell !== null) filled++;
      }
    }
    expect(filled).toBe(4);
  });
});

describe("getValidMoves", () => {
  it("finds the four legal opening moves for black", () => {
    const board = createInitialBoard();
    const moves = getValidMoves(board, "black");
    const sorted = moves.map((m) => `${m.row},${m.col}`).sort();
    expect(sorted).toEqual(["2,3", "3,2", "4,5", "5,4"]);
  });

  it("returns no moves on a board with no valid placements", () => {
    const board: Board = Array.from({ length: 8 }, () => Array<null>(8).fill(null));
    board[0][0] = "black";
    expect(getValidMoves(board, "white")).toEqual([]);
  });
});

describe("applyMove", () => {
  it("flips the bracketed opponent discs and switches turns", () => {
    const state = createInitialGameState();
    const next = applyMove(state, { row: 2, col: 3 });

    expect(next.board[2][3]).toBe("black");
    expect(next.board[3][3]).toBe("black");
    expect(next.currentPlayer).toBe("white");
    expect(next.blackCount).toBe(4);
    expect(next.whiteCount).toBe(1);
  });

  it("leaves the state unchanged for an illegal move", () => {
    const state = createInitialGameState();
    const next = applyMove(state, { row: 0, col: 0 });
    expect(next).toBe(state);
  });

  it("skips a player's turn (pass) when they have no legal move", () => {
    const board: Board = Array.from({ length: 8 }, () => Array<null>(8).fill(null));
    // 黒が(0,2)に置いて白を1枚取る一方、盤の別の場所(5,6)(5,7)には
    // 黒がのちに取れる白石を残しておく。これにより着手後、白は合法手が無くパスし、
    // 黒には合法手が残っているためゲームは終了しない、という状況を作る。
    board[0][0] = "black";
    board[0][1] = "white";
    board[5][6] = "white";
    board[5][7] = "black";
    const state = {
      board,
      currentPlayer: "black" as const,
      blackCount: 2,
      whiteCount: 2,
      isGameOver: false,
      wasPass: false,
    };
    const next = applyMove(state, { row: 0, col: 2 });
    expect(next.wasPass).toBe(true);
    expect(next.currentPlayer).toBe("black");
    expect(next.isGameOver).toBe(false);
  });

  it("ends the game when neither player has a legal move", () => {
    const board: Board = Array.from({ length: 8 }, () => Array<null>(8).fill("black"));
    board[7][7] = null;
    const state = {
      board: board.map((row, r) =>
        row.map((cell, c) => (r === 6 && c === 7 ? "white" : cell)),
      ) as Board,
      currentPlayer: "black" as const,
      blackCount: 62,
      whiteCount: 1,
      isGameOver: false,
      wasPass: false,
    };
    const next = applyMove(state, { row: 7, col: 7 });
    expect(next.isGameOver).toBe(true);
  });
});

describe("getWinner", () => {
  it("returns null while the game is still in progress", () => {
    expect(getWinner(createInitialGameState())).toBeNull();
  });

  it("returns the player with more discs when the game is over", () => {
    const state = { ...createInitialGameState(), isGameOver: true, blackCount: 40, whiteCount: 24 };
    expect(getWinner(state)).toBe("black");
  });

  it("returns 'draw' when both players end with equal discs", () => {
    const state = { ...createInitialGameState(), isGameOver: true, blackCount: 32, whiteCount: 32 };
    expect(getWinner(state)).toBe("draw");
  });
});
