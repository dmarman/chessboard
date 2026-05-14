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
            // Board left empty; caller must follow with setPiecesFromFen to populate with deck pieces.
            this._chessboard.clear();
        }

        // Returns MoveIntent[] — no raw chess.js shapes leak out.
        moves() {
            return this._chess.moves({ verbose: true }).map(m => MoveIntent({
                from: m.from,
                to: m.to,
                san: m.san,
                promotion: m.promotion,
            }));
        }

        // Accepts a MoveIntent (or intent-shaped literal). Returns snapshotted MoveEffect[].
        // Throws if move illegal (chess.js raises on invalid input).
        move(intent, player = null) {
            const chessMove = this._chess.move(intent); // chess.js accepts {from,to,promotion}

            // Freeze chess.js booleans before chessMove ref escapes the adapter boundary.
            const isEnPassant = chessMove.isEnPassant();
            const isKingsideCastle = chessMove.isKingsideCastle();
            const isQueensideCastle = chessMove.isQueensideCastle();

            const liveEffects = this._chessboard.move(
                MoveIntent({ from: chessMove.from, to: chessMove.to, promotion: chessMove.promotion }),
                { enPassant: isEnPassant, isKingsideCastle, isQueensideCastle, player },
            );
            const physicalMoves = liveEffects.map(snapshotMoveEffect);

            // Emit one logical turn event per chess move, regardless of how many
            // pieces moved physically (e.g. castling = 2 physical, 1 turn).
            this.emit('turn', {
                player,
                moves: physicalMoves,
                primaryMove: physicalMoves[0],
                captured: physicalMoves[0].captured,
                isCastle: isKingsideCastle || isQueensideCastle,
                isKingsideCastle,
                isQueensideCastle,
                isEnPassant,
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

        // Removes a piece by id from the domain chessboard and chess.js engine.
        // Returns { piece, row, col, square } or null. Keeps chess.js legality in sync.
        removePieceById(id) {
            const result = this._chessboard.removePieceById(id);
            if (!result) return null;
            const square = toChessSquare(result.row, result.col);
            this._chess.remove(square);
            return { ...result, square };
        }

    }
