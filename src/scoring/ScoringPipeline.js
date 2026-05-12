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
        static build(turn, ctx, registry, boardState = null, opponentSteps = []) {
            const steps = [];

            // Phase 1: ON_MOVE_PLAYED — move type effects fire first (hand-type scoring), then joker reactions
            const moveTypeSteps = ScoringPipeline._moveTypeSteps(turn);
             console.log('[ScoringPipeline] Phase 1a - Move Type:', moveTypeSteps.map(s => `${s.kind}(${s.value})`));
            steps.push(...moveTypeSteps);
            const phase1JokerSteps = registry.collectSteps(EventType.ON_MOVE_PLAYED, ctx);
             console.log('[ScoringPipeline] Phase 1 - ON_MOVE_PLAYED jokers:', phase1JokerSteps.map(s => `${s.source?.label}:${s.kind}(${s.value})`));
            steps.push(...phase1JokerSteps);

            // Phase 1b: opponent onMove reactions — after move is established, before piece scoring
             console.log('[ScoringPipeline] Phase 1b - Opponent reactions:', opponentSteps.length);
            steps.push(...opponentSteps);

            // Phase 2+3: ON_PIECE_SCORED + ON_PIECE_SCORED_END (with retrigger expansion)
            const move = turn.primaryMove;
            if (move?.piece) {
                const baseSteps = ScoringPipeline._pieceAndJokerSteps(move, ctx, registry);
                console.log('[ScoringPipeline] Phase 2 - Piece & Jokers (base):', baseSteps.map(s => `${s.source?.label}:${s.kind}(${s.value})`));
                const expanded = ScoringPipeline._expandRetriggers(baseSteps, move, ctx, registry);
                 console.log('[ScoringPipeline] Phase 2 - After retrigger expansion:', expanded.length, 'total steps');
                steps.push(...expanded);
                const phase3Steps = registry.collectSteps(EventType.ON_PIECE_SCORED_END, ctx);
                 console.log('[ScoringPipeline] Phase 3 - ON_PIECE_SCORED_END:', phase3Steps.map(s => `${s.source?.label}:${s.kind}(${s.value})`));
                steps.push(...phase3Steps);
            }

            // Phase 4: ON_NON_MOVED_PIECE (held-card equivalent)
            if (boardState) {
                const heldSteps = ScoringPipeline._nonMovedPieceSteps(move, boardState, ctx, registry);
                 console.log('[ScoringPipeline] Phase 4 - ON_NON_MOVED_PIECE (held pieces):', heldSteps.length);
                steps.push(...heldSteps);
            }

            // Phase 5: INDEPENDENT — passive joker effects + joker edition modifiers
            const independentSteps = registry.collectSteps(EventType.INDEPENDENT, ctx);
            // console.log('[ScoringPipeline] Phase 5a - INDEPENDENT jokers:', independentSteps.map(s => `${s.source?.label}:${s.kind}(${s.value})`));
            steps.push(...independentSteps);
            const editionSteps = ScoringPipeline._jokerEditionSteps(registry);
            // console.log('[ScoringPipeline] Phase 5b - Edition modifiers:', editionSteps.map(s => `${s.source?.label}:${s.kind}(${s.value})`));
            steps.push(...editionSteps);

            // Phase 6: ON_MOVE_SCORED_END — decay, expiry, counters
            const finalSteps = registry.collectSteps(EventType.ON_MOVE_SCORED_END, ctx);
            // console.log('[ScoringPipeline] Phase 6 - ON_MOVE_SCORED_END:', finalSteps.map(s => `${s.source?.label}:${s.kind}(${s.value})`));
            steps.push(...finalSteps);

            console.log('[ScoringPipeline] TOTAL STEPS:', steps.length, steps);
            return steps;
        }

        // Derives active move types from the turn DTO and returns their ScoringSteps.
        // Multiple types can stack (e.g. capture + check, enpassant + check).
        static _moveTypeSteps(turn) {
            const types = [];
            if (turn.captured || turn.isEnPassant) types.push('capture');
            if (turn.isCheck || turn.isCheckmate) types.push('check');
            if (turn.isKingsideCastle)  types.push('castle king');
            if (turn.isQueensideCastle) types.push('castle queen');
            if (turn.promotion)         types.push('promotion');
            if (turn.isEnPassant)       types.push('enpassant');
            return types.flatMap(t => Effects.stepsFromMoveType(t));
        }

        // Returns ON_PIECE_SCORED steps: piece chips + joker effects for that phase.
        static _pieceAndJokerSteps(move, ctx, registry) {
            const pieceSteps = Effects.stepsFromPiece(move.piece);
            const jokerSteps = registry.collectSteps(EventType.ON_PIECE_SCORED, ctx);
            return [...pieceSteps, ...jokerSteps];
        }

        // Returns ON_PIECE_SCORED steps excluding specified jokers (used in retrigger expansion).
        static _pieceAndJokerStepsExcluding(move, ctx, registry, excludeJokerIds) {
            const pieceSteps = Effects.stepsFromPiece(move.piece);
            const allJokerSteps = registry.collectSteps(EventType.ON_PIECE_SCORED, ctx);
            const filteredJokerSteps = allJokerSteps.filter(
                step => !excludeJokerIds.has(step.source?.id)
            );
            return [...pieceSteps, ...filteredJokerSteps];
        }

        // Returns ON_PIECE_SCORED steps, including only jokers that appeared before retrigger.
        static _pieceAndJokerStepsOnlyBefore(move, ctx, registry, jokerIdsBefore) {
            const pieceSteps = Effects.stepsFromPiece(move.piece);
            const allJokerSteps = registry.collectSteps(EventType.ON_PIECE_SCORED, ctx);
            const filteredJokerSteps = allJokerSteps.filter(
                step => jokerIdsBefore.has(step.source?.id)
            );
            return [...pieceSteps, ...filteredJokerSteps];
        }

        // Walks step array; on retrigger steps, inserts a fresh copy of the piece's ON_PIECE_SCORED
        // steps at that position. Capped at MAX_RETRIGGERS total expansions. Tracks retriggered jokers
        // to prevent them from triggering again in the same movement.
        // Retrigger only re-executes effects from jokers that appeared BEFORE it in the original array.
        static _expandRetriggers(steps, move, ctx, registry) {
            const result = [];
            let retriggerCount = 0;
            const retriggeredJokerIds = new Set();
            const jokersSoFar = new Set();

            for (const step of steps) {
                if (step.kind !== 'retrigger') {
                    result.push(step);
                    // Track jokers that have already appeared
                    if (step.source?.type === 'joker' && step.source?.id) {
                        jokersSoFar.add(step.source.id);
                    }
                    continue;
                }
                // Always push the retrigger marker so AnimationCoordinator can show a pulse
                result.push(step);
                if (retriggerCount >= MAX_RETRIGGERS) continue;
                retriggerCount++;
                // Track the joker that caused this retrigger to prevent self-retriggering
                if (step.source?.id) {
                    retriggeredJokerIds.add(step.source.id);
                }
                // Only retrigger effects from jokers that appeared BEFORE this retrigger
                result.push(...ScoringPipeline._pieceAndJokerStepsOnlyBefore(move, ctx, registry, jokersSoFar));
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
                    if (piece.color !== playerColor) continue;
                    if (piece.id === movingPieceId) continue;
                    // Extend ctx locally — heldPiece is only meaningful in this phase
                    const heldCtx = {
                        ...ctx,
                        heldPiece: piece,
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
