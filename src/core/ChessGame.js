    class ChessGame extends EventEmitter {
        constructor(chessboard) {
            super();
            this.chess = new Chess();
            this.chessboard = chessboard;
        }

        setPiecesFromFen(fen, pieces) {
            this.chess.load(fen);
            this.chessboard.setPiecesFromFen(fen, pieces);
        }

        reset() {
            this.chess.reset();
        }

        moves(options = {}) {
            return this.chess.moves(options);
        }

        move(move, player = null) {
            const chessMove = this.chess.move(move); // Parse stockfish move to chess.js move
            if (!chessMove) return null;

            const physicalMoves = this.chessboard.move({
                from: chessMove.from,
                to: chessMove.to,
                enPassant: chessMove.isEnPassant(),
                promotion: chessMove.promotion,
                isKingsideCastle: chessMove.isKingsideCastle(),
                isQueensideCastle: chessMove.isQueensideCastle(),
                player,
            });

            // Emit one logical turn event per chess move, regardless of how many
            // pieces moved physically (e.g. castling = 2 physical, 1 turn).
            this.emit('turn', {
                player,
                moves: physicalMoves,
                primaryMove: physicalMoves[0],
                captured: physicalMoves[0].captured,
                isCastle: chessMove.isKingsideCastle() || chessMove.isQueensideCastle(),
                isEnPassant: chessMove.isEnPassant(),
                isCheck: this.chess.isCheck(),
                isCheckmate: this.chess.isCheckmate(),
                promotion: chessMove.promotion || null,
            });

            return chessMove;
        }

        isGameOver() {
            return this.chess.isGameOver();
        }

        turn() {
            return this.chess.turn();
        }

        fen() {
            return this.chess.fen();
        }

        isCheck() {
            return this.chess.isCheck();
        }

        getPieceAt(square) {
            return this.chessboard.getPieceAt(square);
        }

        hasBishopPair(color) {
            return this._boardPieces().filter(p => p.type.toLowerCase() === 'b' && p.color() === color).length >= 2;
        }

        getPieceCount(type, color) {
            return this._boardPieces().filter(p => p.type.toLowerCase() === type.toLowerCase() && p.color() === color).length;
        }

        _boardPieces() {
            return this.chessboard.getState().flat().filter(Boolean);
        }

    }
