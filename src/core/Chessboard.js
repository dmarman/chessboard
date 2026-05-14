    class Chessboard {
        constructor() {
            this._board = this.createBoard();
            this.pieces = [];
        }

        getState() {
            return this._board.map(row => row.map(piece => piece ? piece.toSnapshot() : null));
        }

        getPieceAt(pos) {
            const [row, col] = parseChessPosition(pos);
            return this._board[row][col];
        }

        // Removes a piece by id from both the 8x8 board and the deck array.
        // Returns { piece, row, col } if found, or null if not present.
        removePieceById(id) {
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const piece = this._board[row][col];
                    if (piece?.id === id) {
                        this._board[row][col] = null;
                        this.pieces = this.pieces.filter(p => p.id !== id);
                        return { piece, row, col };
                    }
                }
            }
            return null;
        }

        createBoard() {
            return Array.from({length: 8}, () => Array(8).fill(null));
        }

        setPiecesFromFen(fen, pieces) {
            this.pieces = [...pieces];
            // revert in-place promotions so deck pieces return to original type before re-placing
            this.pieces.forEach(p => p.revertToOriginalType());
            this._board = this.createBoard();
            const consumed = new Set();

            const rows = fen.split(' ')[0].split('/');
            for (let i = 0; i < 8; i++) {
                let colIndex = 0;
                for (const char of rows[i]) {
                    if (isNaN(parseInt(char))) {
                        const index = this.pieces.findIndex((p, idx) => p.type === char && !consumed.has(idx));
                        if (index !== -1) {
                            this._board[i][colIndex] = this.pieces[index];
                            consumed.add(index);
                        } else {
                            console.warn(`setPiecesFromFen: no deck piece found for FEN char '${char}' at row ${i} col ${colIndex}. Square left empty.`);
                        }
                        colIndex++;
                    } else {
                        colIndex += parseInt(char);
                    }
                }
            }
        }

        // Applies a MoveIntent plus engine-derived adapter flags. Returns MoveEffect[]
        // (2 for castling, 1 otherwise). Does not emit — ChessGame aggregates into 'turn'.
        move(intent, { enPassant = false, isKingsideCastle = false, isQueensideCastle = false, player = null } = {}) {
            const { from, to, promotion } = intent;
            const [fromRow, fromCol] = parseChessPosition(from);
            const [toRow, toCol] = parseChessPosition(to);

            if (isKingsideCastle) {
                const piece = this._board[fromRow][4];
                const rook = this._board[fromRow][7];
                if (!piece) throw new Error(`Chessboard.move: kingside castle — no king at (${fromRow},4)`);
                if (!rook) throw new Error(`Chessboard.move: kingside castle — no rook at (${fromRow},7)`);
                this._board[fromRow][6] = piece;
                this._board[fromRow][5] = rook;
                this._board[fromRow][4] = null;
                this._board[fromRow][7] = null;
                return [
                    MoveEffect({ piece, fromRow, fromCol: 4, toRow: fromRow, toCol: 6, player }),
                    MoveEffect({ piece: rook, fromRow, fromCol: 7, toRow: fromRow, toCol: 5, player }),
                ];
            }

            if (isQueensideCastle) {
                const piece = this._board[fromRow][4];
                const rook = this._board[fromRow][0];
                if (!piece) throw new Error(`Chessboard.move: queenside castle — no king at (${fromRow},4)`);
                if (!rook) throw new Error(`Chessboard.move: queenside castle — no rook at (${fromRow},0)`);
                this._board[fromRow][2] = piece;
                this._board[fromRow][3] = rook;
                this._board[fromRow][4] = null;
                this._board[fromRow][0] = null;
                return [
                    MoveEffect({ piece, fromRow, fromCol: 4, toRow: fromRow, toCol: 2, player }),
                    MoveEffect({ piece: rook, fromRow, fromCol: 0, toRow: fromRow, toCol: 3, player }),
                ];
            }

            let piece = this._board[fromRow][fromCol];
            if (!piece) throw new Error(`Chessboard.move: no piece at ${from} (${fromRow},${fromCol})`);

            let captured = this._board[toRow][toCol];
            let capturedRow = toRow, capturedCol = toCol;

            if (enPassant) {
                // en passant: captured pawn sits on moving pawn's rank, destination file
                captured = this._board[fromRow][toCol];
                this._board[fromRow][toCol] = null;
                capturedRow = fromRow;
                capturedCol = toCol;
            }

            if (promotion) {
                const promotedType = piece.color() === 'w' ? promotion.toUpperCase() : promotion.toLowerCase();
                piece = piece.promote(promotedType);
            }

            this._board[toRow][toCol] = piece;
            this._board[fromRow][fromCol] = null;
            return [MoveEffect({
                piece, captured,
                fromRow, fromCol, toRow, toCol,
                capturedRow: captured ? capturedRow : null,
                capturedCol: captured ? capturedCol : null,
                promotion, player,
            })];
        }
    }
