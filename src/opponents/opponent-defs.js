    // Generic opponents — always appear each tournament, no powers, score target computed dynamically
    const OPPONENT_CONFIG = {
        SMALL: { id: 'SMALL', name: 'Small Opponent', description: 'A timid foe. Score enough and they fold.', multiplier: 1.0, reward: 3 },
        BIG:   { id: 'BIG',   name: 'Big Opponent',   description: 'A hardened foe. They won\'t go down easy.', multiplier: 1.5, reward: 4 },
    };

    // Boss pool — one picked per tournament, no repeats until pool exhausted
    // Powers structure:
    // {
    //   timing: 'onGameStart' | 'onMove' | 'onOpponentMove' | 'passive',
    //   action(ctx, state) { return actionDescriptor | null }
    // }
    const BOSS_DEFS = {
        THE_HOOK: {
            id: 'THE_HOOK',
            name: 'The Hook',
            description: 'A ruthless tactician. Every move you waste costs you.',
            multiplier: 2.0,
            reward: 5,
            powers: [],
        },
        THE_NERD: {
            id: 'THE_NERD',
            name: 'The Nerd',
            description: 'A nerd tactician.',
            multiplier: 2.0,
            reward: 5,
            powers: [],
        },
    };
