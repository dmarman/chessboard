const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function loadGameRuntime(rootDir) {
    const files = [
        'src/EventEmitter.js',
        'src/scoring/ScoringStep.js',
        'src/scoring/Effects.js',
        'src/core/BoardInspector.js',
        'src/jokers/joker-defs.js',
        'src/jokers/Joker.js',
        'src/jokers/JokerRegistry.js',
        'src/scoring/ScoreEngine.js',
        'src/scoring/ScoringPipeline.js',
        'src/opponents/opponent-defs.js',
        'src/opponents/Opponent.js',
        'src/opponents/CommandDispatcher.js',
        'src/opponents/tournament-config.js',
        'src/opponents/TournamentManager.js',
    ];

    const source = files
        .map(file => fs.readFileSync(path.join(rootDir, file), 'utf8'))
        .join('\n\n');

    const exportFooter = `
globalThis.__simExports = {
    EventEmitter,
    EventType,
    EVENT_ORDER,
    makeScoringStep,
    Effects,
    BoardInspector,
    JOKER_DEFS,
    Joker,
    JokerRegistry,
    ScoreEngine,
    ScoringPipeline,
    OPPONENT_CONFIG,
    BOSS_DEFS,
    Opponent,
    CommandDispatcher,
    getScoreTarget,
    MAX_TOURNAMENT,
    TournamentManager
};
`;

    const context = vm.createContext({
        console,
        crypto,
        Math,
        Set,
        Map,
        Object,
        Array,
    });

    vm.runInContext(`${source}\n\n${exportFooter}`, context, { filename: 'game-runtime.bundle.js' });
    return context.__simExports;
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return function next() {
        t += 0x6D2B79F5;
        let x = t;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

class Rng {
    constructor(seed = 123456789) {
        this._next = mulberry32(seed);
    }

    float() {
        return this._next();
    }

    int(min, max) {
        return Math.floor(this.float() * (max - min + 1)) + min;
    }

    chance(probability) {
        return this.float() < probability;
    }

    pick(items) {
        return items[this.int(0, items.length - 1)];
    }

    weightedPick(weightMap) {
        const entries = Object.entries(weightMap);
        const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = this.float() * total;
        for (const [key, weight] of entries) {
            roll -= weight;
            if (roll <= 0) return key;
        }
        return entries[entries.length - 1][0];
    }
}

class HeuristicScenarioGenerator {
    constructor(options = {}) {
        this._playerColor = options.playerColor ?? 'w';
        this._captureRate = options.captureRate ?? 0.28;
        this._checkRate = options.checkRate ?? 0.12;
        this._checkmateRate = options.checkmateRate ?? 0.01;
        this._castleRate = options.castleRate ?? 0.04;
        this._enPassantRate = options.enPassantRate ?? 0.01;
        this._promotionRate = options.promotionRate ?? 0.015;
        this._opponentCaptureRate = options.opponentCaptureRate ?? 0.22;
        this._opponentCheckRate = options.opponentCheckRate ?? 0.08;
        this._opponentPromotionRate = options.opponentPromotionRate ?? 0.005;
        this._pieceWeights = options.pieceWeights ?? { P: 42, N: 15, B: 14, R: 12, Q: 10, K: 7 };
        this._heldPieceRange = options.heldPieceRange ?? [5, 14];
    }

    makeGamePlan(turnCount, rng) {
        const turns = [];
        for (let i = 0; i < turnCount; i++) {
            turns.push(this._makeTurnScenario(rng, i));
        }
        return turns;
    }

    _makeTurnScenario(rng, turnIndex) {
        const movedType = rng.weightedPick(this._pieceWeights);
        const isCapture = rng.chance(this._captureRate);
        const isCheck = rng.chance(this._checkRate);
        const isCheckmate = isCheck && rng.chance(this._checkmateRate);
        const isCastle = movedType === 'K' && rng.chance(this._castleRate);
        const isEnPassant = movedType === 'P' && isCapture && rng.chance(this._enPassantRate);
        const promotion = movedType === 'P' && rng.chance(this._promotionRate)
            ? rng.pick(['q', 'r', 'b', 'n'])
            : null;

        const movingPiece = makePieceSnapshot({
            id: `turn-${turnIndex}-piece`,
            type: promotion ? promotion.toUpperCase() : movedType,
            color: this._playerColor,
        });
        const boardState = makeBoardState({
            movingPiece,
            heldPieces: makeHeldPieces(rng, this._heldPieceRange, this._playerColor),
        });
        const captured = isCapture
            ? makePieceSnapshot({ id: `turn-${turnIndex}-captured`, type: rng.pick(['P', 'N', 'B', 'R', 'Q']), color: oppositeColor(this._playerColor) })
            : null;

        const primaryMove = Object.freeze({
            piece: movingPiece,
            pieceId: movingPiece.id,
            captured,
            fromRow: 6,
            fromCol: 4,
            toRow: 4,
            toCol: 4,
            capturedRow: captured ? 4 : null,
            capturedCol: captured ? 4 : null,
            promotion,
            player: 'user',
        });

        const turn = Object.freeze({
            player: 'user',
            moves: Object.freeze([primaryMove]),
            primaryMove,
            captured,
            isCastle,
            isEnPassant,
            isCheck,
            isCheckmate,
            promotion,
        });

        const opponentMove = Object.freeze({
            captured: rng.chance(this._opponentCaptureRate) ? { id: `opp-cap-${turnIndex}` } : null,
            promotion: rng.chance(this._opponentPromotionRate) ? 'q' : null,
            isCheck: rng.chance(this._opponentCheckRate),
        });

        return Object.freeze({
            turn,
            boardState,
            opponentMove,
        });
    }
}

function makePieceSnapshot({ id, type, color, style = 'standard', modifiers = [], name = null }) {
    const normalizedType = color === 'w' ? type.toUpperCase() : type.toLowerCase();
    return Object.freeze({
        id,
        type: normalizedType,
        color,
        style,
        modifiers: Object.freeze([...modifiers]),
        name,
        label: name ?? normalizedType,
    });
}

function makeHeldPieces(rng, range, color) {
    const count = rng.int(range[0], range[1]);
    const held = [];
    for (let i = 0; i < count; i++) {
        const type = rng.weightedPick({ P: 45, N: 13, B: 13, R: 12, Q: 8, K: 1 });
        held.push(makePieceSnapshot({ id: `held-${i}-${crypto.randomUUID()}`, type, color }));
    }
    return held;
}

function makeBoardState({ movingPiece, heldPieces }) {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const pieces = [movingPiece, ...heldPieces];
    for (const [index, piece] of pieces.entries()) {
        const row = Math.floor(index / 8);
        const col = index % 8;
        board[row][col] = piece;
    }
    return board;
}

function oppositeColor(color) {
    return color === 'w' ? 'b' : 'w';
}

class BalanceSimulator {
    constructor(options = {}) {
        this._rootDir = options.rootDir ?? path.resolve(__dirname, '..');
        this._runtime = options.runtime ?? loadGameRuntime(this._rootDir);
        this._generator = options.generator ?? new HeuristicScenarioGenerator();
        this._defaultSeed = options.seed ?? 12345;
    }

    run(config = {}) {
        const seed = config.seed ?? this._defaultSeed;
        const games = config.games ?? 500;
        const turnsPerGame = config.turnsPerGame ?? 12;
        const jokerIds = [...(config.jokers ?? [])];
        const bossId = config.bossId ?? null;
        const rng = new Rng(seed);
        const gamePlans = Array.from({ length: games }, () => this._generator.makeGamePlan(turnsPerGame, rng));

        const baseResult = this._runPlans({
            gamePlans,
            jokerIds,
            bossId,
            targetScore: config.targetScore ?? null,
            tournament: config.tournament ?? 1,
            opponentSlot: config.opponentSlot ?? (bossId ? 'BOSS' : 'SMALL'),
        });

        if (!config.measureAblations) return baseResult;

        const ablations = jokerIds.map((jokerId, index) => {
            const reduced = jokerIds.filter((_, i) => i !== index);
            const result = this._runPlans({
                gamePlans,
                jokerIds: reduced,
                bossId,
                targetScore: config.targetScore ?? null,
                tournament: config.tournament ?? 1,
                opponentSlot: config.opponentSlot ?? (bossId ? 'BOSS' : 'SMALL'),
            });
            return {
                slot: index,
                jokerId,
                averageScoreDelta: round2(baseResult.summary.averageScore - result.summary.averageScore),
                winRateDelta: round4(baseResult.summary.winRate - result.summary.winRate),
            };
        });

        return { ...baseResult, ablations };
    }

    _runPlans({ gamePlans, jokerIds, bossId, targetScore, tournament, opponentSlot }) {
        const { ScoreEngine, JokerRegistry, Opponent, BOSS_DEFS, getScoreTarget, OPPONENT_CONFIG } = this._runtime;
        const perGame = [];
        const aggregateSources = new Map();
        const aggregateCommands = new Map();

        for (const plan of gamePlans) {
            const scoreEngine = new ScoreEngine();
            const registry = new JokerRegistry();
            for (const jokerId of jokerIds) registry.add(jokerId);
            const opponent = bossId ? new Opponent(BOSS_DEFS[bossId]) : null;
            const jokerSlots = registry.getActive().map((joker, index) => ({
                instanceId: joker.instanceId,
                defId: joker.defId,
                slotLabel: `${joker.defId}#${index + 1}`,
            }));
            const target = targetScore ?? deriveTarget({ bossId, tournament, opponentSlot, getScoreTarget, OPPONENT_CONFIG, BOSS_DEFS });
            const metrics = this._simulateSinglePlan({
                plan,
                scoreEngine,
                registry,
                opponent,
                jokerSlots,
            });

            perGame.push({
                score: metrics.finalScore,
                money: metrics.money,
                won: metrics.finalScore >= target,
                targetScore: target,
                turns: plan.length,
            });
            mergeMaps(aggregateSources, metrics.sources);
            mergeMaps(aggregateCommands, metrics.commands);
        }

        return {
            config: {
                games: gamePlans.length,
                turnsPerGame: gamePlans[0]?.length ?? 0,
                jokers: jokerIds,
                bossId,
                tournament,
                opponentSlot,
            },
            summary: summarizeGames(perGame),
            sourceStats: toSortedArray(aggregateSources),
            commandStats: toSortedArray(aggregateCommands),
            perGame,
        };
    }

    _simulateSinglePlan({ plan, scoreEngine, registry, opponent, jokerSlots }) {
        const {
            BoardInspector,
            EventType,
            makeScoringStep,
            ScoringPipeline,
            CommandDispatcher,
        } = this._runtime;

        const sources = new Map();
        const commands = new Map();
        let money = 0;

        scoreEngine.on('money', ({ amount, source }) => {
            money += amount;
            const label = resolveSourceLabel(source, jokerSlots);
            const existing = sources.get(label) ?? makeSourceStat(label);
            existing.money += amount;
            sources.set(label, existing);
        });

        const dispatcher = new CommandDispatcher()
            .register('ADD_SCORE', ({ amount }) => {
                trackCommand(commands, 'ADD_SCORE', amount ?? 0);
                scoreEngine.applyBonus(amount);
            })
            .register('SCORE_EFFECTS', ({ effects }) => {
                trackCommand(commands, 'SCORE_EFFECTS', effects?.length ?? 0);
                const pipelineSteps = (effects ?? [])
                    .filter(effect => effect.value != null)
                    .map(effect => makeScoringStep({
                        event: EventType.ON_MOVE_PLAYED,
                        kind: effect.destination === 'mult'
                            ? (effect.operation === 'mult' ? 'xmult' : 'mult')
                            : 'chips',
                        value: effect.value,
                        source: {
                            type: effect.source ?? 'opponent',
                            id: effect.sourceInstanceId ?? effect.sourceType ?? 'unknown',
                            label: effect.sourceType ?? effect.source ?? 'unknown',
                        },
                    }));
                return { pipelineSteps };
            });

        if (opponent) {
            const startCtx = makePowerContext({
                currentScore: scoreEngine.score,
                boardState: plan[0]?.boardState ?? makeBoardState({ movingPiece: makePieceSnapshot({ id: 'seed', type: 'P', color: 'w' }), heldPieces: [] }),
                playerColor: 'w',
                turn: null,
                lastMove: null,
                BoardInspector,
            });
            const startCommands = opponent.triggerPowers('onGameStart', startCtx);
            dispatcher.execute(startCommands, { scoreEngine });
        }

        for (const scenario of plan) {
            const gameCtx = makePowerContext({
                currentScore: scoreEngine.score,
                boardState: scenario.boardState,
                playerColor: 'w',
                turn: scenario.turn,
                lastMove: scenario.turn.primaryMove,
                BoardInspector,
            });
            const cpuCtx = makePowerContext({
                currentScore: scoreEngine.score,
                boardState: scenario.boardState,
                playerColor: 'w',
                turn: Object.freeze({
                    player: 'cpu',
                    moves: Object.freeze([]),
                    primaryMove: Object.freeze({
                        piece: null,
                        pieceId: null,
                        captured: scenario.opponentMove.captured,
                        promotion: scenario.opponentMove.promotion,
                        player: 'cpu',
                    }),
                    captured: scenario.opponentMove.captured,
                    isCastle: false,
                    isEnPassant: false,
                    isCheck: scenario.opponentMove.isCheck,
                    isCheckmate: false,
                    promotion: scenario.opponentMove.promotion,
                }),
                lastMove: {
                    captured: scenario.opponentMove.captured,
                    promotion: scenario.opponentMove.promotion,
                    player: 'cpu',
                },
                BoardInspector,
            });

            const bossMoveCommands = opponent ? opponent.triggerPowers('onMove', gameCtx) : [];
            const jokerSideEffects = registry.collectSideEffects(gameCtx);
            dispatcher.execute(jokerSideEffects, { scoreEngine });
            const opponentSteps = dispatcher.executeAndCollect(bossMoveCommands, { scoreEngine });

            const scoringSteps = ScoringPipeline.build(
                scenario.turn,
                gameCtx,
                registry,
                scenario.boardState,
                opponentSteps
            );

            for (const step of scoringSteps) {
                const label = resolveSourceLabel(step.source, jokerSlots);
                const existing = sources.get(label) ?? makeSourceStat(label);
                existing.triggers++;
                existing.kinds[step.kind] = (existing.kinds[step.kind] ?? 0) + 1;
                if (typeof step.value === 'number') {
                    existing.rawValue += step.value;
                    existing.valuesByKind[step.kind] = (existing.valuesByKind[step.kind] ?? 0) + step.value;
                }
                sources.set(label, existing);
            }

            scoreEngine.run(scoringSteps);

            const bossOpponentCommands = opponent ? opponent.triggerPowers('onOpponentMove', cpuCtx) : [];
            dispatcher.execute(bossOpponentCommands, { scoreEngine });
        }

        return {
            finalScore: scoreEngine.score,
            money,
            sources,
            commands,
        };
    }
}

function makePowerContext({ currentScore, boardState, playerColor, turn, lastMove, BoardInspector }) {
    return Object.freeze({
        fen: null,
        currentScore,
        lastMove: lastMove ? Object.freeze({ ...lastMove }) : null,
        turn: turn ? Object.freeze({ ...turn }) : null,
        playerColor,
        boardInspector: new BoardInspector(boardState),
    });
}

function deriveTarget({ bossId, tournament, opponentSlot, getScoreTarget, OPPONENT_CONFIG, BOSS_DEFS }) {
    if (bossId) return getScoreTarget(tournament, BOSS_DEFS[bossId].multiplier);
    const slotDef = opponentSlot === 'BIG' ? OPPONENT_CONFIG.BIG : OPPONENT_CONFIG.SMALL;
    return getScoreTarget(tournament, slotDef.multiplier);
}

function makeSourceStat(label) {
    return {
        label,
        triggers: 0,
        rawValue: 0,
        money: 0,
        kinds: {},
        valuesByKind: {},
    };
}

function resolveSourceLabel(source, jokerSlots) {
    const jokerSlot = jokerSlots.find(slot => slot.instanceId === source.id);
    if (jokerSlot) return jokerSlot.slotLabel;
    return source.label ?? `${source.type}:${source.id}`;
}

function trackCommand(map, type, value) {
    const entry = map.get(type) ?? { label: type, triggers: 0, rawValue: 0 };
    entry.triggers++;
    entry.rawValue += typeof value === 'number' ? value : 0;
    map.set(type, entry);
}

function mergeMaps(target, source) {
    for (const [key, value] of source.entries()) {
        const existing = target.get(key);
        if (!existing) {
            target.set(key, cloneStat(value));
            continue;
        }
        existing.triggers += value.triggers;
        existing.rawValue += value.rawValue;
        if (typeof value.money === 'number') existing.money = (existing.money ?? 0) + value.money;
        mergeObjectCounts(existing.kinds, value.kinds);
        mergeObjectCounts(existing.valuesByKind, value.valuesByKind);
    }
}

function mergeObjectCounts(target, source) {
    for (const [key, value] of Object.entries(source ?? {})) {
        target[key] = (target[key] ?? 0) + value;
    }
}

function cloneStat(value) {
    return {
        ...value,
        kinds: { ...(value.kinds ?? {}) },
        valuesByKind: { ...(value.valuesByKind ?? {}) },
    };
}

function toSortedArray(map) {
    return [...map.values()].sort((a, b) => (b.rawValue ?? 0) - (a.rawValue ?? 0));
}

function summarizeGames(perGame) {
    const scores = perGame.map(game => game.score).sort((a, b) => a - b);
    const money = perGame.map(game => game.money);
    const wins = perGame.filter(game => game.won).length;

    return {
        games: perGame.length,
        averageScore: round2(average(scores)),
        medianScore: round2(percentile(scores, 0.5)),
        p90Score: round2(percentile(scores, 0.9)),
        averageMoney: round2(average(money)),
        winRate: round4(wins / Math.max(perGame.length, 1)),
        averageTargetScore: round2(average(perGame.map(game => game.targetScore))),
    };
}

function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sortedValues, p) {
    if (!sortedValues.length) return 0;
    const idx = Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * p));
    return sortedValues[idx];
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

function round4(value) {
    return Math.round(value * 10000) / 10000;
}

module.exports = {
    BalanceSimulator,
    HeuristicScenarioGenerator,
    Rng,
    loadGameRuntime,
};
