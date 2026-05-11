    class ScoreEngine extends EventEmitter {
        constructor() {
            super();
            this.score = 0;
            this.base = 0;
            this.mult = 1;
            this.gained = 0;
        }

        reset() {
            this.score = 0;
            this.base = 0;
            this.mult = 1;
            this.gained = 0;
            this.emit('reset', { score: 0 });
        }

        _applyEffect(effect) {
            if (effect.destination === 'add') {
                if (effect.operation === 'add') this.base += effect.value;
                if (effect.operation === 'mult') this.base *= effect.value;
            }
            if (effect.destination === 'mult') {
                if (effect.operation === 'add') this.mult += effect.value;
                if (effect.operation === 'mult') this.mult *= effect.value;
            }
        }

        // Pre-computes all effects for a move and returns scored snapshots — no event emission, no timing dependency.
        processEffects(effects) {
            const validEffects = effects.filter(e => e.value != null);
            if (!validEffects.length) return [];

            this.base = 0;
            this.mult = 1;
            const snapshots = [];

            for (const [i, effect] of validEffects.entries()) {
                this._applyEffect(effect);
                const isLast = i === validEffects.length - 1;
                if (isLast) {
                    this.gained = this.base * this.mult;
                    this.score += this.gained;
                    snapshots.push({ effect, base: this.base, mult: this.mult, gained: this.gained, total: this.score, isLast: true });
                    this.emit('update', { gained: this.gained, total: this.score });
                    this.base = 0;
                    this.mult = 1;
                } else {
                    snapshots.push({ effect, base: this.base, mult: this.mult, isLast: false });
                }
            }
            return snapshots;
        }
    }
