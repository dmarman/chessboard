const path = require('path');
const { BalanceSimulator, HeuristicScenarioGenerator } = require('../sim/balance-simulator');

const ROOT = path.resolve(__dirname, '..');

// Booster-pack standard weights — handy defaults to riff on.
const STANDARD_ENHANCEMENT_WEIGHTS = { none: 60, glass: 8, metal: 8, gold: 8, rock: 6, red: 8, checkers: 6 };
const STANDARD_EDITION_WEIGHTS     = { base: 82, shine: 4, holo: 3, poly: 1, neon: 1 };

// Each scenario = { name, generatorOptions, runConfig }.
// Same seed across scenarios → same chess move plan → diff isolates modifier/joker impact.
const SHARED = {
    games: 250,
    turnsPerGame: 5,
    seed: 1337,
    tournament: 1,
    opponentSlot: 'BOSS',
    measureAblations: false,
};

const SCENARIOS = [
    // {
    //     name: 'baseline (no modifiers)',
    //     generatorOptions: {},
    //     runConfig: {},
    // },
    // {
    //     name: 'standard pack weights',
    //     generatorOptions: {
    //         enhancementWeights: STANDARD_ENHANCEMENT_WEIGHTS,
    //         editionWeights:     STANDARD_EDITION_WEIGHTS,
    //     },
    //     runConfig: {},
    // },
    // {
    //     name: 'heavy gold (money test)',
    //     generatorOptions: {
    //         enhancementWeights: { none: 60, gold: 40 },
    //         editionWeights:     { base: 1 },
    //     },
    //     runConfig: {},
    // },
    // {
    //     name: 'standard + holo joker',
    //     generatorOptions: {
    //         enhancementWeights: STANDARD_ENHANCEMENT_WEIGHTS,
    //         editionWeights:     STANDARD_EDITION_WEIGHTS,
    //     },
    //     runConfig: { jokers: [{ id: 'WILD_JESTER', edition: 'holo' }] },
    // },
    {
        // Coverage sweep — load every joker def and verify each one triggers at least once.
        // Use longer games so streak / rare-condition jokers (FULL_ARMY, PAWN_WALL) get a shot.
        name: 'all-jokers coverage sweep',
        generatorOptions: {
            // enhancementWeights: STANDARD_ENHANCEMENT_WEIGHTS,
            // editionWeights:     STANDARD_EDITION_WEIGHTS,
        },
        runConfig: (simulator) => ({
            games: 200,
            turnsPerGame: 10,
            measureAblations: true,
            jokers: Object.keys(simulator.jokerDefs).map(id => ({ id, edition: 'base' })),
        //     jokers: [
        //         { id: 'REPETITION' },
        //   //      { id: 'PAWN_MARCH' },
        //     ],
        }),
        coverageCheck: true,
    },
];

function runScenario(scenario) {
    const simulator = new BalanceSimulator({
        rootDir: ROOT,
        seed: SHARED.seed,
        generator: new HeuristicScenarioGenerator({ playerColor: 'w', ...scenario.generatorOptions }),
    });
    const runConfig = typeof scenario.runConfig === 'function'
        ? scenario.runConfig(simulator)
        : scenario.runConfig;
    return { simulator, result: simulator.run({ ...SHARED, ...runConfig }) };
}

function printScenario(name, result) {
    console.log(`\n=== ${name} ===`);
    console.table([result.summary]);
    console.log('Top sources (sorted by triggers — low triggers = condition too rare)');
    const sortedSources = [...result.sourceStats].sort((a, b) => (b.triggers ?? 0) - (a.triggers ?? 0));
    console.table(sortedSources.slice(0, 50).map(stat => ({
        label: stat.label,
        triggers: stat.triggers,
        effectiveScore: Math.round(stat.effectiveScore ?? 0),
        chips: stat.valuesByKind.chips ?? 0,
        mult: stat.valuesByKind.mult ?? 0,
        xmult: stat.valuesByKind.xmult ?? 0,
        money: stat.money,
    })));
    if (result.comboStats?.length) {
        console.log('Piece + move type combos');
        const sortedCombos = [...result.comboStats].sort(
            (a, b) => (b.effectiveScore ?? 0) - (a.effectiveScore ?? 0)
        );
        const maxEffective = sortedCombos.reduce((m, s) => Math.max(m, s.effectiveScore ?? 0), 0);
        const BAR_WIDTH = 24;
        console.table(sortedCombos.map(stat => {
            const effective = Math.round(stat.effectiveScore ?? 0);
            const avg = Math.round((stat.effectiveScore ?? 0) / Math.max(stat.triggers, 1));
            const barLen = maxEffective > 0 ? Math.round((effective / maxEffective) * BAR_WIDTH) : 0;
            return {
                combo: stat.label,
                triggers: stat.triggers,
                effectiveScore: effective,
                avgScore: avg,
                bar: '─'.repeat(barLen).padEnd(BAR_WIDTH),
            };
        }));
    }
    if (result.ablations?.length) {
        console.log('Ablations');
        console.table(result.ablations.sort((a, b) => b.averageScoreDelta - a.averageScoreDelta));
    }
}

function reportCoverage(scenario, simulator, result) {
    const expectedIds = Object.keys(simulator.jokerDefs);
    // Source labels for jokers look like "WILD_JESTER#1". Strip the slot suffix.
    const seen = new Set(
        result.sourceStats
            .map(stat => stat.label.split('#')[0])
            .filter(id => expectedIds.includes(id))
    );
    const missing = expectedIds.filter(id => !seen.has(id));
    console.log(`\n[coverage] ${scenario.name}: ${seen.size}/${expectedIds.length} jokers triggered`);
    if (missing.length) {
        console.log(`[coverage] MISSING (never triggered): ${missing.join(', ')}`);
    } else {
        console.log(`[coverage] All jokers fired at least once.`);
    }
}

// Solo sweep — run sim once per joker (single joker active) and rank by EV/game.
// Use this to spot tier outliers before tuning ratios.
function runSoloSweep({ games = 300, turnsPerGame = 10, baselineGames = null } = {}) {
    const probe = new BalanceSimulator({
        rootDir: ROOT,
        seed: SHARED.seed,
        generator: new HeuristicScenarioGenerator({ playerColor: 'w' }),
    });
    const defs = probe.jokerDefs;
    const ids = Object.keys(defs);

    // Baseline = zero jokers, same seed/plan. Subtract so EV reflects joker-only contribution.
    const baseline = probe.run({
        ...SHARED,
        games: baselineGames ?? games,
        turnsPerGame,
        jokers: [],
        measureAblations: false,
    });

    const rows = ids.map(id => {
        const simulator = new BalanceSimulator({
            rootDir: ROOT,
            seed: SHARED.seed,
            generator: new HeuristicScenarioGenerator({ playerColor: 'w' }),
        });
        const result = simulator.run({
            ...SHARED,
            games,
            turnsPerGame,
            jokers: [{ id, edition: 'base' }],
            measureAblations: false,
        });

        // Triggers + effective sourced from the joker itself in sourceStats.
        const own = result.sourceStats.find(s => s.label.startsWith(`${id}#`));
        const triggers = own?.triggers ?? 0;
        const effective = own?.effectiveScore ?? 0;
        const money    = own?.money ?? 0;

        return {
            id,
            rarity: defs[id].rarity ?? '?',
            evPerGame:        round2((result.summary.averageScore - baseline.summary.averageScore) / 1),
            jokerEffective:   round2(effective / games),
            triggersPerGame:  round2(triggers / games),
            perTrigger:       round2(triggers ? effective / triggers : 0),
            moneyPerGame:     round2(money / games),
            winRate:          result.summary.winRate,
        };
    });

    rows.sort((a, b) => b.evPerGame - a.evPerGame);

    const maxEv = rows.reduce((m, r) => Math.max(m, r.evPerGame), 0);
    const BAR_WIDTH = 24;
    const displayRows = rows.map(r => ({
        ...r,
        bar: maxEv > 0
            ? '─'.repeat(Math.round((r.evPerGame / maxEv) * BAR_WIDTH)).padEnd(BAR_WIDTH)
            : ''.padEnd(BAR_WIDTH),
    }));

    console.log(`\n### Solo sweep (baseline avgScore = ${baseline.summary.averageScore}) ###`);
    console.table(displayRows);

    // Rarity band summary — derive ratios from current data, not target.
    const byRarity = new Map();
    for (const row of rows) {
        const arr = byRarity.get(row.rarity) ?? [];
        arr.push(row.evPerGame);
        byRarity.set(row.rarity, arr);
    }
    const bands = [...byRarity.entries()].map(([rarity, evs]) => ({
        rarity,
        count: evs.length,
        median: round2(median(evs)),
        min: round2(Math.min(...evs)),
        max: round2(Math.max(...evs)),
    })).sort((a, b) => a.median - b.median);

    console.log('\nRarity bands (median EV/game)');
    console.table(bands);

    for (let i = 1; i < bands.length; i++) {
        const prev = bands[i - 1];
        const cur  = bands[i];
        const ratio = prev.median > 0 ? round2(cur.median / prev.median) : '∞';
        console.log(`  ratio ${prev.rarity} → ${cur.rarity}: ×${ratio}`);
    }

    return rows;
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

function main() {
    if (process.argv.includes('--solo')) {
        runSoloSweep();
        return;
    }
    const results = SCENARIOS.map(s => {
        const { simulator, result } = runScenario(s);
        return { name: s.name, scenario: s, simulator, result };
    });

    console.log('\n### Comparison ###');
    console.table(results.map(({ name, result }) => ({
        scenario: name,
        avgScore:    result.summary.averageScore,
        medianScore: result.summary.medianScore,
        p90Score:    result.summary.p90Score,
        avgMoney:    result.summary.averageMoney,
        winRate:     result.summary.winRate,
        avgTarget:   result.summary.averageTargetScore,
    })));

    for (const { name, result } of results) printScenario(name, result);

    for (const { scenario, simulator, result } of results) {
        if (scenario.coverageCheck) reportCoverage(scenario, simulator, result);
    }
}

main();
