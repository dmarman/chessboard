    class OpponentUI {
        constructor(element) {
            this._el = typeof element === 'string' ? document.getElementById(element) : element;
        }

        render(opponent) {
            this._el.innerHTML = '';
            if (!opponent) return;
            this._el.appendChild(this._buildCard(opponent));
        }

        _buildCard(opponent) {
            const card = document.createElement('div');
            card.className = 'opponent-card';
            card.innerHTML = `
                <div class="opponent-name">${opponent.name}</div>
                <div class="opponent-desc">${opponent.description}</div>
                <div class="opponent-target">Beat: <span class="opponent-target-value">${opponent.scoreAtLeast}</span></div>
            `;
            return card;
        }
    }
