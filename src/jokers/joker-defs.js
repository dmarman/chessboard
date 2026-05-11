    // Each joker def is a static blueprint.
    // trigger(ctx, state) returns an effect object (same shape as Effects) or null if condition unmet.
    // ctx: frozen PowerContext — boardFacts, lastMove (DTO), turn (DTO), playerColor, fen, currentScore
    // state: per-instance mutable object for counters, cooldowns, etc.
    // trigger(ctx, state) returns Command[] or null.
    // Scoring jokers: [{ type: 'SCORE_EFFECTS', effects: [Effect, ...] }]
    // Side-effect jokers: [{ type: 'MUTATE_PIECE', ... }], [{ type: 'RETRIGGER', ... }], etc.
    const JOKER_DEFS = {
        WILD_JESTER: {
            id: 'WILD_JESTER',
            name: 'Wild Jester',
            description: '+4 mult every move',
            type: 'Q',
            rarity: 'common',
            price: 2,
            trigger(_ctx, _state) {
                return [{ type: 'SCORE_EFFECTS', effects: [{ source: 'joker', sourceType: 'WILD_JESTER', destination: 'mult', operation: 'add', value: 4 }] }];
            }
        },
        SCHOLAR: {
            id: 'SCHOLAR',
            name: 'Scholar',
            description: 'Bishop pair alive → +50 chips',
            type: 'B',
            rarity: 'uncommon',
            price: 5,
            trigger({ boardFacts, playerColor }, _state) {
                if (!boardFacts.hasBishopPair[playerColor]) return null;
                return [{ type: 'SCORE_EFFECTS', effects: [{ source: 'joker', sourceType: 'SCHOLAR', destination: 'add', operation: 'add', value: 50 }] }];
            }
        },
        PREDATOR: {
            id: 'PREDATOR',
            name: 'Predator',
            description: 'Capture move → mult ×2',
            type: 'N',
            rarity: 'rare',
            price: 7,
            trigger({ lastMove }, _state) {
                if (!lastMove?.captured) return null;
                return [{ type: 'SCORE_EFFECTS', effects: [{ source: 'joker', sourceType: 'PREDATOR', destination: 'mult', operation: 'mult', value: 2 }] }];
            }
        },
    };
