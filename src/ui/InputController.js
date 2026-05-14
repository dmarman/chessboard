// Owns input-driven selection state. Click-to-move and drag-and-drop both feed the same
// selection/commit path: subscribes to ChessboardUI 'squareClick'/'pieceDrag*' events,
// queries ChessGame for legal moves, drives UI highlights, invokes onMove(from, to, promotion)
// to commit moves. Enabled only while the game-state machine is 'idle'.
class InputController {
    constructor({ chessGame, chessboardUI, onMove, playerColor, soundManager = null, hudUI = null }) {
        this._chessGame = chessGame;
        this._ui = chessboardUI;
        this._onMove = onMove;
        this._playerColor = playerColor;
        this._soundManager = soundManager;
        this._hudUI = hudUI;

        this._selected = null;             // algebraic square ("e4") or null
        this._selectedPiece = null;        // piece snapshot for preview
        this._legalFromSelected = [];      // move descriptors {from, to, promotion, san}
        this._legalTargets = new Set();    // dest squares for fast hover lookup
        this._pendingDeselect = false;     // true when pointerdown landed on already-selected square
        this._enabled = false;

        this._ui.on('squareClick',     ({ square }) => this._onSquareClick(square));
        this._ui.on('squarePointerUp', ({ square }) => this._onSquarePointerUp(square));
        this._ui.on('squareHover',     ({ square }) => this._onSquareHover(square));
        this._ui.on('pieceDragStart',  ({ square }) => this._onDragStart(square));
        this._ui.on('pieceDragOver',   ({ square }) => this._onSquareHover(square));
        this._ui.on('pieceDragEnd',    ({ from, to }) => this._onDragEnd(from, to));
    }

    setEnabled(enabled) {
        this._enabled = enabled;
        // When the state machine disables input (e.g. transitioning into playerMove
        // after a commit), don't wipe the HUD preview — the scoring animation is
        // about to overwrite those slots and resetting to 0 first causes a flicker.
        if (!enabled) this._clearSelection({ resetHud: false });
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

        // Already selected: rising edge does nothing; flag for falling-edge deselect.
        if (square === this._selected) {
            this._pendingDeselect = true;
            return;
        }

        const move = this._legalFromSelected.find(m => m.to === square);
        if (move) {
            const from = this._selected;
            // Auto-queen for MVP. If any legal move from→to has promotion, send 'q'.
            const promotion = this._legalFromSelected.some(m => m.to === square && m.promotion) ? 'q' : null;
            // Keep the previewed chips/mult visible — the scoring animation will
            // pick up from there. Don't flicker through 0.
            this._clearSelection({ resetHud: false });
            this._onMove(from, square, promotion);
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

    _onSquarePointerUp(square) {
        if (!this._enabled) return;
        if (this._chessGame.isGameOver()) return;
        if (this._chessGame.turn() !== this._playerColor) return;
        if (this._pendingDeselect && square === this._selected) this._clearSelection();
        this._pendingDeselect = false;
    }

    _onDragStart(square) {
        if (!this._enabled) return;
        if (this._chessGame.isGameOver()) return;
        if (this._chessGame.turn() !== this._playerColor) return;
        // If a different piece was click-selected, drop that selection before adopting the dragged one.
        if (this._selected && this._selected !== square) this._clearSelection();
        if (!this._selected) this._trySelect(square);
    }

    _onDragEnd(from, to) {
        if (!this._enabled) return;
        // Selection may have been cleared mid-drag (state change, etc.) or piece had no legal moves; still clear highlights.
        if (this._selected !== from) {
            this._clearSelection();
            return;
        }
        if (to && to !== from) {
            const move = this._legalFromSelected.find(m => m.to === to);
            if (move) {
                const promotion = this._legalFromSelected.some(m => m.to === to && m.promotion) ? 'q' : null;
                this._clearSelection({ resetHud: false });
                // Claim the dragged piece so ChessboardUI skips the slide animation: the piece is
                // already under the cursor and will be parked on the destination square instantly.
                this._ui.consumeDragForCommit();
                this._onMove(from, to, promotion);
                return;
            }
        }
        // Drop off-board, on origin, or onto illegal target -> deselect.
        this._clearSelection();
    }

    _trySelect(square) {
        const piece = this._chessGame.getPieceAt(square);
        if (!piece || piece.color !== this._playerColor) return;

        const legal = this._chessGame.moves().filter(m => m.from === square);
        if (legal.length === 0) return;

        this._selected = square;
        this._selectedPiece = piece;
        this._legalFromSelected = legal;
        this._legalTargets = new Set(legal.map(m => m.to));
        this._soundManager?.play('card_focus');

        const targets = [...this._legalTargets];
        const captures = targets.filter(to => this._isCapture(square, to, piece));

        this._ui.highlightSelected(square);
        this._ui.highlightLegalMoves(targets, captures);
        this._showPreview(null);
    }

    _onSquareHover(square) {
        if (!this._enabled) return;
        if (!this._selected || !this._selectedPiece) return;
        if (square && this._legalTargets.has(square)) {
            this._showPreview(square);
            this._ui.setHoverTarget(square);
        } else {
            this._showPreview(null);
            this._ui.setHoverTarget(null);
        }
    }

    // Renders move-type chips/mult preview in the HUD.
    // Piece value intentionally excluded — preview shows only the move type base.
    // Defaults to 'quiet' when no target square or no special type.
    _showPreview(targetSquare) {
        if (!this._hudUI || !this._selectedPiece) return;
        const moveTypes = targetSquare ? this._moveTypesFor(targetSquare) : ['quiet'];
        const preview = Effects.preview(moveTypes);
        const labels = this._labelsFromMoveTypes(moveTypes);
        this._hudUI.preview({ ...preview, labels });
    }

    // Mirrors AnimationCoordinator._moveLabels for the preview HUD.
    // Distinct mapping: enpassant subsumes capture; 'Quiet' when no tag fires.
    _labelsFromMoveTypes(moveTypes) {
        const set = new Set(moveTypes);
        const labels = [];
        if (set.has('enpassant'))                                    labels.push('En Passant');
        else if (set.has('capture'))                                 labels.push('Capture');
        if (set.has('castle king') || set.has('castle queen'))       labels.push('Castle');
        if (set.has('promotion'))                                    labels.push('Promotion');
        if (set.has('check'))                                        labels.push('Check');
        if (!labels.length)                                          labels.push('Quiet');
        return labels;
    }

    // Mirrors ScoringPipeline._moveTypeSteps: derives the same move-type tags
    // for a hypothetical move to `to` from the selected square.
    _moveTypesFor(to) {
        const from = this._selected;
        const piece = this._selectedPiece;
        const intent = this._legalFromSelected.find(m => m.to === to);
        if (!intent) return [];

        const types = [];
        const destOccupied = !!this._chessGame.getPieceAt(to);
        const isPawnDiagToEmpty =
            piece.type.toLowerCase() === 'p' && from[0] !== to[0] && !destOccupied;
        const isEnPassant = isPawnDiagToEmpty;

        // san may carry suffixes (+, #) — strip them for castle detection.
        const sanCore = intent.san?.replace(/[+#]$/, '') ?? '';

        if (destOccupied || isEnPassant) types.push('capture');
        if (intent.san?.endsWith('+') || intent.san?.endsWith('#')) types.push('check');
        if (sanCore === 'O-O-O')      types.push('castle queen');
        else if (sanCore === 'O-O')   types.push('castle king');
        if (intent.promotion) types.push('promotion');
        if (isEnPassant)      types.push('enpassant');
        if (!types.length)    types.push('quiet');
        return types;
    }

    _isCapture(from, to, movingPiece) {
        if (this._chessGame.getPieceAt(to)) return true;
        // En passant: pawn moves diagonally onto empty square.
        if (movingPiece.type.toLowerCase() === 'p' && from[0] !== to[0]) return true;
        return false;
    }

    _clearSelection({ resetHud = true } = {}) {
        this._selected = null;
        this._selectedPiece = null;
        this._legalFromSelected = [];
        this._legalTargets = new Set();
        this._pendingDeselect = false;
        this._ui.clearHighlights();
        if (resetHud) this._hudUI?.clearPreview();
    }
}
