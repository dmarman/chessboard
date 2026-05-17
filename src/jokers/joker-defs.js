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
            rarity: 'rare',
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
            rarity: 'common',
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
            rarity: 'rare',
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
            description: 'Each non-moved knight gives +5 chips',
            type: 'N',
            rarity: 'common',
            price: 4,
            events: ['ON_NON_MOVED_PIECE'],
            trigger({ heldPiece }, _state) {
                if (heldPiece?.type?.toLowerCase() !== 'n') return null;
                return [makeScoringStep({
                    event: EventType.ON_NON_MOVED_PIECE,
                    kind: 'chips',
                    value: 5,
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
            rarity: 'uncommon',
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
            rarity: 'common',
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
            rarity: 'common',
            price: 7,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                if (lastMove?.piece?.type?.toLowerCase() !== 'n') return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'retrigger',
                    value: 'null',
                    source: { type: 'joker', id: 'ECHO_KNIGHT', label: 'Echo Knight' },
                })];
            }
        },
        IRON_THRONE: {
            id: 'IRON_THRONE',
            name: 'Iron Throne',
            description: 'Queen or Rook moved → +3 mult',
            type: 'Q',
            rarity: 'common',
            price: 5,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                const t = lastMove?.piece?.type?.toLowerCase();
                if (t !== 'q' && t !== 'r') return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: 3,
                    source: { type: 'joker', id: 'IRON_THRONE', label: 'Iron Throne' },
                })];
            }
        },
        HEDGE_KNIGHT: {
            id: 'HEDGE_KNIGHT',
            name: 'Hedge Knight',
            description: 'Bishop or Knight moved → +4 mult',
            type: 'B',
            rarity: 'uncommon',
            price: 5,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                const t = lastMove?.piece?.type?.toLowerCase();
                if (t !== 'b' && t !== 'n') return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: 4,
                    source: { type: 'joker', id: 'HEDGE_KNIGHT', label: 'Hedge Knight' },
                })];
            }
        },
        RANK_AND_FILE: {
            id: 'RANK_AND_FILE',
            name: 'Rank and File',
            description: 'Pawn moved → +10 mult',
            type: 'P',
            rarity: 'uncommon',
            price: 5,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                if (lastMove?.piece?.type?.toLowerCase() !== 'p') return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: 10,
                    source: { type: 'joker', id: 'RANK_AND_FILE', label: 'Rank and File' },
                })];
            }
        },
        testN: {
            id: 'testN',
            name: 'Rank and File',
            description: 'Pawn moved → +10 mult',
            type: 'P',
            rarity: 'uncommon',
            price: 5,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                if (lastMove?.piece?.type?.toLowerCase() !== 'n') return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: 10,
                    source: { type: 'joker', id: 'testN', label: 'Rank and File' },
                })];
            }
        },
        LONGSTRIDER: {
            id: 'LONGSTRIDER',
            name: 'Longstrider',
            description: 'Sliding piece (Queen, Rook or Bishop) moved → +2 mult',
            type: 'B',
            rarity: 'common',
            price: 5,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                const t = lastMove?.piece?.type?.toLowerCase();
                if (t !== 'q' && t !== 'r' && t !== 'b') return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: 2,
                    source: { type: 'joker', id: 'LONGSTRIDER', label: 'Longstrider' },
                })];
            }
        },
        OFFICER_CLASS: {
            id: 'OFFICER_CLASS',
            name: 'Officer Class',
            description: 'Non-pawn moved → +1 mult',
            type: 'Q',
            rarity: 'common',
            price: 5,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, _state) {
                if (lastMove?.piece?.type?.toLowerCase() === 'p') return null;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: 1,
                    source: { type: 'joker', id: 'OFFICER_CLASS', label: 'Officer Class' },
                })];
            }
        },
        FOOT_SOLDIER_BANE: {
            id: 'FOOT_SOLDIER_BANE',
            name: "Foot Soldier's Bane",
            description: 'Capture a pawn → +15 mult',
            type: 'P',
            rarity: 'common',
            price: 4,
            events: ['ON_MOVE_PLAYED'],
            trigger({ lastMove }, _state) {
                if (lastMove?.captured?.type?.toLowerCase() !== 'p') return null;
                return [makeScoringStep({
                    event: EventType.ON_MOVE_PLAYED,
                    kind: 'mult',
                    value: 15,
                    source: { type: 'joker', id: 'FOOT_SOLDIER_BANE', label: "Foot Soldier's Bane" },
                })];
            }
        },
        MINOR_HUNTER: {
            id: 'MINOR_HUNTER',
            name: 'Minor Hunter',
            description: 'Capture a bishop or knight → +10 mult',
            type: 'N',
            rarity: 'uncommon',
            price: 4,
            events: ['ON_MOVE_PLAYED'],
            trigger({ lastMove }, _state) {
                const t = lastMove?.captured?.type?.toLowerCase();
                if (t !== 'b' && t !== 'n') return null;
                return [makeScoringStep({
                    event: EventType.ON_MOVE_PLAYED,
                    kind: 'mult',
                    value: 10,
                    source: { type: 'joker', id: 'MINOR_HUNTER', label: 'Minor Hunter' },
                })];
            }
        },
        PAWN_MARCH: {
            id: 'PAWN_MARCH',
            name: 'Pawn March',
            description: '+1 mult per consecutive pawn moved. Resets on non-pawn.',
            type: 'P',
            rarity: 'common',
            price: 6,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, state) {
                const t = lastMove?.piece?.type?.toLowerCase();
                if (t !== 'p') {
                    state.streak = 0;
                    return null;
                }
                state.streak = (state.streak ?? 0) + 1;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: state.streak,
                    source: { type: 'joker', id: 'PAWN_MARCH', label: 'Pawn March' },
                })];
            }
        },
        REPETITION: {
            id: 'REPETITION',
            name: 'Repetition',
            description: '+1 mult per consecutive move of same piece. Resets on different piece.',
            type: 'Q',
            rarity: 'uncommon',
            price: 6,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, state) {
                const id = lastMove?.piece?.id;
                if (!id) {
                    state.streak = 0;
                    state.lastPieceId = null;
                    return null;
                }
                if (id === state.lastPieceId) {
                    state.streak = (state.streak ?? 0) + 1;
                } else {
                    state.streak = 1;
                    state.lastPieceId = id;
                }
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: state.streak,
                    source: { type: 'joker', id: 'REPETITION', label: 'Repetition' },
                })];
            }
        },
        QUEEN_PROCESSION: {
            id: 'QUEEN_PROCESSION',
            name: 'Queen Procession',
            description: '+1 mult per consecutive queen move. Resets on non-queen.',
            type: 'Q',
            rarity: 'common',
            price: 6,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, state) {
                const t = lastMove?.piece?.type?.toLowerCase();
                if (t !== 'q') {
                    state.streak = 0;
                    return null;
                }
                state.streak = (state.streak ?? 0) + 1;
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'mult',
                    value: state.streak,
                    source: { type: 'joker', id: 'QUEEN_PROCESSION', label: 'Queen Procession' },
                })];
            }
        },
        GLACIER: {
            id: 'GLACIER',
            name: 'Glacier',
            description: '+50 chips, melts -5 per move',
            type: 'Q',
            rarity: 'rare',
            price: 5,
            events: ['INDEPENDENT'],
            trigger(_ctx, state) {
                state.chips = state.chips ?? 50;
                const value = state.chips;
                state.chips = Math.max(0, state.chips - 5);
                if (value <= 0) return null;
                return [makeScoringStep({
                    event: EventType.INDEPENDENT,
                    kind: 'chips',
                    value,
                    source: { type: 'joker', id: 'GLACIER', label: 'Glacier' },
                })];
            }
        },
        FULL_ARMY: {
            id: 'FULL_ARMY',
            name: 'Full Army',
            description: 'All 16 pieces alive → ×2 mult',
            type: 'K',
            rarity: 'common',
            price: 6,
            events: ['ON_MOVE_PLAYED'],
            trigger({ boardInspector, playerColor }, _state) {
                if (boardInspector?.countByColor(playerColor) !== 16) return null;
                return [makeScoringStep({
                    event: EventType.ON_MOVE_PLAYED,
                    kind: 'xmult',
                    value: 2,
                    source: { type: 'joker', id: 'FULL_ARMY', label: 'Full Army' },
                })];
            }
        },
        LUMBERJACK: {
            id: 'LUMBERJACK',
            name: 'Lumberjack',
            description: '+chips equal to sum of your piece values',
            type: 'R',
            rarity: 'rare',
            price: 6,
            events: ['INDEPENDENT'],
            trigger({ boardInspector, playerColor }, _state) {
                const entries = boardInspector?.getPiecesWithCoordsByColor(playerColor) ?? [];
                const steps = [];
                for (const { piece, row, col } of entries) {
                    const pieceSteps = Effects.PIECE[piece.type.toLowerCase()] ?? [];
                    for (const e of pieceSteps) {
                        if (e.kind !== 'chips') continue;
                        steps.push(makeScoringStep({
                            event: EventType.INDEPENDENT,
                            kind: 'chips',
                            value: e.value,
                            source: { type: 'piece', id: piece.id, label: piece.name ?? piece.type, row, col },
                        }));
                    }
                }
                return steps.length ? steps : null;
            }
        },
        PAWN_WALL: {
            id: 'PAWN_WALL',
            name: 'Pawn Wall',
            description: 'All 8 pawns alive → ×2 mult',
            type: 'P',
            rarity: 'common',
            price: 6,
            events: ['ON_MOVE_PLAYED'],
            trigger({ boardInspector, playerColor }, _state) {
                if (boardInspector?.getPieceCount('p', playerColor) !== 8) return null;
                return [makeScoringStep({
                    event: EventType.ON_MOVE_PLAYED,
                    kind: 'xmult',
                    value: 2,
                    source: { type: 'joker', id: 'PAWN_WALL', label: 'Pawn Wall' },
                })];
            }
        },
        SHERPA: {
            id: 'SHERPA',
            name: 'Sherpa',
            description: 'Every played piece permanently gains +5 chips when scored',
            type: 'P',
            rarity: 'common',
            price: 6,
            events: ['ON_PIECE_SCORED'],
            trigger({ lastMove }, state) {
                const id = lastMove?.piece?.id;
                if (!id) return null;
                state.bonuses = state.bonuses ?? new Map();
                const next = (state.bonuses.get(id) ?? 0) + 5;
                state.bonuses.set(id, next);
                return [makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: 'chips',
                    value: next,
                    source: { type: 'joker', id: 'SHERPA', label: 'Sherpa' },
                })];
            }
        },
    };
