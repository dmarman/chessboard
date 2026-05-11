    const OPPONENT_DEFS = {
        SMALL_BLIND: {
            id: 'SMALL_BLIND',
            name: 'Small Blind',
            description: 'A timid foe. Score enough and they fold.',
            scoreAtLeast: 100,
            powers: [
                // Powers structure:
                // {
                //   timing: 'onGameStart' | 'onMove' | 'passive',
                //   action(ctx, state) { return actionDescriptor | null }
                // }
            ]
        },
        BIG_BLIND: {
            id: 'BIG_BLIND',
            name: 'Big Blind',
            description: 'A hardened foe. They won\'t go down easy.',
            scoreAtLeast: 300,
            powers: []
        },
    };
