    // Shared utility: algebraic square (e.g. "e4") → [row, col] (0-indexed, row 0 = rank 8)
    function parseChessPosition(square) {
        const col = square.charCodeAt(0) - 97;
        const row = 8 - parseInt(square[1]);
        return [row, col];
    }

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

        createBoard() {
            return Array.from({length: 8}, () => Array(8).fill(null));
        }

        setPiecesFromFen(fen, pieces) {
            this.pieces = [...pieces];
            // revert any promotion mutations so deck pieces return to their original type
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

        // Returns array of physical move descriptors (2 for castling, 1 otherwise).
        // Does not emit — ChessGame aggregates these into a single 'turn' event.
        move({ from, to, enPassant, promotion, isKingsideCastle, isQueensideCastle, player }) {
            const [fromRow, fromCol] = parseChessPosition(from);
            const [toRow, toCol] = parseChessPosition(to);

            if (isKingsideCastle) {
                const piece = this._board[fromRow][4];
                const rook = this._board[fromRow][7];
                this._board[fromRow][6] = piece;
                this._board[fromRow][5] = rook;
                this._board[fromRow][4] = null;
                this._board[fromRow][7] = null;
                return [
                    { piece, pieceId: piece.id, captured: null, fromRow, fromCol: 4, toRow: fromRow, toCol: 6, capturedRow: null, capturedCol: null, player },
                    { piece: rook, pieceId: rook.id, captured: null, fromRow, fromCol: 7, toRow: fromRow, toCol: 5, capturedRow: null, capturedCol: null, player },
                ];
            }

            if (isQueensideCastle) {
                const piece = this._board[fromRow][4];
                const rook = this._board[fromRow][0];
                this._board[fromRow][2] = piece;
                this._board[fromRow][3] = rook;
                this._board[fromRow][4] = null;
                this._board[fromRow][0] = null;
                return [
                    { piece, pieceId: piece.id, captured: null, fromRow, fromCol: 4, toRow: fromRow, toCol: 2, capturedRow: null, capturedCol: null, player },
                    { piece: rook, pieceId: rook.id, captured: null, fromRow, fromCol: 0, toRow: fromRow, toCol: 3, capturedRow: null, capturedCol: null, player },
                ];
            }

            const piece = this._board[fromRow][fromCol];
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
                piece.type = piece.color() === 'w' ? promotion.toUpperCase() : promotion.toLowerCase();
            }

            this._board[toRow][toCol] = piece;
            this._board[fromRow][fromCol] = null;
            return [{ piece, pieceId: piece.id, captured, fromRow, fromCol, toRow, toCol,
                capturedRow: captured ? capturedRow : null,
                capturedCol: captured ? capturedCol : null,
                promotion: promotion || null, player }];
        }
    }
