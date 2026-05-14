    class ScoreEngine extends EventEmitter {
        constructor() {
            super();
            this.score = 0;
            this.gained = 0;
        }

        reset() {
            this.score = 0;
            this.gained = 0;
            this.emit('reset', { score: 0 });
        }

        // Processes an ordered ScoringStep[] and returns Snapshot[].
        // Handles chips/mult/xmult; retrigger/expire/message pass through as annotation snapshots.
        // Fires 'update' once at the end when numeric steps are present.
        run(steps) {
            const hasNumeric = steps.some(s => s.value != null && typeof s.value === 'number' && s.kind !== 'money');
            if (!steps.length) return [];

            let base = 0;
            let mult = 1;
            const snapshots = [];

            for (const [i, step] of steps.entries()) {
                const isLast = i === steps.length - 1;

                if (step.kind === 'chips' && step.value != null)  base += step.value;
                if (step.kind === 'mult'  && step.value != null)  mult += step.value;
                if (step.kind === 'xmult' && step.value != null)  mult *= step.value;
                // money steps bypass chips×mult — emit separate event for Wallet wiring
                if (step.kind === 'money' && step.value != null)  this.emit('money', { amount: step.value, source: step.source });
                // expire steps bypass chips×mult — emit separate event for piece removal wiring
                if (step.kind === 'expire')                       this.emit('expire', { source: step.source });
                // retrigger/message: no arithmetic, annotate snapshot only

                if (isLast && hasNumeric) {
                    this.gained = base * mult;
                    this.score += this.gained;
                    snapshots.push({ step, base, mult, gained: this.gained, total: this.score, isLast: true });
                    this.emit('update', { gained: this.gained, total: this.score });
                } else {
                    snapshots.push({ step, base, mult, isLast: false });
                }
            }
            return snapshots;
        }

        // Out-of-band score credit for non-move contexts (onGameStart rewards, shop bonuses, etc.).
        // Bypasses the move pipeline — no base/mult chain, no retrigger, no joker interaction.
        applyBonus(amount) {
            if (!amount) return;
            this.gained = amount;
            this.score += amount;
            this.emit('update', { gained: amount, total: this.score });
        }
    }
