    // Live opponent instance wrapping a def. Holds per-instance state for stateful powers.
    class Opponent {
        constructor(def) {
            this.instanceId = crypto.randomUUID();
            this.defId = def.id;
            this.name = def.name;
            this.description = def.description;
            this.scoreAtLeast = def.scoreAtLeast;
            this.reward = def.reward ?? 0;
            this.powers = def.powers ?? [];
            // Mutable state bag for powers — each def owns its own schema
            this.state = {};
        }

        // Returns array of action descriptors for powers matching the given timing
        triggerPowers(timing, ctx) {
            return this.powers
                .filter(p => p.timing === timing)
                .map(p => p.action(ctx, this.state))
                .filter(Boolean);
        }
    }
