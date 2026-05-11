    // Shop modal overlay. Shown after a win, before the tournament opponent selection.
    // Emits: 'buy' (jokerId), 'reroll', 'leave'
    class ShopUI extends EventEmitter {
        constructor() {
            super();
            this._overlay = document.createElement('div');
            this._overlay.className = 'shop-overlay';
            this._overlay.innerHTML = `
                <div class="shop-modal">
                    <div class="shop-title">Shop</div>
                    <div class="shop-slots"></div>
                    <div class="shop-actions">
                        <button class="shop-reroll-btn">Reroll ($5)</button>
                        <button class="shop-leave-btn">Leave</button>
                    </div>
                </div>
            `;

            this._slotsEl = this._overlay.querySelector('.shop-slots');
            this._rerollBtn = this._overlay.querySelector('.shop-reroll-btn');
            this._leaveBtn = this._overlay.querySelector('.shop-leave-btn');

            this._rerollBtn.addEventListener('click', () => this.emit('reroll'));
            this._leaveBtn.addEventListener('click', () => this.emit('leave'));
        }

        mount(parent) {
            parent.appendChild(this._overlay);
        }

        show(slots, money) {
            this._money = money;
            this._renderSlots(slots);
            this._updateRerollBtn();
            this._overlay.classList.add('shop-overlay--visible');
        }

        // Re-render after a buy or reroll (money may have changed).
        refresh(slots, money) {
            this._money = money;
            this._renderSlots(slots);
            this._updateRerollBtn();
        }

        hide() {
            this._overlay.classList.remove('shop-overlay--visible');
        }

        _renderSlots(slots) {
            this._slotsEl.innerHTML = '';
            for (const def of slots) {
                this._slotsEl.appendChild(this._buildCard(def));
            }
        }

        _buildCard(def) {
            const card = document.createElement('div');
            card.className = `shop-card shop-card--${def.rarity}`;

            const canAfford = this._money >= def.price;

            card.innerHTML = `
                <div class="shop-card__rarity">${def.rarity}</div>
                <div class="shop-card__name">${def.name}</div>
                <div class="shop-card__desc">${def.description}</div>
                <div class="shop-card__price">$${def.price}</div>
                <button class="shop-card__buy"${canAfford ? '' : ' disabled'}>Buy</button>
            `;

            card.querySelector('.shop-card__buy').addEventListener('click', () => {
                this.emit('buy', def.id);
            });

            return card;
        }

        _updateRerollBtn() {
            this._rerollBtn.disabled = this._money < 5;
        }
    }
