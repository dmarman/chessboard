// Owns click-to-move selection state. Subscribes to ChessboardUI 'squareClick' events,
// queries ChessGame for legal moves, drives UI highlights, calls GameController.playerMove
// to commit moves. Enabled only while the game-state machine is 'idle'.
class InputController {
    constructor({ chessGame, chessboardUI, gameController, playerColor, soundManager = null }) {
        this._chessGame = chessGame;
        this._ui = chessboardUI;
        this._gameController = gameController;
        this._playerColor = playerColor;
        this._soundManager = soundManager;

        this._selected = null;             // algebraic square ("e4") or null
        this._legalFromSelected = [];      // move descriptors {from, to, promotion}
        this._enabled = false;

        this._ui.on('squareClick', ({ square }) => this._onSquareClick(square));
    }

    setEnabled(enabled) {
        this._enabled = enabled;
        if (!enabled) this._clearSelection();
    }

    _onSquareClick(square) {
        if (!this._enabled) return;
        if (this._chessGame.isGameOver()) return;
        // Block input on opponent's turn even if state machine is idle (defensive).
        if (this._chessGame.turn() !== this._playerColor) return;

        if (this._selected === null) {
            this._trySelect(square);
            return;
        }

        if (square === this._selected) {
            this._clearSelection();
            return;
        }

        const move = this._legalFromSelected.find(m => m.to === square);
        if (move) {
            const from = this._selected;
            // Auto-queen for MVP. If any legal move from→to has promotion, send 'q'.
            const promotion = this._legalFromSelected.some(m => m.to === square && m.promotion) ? 'q' : null;
            this._clearSelection();
            this._gameController.playerMove(from, square, promotion);
            return;
        }

        // Click on another own piece -> switch selection.
        const piece = this._chessGame.getPieceAt(square);
        if (piece && piece.color === this._playerColor) {
            this._soundManager?.play('card_deselect');
            this._clearSelection();
            this._trySelect(square);
            return;
        }

        // Anywhere else -> deselect.
        this._clearSelection();
    }

    _trySelect(square) {
        const piece = this._chessGame.getPieceAt(square);
        if (!piece || piece.color !== this._playerColor) return;

        const legal = this._chessGame.moves().filter(m => m.from === square);
        if (legal.length === 0) return;

        this._selected = square;
        this._legalFromSelected = legal;
        this._soundManager?.play('card_focus');

        const targets = [...new Set(legal.map(m => m.to))];
        const captures = targets.filter(to => this._isCapture(square, to, piece));

        this._ui.highlightSelected(square);
        this._ui.highlightLegalMoves(targets, captures);
    }

    _isCapture(from, to, movingPiece) {
        if (this._chessGame.getPieceAt(to)) return true;
        // En passant: pawn moves diagonally onto empty square.
        if (movingPiece.type.toLowerCase() === 'p' && from[0] !== to[0]) return true;
        return false;
    }

    _clearSelection() {
        this._selected = null;
        this._legalFromSelected = [];
        this._ui.clearHighlights();
    }
}
