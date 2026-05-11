    // Each joker def is a static blueprint.
    // events: string[] — which pipeline phases this joker responds to.
    // trigger(ctx, state) returns ScoringStep[] or null if condition unmet.
    // ctx: frozen PowerContext — boardInspector, lastMove (DTO), turn (DTO), playerColor, fen, currentScore
    // state: per-instance mutable object for counters, cooldowns, etc.
    // source.id in returned steps uses the def id — JokerRegistry stamps the instanceId on evaluate().
    // Side-effect jokers: add sideEffects(ctx, state) method returning Command[] (e.g. MUTATE_PIECE). trigger() is scoring-only.
    const JOKER_DEFS = {
        WILD_JESTER: {
            id: 'WILD_JESTER',
            name: 'Wild Jester',
            description: '+4 mult every move',
            type: 'Q',
            rarity: 'common',
            price: 2,
            events: ['INDEPENDENT'],
            trigger(_ctx, _state) {
                return [makeScoringStep({
                    event: EventType.INDEPENDENT,
                    kind: 'mult',
                    value: 4,
                    source: { type: 'joker', id: 'WILD_JESTER', label: 'Wild Jester' },
                })];
            }
        },
        SCHOLAR: {
            id: 'SCHOLAR',
            name: 'Scholar',
            description: 'Bishop pair alive → +50 chips',
            type: 'B',
            rarity: 'uncommon',
            price: 5,
            events: ['INDEPENDENT'],
            trigger({ boardInspector, playerColor }, _state) {
                if (!boardInspector?.hasBishopPair(playerColor)) return null;
                return [makeScoringStep({
                    event: EventType.INDEPENDENT,
                    kind: 'chips',
                    value: 50,
                    source: { type: 'joker', id: 'SCHOLAR', label: 'Scholar' },
                })];
            }
        },
        PREDATOR: {
            id: 'PREDATOR',
            name: 'Predator',
            description: 'Capture move → mult ×2',
            type: 'N',
            rarity: 'rare',
            price: 7,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                if (!lastMove?.captured) return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'xmult',
                    value: 2,
                    source: { type: 'joker', id: 'PREDATOR', label: 'Predator' },
                })];
            }
        },
    };
