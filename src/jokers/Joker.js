    // Live joker instance wrapping a def. Holds per-instance state for stateful jokers (counters, cooldowns, etc.).
    class Joker {
        constructor(def, options = {}) {
            this.instanceId = crypto.randomUUID();
            this.defId = def.id;
            this._def = def;
            this.name = def.name;
            this.description = def.description;
            this.type = options.type || def.type || 'Q';
            this.enhancement = options.enhancement ?? 'none';
            this.edition = options.edition ?? 'base';
            this._color = options.color || 'w';
            // Mutable state bag — each def owns its own schema (e.g. { count: 0 })
            this.state = {};
        }

        color() { return this._color; }

        // Wipe per-instance state — call between games so counters/streaks don't bleed across boards.
        resetState() { this.state = {}; }

        // Returns ScoringStep[] for the given pipeline phase — empty if def doesn't handle this event.
        // Stamps this.instanceId onto source.id so AnimationCoordinator can route to the correct joker card.
        evaluate(event, ctx) {
            const def = this._def;
            if (!def.events?.includes(event)) return [];
            const result = def.trigger(ctx, this.state);
            if (!result) return [];
            const steps = Array.isArray(result) ? result : [result];
            return steps.map(step => Object.freeze({
                ...step,
                source: Object.freeze({ ...step.source, id: this.instanceId }),
            }));
        }

        // Returns non-scoring Command[] (MUTATE_PIECE, etc.) — bypasses the scoring pipeline.
        // Defs declare side effects via an optional sideEffects(ctx, state) method, separate from trigger().
        // This avoids double-firing trigger() and removes the duck-type split on ScoringStep shape.
        evaluateSideEffects(ctx) {
            const def = this._def;
            if (typeof def.sideEffects !== 'function') return [];
            const result = def.sideEffects(ctx, this.state);
            if (!result) return [];
            const commands = Array.isArray(result) ? result : [result];
            return commands.map(cmd => ({ ...cmd, sourceInstanceId: this.instanceId }));
        }
    }
