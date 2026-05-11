    // Renders active jokers as cards. animateEffect() is called by AnimationCoordinator for joker-sourced effects.
    class JokersUI {
        constructor(element, renderPiece) {
            this._el = typeof element === 'string' ? document.getElementById(element) : element;
            this._renderPiece = renderPiece;
            this._jokers = [];
            this._cardEls = new Map(); // instanceId -> card element
        }

        render(jokers) {
            this._el.innerHTML = '';
            this._cardEls.clear();
            this._jokers = [...jokers];
            for (const joker of this._jokers) {
                const card = this._buildCard(joker);
                this._cardEls.set(joker.instanceId, card);
                this._el.appendChild(card);
            }
        }

        _buildCard(joker) {
            const card = document.createElement('div');
            card.className = 'joker-card';
            card.innerHTML = `
                <div class="joker-sprite">${this._renderPiece(joker)}</div>
                <div class="joker-name">${joker.name}</div>
                <div class="joker-desc">${joker.description}</div>
            `;
            return card;
        }

        animateEffect(instanceId, value) {
            const el = this._cardEls.get(instanceId);
            if (!el) return Promise.resolve();
            return this._animate(el, value);
        }

        _animate(el, value) {
            const popup = document.createElement('div');
            popup.className = 'joker-score-popup';
            const num = parseFloat(value);
            popup.textContent = (num > 0 ? '+' : '') + num;
            el.appendChild(popup);
            el.animate([
                { transform: 'scale(1.5)' },
                { transform: 'scale(1)' },
            ], { duration: 200, easing: 'ease-out' });
            return popup.animate([
                { transform: 'translateX(-50%) translateY(0)', opacity: 1 },
                { transform: 'translateX(-50%) translateY(-32px)', opacity: 0 },
            ], { duration: 600, easing: 'ease-out', fill: 'forwards' }).finished.then(() => popup.remove());
        }
    }
