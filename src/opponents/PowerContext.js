    // Builds read-only context passed to power actions.
    // No engine refs — powers get facts only, never direct engine access.
    //
    // turn.moves[] and lastMove are MoveEffect — already snapshot-frozen by ChessGame.

    function buildPowerContext({ chessGame, chessboard, scoreEngine, turn, lastMove, playerColor } = {}) {
        return Object.freeze({
            fen: chessGame?.fen() ?? null,
            currentScore: scoreEngine?.score ?? 0,
            lastMove: lastMove ?? null,
            turn: turn ? Object.freeze({ ...turn, moves: Object.freeze([...(turn.moves ?? [])]) }) : null,
            playerColor: playerColor ?? null,
            boardInspector: chessboard ? new BoardInspector(chessboard.getState()) : null,
        });
    }
