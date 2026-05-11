    // Builds read-only context passed to power actions.
    // No engine refs — powers get facts only, never direct engine access.

    // Extract scoring-safe primitives from a Piece — no live object refs leak out.
    function pieceDTO(piece) {
        if (!piece) return null;
        return Object.freeze({
            id: piece.id,
            role: piece.type,
            color: piece.color(),
            modifiers: Object.freeze([...piece.modifiers]),
            name: piece.name ?? null,
        });
    }

    // Extract scoring-safe primitives from a move record — no live Piece refs leak out.
    function moveDTO(move) {
        if (!move) return null;
        return Object.freeze({
            piece: pieceDTO(move.piece),
            pieceId: move.pieceId ?? move.piece?.id ?? null,
            captured: pieceDTO(move.captured),
            fromRow: move.fromRow,
            fromCol: move.fromCol,
            toRow: move.toRow,
            toCol: move.toCol,
            capturedRow: move.capturedRow ?? null,
            capturedCol: move.capturedCol ?? null,
            promotion: move.promotion ?? null,
            player: move.player ?? null,
        });
    }

    // Extract scoring-safe primitives from a turn record — no live move or Piece refs leak out.
    function turnDTO(turn) {
        if (!turn) return null;
        const moves = Object.freeze((turn.moves ?? []).map(moveDTO));
        const primaryMove = turn.primaryMove
            ? moveDTO(turn.primaryMove)
            : (moves[0] ?? null);

        return Object.freeze({
            player: turn.player ?? null,
            moves,
            primaryMove,
            captured: pieceDTO(turn.captured),
            isCastle: !!turn.isCastle,
            isEnPassant: !!turn.isEnPassant,
            isCheck: !!turn.isCheck,
            isCheckmate: !!turn.isCheckmate,
            promotion: turn.promotion ?? null,
        });
    }

    function buildPowerContext({ chessGame, chessboard, scoreEngine, turn, lastMove, playerColor } = {}) {
        return Object.freeze({
            fen: chessGame?.fen() ?? null,
            currentScore: scoreEngine?.score ?? 0,
            lastMove: moveDTO(lastMove),
            turn: turnDTO(turn),
            playerColor: playerColor ?? null,
            boardInspector: chessboard ? new BoardInspector(chessboard.getState()) : null,
        });
    }
