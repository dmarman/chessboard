const path = require('path');
const { BalanceSimulator } = require('../sim/balance-simulator');

function main() {
    const simulator = new BalanceSimulator({
        rootDir: path.resolve(__dirname, '..'),
        seed: 1337,
    });

    const result = simulator.run({
        games: 250,
        turnsPerGame: 12,
        //jokers: ['WILD_JESTER', 'PREDATOR', 'COMET', 'BANKER', 'STABLEMASTER', 'CATHEDRAL', 'METRONOME', 'DUELIST', 'ECHO_KNIGHT', 'CORONATION'],
        //jokers: ['WILD_JESTER', 'METRONOME', 'BANKER'],
        //bossId: 'THE_HOOK',
        tournament: 1,
        opponentSlot: 'BOSS',
        measureAblations: true,
    });

    console.log('Summary');
    console.table([result.summary]);

    console.log('\nTop Sources');
    console.table(result.sourceStats.slice(0, 100).map(stat => ({
        label: stat.label,
        triggers: stat.triggers,
        rawValue: stat.rawValue,
        money: stat.money,
        chips: stat.valuesByKind.chips ?? 0,
        mult: stat.valuesByKind.mult ?? 0,
        xmult: stat.valuesByKind.xmult ?? 0,
        retrigger: stat.kinds.retrigger ?? 0,
    })));

    console.log('\nCommand Stats');
    console.table(result.commandStats);

    if (result.ablations?.length) {
        console.log('\nAblations');
        console.table(result.ablations.sort((a, b) => b.averageScoreDelta - a.averageScoreDelta));
    }
}

main();
