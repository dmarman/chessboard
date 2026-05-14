// Per-piece calibration: scores each (type × enhancement × edition) combo in isolation
// so values like rock-chips, holo-mult, checkers-xmult can be tuned at the lowest level.
//
// Three tables:
//   1. MOVED   — Effects.stepsFromPiece (piece base + ENHANCEMENT + EDITION) × move type
//   2. HELD    — Effects.stepsFromNonMovedPiece    (PIECE_HELD + ENHANCEMENT_HELD: metal)
//   3. ALIVE   — Effects.stepsFromAliveAtGameEnd   (PIECE_ALIVE + ENHANCEMENT_ALIVE: gold)

const path = require('path');
const { loadGameRuntime } = require('../sim/balance-simulator');

const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
const ENHANCEMENTS = ['none', 'metal', 'glass', 'red', 'blue', 'checkers', 'rock', 'gold', 'lucky'];
const EDITIONS = ['base', 'holo', 'poly', 'shine', 'neon'];
const MOVE_TYPES = ['quiet', 'capture', 'check'];

function scoreSteps(ScoreEngine, Effects, moveType, pieceSteps) {
    const engine = new ScoreEngine();
    let money = 0;
    engine.on('money', ({ amount }) => { money += amount; });
    const moveSteps = Effects.stepsFromMoveType(moveType);
    const allSteps = [...moveSteps, ...pieceSteps].filter(s => typeof s.value === 'number' || s.kind === 'money');
    engine.run(allSteps);
    return {
        chips: pieceSteps.filter(s => s.kind === 'chips').reduce((sum, s) => sum + s.value, 0),
        mult:  pieceSteps.filter(s => s.kind === 'mult').reduce((sum, s) => sum + s.value, 0),
        xmult: pieceSteps.filter(s => s.kind === 'xmult').reduce((sum, p) => sum * p.value, 1),
        score: engine.score,
        money,
    };
}

function round2(v) { return Math.round(v * 100) / 100; }

function asciiBarChart(rows, { valueKey = 'score', labelKey = 'variant', width = 50 } = {}) {
    const max = Math.max(...rows.map(r => r[valueKey]));
    for (const row of rows) {
        const label = String(row[labelKey]).padEnd(22);
        const barLen = max > 0 ? Math.round((row[valueKey] / max) * width) : 0;
        const bar = '█'.repeat(barLen);
        const val = String(round2(row[valueKey])).padStart(10);
        console.log(`${label} ${bar.padEnd(width)} ${val}`);
    }
}

function main() {
    // Force probabilistic steps (e.g. glass 25% break) to fire deterministically — calibration
    // wants the on-trigger value, not the expected value.
    const origRandom = Math.random;
    Math.random = () => 0;

    try {
        const rt = loadGameRuntime(path.resolve(__dirname, '..'));
        const { Effects, ScoreEngine } = rt;

        const moved = [];
        for (const type of TYPES) {
            for (const enhancement of ENHANCEMENTS) {
                for (const edition of EDITIONS) {
                    const pieceSteps = Effects.stepsFromPiece({ id: 'calib', type, enhancement, edition, name: null });
                    const scores = {};
                    for (const mt of MOVE_TYPES) {
                        scores[mt] = scoreSteps(ScoreEngine, Effects, mt, pieceSteps).score;
                    }
                    const { chips, mult, xmult } = scoreSteps(ScoreEngine, Effects, 'quiet', pieceSteps);
                    moved.push({ type, enhancement, edition, variant: `${type}+${enhancement}+${edition}`, chips, addMult: mult, xmult: round2(xmult), ...Object.fromEntries(MOVE_TYPES.map(mt => [mt, round2(scores[mt])])) });
                }
            }
        }

        const held = [];
        for (const type of TYPES) {
            for (const enhancement of ENHANCEMENTS) {
                const steps = Effects.stepsFromNonMovedPiece({ id: 'calib', type, enhancement, edition: 'base', name: null });
                if (!steps.length) continue;
                // Prepend base type chips so score = type_chips * held_xmult (e.g. rook+metal: 5*5=25)
                const typeSteps = Effects.stepsFromPiece({ id: 'calib', type, enhancement: 'none', edition: 'base', name: null });
                const { chips, mult, xmult, score, money } = scoreSteps(ScoreEngine, Effects, 'quiet', [...typeSteps, ...steps]);
                held.push({ type, enhancement, variant: `${type}+${enhancement}`, chips, addMult: mult, xmult: round2(xmult), score: round2(score), money });
            }
        }

        const alive = [];
        for (const type of TYPES) {
            for (const enhancement of ENHANCEMENTS) {
                const steps = Effects.stepsFromAliveAtGameEnd({ id: 'calib', type, enhancement, edition: 'base', name: null });
                if (!steps.length) continue;
                // Prepend base type chips so score reflects type value even in alive phase
                const typeSteps = Effects.stepsFromPiece({ id: 'calib', type, enhancement: 'none', edition: 'base', name: null });
                const { chips, mult, xmult, score, money } = scoreSteps(ScoreEngine, Effects, 'quiet', [...typeSteps, ...steps]);
                alive.push({ type, enhancement, variant: `${type}+${enhancement}`, chips, addMult: mult, xmult: round2(xmult), score: round2(score), money });
            }
        }

        console.log('\n=== MOVED (piece base + enhancement + edition) by move type ===');
        console.log('Columns: quiet / capture / check scores. Filter metal+gold (phase-specific).');
        const movedFiltered = moved.filter(r => r.enhancement !== 'metal' && r.enhancement !== 'gold');
        const onlyInteresting = process.argv.includes('--all')
            ? movedFiltered
            : movedFiltered.filter(r => r.enhancement !== 'none' || r.edition !== 'base');
        const sortedMoved = onlyInteresting.sort((a, b) => b.check - a.check);
        console.table(sortedMoved.map(({ variant, chips, addMult, xmult, quiet, capture, check }) =>
            ({ variant, chips, addMult, xmult, quiet, capture, check })));

        console.log('\n--- MOVED score chart (all move types) ---');
        const expandedMoved = sortedMoved
            .flatMap(r => MOVE_TYPES.map(mt => ({ variant: `${r.variant}+${mt}`, score: r[mt] })))
            .sort((a, b) => b.score - a.score);
        asciiBarChart(expandedMoved);

        console.log('\n=== HELD (Effects.stepsFromNonMovedPiece) ===');
        console.table(held.sort((a, b) => b.score - a.score));

        console.log('\n=== ALIVE at game end (Effects.stepsFromAliveAtGameEnd) ===');
        console.table(alive.sort((a, b) => b.money - a.money || b.score - a.score));

        console.log('\nBaseline rows (enhancement=none, edition=base) — pure type chips:');
        console.table(moved.filter(r => r.enhancement === 'none' && r.edition === 'base')
            .map(({ variant, chips, addMult, xmult, quiet, capture, check }) =>
                ({ variant, chips, addMult, xmult, quiet, capture, check })));
    } finally {
        Math.random = origRandom;
    }
}

main();
