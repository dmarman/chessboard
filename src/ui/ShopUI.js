    // Shop modal overlay. Shown after a win, before the tournament opponent selection.
    // Emits: 'buy-joker' (jokerId), 'buy-pack' (packDef), 'reroll', 'leave'
    class ShopUI extends EventEmitter {
        constructor() {
            super();
            this._overlay = document.createElement('div');
            this._overlay.className = 'shop-overlay';
            this._overlay.innerHTML = `
                <div class="shop-modal">
                    <div class="shop-title">Shop</div>
                    <div class="shop-section">
                        <div class="shop-joker-slots"></div>
                    </div>
                    <div class="shop-section">
                        <div class="shop-pack-slots"></div>
                    </div>
                    <div class="shop-actions">
                        <button class="shop-reroll-btn">Reroll ($5)</button>
                        <button class="shop-leave-btn">Leave</button>
                    </div>
                </div>
            `;

            this._jokerSlotsEl = this._overlay.querySelector('.shop-joker-slots');
            this._packSlotsEl  = this._overlay.querySelector('.shop-pack-slots');
            this._rerollBtn    = this._overlay.querySelector('.shop-reroll-btn');
            this._leaveBtn     = this._overlay.querySelector('.shop-leave-btn');

            this._rerollBtn.addEventListener('click', () => this.emit('reroll'));
            this._leaveBtn.addEventListener('click', () => this.emit('leave'));
        }

        mount(parent) {
            parent.appendChild(this._overlay);
        }

        show(jokerSlots, packSlots, money) {
            this._money = money;
            this._renderJokers(jokerSlots);
            this._renderPacks(packSlots);
            this._updateRerollBtn();
            this._overlay.classList.add('shop-overlay--visible');
        }

        // Re-render after a buy or reroll (money may have changed).
        refresh(jokerSlots, packSlots, money) {
            this._money = money;
            this._renderJokers(jokerSlots);
            this._renderPacks(packSlots);
            this._updateRerollBtn();
        }

        hide() {
            this._overlay.classList.remove('shop-overlay--visible');
        }

        _renderJokers(slots) {
            this._jokerSlotsEl.innerHTML = '';
            for (const def of slots) {
                this._jokerSlotsEl.appendChild(this._buildJokerCard(def));
            }
        }

        _renderPacks(slots) {
            this._packSlotsEl.innerHTML = '';
            for (const def of slots) {
                this._packSlotsEl.appendChild(this._buildPackCard(def));
            }
        }

        _buildJokerCard(def) {
            const card = document.createElement('div');
            const canAfford = this._money >= def.price;
            card.className = `shop-card shop-card--${def.rarity}${canAfford ? '' : ' shop-card--cannot-afford'}`;

            card.innerHTML = `
                <div class="shop-card__rarity">${def.rarity}</div>
                <div class="shop-card__name">${def.name}</div>
                <div class="shop-card__desc">${def.description}</div>
                <div class="shop-card__price">$${def.price}</div>
            `;

            if (canAfford) {
                card.addEventListener('click', () => {
                    this.emit('buy-joker', def.id);
                });
            }

            return card;
        }

        _buildPackCard(def) {
            const card = document.createElement('div');
            const canAfford = this._money >= def.price;
            card.className = `shop-card shop-card--pack shop-card--pack-${def.category}${canAfford ? '' : ' shop-card--cannot-afford'}`;

            const allClasses    = (def.cssClass || '').split(' ').filter(Boolean);
            const structClasses = allClasses.filter(c => !ShopUI.PACK_OVERLAY_CLASSES.has(c));
            const overlayClasses = allClasses.filter(c => ShopUI.PACK_OVERLAY_CLASSES.has(c));

            const spriteVar    = `--sprite:url(/sprites/packs/pack_base.png)`;
            const categoryLabel = def.category.charAt(0).toUpperCase() + def.category.slice(1);
            const sizeLabel     = def.size !== 'normal' ? def.size.charAt(0).toUpperCase() + def.size.slice(1) : '';
            const overlayDivs  = overlayClasses
                .map(cls => `<div class="${cls}" style="${spriteVar}"></div>`)
                .join('');

            card.innerHTML = `
                <div class="pack-visual ${structClasses.join(' ')}">
                    <img class="pack-visual__base" src="/sprites/packs/pack_base.png" alt="" />
                    <div class="pack-visual__label" data-category="${def.category}" data-size="${def.size}">
                        ${sizeLabel ? `<span class="pack-label__size">${sizeLabel}</span>` : ''}
                        <span class="pack-label__category">${categoryLabel}</span>
                        <span class="pack-label__pack">Pack</span>
                    </div>
                    ${overlayDivs}
                </div>
                <div class="shop-card__desc">${def.description}</div>
                <div class="shop-card__price">$${def.price}</div>
            `;

            if (canAfford) {
                card.addEventListener('click', () => {
                    this.emit('buy-pack', def);
                });
            }

            return card;
        }

        _updateRerollBtn() {
            this._rerollBtn.disabled = this._money < 5;
        }
    }

    // Overlay classes shared with piece enhancement/edition system — rendered as masked divs with --sprite set to pack_base.png
    ShopUI.PACK_OVERLAY_CLASSES = new Set([
        'holo-overlay', 'poly-overlay', 'metal-overlay', 'shine-overlay',
        'neon-tint', 'glass-overlay', 'gold-overlay', 'stripes-overlay',
    ]);
