    // Read-only board analysis. Operates on a Chessboard.getState() snapshot.
    // Add all position queries here — never on ChessGame.
    class BoardInspector {
        constructor(boardState) {
            this._board = boardState;
            this._pieces = boardState.flat().filter(Boolean);
        }

        hasBishopPair(color) {
            return this._pieces.filter(p => p.type.toLowerCase() === 'b' && p.color === color).length >= 2;
        }

        getPieceCount(type, color) {
            return this._pieces.filter(p => p.type.toLowerCase() === type.toLowerCase() && p.color === color).length;
        }
    }
