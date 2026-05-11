    class ChessboardUI extends EventEmitter {
        constructor(element, options = {}) {
            super();
            this.boardElement = typeof element === 'string' ? document.getElementById(element) : element;
            this.boardElement.classList.add('chessboard-ui');
            this.squareSize = options.squareSize ?? 90;
            this._lightColor = options.lightColor ?? THEME.squareLight;
            this._darkColor = options.darkColor ?? THEME.squareDark;
            this._transitionMs = options.transitionMs ?? 150;
            this._shakeMs = options.shakeMs ?? 500;
            this._renderPiece = options.renderPiece ?? (() => '');
            this._orientation = options.orientation ?? 'w';
            this.pieceElements = new Map();
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

        _updateStyles() {
            const s = this.squareSize;
            this._styleEl.textContent = `
                .chessboard-ui .chess-square { width: ${s}px; height: ${s}px; }
                .chessboard-ui .chess-square.light { background: ${this._lightColor}; }
                .chessboard-ui .chess-square.dark { background: ${this._darkColor}; }
                .chessboard-ui .piece {
                    position: absolute;
                    width: ${s}px;
                    height: ${s}px;
                    transition: transform ${this._transitionMs}ms ease-in-out;
                    pointer-events: none;
                }
            `;
        }

        initBoard(initialState) {
            this._cancelAnimations();
            this.boardElement.innerHTML = '';
            this.pieceElements.clear();

            const squaresLayer = document.createElement('div');
            for (let i = 0; i < 8; i++) {
                const row = document.createElement('div');
                row.classList.add('chess-row');
                for (let j = 0; j < 8; j++) {
                    const sq = document.createElement('div');
                    sq.classList.add('chess-square', (i + j) % 2 === 0 ? 'light' : 'dark');
                    row.appendChild(sq);
                }
                squaresLayer.appendChild(row);
            }
            this.boardElement.appendChild(squaresLayer);

            this.piecesLayer = document.createElement('div');
            this.piecesLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none';
            this.boardElement.appendChild(this.piecesLayer);

            for (let i = 0; i < 8; i++)
                for (let j = 0; j < 8; j++) {
                    const piece = initialState[i][j];
                    if (piece) this.createPieceElement(piece, i, j);
                }
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
            this._animateFloat(el);
            return el;
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

        _showScoreEffect(el, value) {
            const rect = el.getBoundingClientRect();
            const boardRect = this.boardElement.getBoundingClientRect();
            const popup = document.createElement('div');
            popup.className = 'score-popup';
            const num = parseFloat(value);
            popup.textContent = (num > 0 ? '+' : '') + (Number.isInteger(num) ? num : num.toFixed(2));
            popup.style.color = num >= 0 ? THEME.scorePositive : THEME.scoreNegative;
            popup.style.left = (rect.left - boardRect.left + rect.width / 2) + 'px';
            popup.style.top  = (rect.top  - boardRect.top  + rect.height / 4) + 'px';
            this.boardElement.appendChild(popup);
            return popup.animate([
                { transform: 'translateX(-50%) translateY(-140%)', opacity: 1, letterSpacing: '-0.4em' },
                { transform: 'translateX(-50%) translateY(-140%)', opacity: 1, letterSpacing: '0.1em'  },
                { transform: 'translateX(-50%) translateY(-140%)', opacity: 1 },
                { transform: 'translateX(-50%) translateY(-140%)', opacity: 0 },
            ], { duration: this._shakeMs, easing: 'ease-out', fill: 'forwards' }).finished.then(() => popup.remove());
        }

        _animateShake(el) {
            return el.animate([
                { transform: 'scale(1)    rotate(0)',     filter: 'drop-shadow(4px 4px 0.5px rgba(0,0,0,0.2))' },
                { transform: 'scale(1.8)  rotate(10deg)', filter: 'drop-shadow(4px 8px 0.5px rgba(0,0,0,0.2))', offset: 0.2 },
                { transform: 'scale(0.7)  rotate(-5deg)', offset: 0.4 },
                { transform: 'scale(1.2)  rotate(2deg)',  filter: 'drop-shadow(4px 8px 0.5px rgba(0,0,0,0.2))',  offset: 0.6 },
                { transform: 'scale(0.9)  rotate(-1deg)', offset: 0.8 },
                { transform: 'scale(1)    rotate(0)',     filter: 'drop-shadow(4px 4px 0.5px rgba(0,0,0,0.2))' },
            ], { duration: this._shakeMs, easing: 'ease-out' }).finished;
        }

        _animateFloat(el) {
            el._floatAnimation?.cancel();
            const delay = -(Math.random() * 5000);
            el._floatAnimation = el.animate([
                { filter: 'drop-shadow(4px 4px 3px rgba(0,0,0,0.6))', transform: 'translateY(0px)' },
                { filter: 'drop-shadow(4px 8px 3px rgba(0,0,0,0.6))', transform: 'translateY(-4px)', offset: 0.5 },
                { filter: 'drop-shadow(4px 4px 3px rgba(0,0,0,0.6))', transform: 'translateY(0px)' },
            ], { duration: 5000, easing: 'ease-in-out', iterations: Infinity, delay });
            el.querySelectorAll('[data-sync-delay]').forEach(child => {
                child.style.animationDelay = `${delay}ms`;
            });
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

            await this._animateSlide(el, dx, dy, vToRow, vToCol);
            this._handleCaptureAndPromotion(el, piece, promotion);

            if (capturedEl) {
                // Map deletion and DOM removal co-located: no code path can delete one without the other
                this.pieceElements.delete(this._posKey(capturedRow, capturedCol));
                await this._animateThrow(capturedEl, dx, dy);
            }

            this.pieceElements.delete(fromKey);
            this.pieceElements.set(this._posKey(toRow, toCol), el);
        }

        // Shakes piece at square and shows score popup. Returns Promise.
        animatePieceEffect(toRow, toCol, value) {
            const el = this.pieceElements.get(this._posKey(toRow, toCol));
            if (!el) return Promise.resolve();
            this._animateShake(el);
            return this._showScoreEffect(el, value);
        }

        // Starts idle float on piece at destination. Call after all effects are done.
        endMove(toRow, toCol) {
            const el = this.pieceElements.get(this._posKey(toRow, toCol));
            if (el) this._animateFloat(el);
        }
    }
