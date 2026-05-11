    // Modal that presents a set of opponents for the player to choose from.
    // Decoupled from OpponentRegistry — emits 'select' with the chosen opponentId.
    // Usage: tournamentUI.on('select', id => opponentRegistry.set(id))
    //        tournamentUI.show(opponents)
    class TournamentUI extends EventEmitter {
        constructor() {
            super();
            this._overlay = this._buildOverlay();
        }

        mount(parent) {
            parent.appendChild(this._overlay);
        }

        // bosses: array of opponent defs, each pre-annotated with scoreAtLeast
        show(bosses) {
            const grid = this._overlay.querySelector('.tournament-grid');
            grid.innerHTML = '';
            bosses.forEach(boss => {
                grid.appendChild(this._buildCard(boss));
            });
            this._overlay.classList.add('tournament-overlay--visible');
        }

        hide() {
            this._overlay.classList.remove('tournament-overlay--visible');
        }

        _buildOverlay() {
            const overlay = document.createElement('div');
            overlay.className = 'tournament-overlay';
            overlay.innerHTML = `
                <div class="tournament-modal">
                    <div class="tournament-title">Choose your opponent</div>
                    <div class="tournament-grid"></div>
                </div>
            `;
            // Close on backdrop click
            overlay.addEventListener('click', e => {
                if (e.target === overlay) this.hide();
            });
            return overlay;
        }

        _buildCard(opp) {
            const card = document.createElement('div');
            card.className = 'tournament-card' + (opp.isActive ? '' : ' tournament-card--locked');
            card.innerHTML = `
                <div class="tournament-card__name">${opp.name}</div>
                <div class="tournament-card__desc">${opp.description}</div>
                <div class="tournament-card__target">Beat: <span class="tournament-card__target-value">${opp.scoreAtLeast}</span></div>
                <div class="tournament-card__reward">${'$'.repeat(opp.reward)}</div>
                <button class="tournament-card__btn" ${opp.isActive ? '' : 'disabled'}>Fight</button>
            `;
            if (opp.isActive) {
                card.querySelector('.tournament-card__btn').addEventListener('click', () => {
                    this.emit('select', opp.id);
                    this.hide();
                });
            }
            return card;
        }
    }
