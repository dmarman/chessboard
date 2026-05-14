    class Effects {
        static MOVE_TYPE = {
            'capture':      [{ kind: 'mult',  value: 1   }],
            'check':        [{ kind: 'mult',  value: 2   }],
            'castle king':  [{ kind: 'mult',  value: 3   }],
            'castle queen': [{ kind: 'mult',  value: 4   }],
            'promotion':    [{ kind: 'mult',  value: 20  }],
            'enpassant':    [{ kind: 'mult',  value: 300 }],
        };

        static PIECE = {
            p:  [{ kind: 'chips', value: 1  }],
            n:  [{ kind: 'chips', value: 3  }],
            b:  [{ kind: 'chips', value: 4  }],
            r:  [{ kind: 'chips', value: 5  }],
            q:  [{ kind: 'chips', value: 8  }],
            k:  [{ kind: 'chips', value: 10 }],
        }

        // Enhancement: fires when piece moves (ON_PIECE_SCORED).
        // metal/glass/stripes/checkers/rock share standard sprite; checkers/rock swap sprite family.
        // gold and steel are phase-specific — see ENHANCEMENT_ALIVE and ENHANCEMENT_HELD.
        // chance: optional float [0,1] — step only emits if Math.random() < chance.
        static ENHANCEMENT = {
            //metal:    [{ kind: 'xmult', value: 1.5 }],
            glass:    [{ kind: 'xmult', value: 2   },
                       { kind: 'expire', value: null, chance: 0.25 }], // 25% break on move
            stripes:  [{ kind: 'mult',  value: 4   }],
            checkers: [{ kind: 'xmult', value: 10  }],
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
            poly:  [{ kind: 'xmult', value: 1.5 }],
            shine: [{ kind: 'chips', value: 50  }],
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
        static stepsFromMoveType(moveType) {
            return (Effects.MOVE_TYPE[moveType] ?? []).map(e => makeScoringStep({
                event: EventType.ON_MOVE_PLAYED,
                kind: e.kind,
                value: e.value,
                source: { type: 'moveType', label: moveType },
            }));
        }

        // Deterministic preview of base piece + move-type scoring only.
        // Enhancement and edition intentionally excluded — preview shows only the
        // raw piece+move contribution. No jokers, no RNG, no held/alive phases.
        // Returns { chips, mult, gained } — gained = chips * mult.
        static preview(piece, moveTypes = []) {
            if (!piece) return { chips: 0, mult: 1, gained: 0 };
            const t = piece.type.toLowerCase();

            let chips = 0;
            let mult = 1;

            const apply = entries => {
                for (const e of entries ?? []) {
                    if (e.kind === 'chips') chips += e.value;
                    else if (e.kind === 'mult')  mult += e.value;
                    else if (e.kind === 'xmult') mult *= e.value;
                }
            };

            for (const mt of moveTypes) apply(Effects.MOVE_TYPE[mt]);
            apply(Effects.PIECE[t]);

            return { chips, mult, gained: chips * mult };
        }
    }
