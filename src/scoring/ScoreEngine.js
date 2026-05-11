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

        // Processes an ordered ScoringStep[] and returns Snapshot[].
        // Handles chips/mult/xmult; retrigger/expire/message pass through as annotation snapshots.
        // Fires 'update' once at the end when numeric steps are present.
        run(steps) {
            const hasNumeric = steps.some(s => s.value != null && typeof s.value === 'number' && s.kind !== 'money');
            if (!steps.length) return [];

            this.base = 0;
            this.mult = 1;
            const snapshots = [];

            for (const [i, step] of steps.entries()) {
                const isLast = i === steps.length - 1;

                if (step.kind === 'chips' && step.value != null)  this.base += step.value;
                if (step.kind === 'mult'  && step.value != null)  this.mult += step.value;
                if (step.kind === 'xmult' && step.value != null)  this.mult *= step.value;
                // money steps bypass chips×mult — emit separate event for Wallet wiring
                if (step.kind === 'money' && step.value != null)  this.emit('money', { amount: step.value, source: step.source });
                // retrigger/expire/message: no arithmetic, annotate snapshot only

                if (isLast && hasNumeric) {
                    this.gained = this.base * this.mult;
                    this.score += this.gained;
                    snapshots.push({ step, base: this.base, mult: this.mult, gained: this.gained, total: this.score, isLast: true });
                    this.emit('update', { gained: this.gained, total: this.score });
                    this.base = 0;
                    this.mult = 1;
                } else {
                    snapshots.push({ step, base: this.base, mult: this.mult, isLast: false });
                }
            }
            return snapshots;
        }

        // Shim for legacy Effect[] shapes (opponent CommandDispatcher handlers).
        // New code should use run() with ScoringStep[] directly.
        // Pre-computes all effects for a move and returns scored snapshots — no event emission, no timing dependency.
        processEffects(effects) {
            const validEffects = effects.filter(e => e.value != null);
            if (!validEffects.length) return [];

            const steps = validEffects.map(e => makeScoringStep({
                event: EventType.ON_PIECE_SCORED,
                kind: e.destination === 'mult'
                    ? (e.operation === 'mult' ? 'xmult' : 'mult')
                    : 'chips',
                value: e.value,
                source: {
                    type: e.source ?? 'piece',
                    id: e.sourceInstanceId ?? e.sourceType ?? 'unknown',
                    label: e.sourceType ?? e.source ?? 'unknown',
                },
            }));
            return this.run(steps);
        }
    }
