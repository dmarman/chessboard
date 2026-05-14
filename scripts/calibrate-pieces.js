// Per-piece calibration: scores each (type × enhancement × edition) combo in isolation
// so values like rock-chips, holo-mult, checkers-xmult can be tuned at the lowest level.
//
// Three tables:
//   1. MOVED   — Effects.stepsFromPiece            (piece base + ENHANCEMENT + EDITION)
//   2. HELD    — Effects.stepsFromNonMovedPiece    (PIECE_HELD + ENHANCEMENT_HELD: metal)
//   3. ALIVE   — Effects.stepsFromAliveAtGameEnd   (PIECE_ALIVE + ENHANCEMENT_ALIVE: gold)

const path = require('path');
const { loadGameRuntime } = require('../sim/balance-simulator');

const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
const ENHANCEMENTS = ['none', 'metal', 'glass', 'stripes', 'checkers', 'rock', 'gold'];
const EDITIONS = ['base', 'holo', 'poly', 'shine', 'neon'];

function scoreSteps(ScoreEngine, steps) {
    const engine = new ScoreEngine();
    let money = 0;
    engine.on('money', ({ amount }) => { money += amount; });
    // Coerce expire ('value: null') so engine still emits a final snapshot when only expire fires.
    const numericSteps = steps.filter(s => typeof s.value === 'number' || s.kind === 'money');
    engine.run(numericSteps);
    return {
        chips: numericSteps.filter(s => s.kind === 'chips').reduce((sum, s) => sum + s.value, 0),
        mult:  numericSteps.filter(s => s.kind === 'mult').reduce((sum, s) => sum + s.value, 0),
        xmult: numericSteps.filter(s => s.kind === 'xmult').reduce((sum, p) => sum * p.value, 1),
        score: engine.score,
        money,
    };
}

function rowFor(label, ScoreEngine, steps) {
    const { chips, mult, xmult, score, money } = scoreSteps(ScoreEngine, steps);
    return {
        variant: label,
        chips,
        addMult: mult,
        xmult: round2(xmult),
        score: round2(score),
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
                    const steps = Effects.stepsFromPiece({ id: 'calib', type, enhancement, edition, name: null });
                    moved.push({ type, enhancement, edition, ...rowFor(`${type}+${enhancement}+${edition}`, ScoreEngine, steps) });
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
                held.push({ type, enhancement, ...rowFor(`${type}+${enhancement}`, ScoreEngine, [...typeSteps, ...steps]) });
            }
        }

        const alive = [];
        for (const type of TYPES) {
            for (const enhancement of ENHANCEMENTS) {
                const steps = Effects.stepsFromAliveAtGameEnd({ id: 'calib', type, enhancement, edition: 'base', name: null });
                if (!steps.length) continue;
                // Prepend base type chips so score reflects type value even in alive phase
                const typeSteps = Effects.stepsFromPiece({ id: 'calib', type, enhancement: 'none', edition: 'base', name: null });
                alive.push({ type, enhancement, ...rowFor(`${type}+${enhancement}`, ScoreEngine, [...typeSteps, ...steps]) });
            }
        }

        console.log('\n=== MOVED (Effects.stepsFromPiece) ===');
        console.log('Filter rows in code with --type=p / --enh=metal / etc., or sort by score.');
        const movedFiltered = moved.filter(r => r.enhancement !== 'metal' && r.enhancement !== 'gold');
        const onlyInteresting = process.argv.includes('--all')
            ? movedFiltered
            : movedFiltered.filter(r => r.enhancement !== 'none' || r.edition !== 'base');
        const sortedMoved = onlyInteresting.sort((a, b) => b.score - a.score);
        console.table(sortedMoved);

        console.log('\n--- MOVED score chart ---');
        asciiBarChart(sortedMoved);

        console.log('\n=== HELD (Effects.stepsFromNonMovedPiece) ===');
        console.table(held.sort((a, b) => b.score - a.score));

        console.log('\n=== ALIVE at game end (Effects.stepsFromAliveAtGameEnd) ===');
        console.table(alive.sort((a, b) => b.money - a.money || b.score - a.score));

        console.log('\nBaseline rows (enhancement=none, edition=base) — pure type chips:');
        console.table(moved.filter(r => r.enhancement === 'none' && r.edition === 'base'));
    } finally {
        Math.random = origRandom;
    }
}

main();
