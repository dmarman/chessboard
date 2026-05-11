    // Live joker instance wrapping a def. Holds per-instance state for stateful jokers (counters, cooldowns, etc.).
    class Joker {
        constructor(def, options = {}) {
            this.instanceId = crypto.randomUUID();
            this.defId = def.id;
            this.name = def.name;
            this.description = def.description;
            this.type = options.type || def.type || 'Q';
            this.style = options.style || 'standard';
            this.modifiers = new Set(options.modifiers ?? []);
            this._color = options.color || 'w';
            // Mutable state bag — each def owns its own schema (e.g. { count: 0 })
            this.state = {};
        }

        color() { return this._color; }

        evaluate(ctx) {
            return JOKER_DEFS[this.defId].trigger(ctx, this.state);
        }
    }
