    // Each joker def is a static blueprint.
    // trigger(ctx, state) returns an effect object (same shape as Effects) or null if condition unmet.
    // ctx: { chessGame, lastMove, scoreEngine, playerColor }
    // state: per-instance mutable object for counters, cooldowns, etc.
    const JOKER_DEFS = {
        WILD_JESTER: {
            id: 'WILD_JESTER',
            name: 'Wild Jester',
            description: '+4 mult every move',
            type: 'Q',
            trigger(_ctx, _state) {
                return { source: 'joker', sourceType: 'WILD_JESTER', destination: 'mult', operation: 'add', value: 4 };
            }
        },
        SCHOLAR: {
            id: 'SCHOLAR',
            name: 'Scholar',
            description: 'Bishop pair alive → +50 chips',
            type: 'B',
            trigger({ chessGame, playerColor }, _state) {
                if (!chessGame.hasBishopPair(playerColor)) return null;
                return { source: 'joker', sourceType: 'SCHOLAR', destination: 'add', operation: 'add', value: 50 };
            }
        },
        PREDATOR: {
            id: 'PREDATOR',
            name: 'Predator',
            description: 'Capture move → mult ×2',
            type: 'N',
            trigger({ lastMove }, _state) {
                if (!lastMove?.captured) return null;
                return { source: 'joker', sourceType: 'PREDATOR', destination: 'mult', operation: 'mult', value: 2 };
            }
        },
    };
