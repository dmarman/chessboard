# Simulator Foundation

There is now a headless balance simulator in the repo.

## Files

- `sim/balance-simulator.js`
- `scripts/run-simulator.js`

## Run it

```bash
npm run simulate
```

This runs a sample batch of simulated games and prints:

- score summary
- top scoring sources
- command stats
- joker ablation estimates

## What it does

The simulator loads the current browser-side game logic into a Node VM and executes the real:

- joker definitions
- boss definitions
- scoring pipeline
- score engine
- command dispatcher behavior for `ADD_SCORE` and `SCORE_EFFECTS`

It does not use the UI.

## What it simulates

Right now the simulator uses an abstract heuristic scenario generator, not legal full chess play.

Each simulated turn rolls things like:

- moved piece type
- capture or not
- check or not
- promotion or not
- castle or not
- en passant or not
- held-piece board composition
- opponent move events for boss reactions

This makes it useful for early balancing of:

- trigger frequency
- average joker value
- relative boss pressure
- combo scaling
- marginal contribution via ablations

## Why this is a good first step

This is not a final balance oracle, but it is already useful because it:

- runs the real scoring code
- is reproducible with a seed
- can simulate hundreds or thousands of games quickly
- gives you comparative data before human playtests

## Important limitation

The current simulator is a balance harness, not a chess-strength simulator.

It does not yet model:

- legal move generation
- real openings / middlegames / endgames
- actual engine-vs-player position quality
- shop flow over a whole run
- drafting decisions

So the numbers are best used for:

- comparing content against other content
- spotting obvious overpowered or underpowered designs
- estimating expected value and variance

They should not be treated as final truth for real gameplay feel.

## Good next upgrades

The best next improvements would be:

1. add multiple scenario profiles
   - opening-heavy
   - tactical
   - endgame
   - promotion-heavy
2. add run-level simulation
   - tournament progression
   - shop rolls
   - buying decisions
3. add legal move data
   - use real generated move sequences instead of abstract events
4. add telemetry export
   - CSV or JSON output for spreadsheets
5. add boss and joker matchup sweeps
   - test all jokers vs all bosses in batches

## Suggested usage pattern

When adding a new joker or boss:

1. run the simulator with a baseline set
2. add the new content
3. rerun with the same seed and same scenario counts
4. compare:
   - average score
   - win rate
   - trigger counts
   - ablation delta
5. adjust numbers
6. repeat
