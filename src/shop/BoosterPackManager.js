    // Manages booster pack slots in the shop.
    // Packs have no finite pool — they roll fresh each visit.
    const MAX_SHOP_PACKS = 2;

    class BoosterPackManager {
        constructor() {
            this._slots = [];
        }

        // Roll MAX_SHOP_PACKS packs by weight and return their defs.
        roll() {
            this._slots = [];
            for (let i = 0; i < MAX_SHOP_PACKS; i++) {
                const id = BoosterPackManager._weightedPick(PACK_WEIGHTS);
                this._slots.push(PACK_DEFS[id]);
            }
            return this.currentSlots();
        }

        // Remove a bought pack from current slots and return its def.
        buy(packId) {
            const idx = this._slots.findIndex(def => def.id === packId);
            if (idx !== -1) this._slots.splice(idx, 1);
            return PACK_DEFS[packId];
        }

        // Current displayed pack defs (copy).
        currentSlots() {
            return [...this._slots];
        }

        // Generate piece previews for a pack using category content weights.
        // Returns null if the category is not yet implemented.
        // Each piece: { type, enhancement, edition, style, modifiers[] }
        // modifiers is the flat union of enhancement.modifiers + edition.modifiers.
        generateContent(packDef) {
            const weights = PACK_CONTENT_WEIGHTS[packDef.category];
            if (!weights) return null;

            const pieces = [];
            for (let i = 0; i < packDef.numPieces; i++) {
                const enh = BoosterPackManager._weightedPickItem(weights.enhancements);
                const edt = BoosterPackManager._weightedPickItem(weights.editions);
                pieces.push({
                    type:        BoosterPackManager._weightedPick(weights.pieceTypes),
                    enhancement: enh.value,
                    edition:     edt.value,
                    style:       enh.style,
                    modifiers:   [...enh.modifiers, ...edt.modifiers],
                });
            }
            return pieces;
        }

        // Weighted random pick — returns item.value.
        static _weightedPick(items) {
            const total = items.reduce((sum, item) => sum + item.weight, 0);
            let r = Math.random() * total;
            for (const item of items) {
                r -= item.weight;
                if (r <= 0) return item.value;
            }
            return items[items.length - 1].value;
        }

        // Weighted random pick — returns the full item object.
        static _weightedPickItem(items) {
            const total = items.reduce((sum, item) => sum + item.weight, 0);
            let r = Math.random() * total;
            for (const item of items) {
                r -= item.weight;
                if (r <= 0) return item;
            }
            return items[items.length - 1];
        }
    }
