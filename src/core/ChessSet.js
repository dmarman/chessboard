    class ChessSet {
        constructor() {
            this.pieces = [];
        }

        clearPieces() {
            this.pieces = [];
        }

        getPieces() {
            return [...this.pieces];
        }

        addPieces(piecesToAdd, options = {}) {
            piecesToAdd.forEach(type => {
                this.addPiece(type, options);
            });
        }

        addPiece(type, options = {}) {
            this.pieces.push(new Piece(type, {
                name: PIECE_NAMES[type.toUpperCase()],
                ...options
            }));
        }

        addPieceObject(piece) {
            this.pieces.push(piece);
        }

        shufflePieces() {
            for (let i = this.pieces.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.pieces[i], this.pieces[j]] = [this.pieces[j], this.pieces[i]];
            }
        }
    }
