    // Manages the joker shop pool for one run.
    // Available pool starts with all joker ids; bought jokers are permanently removed.
    // Displayed (slot) jokers are temporarily removed and restored on leave/reroll.
    const MAX_SHOP_JOKERS = 2;
    const REROLL_COST = 5;

    const JOKER_RARITY_WEIGHTS = [
        { rarity: 'common',    threshold: 70  },
        { rarity: 'uncommon',  threshold: 95  },
        { rarity: 'rare',      threshold: 100 },
        // legendary: weight 0 — never rolled
    ];

    class ShopManager extends EventEmitter {
        constructor() {
            super();
            this._available = [];
            this._slots = [];
        }

        // Call once at run start (or run reset). Populates pool with every known joker id.
        init() {
            this._available = Object.keys(JOKER_DEFS);
            this._slots = [];
        }

        // Roll up to MAX_SHOP_JOKERS slots from the available pool.
        // Temporarily removes chosen ids from _available (restored by leave/reroll).
        // Returns array of def objects for the rolled slots.
        roll() {
            const pool = [...this._available];
            const slots = [];

            for (let i = 0; i < MAX_SHOP_JOKERS; i++) {
                if (pool.length === 0) break;

                const r = Math.floor(Math.random() * 100);

                let rolledRarity = 'rare';
                for (const { rarity, threshold } of JOKER_RARITY_WEIGHTS) {
                    if (r < threshold) { rolledRarity = rarity; break; }
                }

                let candidates = pool.filter(id => JOKER_DEFS[id].rarity === rolledRarity);
                // Fallback: rarity pool empty — pick from all remaining
                if (candidates.length === 0) candidates = pool;

                const pick = candidates[Math.floor(Math.random() * candidates.length)];
                slots.push(pick);
                pool.splice(pool.indexOf(pick), 1);
            }

            this._slots = slots;
            // Temporarily remove slots from available pool
            for (const id of slots) {
                const idx = this._available.indexOf(id);
                if (idx !== -1) this._available.splice(idx, 1);
            }

            return this._slots.map(id => JOKER_DEFS[id]);
        }

        // Restore current slots to pool then roll fresh ones.
        reroll() {
            this._available.push(...this._slots);
            this._slots = [];
            return this.roll();
        }

        // Price of a slot without mutating state.
        peekPrice(jokerId) {
            return JOKER_DEFS[jokerId]?.price ?? 0;
        }

        // Permanently remove joker from pool (bought — gone for rest of run).
        // Returns the def object.
        buy(jokerId) {
            const slotIdx = this._slots.indexOf(jokerId);
            if (slotIdx !== -1) this._slots.splice(slotIdx, 1);
            // _available already doesn't have it (was removed on roll); no restore.
            return JOKER_DEFS[jokerId];
        }

        // Restore displayed jokers to pool (player left without buying).
        leave() {
            this._available.push(...this._slots);
            this._slots = [];
        }

        getRerollCost() {
            return REROLL_COST;
        }

        // Current slot defs (for refreshing UI after a buy without full re-roll).
        currentSlots() {
            return this._slots.map(id => JOKER_DEFS[id]);
        }
    }
