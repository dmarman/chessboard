    // Maintains ordered list of active Joker instances. collectEffects() returns effect objects ready for ScoreEngine.
    class JokerRegistry extends EventEmitter {
        constructor() {
            super();
            this._active = [];
        }

        add(jokerId, options = {}) {
            if (!JOKER_DEFS[jokerId]) throw new Error(`Unknown joker: ${jokerId}`);
            const joker = new Joker(JOKER_DEFS[jokerId], options);
            this._active.push(joker);
            this.emit('change', [...this._active]);
            return joker;
        }

        getActive() {
            return [...this._active];
        }

        // Remove by instanceId so duplicate jokers can be targeted individually
        remove(instanceId) {
            this._active = this._active.filter(j => j.instanceId !== instanceId);
            this.emit('change', [...this._active]);
        }

        collectEffects(ctx) {
            return this._active
                .map(j => {
                    const effect = j.evaluate(ctx);
                    if (!effect) return null;
                    return { ...effect, sourceInstanceId: j.instanceId };
                })
                .filter(Boolean);
        }
    }
