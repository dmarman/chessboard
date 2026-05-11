    // Manages a single active Opponent at a time. Exposes resign check and power triggering.
    class OpponentRegistry extends EventEmitter {
        constructor() {
            super();
            this._current = null;
        }

        // opponentId: string key into BOSS_DEFS or BLIND_CONFIG — or pass a full def object directly
        set(opponentIdOrDef, options = {}) {
            let def;
            if (typeof opponentIdOrDef === 'object') {
                def = opponentIdOrDef;
            } else {
                def = BOSS_DEFS[opponentIdOrDef] ?? BLIND_CONFIG[opponentIdOrDef];
                if (!def) throw new Error(`Unknown opponent: ${opponentIdOrDef}`);
            }
            this._current = new Opponent({ ...def, ...options });
            this.emit('change', this._current);
            return this._current;
        }

        getCurrent() { return this._current; }

        clear() {
            this._current = null;
            this.emit('change', null);
        }

        // True when the player has reached or passed the resign threshold
        checkResign(score) {
            if (!this._current) return false;
            return score >= this._current.scoreAtLeast;
        }

        // Safe to call when no opponent is set — returns empty array
        triggerPowers(timing, ctx) {
            if (!this._current) return [];
            return this._current.triggerPowers(timing, ctx);
        }
    }
