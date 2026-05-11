    // Maintains ordered list of active Joker instances. collectCommands() returns Command[] from all jokers.
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

        // Returns flat Command[] from all active jokers.
        collectCommands(ctx) {
            return this._active.flatMap(j => j.evaluate(ctx));
        }
    }
