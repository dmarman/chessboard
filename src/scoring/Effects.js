    class Effects {
        // Base chips and mult for each move type. level starts at 1 and can be upgraded.
        // These values are scored first (before piece/joker effects) but not animated.
        static MOVE_TYPE = {
            'quiet':        { chips: 5,   mult: 1,   level: 1 },
            'capture':      { chips: 10,  mult: 2,   level: 1 },
            'check':        { chips: 20,  mult: 2,   level: 1 },
            'castle king':  { chips: 30,  mult: 2,   level: 1 },
            'castle queen': { chips: 40,  mult: 2,   level: 1 },
            'promotion':    { chips: 50,  mult: 3,   level: 1 },
            'enpassant':    { chips: 60,  mult: 4,   level: 1 },
        };

        static PIECE = {
            p:  [{ kind: 'chips', value: 1  }],
            n:  [{ kind: 'chips', value: 3  }],
            b:  [{ kind: 'chips', value: 3  }],
            r:  [{ kind: 'chips', value: 5  }],
            q:  [{ kind: 'chips', value: 8  }],
            k:  [{ kind: 'chips', value: 10 }],
        }

        // Enhancement: fires when piece moves (ON_PIECE_SCORED).
        // metal/glass/stripes/checkers/rock share standard sprite; checkers/rock swap sprite family.
        // gold and metal are phase-specific — see ENHANCEMENT_ALIVE and ENHANCEMENT_HELD.
        // chance: optional float [0,1] — step only emits if Math.random() < chance.
        static ENHANCEMENT = {
            //metal:    [{ kind: 'xmult', value: 1.5 }],
            glass:    [{ kind: 'xmult', value: 2   },
                       { kind: 'expire', value: null, chance: 0.25 }], // 25% break on move
            stripes:  [{ kind: 'mult',  value: 4   }],
            checkers: [{ kind: 'xmult', value: 8  }],
            rock:     [{ kind: 'chips', value: 10  }],
        };

        // Enhancement effects that fire only when piece does NOT move (ON_NON_MOVED_PIECE).
        static ENHANCEMENT_HELD = {
            metal: [{ kind: 'xmult', value: 5 }],
        };

        // Enhancement effects that fire only when piece is alive at game end (ON_GAME_END).
        static ENHANCEMENT_ALIVE = {
            gold: [{ kind: 'money', value: 5 }],
        };

        // Edition: visual overlay (single value per piece). Stacks on top of enhancement.
        static EDITION = {
            holo:  [{ kind: 'mult',  value: 10  }],
            poly:  [{ kind: 'xmult', value: 2 }],
            shine: [{ kind: 'chips', value: 20  }],
            neon:  [{ kind: 'mult',  value: 5   }],
        };

        // Base per-type scoring for non-moved pieces. Empty by default — fill to give all pieces
        // a held bonus regardless of enhancement.
        static PIECE_HELD = {};

        // Base per-type scoring for alive-at-game-end pieces. Empty by default.
        static PIECE_ALIVE = {};

        // Returns ScoringStep[] for the ON_PIECE_SCORED phase.
        // piece: { id, type, enhancement, edition, name }
        static stepsFromPiece({ id, type, enhancement, edition, name }) {
            const t = type.toLowerCase();
            const label = name ?? t;

            const tableToSteps = (table, key) =>
                (table[key] ?? [])
                    .filter(e => e.chance === undefined || Math.random() < e.chance)
                    .map(e => makeScoringStep({
                        event: EventType.ON_PIECE_SCORED,
                        kind: e.kind,
                        value: e.value,
                        source: { type: 'piece', id, label },
                    }));

            return [
                ...tableToSteps(Effects.PIECE, t),
                ...tableToSteps(Effects.ENHANCEMENT, enhancement?.toLowerCase()),
                ...tableToSteps(Effects.EDITION, edition?.toLowerCase()),
            ];
        }

        // Returns ScoringStep[] for the ON_NON_MOVED_PIECE phase.
        // piece: { id, type, enhancement, edition, name }
        // square: { row, col } — position of held piece, threaded into source so the
        // animator pulses the held piece's square rather than the moved piece's destination.
        static stepsFromNonMovedPiece({ id, type, enhancement, edition, name }, square = null) {
            const t = type.toLowerCase();
            const label = name ?? t;

            const tableToSteps = (table, key) =>
                (table[key] ?? []).map(e => makeScoringStep({
                    event: EventType.ON_NON_MOVED_PIECE,
                    kind: e.kind,
                    value: e.value,
                    source: { type: 'piece', id, label, row: square?.row ?? null, col: square?.col ?? null },
                }));

            return [
                ...tableToSteps(Effects.PIECE_HELD, t),
                ...tableToSteps(Effects.ENHANCEMENT_HELD, enhancement?.toLowerCase()),
            ];
        }

        // Returns ScoringStep[] for the ON_GAME_END phase.
        // piece: { id, type, enhancement, edition, name }
        static stepsFromAliveAtGameEnd({ id, type, enhancement, edition, name }) {
            const t = type.toLowerCase();
            const label = name ?? t;

            const tableToSteps = (table, key) =>
                (table[key] ?? []).map(e => makeScoringStep({
                    event: EventType.ON_GAME_END,
                    kind: e.kind,
                    value: e.value,
                    source: { type: 'piece', id, label },
                }));

            return [
                ...tableToSteps(Effects.PIECE_ALIVE, t),
                ...tableToSteps(Effects.ENHANCEMENT_ALIVE, enhancement?.toLowerCase()),
            ];
        }

        // Returns ScoringStep[] for move type effects.
        // moveType: string (e.g. 'capture', 'check', 'promotion')
        // Both chips and mult steps are marked animate:false — they are the base, not animated.
        static stepsFromMoveType(moveType) {
            const def = Effects.MOVE_TYPE[moveType];
            if (!def) return [];
            const source = { type: 'moveType', label: moveType };
            return [
                makeScoringStep({ event: EventType.ON_MOVE_PLAYED, kind: 'chips', value: def.chips, animate: false, source }),
                makeScoringStep({ event: EventType.ON_MOVE_PLAYED, kind: 'mult',  value: def.mult,  animate: false, source }),
            ];
        }

        // Deterministic preview of move-type base scoring only.
        // Piece, enhancement, edition, and jokers intentionally excluded — preview shows
        // only what the move type contributes. Returns { chips, mult, gained }.
        static preview(moveTypes = []) {
            let chips = 0;
            let mult = 0;

            for (const mt of moveTypes) {
                const def = Effects.MOVE_TYPE[mt];
                if (def) { chips += def.chips ?? 0; mult += def.mult ?? 0; }
            }

            return { chips, mult, gained: chips * mult };
        }
    }
