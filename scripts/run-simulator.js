const path = require('path');
const { BalanceSimulator, HeuristicScenarioGenerator } = require('../sim/balance-simulator');

const ROOT = path.resolve(__dirname, '..');

// Booster-pack standard weights — handy defaults to riff on.
const STANDARD_ENHANCEMENT_WEIGHTS = { none: 56, glass: 8, metal: 8, gold: 8, rock: 6, stripes: 8, checkers: 6 };
const STANDARD_EDITION_WEIGHTS     = { base: 82, shine: 4, holo: 3, poly: 1, neon: 1 };

// Each scenario = { name, generatorOptions, runConfig }.
// Same seed across scenarios → same chess move plan → diff isolates modifier/joker impact.
const SHARED = {
    games: 250,
    turnsPerGame: 12,
    seed: 1337,
    tournament: 1,
    opponentSlot: 'BOSS',
    measureAblations: false,
};

const SCENARIOS = [
    {
        name: 'baseline (no modifiers)',
        generatorOptions: {},
        runConfig: {},
    },
    {
        name: 'standard pack weights',
        generatorOptions: {
            enhancementWeights: STANDARD_ENHANCEMENT_WEIGHTS,
            editionWeights:     STANDARD_EDITION_WEIGHTS,
        },
        runConfig: {},
    },
    {
        name: 'heavy gold (money test)',
        generatorOptions: {
            enhancementWeights: { none: 60, gold: 40 },
            editionWeights:     { base: 1 },
        },
        runConfig: {},
    },
    {
        name: 'standard + holo joker',
        generatorOptions: {
            enhancementWeights: STANDARD_ENHANCEMENT_WEIGHTS,
            editionWeights:     STANDARD_EDITION_WEIGHTS,
        },
        runConfig: { jokers: [{ id: 'WILD_JESTER', edition: 'holo' }] },
    },
];

function runScenario(scenario) {
    const simulator = new BalanceSimulator({
        rootDir: ROOT,
        seed: SHARED.seed,
        generator: new HeuristicScenarioGenerator({ playerColor: 'w', ...scenario.generatorOptions }),
    });
    return simulator.run({ ...SHARED, ...scenario.runConfig });
}

function printScenario(name, result) {
    console.log(`\n=== ${name} ===`);
    console.table([result.summary]);
    console.log('Top sources');
    console.table(result.sourceStats.slice(0, 12).map(stat => ({
        label: stat.label,
        triggers: stat.triggers,
        effectiveScore: Math.round(stat.effectiveScore ?? 0),
        chips: stat.valuesByKind.chips ?? 0,
        mult: stat.valuesByKind.mult ?? 0,
        xmult: stat.valuesByKind.xmult ?? 0,
        money: stat.money,
    })));
    if (result.ablations?.length) {
        console.log('Ablations');
        console.table(result.ablations.sort((a, b) => b.averageScoreDelta - a.averageScoreDelta));
    }
}

function main() {
    const results = SCENARIOS.map(s => ({ name: s.name, result: runScenario(s) }));

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
}

main();
