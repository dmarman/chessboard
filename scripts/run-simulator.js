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
        //jokers: ['ROYAL_BOUNTY','TOWER_PLUNDER','MINOR_TROPHY', 'PAWN_TROPHY','FOOT_SOLDIER_BANE', 'MINOR_HUNTER', 'CASTLE_CRASHER', 'REGICIDE','IRON_THRONE', 'HEDGE_KNIGHT', 'RANK_AND_FILE', 'LONGSTRIDER', 'OFFICER_CLASS'],
        //jokers: ['ROYAL_BOUNTY','TOWER_PLUNDER','MINOR_TROPHY', 'PAWN_TROPHY','FOOT_SOLDIER_BANE', 'MINOR_HUNTER', 'CASTLE_CRASHER', 'REGICIDE','IRON_THRONE', 'HEDGE_KNIGHT', 'RANK_AND_FILE', 'LONGSTRIDER', 'OFFICER_CLASS', 'WILD_JESTER', 'PREDATOR', 'COMET', 'BANKER', 'STABLEMASTER', 'CATHEDRAL', 'METRONOME', 'DUELIST', 'ECHO_KNIGHT', 'CORONATION'],
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
        effectiveScore: Math.round(stat.effectiveScore ?? 0),
        chips: stat.valuesByKind.chips ?? 0,
        mult: stat.valuesByKind.mult ?? 0,
        xmult: stat.valuesByKind.xmult ?? 0,
        money: stat.money,
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
