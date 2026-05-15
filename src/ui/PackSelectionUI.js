    // Pack selection modal. Shown after buying a booster pack.
    // Emits: 'pieces-selected' ([{type, enhancement, edition}, ...])
    class PackSelectionUI extends EventEmitter {
        constructor(pngTheme) {
            super();
            this._overlay = document.createElement('div');
            this._overlay.className = 'pack-selection-overlay';
            this._overlay.innerHTML = `
                <div class="pack-selection-modal">
                    <div class="pack-selection-header">
                        <h2 class="pack-selection-title"></h2>
                        <p class="pack-selection-desc"></p>
                    </div>
                    <div class="pack-selection-pieces"></div>
                    <div class="pack-selection-footer">
                        <button class="pack-selection-confirm" disabled>Confirm</button>
                    </div>
                </div>
            `;

            this._titleEl    = this._overlay.querySelector('.pack-selection-title');
            this._descEl     = this._overlay.querySelector('.pack-selection-desc');
            this._piecesEl   = this._overlay.querySelector('.pack-selection-pieces');
            this._confirmBtn = this._overlay.querySelector('.pack-selection-confirm');

            this._theme = pngTheme;
            this._packDef = null;
            this._content = [];
            this._selected = new Set();
        }

        mount(parent) {
            parent.appendChild(this._overlay);
        }

        show(packDef, content) {
            this._packDef = packDef;
            this._content = content;
            this._selected = new Set();

            this._titleEl.textContent = packDef.name;
            this._descEl.textContent  = `Choose ${packDef.numChoose} of ${packDef.numPieces} piece${packDef.numPieces > 1 ? 's' : ''}`;

            this._piecesEl.innerHTML = '';
            content.forEach((pieceData, i) => {
                const card = this._buildPieceCard(pieceData, i);
                this._piecesEl.appendChild(card);
            });

            this._updateConfirm();
            this._overlay.classList.add('pack-selection-overlay--visible');
        }

        get isOpen() {
            return this._overlay.classList.contains('pack-selection-overlay--visible');
        }

        hide() {
            this._overlay.classList.remove('pack-selection-overlay--visible');
        }

        _buildPieceCard(pieceData, index) {
            const card = document.createElement('div');
            card.className = 'pack-piece-card';

            // Pseudo-piece object compatible with PngPieceTheme.render()
            const pseudoPiece = {
                type:        pieceData.type.toUpperCase(),
                enhancement: pieceData.enhancement ?? 'none',
                edition:     pieceData.edition ?? 'base',
                color:       () => 'w',
            };

            const typeName   = PIECE_NAMES[pieceData.type.toUpperCase()] || pieceData.type;
            const enhBadge   = pieceData.enhancement && pieceData.enhancement !== 'none'
                ? `<span class="pack-piece-card__enhancement">${pieceData.enhancement}</span>`
                : '';
            const edtBadge   = pieceData.edition && pieceData.edition !== 'base'
                ? `<span class="pack-piece-card__edition">${pieceData.edition}</span>`
                : '';

            card.innerHTML = `
                <div class="pack-piece-card__sprite">${this._theme.render(pseudoPiece)}</div>
                <div class="pack-piece-card__type">${typeName}</div>
                ${enhBadge}${edtBadge}
            `;

            card.addEventListener('click', () => this._onCardClick(index, card));

            EffectDescriberUI.attach(card, {
                type: 'piece',
                piece: {
                    type:        pieceData.type,
                    enhancement: pieceData.enhancement ?? 'none',
                    edition:     pieceData.edition ?? 'base',
                    name:        typeName,
                },
            });

            return card;
        }

        _onCardClick(index, card) {
            const numChoose = this._packDef.numChoose;

            if (numChoose === 1) {
                // Instant confirm on single-choose packs
                this._emitSelected([this._content[index]]);
                return;
            }

            if (this._selected.has(index)) {
                this._selected.delete(index);
                card.classList.remove('pack-piece-card--selected');
            } else if (this._selected.size < numChoose) {
                this._selected.add(index);
                card.classList.add('pack-piece-card--selected');
            }

            this._updateConfirm();
        }

        _updateConfirm() {
            const ready = this._selected.size === this._packDef.numChoose;
            this._confirmBtn.disabled = !ready;

            // Re-wire to avoid duplicate listeners
            this._confirmBtn.onclick = ready ? () => {
                const chosen = [...this._selected].map(i => this._content[i]);
                this._emitSelected(chosen);
            } : null;
        }

        _emitSelected(pieces) {
            this.hide();
            this.emit('pieces-selected', pieces);
        }
    }
