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
            description: '+2 mult every move',
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
        COMET: {
            id: 'COMET',
            name: 'Comet',
            description: 'If your move gives check, +12 mult',
            type: 'Q',
            rarity: 'uncommon',
            price: 5,
            events: ['ON_MOVE_PLAYED'],
            trigger({ turn }, _state) {
                if (!turn?.isCheck) return null;
                return [makeScoringStep({
                    event: EventType.ON_MOVE_PLAYED,
                    kind: 'mult',
                    value: 12,
                    source: { type: 'joker', id: 'COMET', label: 'Comet' },
                })];
            }
        },
        BANKER: {
            id: 'BANKER',
            name: 'Banker',
            description: 'Every move, gain $1',
            type: 'Q',
            rarity: 'common',
            price: 4,
            events: ['INDEPENDENT'],
            trigger(_ctx, _state) {
                return [makeScoringStep({
                    event: EventType.INDEPENDENT,
                    kind: 'money',
                    value: 1,
                    source: { type: 'joker', id: 'BANKER', label: 'Banker' },
                })];
            }
        },
        STABLEMASTER: {
            id: 'STABLEMASTER',
            name: 'Stablemaster',
            description: 'Each non-moved knight gives +10 chips',
            type: 'N',
            rarity: 'uncommon',
            price: 4,
            events: ['ON_NON_MOVED_PIECE'],
            trigger({ heldPiece }, _state) {
                if (heldPiece?.type?.toLowerCase() !== 'n') return null;
                return [makeScoringStep({
                    event: EventType.ON_NON_MOVED_PIECE,
                    kind: 'chips',
                    value: 10,
                    source: { type: 'joker', id: 'STABLEMASTER', label: 'Stablemaster' },
                })];
            }
        },
        CATHEDRAL: {
            id: 'CATHEDRAL',
            name: 'Cathedral',
            description: 'Bishop pair alive → +30 chips',
            type: 'B',
            rarity: 'uncommon',
            price: 5,
            events: ['INDEPENDENT'],
            trigger({ boardInspector, playerColor }, _state) {
                if (!boardInspector?.hasBishopPair(playerColor)) return null;
                return [makeScoringStep({
                    event: EventType.INDEPENDENT,
                    kind: 'chips',
                    value: 30,
                    source: { type: 'joker', id: 'CATHEDRAL', label: 'Cathedral' },
                })];
            }
        },
        METRONOME: {
            id: 'METRONOME',
            name: 'Metronome',
            description: 'Every third move, +4 mult',
            type: 'Q',
            rarity: 'common',
            price: 3,
            events: ['ON_MOVE_PLAYED'],
            trigger(_ctx, state) {
                state.count = (state.count ?? 0) + 1;
                if (state.count % 3 !== 0) return null;
                return [makeScoringStep({
                    event: EventType.ON_MOVE_PLAYED,
                    kind: 'mult',
                    value: 4,
                    source: { type: 'joker', id: 'METRONOME', label: 'Metronome' },
                })];
            }
        },
        DUELIST: {
            id: 'DUELIST',
            name: 'Duelist',
            description: 'Consecutive captures: +20, +40, +60 chips...',
            type: 'N',
            rarity: 'rare',
            price: 6,
            events: ['ON_MOVE_PLAYED'],
            trigger({ lastMove }, state) {
                if (!lastMove?.captured) {
                    state.captureStreak = 0;
                    return null;
                }
                state.captureStreak = (state.captureStreak ?? 0) + 1;
                return [makeScoringStep({
                    event: EventType.ON_MOVE_PLAYED,
                    kind: 'chips',
                    value: state.captureStreak * 20,
                    source: { type: 'joker', id: 'DUELIST', label: 'Duelist' },
                })];
            }
        },
        ECHO_KNIGHT: {
            id: 'ECHO_KNIGHT',
            name: 'Echo Knight',
            description: 'Knight move → retrigger scored piece',
            type: 'N',
            rarity: 'rare',
            price: 7,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                if (lastMove?.piece?.type?.toLowerCase() !== 'n') return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'retrigger',
                    value: null,
                    source: { type: 'joker', id: 'ECHO_KNIGHT', label: 'Echo Knight' },
                })];
            }
        },
        CORONATION: {
            id: 'CORONATION',
            name: 'Coronation',
            description: 'Promotion move → ×200 mult',
            type: 'Q',
            rarity: 'rare',
            price: 7,
            events: ['ON_MOVE_PLAYED'],
            trigger({ turn }, _state) {
                if (!turn?.promotion) return null;
                return [makeScoringStep({
                    event: EventType.ON_MOVE_PLAYED,
                    kind: 'xmult',
                    value: 200,
                    source: { type: 'joker', id: 'CORONATION', label: 'Coronation' },
                })];
            }
        },
    };
