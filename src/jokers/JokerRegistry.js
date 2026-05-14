    // Maintains ordered list of active Joker instances.
    // collectSteps(event, ctx) returns ScoringStep[] from all jokers that respond to that pipeline phase.
    // collectCommands(ctx) is a legacy alias for non-scoring side effects — kept until GameController cutover.
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

        // Returns ScoringStep[] from all jokers that respond to this pipeline phase.
        collectSteps(event, ctx) {
            return this._active.flatMap(j => j.evaluate(event, ctx));
        }

        // Returns non-scoring Command[] (MUTATE_PIECE, etc.) from all jokers.
        collectSideEffects(ctx) {
            return this._active.flatMap(j => j.evaluateSideEffects(ctx));
        }

        // Reset all active joker states — call on resetChessboard so counters don't bleed between games.
        resetStates() {
            this._active.forEach(j => j.resetState());
        }

        // Moves a joker to a new position in play order. Affects the sequence joker steps are collected.
        reorder(instanceId, newIndex) {
            const idx = this._active.findIndex(j => j.instanceId === instanceId);
            if (idx === -1) return;
            const [joker] = this._active.splice(idx, 1);
            const clamped = Math.max(0, Math.min(newIndex, this._active.length));
            this._active.splice(clamped, 0, joker);
            this.emit('change', [...this._active]);
        }

    }
