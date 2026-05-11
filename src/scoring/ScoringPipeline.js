    // Builds an ordered ScoringStep[] for a complete player turn.
    // Handles the 6-phase Balatro event pipeline, retrigger expansion (capped),
    // and joker edition effects in the INDEPENDENT phase.
    //
    // Usage:
    //   const steps = ScoringPipeline.build(turn, ctx, jokerRegistry, boardState);
    //   const snapshots = scoreEngine.run(steps);

    const MAX_RETRIGGERS = 5;

    class ScoringPipeline {
        /**
         * @param {object} turn           — turnDTO from ChessGame 'turn' event
         * @param {object} ctx            — frozen PowerContext
         * @param {JokerRegistry} registry
         * @param {Piece[][]|null} boardState — 8×8 board for ON_NON_MOVED_PIECE phase; null skips phase
         * @returns {ScoringStep[]}
         */
        static build(turn, ctx, registry, boardState = null) {
            const steps = [];

            // Phase 1: ON_MOVE_PLAYED
            steps.push(...registry.collectSteps(EventType.ON_MOVE_PLAYED, ctx));

            // Phase 2+3: ON_PIECE_SCORED + ON_PIECE_SCORED_END (with retrigger expansion)
            const move = turn.primaryMove;
            if (move?.piece) {
                const baseSteps = ScoringPipeline._pieceAndJokerSteps(move, ctx, registry);
                const expanded = ScoringPipeline._expandRetriggers(baseSteps, move, ctx, registry);
                steps.push(...expanded);
                steps.push(...registry.collectSteps(EventType.ON_PIECE_SCORED_END, ctx));
            }

            // Phase 4: ON_NON_MOVED_PIECE (held-card equivalent)
            if (boardState) {
                steps.push(...ScoringPipeline._nonMovedPieceSteps(move, boardState, ctx, registry));
            }

            // Phase 5: INDEPENDENT — passive joker effects + joker edition modifiers
            steps.push(...registry.collectSteps(EventType.INDEPENDENT, ctx));
            steps.push(...ScoringPipeline._jokerEditionSteps(registry));

            // Phase 6: ON_MOVE_SCORED_END — decay, expiry, counters
            steps.push(...registry.collectSteps(EventType.ON_MOVE_SCORED_END, ctx));

            return steps;
        }

        // Returns ON_PIECE_SCORED steps: piece chips + joker effects for that phase.
        static _pieceAndJokerSteps(move, ctx, registry) {
            const pieceSteps = Effects.stepsFromPiece(move.piece);
            const jokerSteps = registry.collectSteps(EventType.ON_PIECE_SCORED, ctx);
            return [...pieceSteps, ...jokerSteps];
        }

        // Walks step array; on retrigger steps, inserts a fresh copy of the piece's ON_PIECE_SCORED
        // steps at that position. Capped at MAX_RETRIGGERS total expansions.
        static _expandRetriggers(steps, move, ctx, registry) {
            const result = [];
            let retriggerCount = 0;

            for (const step of steps) {
                if (step.kind !== 'retrigger') {
                    result.push(step);
                    continue;
                }
                // Always push the retrigger marker so AnimationCoordinator can show a pulse
                result.push(step);
                if (retriggerCount >= MAX_RETRIGGERS) continue;
                retriggerCount++;
                // Default: retrigger the current moving piece. Future: support retriggerPieceId for a different target.
                result.push(...ScoringPipeline._pieceAndJokerSteps(move, ctx, registry));
            }

            return result;
        }

        // Generates ON_NON_MOVED_PIECE steps for each friendly piece not involved in this turn.
        static _nonMovedPieceSteps(primaryMove, boardState, ctx, registry) {
            const steps = [];
            const movingPieceId = primaryMove?.piece?.id;
            const playerColor = ctx.playerColor;

            for (const row of boardState) {
                for (const piece of row) {
                    if (!piece) continue;
                    if (piece.color() !== playerColor) continue;
                    if (piece.id === movingPieceId) continue;
                    // Extend ctx locally — heldPiece is only meaningful in this phase
                    const heldCtx = {
                        ...ctx,
                        heldPiece: Object.freeze({
                            id: piece.id,
                            role: piece.type,
                            color: piece.color(),
                            modifiers: Object.freeze([...piece.modifiers]),
                            label: piece.name ?? piece.type,
                        }),
                    };
                    steps.push(...registry.collectSteps(EventType.ON_NON_MOVED_PIECE, heldCtx));
                }
            }
            return steps;
        }

        // Generates INDEPENDENT-phase ScoringSteps from each joker's edition modifiers (holo/poly/metal).
        // These are first-class scoring sources separate from the joker's trigger() logic.
        static _jokerEditionSteps(registry) {
            const steps = [];
            for (const joker of registry.getActive()) {
                for (const mod of joker.modifiers) {
                    const effects = Effects.MODIFIER[mod.toLowerCase()];
                    if (!effects?.length) continue;
                    const e = effects[0];
                    steps.push(makeScoringStep({
                        event: EventType.INDEPENDENT,
                        kind: e.destination === 'mult'
                            ? (e.operation === 'mult' ? 'xmult' : 'mult')
                            : 'chips',
                        value: e.value,
                        source: { type: 'edition', id: joker.instanceId, label: `${joker.name} (${mod})` },
                    }));
                }
            }
            return steps;
        }
    }
