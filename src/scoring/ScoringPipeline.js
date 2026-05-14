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
            steps.push(...ScoringPipeline._moveTypeSteps(turn));
            steps.push(...registry.collectSteps(EventType.ON_MOVE_PLAYED, ctx));

            // Phase 1b: opponent onMove reactions — after move is established, before piece scoring
            steps.push(...opponentSteps);

            // Phase 2+3: ON_PIECE_SCORED + ON_PIECE_SCORED_END (with retrigger expansion)
            const move = turn.primaryMove;
            if (move?.piece) {
                const baseSteps = ScoringPipeline._pieceAndJokerSteps(move, ctx, registry);
                steps.push(...ScoringPipeline._expandRetriggers(baseSteps, move, ctx, registry));
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

        // Derives active move types from the turn DTO and returns their ScoringSteps.
        // Multiple types can stack (e.g. capture + check, enpassant + check).
        // Falls back to 'quiet' when no special type applies.
        static _moveTypeSteps(turn) {
            const types = [];
            if (turn.captured || turn.isEnPassant) types.push('capture');
            if (turn.isCheck || turn.isCheckmate) types.push('check');
            if (turn.isKingsideCastle)  types.push('castle king');
            if (turn.isQueensideCastle) types.push('castle queen');
            if (turn.promotion)         types.push('promotion');
            if (turn.isEnPassant)       types.push('enpassant');
            if (!types.length)          types.push('quiet');
            return types.flatMap(t => Effects.stepsFromMoveType(t));
        }

        // Returns ON_PIECE_SCORED steps: piece chips + joker effects for that phase.
        static _pieceAndJokerSteps(move, ctx, registry) {
            const pieceSteps = Effects.stepsFromPiece(move.piece);
            const jokerSteps = registry.collectSteps(EventType.ON_PIECE_SCORED, ctx);
            return [...pieceSteps, ...jokerSteps];
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
                // Only retrigger effects from jokers that appeared BEFORE this retrigger
                result.push(...ScoringPipeline._pieceAndJokerStepsOnlyBefore(move, ctx, registry, jokersSoFar));
            }

            return result;
        }

        // Generates ON_NON_MOVED_PIECE steps for each friendly piece not involved in this turn.
        // Fires piece base (PIECE_HELD) + enhancement + edition effects, then joker reactions.
        static _nonMovedPieceSteps(primaryMove, boardState, ctx, registry) {
            const steps = [];
            const movingPieceId = primaryMove?.piece?.id;
            const playerColor = ctx.playerColor;

            for (let r = 0; r < boardState.length; r++) {
                const row = boardState[r];
                for (let c = 0; c < row.length; c++) {
                    const piece = row[c];
                    if (!piece) continue;
                    if (piece.color !== playerColor) continue;
                    if (piece.id === movingPieceId) continue;
                    steps.push(...Effects.stepsFromNonMovedPiece(piece, { row: r, col: c }));
                    // Extend ctx locally — heldPiece is only meaningful in this phase
                    const heldCtx = Object.freeze({
                        ...ctx,
                        heldPiece: piece,
                    });
                    steps.push(...registry.collectSteps(EventType.ON_NON_MOVED_PIECE, heldCtx));
                }
            }
            return steps;
        }

        /**
         * Builds a ScoringStep[] for end-of-game scoring (separate from the per-move pipeline).
         * Fires ON_GAME_END for every alive friendly piece (base money + enhancement + edition),
         * then joker reactions to ON_GAME_END.
         *
         * @param {Piece[][]|null} boardState — 8×8 board of alive pieces
         * @param {object} ctx               — frozen PowerContext
         * @param {JokerRegistry} registry
         * @returns {ScoringStep[]}
         */
        static buildGameEnd(boardState, ctx, registry) {
            const steps = [];
            const playerColor = ctx.playerColor;

            for (const row of boardState) {
                for (const piece of row) {
                    if (!piece) continue;
                    if (piece.color !== playerColor) continue;
                    steps.push(...Effects.stepsFromAliveAtGameEnd(piece));
                }
            }

            steps.push(...registry.collectSteps(EventType.ON_GAME_END, ctx));
            return steps;
        }

        // Generates INDEPENDENT-phase ScoringSteps from each joker's edition (holo/poly/shine/neon).
        // These are first-class scoring sources separate from the joker's trigger() logic.
        static _jokerEditionSteps(registry) {
            const steps = [];
            for (const joker of registry.getActive()) {
                const edition = joker.edition?.toLowerCase();
                if (!edition || edition === 'base') continue;
                const effects = Effects.EDITION[edition];
                if (!effects?.length) continue;
                const e = effects[0];
                steps.push(makeScoringStep({
                    event: EventType.INDEPENDENT,
                    kind: e.kind,
                    value: e.value,
                    source: { type: 'edition', id: joker.instanceId, label: `${joker.name} (${edition})` },
                }));
            }
            return steps;
        }
    }
