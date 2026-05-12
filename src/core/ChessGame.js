    class ChessGame extends EventEmitter {
        constructor(chessboard) {
            super();
            this._chess = new Chess();
            this._chessboard = chessboard;
        }

        setPiecesFromFen(fen, pieces) {
            this._chess.load(fen);
            this._chessboard.setPiecesFromFen(fen, pieces);
        }

        reset() {
            this._chess.reset();
        }

        // Returns domain move descriptors {from, to, san, promotion} — no raw chess.js shapes.
        moves() {
            return this._chess.moves({ verbose: true }).map(m => ({
                from: m.from,
                to: m.to,
                san: m.san,
                promotion: m.promotion || null,
            }));
        }

        // Returns snapshotted move descriptors or null. Never leaks live Piece refs.
        move(move, player = null) {
            const chessMove = this._chess.move(move); // Parse stockfish move to chess.js move
            if (!chessMove) return null;

            const physicalMoves = this._chessboard.move({
                from: chessMove.from,
                to: chessMove.to,
                enPassant: chessMove.isEnPassant(),
                promotion: chessMove.promotion,
                isKingsideCastle: chessMove.isKingsideCastle(),
                isQueensideCastle: chessMove.isQueensideCastle(),
                player,
            }).map(m => Object.freeze({
                ...m,
                piece: m.piece?.toSnapshot() ?? null,
                captured: m.captured?.toSnapshot() ?? null,
            }));

            // Emit one logical turn event per chess move, regardless of how many
            // pieces moved physically (e.g. castling = 2 physical, 1 turn).
            this.emit('turn', {
                player,
                moves: physicalMoves,
                primaryMove: physicalMoves[0],
                captured: physicalMoves[0].captured,
                isCastle: chessMove.isKingsideCastle() || chessMove.isQueensideCastle(),
                isKingsideCastle: chessMove.isKingsideCastle(),
                isQueensideCastle: chessMove.isQueensideCastle(),
                isEnPassant: chessMove.isEnPassant(),
                isCheck: this._chess.isCheck(),
                isCheckmate: this._chess.isCheckmate(),
                promotion: chessMove.promotion || null,
            });

            return physicalMoves;
        }

        isGameOver() {
            return this._chess.isGameOver();
        }

        turn() {
            return this._chess.turn();
        }

        fen() {
            return this._chess.fen();
        }

        isCheck() {
            return this._chess.isCheck();
        }

        getPieceAt(square) {
            return this._chessboard.getPieceAt(square)?.toSnapshot() ?? null;
        }

    }
