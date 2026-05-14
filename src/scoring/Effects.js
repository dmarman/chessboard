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
            k:  [{ kind: 'chips', value: 9 }],
        }

        // Enhancement: fires when piece moves (ON_PIECE_SCORED).
        // metal/glass/red/checkers/rock share standard sprite; checkers/rock swap sprite family.
        // gold and metal are phase-specific — see ENHANCEMENT_ALIVE and ENHANCEMENT_HELD.
        // chance: optional float [0,1] — step only emits if Math.random() < chance.
        static ENHANCEMENT = {
            glass:    [{ kind: 'xmult',  value: 2 },
                       { kind: 'expire', value: null, chance: 0.25 }], // 25% break on move
            red:      [{ kind: 'mult',   value: 4  }], // Name: Cochineal
            blue:     [{ kind: 'chips',  value: 30 }],
            checkers: [{ kind: 'xmult',  value: 8  }],
            rock:     [{ kind: 'chips',  value: 50 }],
            lucky:    [{ kind: 'mult',   value: 20, chance: 1/5 },
                       { kind: 'money',  value: 20, chance: 1/15 }
            ],
        };

        // Movement restrictions per enhancement. Checked by ChessGame.moves() before exposing legal moves.
        // noCapture: piece may not capture (move to occupied square or en passant).
        static ENHANCEMENT_RESTRICTIONS = {
            rock: { noCapture: true },
            // Bloodthirsty — ON_PIECE_SCORED: xmult 4, but restriction: mustCapture (only fires if move was a capture). Dead weight on quiet moves, brutal on captures. Knight that hunts = assassin build.
        };

        // Enhancement effects that fire immediately when opponent captures this piece (ON_PIECE_CAPTURED).
        // Scored in isolation on the opponent's turn — use chips or money only (no xmult: no pipeline context).
        static ENHANCEMENT_ON_CAPTURED = {
            poisoned:    [{ kind: 'chips', value: 50 }],
            golddigger:  [{ kind: 'money', value: 15 }],
        };

        // Enhancement effects that fire only when piece does NOT move (ON_NON_MOVED_PIECE).
        static ENHANCEMENT_HELD = {
            metal: [{ kind: 'xmult', value: 1.5 }],
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
        static stepsFromAliveAtGameEnd({ id, type, enhancement, edition, name }, row = null, col = null) {
            const t = type.toLowerCase();
            const label = name ?? t;

            const tableToSteps = (table, key) =>
                (table[key] ?? []).map(e => makeScoringStep({
                    event: EventType.ON_GAME_END,
                    kind: e.kind,
                    value: e.value,
                    source: { type: 'piece', id, label, row, col },
                }));

            return [
                ...tableToSteps(Effects.PIECE_ALIVE, t),
                ...tableToSteps(Effects.ENHANCEMENT_ALIVE, enhancement?.toLowerCase()),
            ];
        }

        // Returns ScoringStep[] for a player piece captured by the opponent (ON_PIECE_CAPTURED).
        // Scored immediately on the opponent's turn — not injected into the next player pipeline.
        // capturedRow/capturedCol: where the piece stood, so the animator pulses that square.
        // Prepends a seed mult:1 step so chip effects score as chips×1 instead of chips×0.
        static stepsFromCapturedPiece({ id, type, enhancement, name }, capturedRow = null, capturedCol = null) {
            const effects = Effects.ENHANCEMENT_ON_CAPTURED[enhancement?.toLowerCase()] ?? [];
            if (!effects.length) return [];

            const label = name ?? type?.toLowerCase();
            const source = { type: 'piece', id, label, row: capturedRow, col: capturedCol };

            const hasChips = effects.some(e => e.kind === 'chips');
            const steps = [];

            // Seed mult so chips×mult is non-zero; money steps bypass this entirely
            if (hasChips) {
                steps.push(makeScoringStep({
                    event: EventType.ON_PIECE_CAPTURED,
                    kind: 'mult',
                    value: 1,
                    animate: false,
                    source,
                }));
            }

            for (const e of effects) {
                steps.push(makeScoringStep({
                    event: EventType.ON_PIECE_CAPTURED,
                    kind: e.kind,
                    value: e.value,
                    source,
                }));
            }

            return steps;
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
