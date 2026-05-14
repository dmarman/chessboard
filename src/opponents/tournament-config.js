    // Base score table — index matches tournament number (1–8). Index 0 is a safety value.
    const TOURNAMENT_BASES = [100, 3222, 8, 20, 5000, 11000, 20000, 35000, 50000];

    const MAX_TOURNAMENT = 8;

    function getScoreTarget(tournamentNumber, opponentMultiplier) {
        return Math.floor(TOURNAMENT_BASES[tournamentNumber] * opponentMultiplier);
    }
