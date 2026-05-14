    // Move domain types: shared by ChessGame, Chessboard, PowerContext, InputController.
    //
    // MoveIntent  — what the player/engine wants. Algebraic, no board context.
    // MoveEffect  — physical board change record. Output of Chessboard.move.
    //
    // Castle / en-passant flags are internal adapter details between ChessGame and
    // Chessboard — not part of the domain. They live on the private flags arg.

    // Algebraic square (e.g. "e4") → [row, col] (0-indexed, row 0 = rank 8).
    function parseChessPosition(square) {
        if (typeof square !== 'string' || !/^[a-h][1-8]$/.test(square)) {
            throw new Error(`parseChessPosition: invalid square "${square}"`);
        }
        const col = square.charCodeAt(0) - 97;
        const row = 8 - parseInt(square[1]);
        return [row, col];
    }

    // [row, col] → algebraic square ("e4").
    function toChessSquare(row, col) {
        return String.fromCharCode(97 + col) + (8 - row);
    }

    // Player/engine intent for a move. Algebraic. Promotion is piece char ('q','r','b','n') or null.
    function MoveIntent({ from, to, promotion = null, san = null }) {
        return Object.freeze({ from, to, promotion: promotion || null, san: san || null });
    }

    // Physical board change record. Live Piece refs allowed — ChessGame snapshots before emit.
    function MoveEffect({
        piece, captured = null,
        fromRow, fromCol, toRow, toCol,
        capturedRow = null, capturedCol = null,
        promotion = null, player = null,
    }) {
        return Object.freeze({
            piece,
            pieceId: piece?.id ?? null,
            captured,
            fromRow, fromCol, toRow, toCol,
            capturedRow, capturedCol,
            promotion: promotion || null,
            player,
        });
    }

    // Same as MoveEffect but with piece/captured snapshotted — safe to leak outside the engine.
    function snapshotMoveEffect(effect) {
        return Object.freeze({
            ...effect,
            piece: effect.piece?.toSnapshot ? effect.piece.toSnapshot() : (effect.piece ?? null),
            captured: effect.captured?.toSnapshot ? effect.captured.toSnapshot() : (effect.captured ?? null),
        });
    }
