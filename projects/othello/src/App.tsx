import { useMemo, useState } from "react";
import {
  applyMove,
  createInitialGameState,
  getValidMoves,
  getWinner,
  opponentOf,
  type GameState,
  type Player,
} from "./othello.ts";
import "./App.css";

const PLAYER_LABEL: Record<Player, string> = {
  black: "黒",
  white: "白",
};

function App() {
  const [state, setState] = useState<GameState>(() => createInitialGameState());

  const validMoves = useMemo(
    () => getValidMoves(state.board, state.currentPlayer),
    [state.board, state.currentPlayer],
  );
  const validMoveKeys = useMemo(
    () => new Set(validMoves.map((m) => `${m.row},${m.col}`)),
    [validMoves],
  );

  const winner = getWinner(state);

  const handleCellClick = (row: number, col: number) => {
    if (state.isGameOver) return;
    setState((prev) => applyMove(prev, { row, col }));
  };

  const handleReset = () => {
    setState(createInitialGameState());
  };

  let statusMessage: string;
  if (state.isGameOver) {
    statusMessage =
      winner === "draw" ? "引き分けです" : `${PLAYER_LABEL[winner as Player]}の勝ちです`;
  } else if (state.wasPass) {
    statusMessage = `${PLAYER_LABEL[opponentOf(state.currentPlayer)]}は置けないためパスしました。${PLAYER_LABEL[state.currentPlayer]}の番です`;
  } else {
    statusMessage = `${PLAYER_LABEL[state.currentPlayer]}の番です`;
  }

  return (
    <div className="othello">
      <h1>オセロ</h1>

      <div className="scoreboard">
        <div className="score">
          <span className="disc disc-black" aria-hidden="true" />
          黒: {state.blackCount}
        </div>
        <div className="score">
          <span className="disc disc-white" aria-hidden="true" />
          白: {state.whiteCount}
        </div>
      </div>

      <p className="status" role="status">
        {statusMessage}
      </p>

      <div className="board">
        {state.board.map((rowCells, row) =>
          rowCells.map((cell, col) => {
            const key = `${row},${col}`;
            const isValidMove = validMoveKeys.has(key);
            return (
              <button
                key={key}
                type="button"
                className="cell"
                disabled={state.isGameOver || (!isValidMove && cell === null)}
                aria-label={`${row + 1}行${col + 1}列`}
                onClick={() => handleCellClick(row, col)}
              >
                {cell !== null && <span className={`disc disc-${cell}`} />}
                {cell === null && isValidMove && <span className="hint" />}
              </button>
            );
          }),
        )}
      </div>

      <button type="button" className="reset" onClick={handleReset}>
        リセット
      </button>
    </div>
  );
}

export default App;
