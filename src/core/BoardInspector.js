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

        countByColor(color) {
            return this._pieces.filter(p => p.color === color).length;
        }

        getPiecesByColor(color) {
            return this._pieces.filter(p => p.color === color);
        }

        getPiecesWithCoordsByColor(color) {
            const out = [];
            for (let r = 0; r < this._board.length; r++) {
                const row = this._board[r];
                for (let c = 0; c < row.length; c++) {
                    const p = row[c];
                    if (p && p.color === color) out.push({ piece: p, row: r, col: c });
                }
            }
            return out;
        }
    }
