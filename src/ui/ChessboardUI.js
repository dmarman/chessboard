    class ChessboardUI extends EventEmitter {
        constructor(element, options = {}) {
            super();
            this.boardElement = typeof element === 'string' ? document.getElementById(element) : element;
            this.boardElement.classList.add('chessboard-ui');
            this.squareSize = options.squareSize ?? 90;
            this._lightColor = options.lightColor ?? THEME.squareLight;
            this._darkColor = options.darkColor ?? THEME.squareDark;
            this._transitionMs = options.transitionMs ?? 200;
            this._shakeMs = options.shakeMs ?? 700;
            this._renderPiece = options.renderPiece ?? (() => '');
            this._orientation = options.orientation ?? 'w';
            this._dragEnabled = options.dragEnabled ?? true;
            this._dragThreshold = options.dragThreshold ?? 5;
            this._dragState = null;
            this.pieceElements = new Map();
            this.squareElements = new Map(); // algebraic ("e4") -> square <div>
            this.piecesLayer = null;
            this._styleEl = document.createElement('style');
            document.head.appendChild(this._styleEl);
            this._updateStyles();
        }

        get lightColor() { return this._lightColor; }
        set lightColor(v) { this._lightColor = v; this._updateStyles(); }

        get darkColor() { return this._darkColor; }
        set darkColor(v) { this._darkColor = v; this._updateStyles(); }

        get transitionMs() { return this._transitionMs; }
        set transitionMs(v) { this._transitionMs = v; this._updateStyles(); }

        get shakeMs() { return this._shakeMs; }
        set shakeMs(v) { this._shakeMs = v; this._updateStyles(); }

        get dragEnabled() { return this._dragEnabled; }
        setDragEnabled(v) {
            this._dragEnabled = !!v;
            if (!this._dragEnabled) this._cancelDrag();
        }

        _updateStyles() {
            const s = this.squareSize;
            const dot = Math.round(s * 0.28);
            const ringBorder = Math.round(s * 0.10);
            this._styleEl.textContent = `
                .chessboard-ui .chess-square { width: ${s}px; height: ${s}px; position: relative; cursor: pointer; }
                .chessboard-ui .chess-square.light { background: ${this._lightColor}; }
                .chessboard-ui .chess-square.dark { background: ${this._darkColor}; }
                .chessboard-ui .chess-square.has-piece { cursor: grab; }
                .chessboard-ui .chess-square.selected { box-shadow: inset 0 0 0 9999px ${THEME.squareSelected}; }
                .chessboard-ui .chess-square.legal-move::after {
                    content: ''; position: absolute; left: 50%; top: 50%;
                    width: ${dot}px; height: ${dot}px; margin-left: -${dot/2}px; margin-top: -${dot/2}px;
                    border-radius: 50%; background: ${THEME.legalMoveDot}; mix-blend-mode: difference; pointer-events: none; z-index: 5;
                }
                .chessboard-ui .chess-square.legal-move-capture::after {
                    content: ''; position: absolute; inset: 0;
                    border: ${ringBorder}px solid ${THEME.legalMoveCapture}; border-radius: 50%;
                    box-sizing: border-box; pointer-events: none; z-index: 5;
                }
                .chessboard-ui .chess-square.hover-target,
                .chessboard-ui .chess-square.drag-origin {
                    outline: 3px solid ${THEME.squareHover};
                    outline-offset: -3px;
                    z-index: 6;
                }
                .chessboard-ui .piece {
                    position: absolute;
                    width: ${s}px;
                    height: ${s}px;
                    transition: transform ${this._transitionMs}ms ease-in-out;
                    pointer-events: none;
                }
                body.chessboard-dragging, body.chessboard-dragging * { cursor: grabbing !important; }
            `;
        }

        initBoard(initialState) {
            this._cancelAnimations();
            this.boardElement.innerHTML = '';
            this.pieceElements.clear();
            this.squareElements.clear();

            const squaresLayer = document.createElement('div');
            squaresLayer.classList.add('squares-layer');
            for (let i = 0; i < 8; i++) {
                const row = document.createElement('div');
                row.classList.add('chess-row');
                for (let j = 0; j < 8; j++) {
                    // i,j are visual row/col. Map to logical (row, col) using orientation.
                    const [lRow, lCol] = this._toVisual(i, j); // _toVisual is its own inverse
                    const square = this._squareFromRowCol(lRow, lCol);
                    const sq = document.createElement('div');
                    sq.classList.add('chess-square', (i + j) % 2 === 0 ? 'light' : 'dark');
                    sq.dataset.square = square;
                    sq.dataset.row = String(lRow);
                    sq.dataset.col = String(lCol);
                    row.appendChild(sq);
                    this.squareElements.set(square, sq);
                }
                squaresLayer.appendChild(row);
            }
            this.boardElement.appendChild(squaresLayer);

            // Selection fires on rising edge (pointerdown), not on click, so it feels instant
            // and matches the moment the drag visual starts following the cursor.
            squaresLayer.addEventListener('pointerdown', (event) => this._onPointerDown(event));

            // Hover events — emits squareHover with the square under the pointer,
            // or null when pointer leaves the board. Used by InputController for
            // legal-move scoring preview.
            squaresLayer.addEventListener('mouseover', (event) => {
                const sq = event.target.closest('.chess-square');
                if (!sq || !this.boardElement.contains(sq)) return;
                this.emit('squareHover', { square: sq.dataset.square });
            });
            squaresLayer.addEventListener('mouseleave', () => {
                this.emit('squareHover', { square: null });
            });

            this.piecesLayer = document.createElement('div');
            this.piecesLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none';
            this.boardElement.appendChild(this.piecesLayer);

            for (let i = 0; i < 8; i++)
                for (let j = 0; j < 8; j++) {
                    const piece = initialState[i][j];
                    if (piece) this.createPieceElement(piece, i, j);
                }
        }

        // Logical (row, col) -> algebraic. row 0 = rank 8, col 0 = file 'a'.
        _squareFromRowCol(row, col) {
            return String.fromCharCode(97 + col) + (8 - row);
        }

        highlightSelected(square) {
            const el = this.squareElements.get(square);
            if (el) el.classList.add('selected');
        }

        highlightLegalMoves(moveSquares, captureSquares) {
            const captureSet = new Set(captureSquares || []);
            for (const sq of moveSquares || []) {
                const el = this.squareElements.get(sq);
                if (!el) continue;
                el.classList.add(captureSet.has(sq) ? 'legal-move-capture' : 'legal-move');
            }
        }

        clearHighlights() {
            for (const el of this.squareElements.values()) {
                el.classList.remove('selected', 'legal-move', 'legal-move-capture', 'hover-target', 'drag-origin');
            }
            this._hoverTargetEl = null;
        }

        setHoverTarget(square) {
            const next = square ? this.squareElements.get(square) : null;
            if (next === this._hoverTargetEl) return;
            this._hoverTargetEl?.classList.remove('hover-target');
            next?.classList.add('hover-target');
            this._hoverTargetEl = next ?? null;
        }

        _onPointerDown(event) {
            if (event.button !== 0) return;
            const sq = event.target.closest('.chess-square');
            if (!sq || !this.boardElement.contains(sq)) return;
            const row = parseInt(sq.dataset.row, 10);
            const col = parseInt(sq.dataset.col, 10);
            // Rising-edge selection: emit before any drag setup so InputController updates
            // selection/highlights as the press lands, not on release.
            this.emit('squareClick', { square: sq.dataset.square, row, col });

            if (!this._dragEnabled) return;
            const pieceEl = this.pieceElements.get(this._posKey(row, col));
            if (!pieceEl) return;

            const [vRow, vCol] = this._toVisual(row, col);
            const rect = this.boardElement.getBoundingClientRect();
            const half = this.squareSize / 2;
            // Piece occupies (vCol*size, vRow*size) within boardElement; its center sits half a square in.
            const pieceCenterClientX = rect.left + vCol * this.squareSize + half;
            const pieceCenterClientY = rect.top + vRow * this.squareSize + half;

            // Lift piece out of float, kill transition so it tracks the cursor exactly.
            pieceEl._floatAnimation?.cancel();
            pieceEl._floatAnimation = null;
            pieceEl.style.transition = 'none';
            pieceEl.style.zIndex = '1000';

            this._dragState = {
                square: sq.dataset.square,
                row, col, pieceEl,
                startX: event.clientX,
                startY: event.clientY,
                pieceCenterClientX,
                pieceCenterClientY,
                dragging: false,
                lastOverSquare: null,
                pointerId: event.pointerId,
            };
            // Snap piece center to cursor immediately on press.
            this._applyDragTransform(this._dragState, event.clientX, event.clientY);
            document.body.classList.add('chessboard-dragging');

            const onMove = (ev) => this._onPointerMove(ev);
            const onUp = (ev) => {
                this._onPointerUp(ev);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        }

        _onPointerMove(event) {
            const s = this._dragState;
            if (!s || event.pointerId !== s.pointerId) return;
            this._applyDragTransform(s, event.clientX, event.clientY);
            if (!s.dragging) {
                const dx = event.clientX - s.startX;
                const dy = event.clientY - s.startY;
                if (Math.hypot(dx, dy) < this._dragThreshold) return;
                s.dragging = true;
                this.emit('pieceDragStart', { square: s.square });
            }
            const overSquare = this._squareAtClient(event.clientX, event.clientY);
            if (overSquare !== s.lastOverSquare) {
                s.lastOverSquare = overSquare;
                const originEl = this.squareElements.get(s.square);
                originEl?.classList.toggle('drag-origin', overSquare === s.square);
                this.emit('pieceDragOver', { square: overSquare });
            }
        }

        _onPointerUp(event) {
            const s = this._dragState;
            if (!s || event.pointerId !== s.pointerId) return;
            this._dragState = null;
            document.body.classList.remove('chessboard-dragging');
            if (!s.dragging) {
                // Tap without movement: snap piece back. Selection already fired on pointerdown.
                this._resetDraggedPieceStyles(s.pieceEl);
                // Falling-edge tap: lets InputController deselect on release rather than press.
                this.emit('squarePointerUp', { square: s.square });
                return;
            }
            const target = this._squareAtClient(event.clientX, event.clientY);
            // Stash the piece so consumers can claim the drop (skip the slide); fall back to snap-back.
            this._pendingDropPiece = s.pieceEl;
            this.emit('pieceDragEnd', { from: s.square, to: target });
            if (this._pendingDropPiece) {
                this._resetDraggedPieceStyles(this._pendingDropPiece);
                this._pendingDropPiece = null;
            }
        }

        // Called synchronously inside a 'pieceDragEnd' handler when the consumer is about to commit
        // the move. Leaves the dragged piece where it sits (centered on cursor) and instructs the
        // next slideMove to skip its animation so the piece "lands" instantly at the destination.
        consumeDragForCommit() {
            this._pendingDropPiece = null;
            this._skipNextSlide = true;
        }

        _cancelDrag() {
            const s = this._dragState;
            if (!s) return;
            this._dragState = null;
            document.body.classList.remove('chessboard-dragging');
            this._resetDraggedPieceStyles(s.pieceEl);
            if (s.dragging) this.emit('pieceDragEnd', { from: s.square, to: null });
        }

        _applyDragTransform(s, clientX, clientY) {
            const tx = clientX - s.pieceCenterClientX;
            const ty = clientY - s.pieceCenterClientY;
            s.pieceEl.style.transform = `translate(${tx}px, ${ty}px)`;
        }

        _resetDraggedPieceStyles(el) {
            el.style.transform = '';
            el.style.zIndex = '';
            el.style.transition = '';
            this._animateFloat(el);
        }

        _squareAtClient(clientX, clientY) {
            const rect = this.boardElement.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const boardPx = 8 * this.squareSize;
            if (x < 0 || y < 0 || x >= boardPx || y >= boardPx) return null;
            const vRow = Math.floor(y / this.squareSize);
            const vCol = Math.floor(x / this.squareSize);
            // _toVisual is its own inverse, so it also maps visual->logical.
            const [row, col] = this._toVisual(vRow, vCol);
            return this._squareFromRowCol(row, col);
        }

        _posKey(row, col) { return `${row},${col}`; }

        _toVisual(row, col) {
            return this._orientation === 'b' ? [7 - row, 7 - col] : [row, col];
        }

        createPieceElement(piece, row, col) {
            const [vRow, vCol] = this._toVisual(row, col);
            const el = document.createElement('div');
            el.className = 'piece';
            el.style.top = `${vRow * this.squareSize}px`;
            el.style.left = `${vCol * this.squareSize}px`;
            el.innerHTML = this._renderPiece(piece);
            this.piecesLayer.appendChild(el);
            this.pieceElements.set(this._posKey(row, col), el);
            this._setSquareHasPiece(row, col, true);
            this._animateFloat(el);
            return el;
        }

        _setSquareHasPiece(row, col, hasPiece) {
            const sqEl = this.squareElements.get(this._squareFromRowCol(row, col));
            if (sqEl) sqEl.classList.toggle('has-piece', hasPiece);
        }

        _cancelAnimations() {
            this.boardElement.getAnimations?.({ subtree: true }).forEach(a => a.cancel());
        }

        async _animateSlide(el, dx, dy, toRow, toCol) {
            el._floatAnimation?.cancel();
            el._floatAnimation = null;
            el.style.zIndex = '1000';
            await el.animate([
                { transform: 'translate(0px, 0px)' },
                { transform: `translate(${dx}px, ${dy}px)` },
            ], { duration: this._transitionMs, easing: 'ease-in-out', fill: 'forwards' }).finished;
            el.style.top = `${toRow * this.squareSize}px`;
            el.style.left = `${toCol * this.squareSize}px`;
            el.getAnimations().forEach(a => a.cancel());
            el.style.zIndex = '';
        }

        // kind: 'chips' | 'mult' | 'xmult' | 'money' — drives color and label format
        _showScoreEffect(el, value, kind = 'chips') {
            if (value == null) return Promise.resolve();
            const rect = el.getBoundingClientRect();
            const boardRect = this.boardElement.getBoundingClientRect();

            const num = parseFloat(value);
            const formatted = Number.isInteger(num) ? Math.abs(num) : Math.abs(num).toFixed(2);
            const labelMap = {
                chips:  `+${formatted}`,
                mult:   `+${formatted}  Mult`,
                xmult:  `X${formatted}  Mult`,
                money:  `$${formatted}`,
            };
            const label = labelMap[kind] ?? `+${formatted}`;

            const popup = document.createElement('div');
            popup.className = `score-popup score-popup--${kind}`;
            popup.dataset.kind = kind;
            popup.style.left = (rect.left - boardRect.left + rect.width / 2) + 'px';
            popup.style.top  = 0.95*(rect.top  - boardRect.top) + 'px';

            const diamond = document.createElement('div');
            diamond.className = 'score-popup__diamond';

            const text = document.createElement('div');
            text.className = 'score-popup__text';
            text.innerHTML = [...label].map(ch => ch === ' ' ? '<span class="score-popup__char score-popup__char--space"> </span>' : `<span class="score-popup__char">${ch}</span>`).join('');

            popup.appendChild(diamond);
            popup.appendChild(text);
            this.boardElement.appendChild(popup);

            const dur = this._shakeMs;
            const diamondAnim = diamond.animate([
                { transform: 'translate(-50%, -50%) rotate(4deg)  scale(0)',    opacity: 0 },
                { transform: 'translate(-50%, -50%) rotate(45deg) scale(1.2)',  opacity: 0.6, offset: 0.2 },
                { transform: 'translate(-50%, -50%) rotate(40deg) scale(1)',    opacity: 0.6, offset: 0.4 },
                { transform: 'translate(-50%, -50%) rotate(45deg) scale(1)',    opacity: 0.6, offset: 0.7 },
                { transform: 'translate(-50%, -50%) rotate(4deg) scale(1.15)', opacity: 0 },
            ], { duration: dur, easing: 'ease-out', fill: 'forwards' });

            const upDur   = dur * 0.2;
            const holdDur = dur * 0.5;
            const downDur = dur * 0.01;
            const totalDur = upDur + holdDur + downDur;
            const upEnd    = upDur / totalDur;
            const downStart = (upDur + holdDur) / totalDur;

            [...text.querySelectorAll('.score-popup__char')].forEach((span, i) =>
                span.animate(
                    [
                        { transform: 'scale(0)',   offset: 0 },
                        { transform: 'scale(0.5)', offset: upEnd * 0.4 },
                        { transform: 'scale(0.9)', offset: upEnd * 0.8 },
                        { transform: 'scale(1)',   offset: upEnd },
                        { transform: 'scale(1)',   offset: downStart },
                        { transform: 'scale(0)',   offset: 1 },
                    ],
                    { duration: totalDur, delay: i * 20, easing: 'ease-out', fill: 'both' }
                )
            );

            return diamondAnim.finished.then(() => popup.remove());
        }

        _animateShake(el) {
            return el.animate([
                { transform: 'scale(1)    rotate(0)',     filter: `drop-shadow(4px 4px 3px ${THEME.pieceShadow})` },
                { transform: 'scale(1.8)  rotate(10deg)', filter: `drop-shadow(4px 8px 3px ${THEME.pieceShadow})`, offset: 0.2 },
                { transform: 'scale(0.7)  rotate(-5deg)', offset: 0.4 },
                { transform: 'scale(1.2)  rotate(2deg)',  filter: `drop-shadow(4px 8px 3px ${THEME.pieceShadow})`,  offset: 0.6 },
                { transform: 'scale(0.9)  rotate(-1deg)', offset: 0.8 },
                { transform: 'scale(1)    rotate(0)',     filter: `drop-shadow(4px 4px 3px ${THEME.pieceShadow})` },
            ], { duration: this._shakeMs, easing: 'ease-out' }).finished;
        }

        _animateFloat(el) {
            el._floatAnimation?.cancel();
            const delay = -(Math.random() * 5000);
            el._floatAnimation = el.animate([
                { filter: `drop-shadow(4px 4px 3px ${THEME.pieceShadow})`, transform: 'translateY(0px)' },
                { filter: `drop-shadow(4px 8px 3px ${THEME.pieceShadow})`, transform: 'translateY(-4px)', offset: 0.5 },
                { filter: `drop-shadow(4px 4px 3px ${THEME.pieceShadow})`, transform: 'translateY(0px)' },
            ], { duration: 5000, easing: 'ease-in-out', iterations: Infinity, delay });
            el.querySelectorAll('[data-sync-delay]').forEach(child => {
                child.style.animationDelay = `${delay}ms`;
            });
        }

        // Removes piece DOM at (row, col) with break animation. No-op if no piece there.
        async removePieceAt(row, col) {
            const key = this._posKey(row, col);
            const el = this.pieceElements.get(key);
            if (!el) return;
            this.pieceElements.delete(key);
            this._setSquareHasPiece(row, col, false);
            el._floatAnimation?.cancel();
            el._floatAnimation = null;
            el.style.zIndex = '999';
            await el.animate([
                { transform: 'scale(1)    rotate(0deg)',   opacity: 1, filter: 'brightness(1)' },
                { transform: 'scale(1.3)  rotate(0deg)',   opacity: 1, filter: 'brightness(2.5)', offset: 0.25 },
                { transform: 'scale(0.0)  rotate(180deg)', opacity: 0, filter: 'brightness(2.5)' },
            ], { duration: this._shakeMs, easing: 'ease-out', fill: 'forwards' }).finished;
            el.remove();
        }


        _animateThrow(el, dx, dy) {
            const rot = (Math.random() < 0.5 ? 1 : -1) * (270 + Math.random() * 360);
            el.style.zIndex = '999';
            dx = Math.max(-200, Math.min(200, dx))
            dy = Math.max(-200, Math.min(200, dy))

            return el.animate([
                { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
                { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity: 0 },
            ], { duration: this._transitionMs/2, easing: 'ease-out', fill: 'forwards' }).finished.then(() => el.remove());
        }

        _handleCaptureAndPromotion(el, piece, promotion) {
            if (promotion) el.innerHTML = this._renderPiece(piece);
        }

        _squareToPixelCenter(square) {
            const [row, col] = parseChessPosition(square);
            const [vRow, vCol] = this._toVisual(row, col);
            const s = this.squareSize;
            return [vCol * s + s / 2, vRow * s + s / 2];
        }

        drawArrow(startSquare, endSquare, color = 'green') {
            const [x1, y1] = this._squareToPixelCenter(startSquare);
            const [x2, y2] = this._squareToPixelCenter(endSquare);
            const s = this.squareSize;
            const boardSize = 8 * s;
            const strokeWidth = s * 0.2;

            const dx = x2 - x1, dy = y2 - y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / dist, uy = dy / dist;
            // Shorten path end so arrowhead tip (0.75 * strokeWidth beyond endpoint) lands at target center
            const ex = x2 - ux * strokeWidth * 0.75;
            const ey = y2 - uy * strokeWidth * 0.75;

            const markerId = `arrow-${this._uid}-${Math.random().toString(36).slice(2)}`;
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', `0 0 ${boardSize} ${boardSize}`);
            svg.setAttribute('data-arrow', '');
            svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;width:100%;height:100%';
            svg.innerHTML = `<defs><marker id="${markerId}" markerWidth="2" markerHeight="2.5" refX="1.25" refY="1.25" orient="auto"><path fill="${color}" d="M.3 0 2 1.25.3 2.5z"/></marker></defs><path d="M${x1} ${y1} L${ex} ${ey}" fill="none" opacity=".65" stroke="${color}" stroke-width="${strokeWidth}" marker-end="url(#${markerId})"/>`;
            this.boardElement.appendChild(svg);
            return svg;
        }

        clearArrows() {
            this.boardElement.querySelectorAll('[data-arrow]').forEach(el => el.remove());
        }

        // Slides piece to destination and throws captured piece. Updates pieceElements.
        // Call animatePieceEffect() per scored effect after this, then endMove().
        async slideMove({ piece, captured, fromRow, fromCol, toRow, toCol, capturedRow, capturedCol, promotion = false }) {
            const fromKey = this._posKey(fromRow, fromCol);
            const el = this.pieceElements.get(fromKey);
            if (!el) return;

            const [vToRow, vToCol] = this._toVisual(toRow, toCol);
            const [vFromRow, vFromCol] = this._toVisual(fromRow, fromCol);
            const dx = (vToCol - vFromCol) * this.squareSize;
            const dy = (vToRow - vFromRow) * this.squareSize;

            const capturedEl = (captured && capturedRow != null)
                ? this.pieceElements.get(this._posKey(capturedRow, capturedCol))
                : null;

            if (this._skipNextSlide) {
                // Drag-and-drop commit: piece is already at the cursor (i.e. on the destination square).
                // Park it at its new top/left with no transition, then restore the transition next frame
                // so subsequent slides animate normally.
                this._skipNextSlide = false;
                el._floatAnimation?.cancel();
                el._floatAnimation = null;
                el.style.transition = 'none';
                el.style.transform = '';
                el.style.top = `${vToRow * this.squareSize}px`;
                el.style.left = `${vToCol * this.squareSize}px`;
                el.style.zIndex = '';
                requestAnimationFrame(() => { el.style.transition = ''; });
            } else {
                await this._animateSlide(el, dx, dy, vToRow, vToCol);
            }
            this._handleCaptureAndPromotion(el, piece, promotion);

            if (capturedEl) {
                // Map deletion and DOM removal co-located: no code path can delete one without the other
                this.pieceElements.delete(this._posKey(capturedRow, capturedCol));
                this._setSquareHasPiece(capturedRow, capturedCol, false);
                await this._animateThrow(capturedEl, dx, dy);
            }

            this.pieceElements.delete(fromKey);
            this.pieceElements.set(this._posKey(toRow, toCol), el);
            this._setSquareHasPiece(fromRow, fromCol, false);
            this._setSquareHasPiece(toRow, toCol, true);
            // Start float immediately so it runs under each shake during the scoring phase.
            // Shake (added later) overrides float's transform/filter while active; when shake
            // ends with no fill:forwards, float resumes. endMove restarts float with a fresh phase.
            this._animateFloat(el);
        }

        // Shakes piece at square and shows score popup. Returns Promise.
        // kind: 'chips' | 'mult' | 'xmult' | 'money'
        animatePieceEffect(toRow, toCol, value, kind = 'chips') {
            const el = this.pieceElements.get(this._posKey(toRow, toCol));
            if (!el) return Promise.resolve();
            this._animateShake(el);
            return this._showScoreEffect(el, value, kind);
        }

        // Starts idle float on piece at destination. Call after all effects are done.
        endMove(toRow, toCol) {
            const el = this.pieceElements.get(this._posKey(toRow, toCol));
            if (el && el._floatAnimation?.playState !== 'running') this._animateFloat(el);
        }
    }
