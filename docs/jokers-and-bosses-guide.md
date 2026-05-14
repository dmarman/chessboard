# Jokers and Bosses Guide

This is a quick guide for adding new jokers and new bosses to the current game.

The most important distinction is:

- A **joker** is a scoring blueprint in `src/jokers/joker-defs.js`.
- A **boss** is an opponent definition in `src/opponents/opponent-defs.js`.

## 1. What jokers can do today

Jokers are static definitions with this shape:

```js
{
  id: 'MY_JOKER',
  name: 'My Joker',
  description: 'What it does',
  type: 'Q',
  rarity: 'common',
  price: 3,
  events: ['INDEPENDENT'],
  trigger(ctx, state) {
    return [makeScoringStep(...)];
  }
}
```

The engine supports these joker trigger phases, in order:

- **`ON_MOVE_PLAYED`** — fires once when the move is established. Move type bonuses land here (capture, check, castle, promotion, en passant). Jokers reacting to "what kind of move was this?" go here. No piece yet — just move context.

- **`ON_PIECE_SCORED`** — fires for the moving piece. Piece's base chips come from here, then joker reactions to that piece. This phase can be retriggered (replayed up to 5×). Jokers caring about piece type (`lastMove.piece`) belong here.

- **`ON_PIECE_SCORED_END`** — fires once after all retriggers for the moving piece are done. Good for "after piece scores, do X" without being re-played by retriggers.

- **`ON_NON_MOVED_PIECE`** — fires once per friendly piece that did not move (bench / held-card equivalent). `ctx.heldPiece` is the piece being evaluated. Jokers like "each idle knight gives +10 chips" live here.

- **`INDEPENDENT`** — passive always-on effects. No move or piece context needed. Joker edition modifiers (holo/poly/metal) also apply here. Jokers that give flat bonuses regardless of what happened.

- **`ON_MOVE_SCORED_END`** — fires last, after all scoring is done. Use for counters, cooldowns, decay, once-per-round resets in `state`. Nothing here should add score — it is bookkeeping.

Balatro analogy:

| Phase | Balatro equivalent |
|---|---|
| `ON_MOVE_PLAYED` | Hand type scored |
| `ON_PIECE_SCORED` | Each card scored |
| `ON_PIECE_SCORED_END` | After card scoring done |
| `ON_NON_MOVED_PIECE` | Held cards |
| `INDEPENDENT` | Always-on jokers |
| `ON_MOVE_SCORED_END` | End of hand cleanup |

### Joker context available in `trigger(ctx, state)`

`ctx` currently contains:

- `fen`
- `currentScore`
- `lastMove`
- `turn`
- `playerColor`
- `boardInspector`

For `ON_NON_MOVED_PIECE`, the pipeline also adds:

- `heldPiece`

`state` is a mutable per-joker instance object. Use it for counters, cooldowns, once-per-round flags, and similar persistent state.

### Scoring effects jokers can return

Jokers return one or more `ScoringStep`s. Supported `kind` values are:

- `chips`: add to base chips
- `mult`: add to multiplier
- `xmult`: multiply multiplier
- `retrigger`: replay the moving piece's `ON_PIECE_SCORED` sequence
- `money`: give gold directly
- `expire`: annotation only right now
- `message`: annotation only right now

Important notes:

- `retrigger` is capped globally at `5` extra replays per scored move.
- `money` bypasses `chips * mult`.
- `expire` and `message` exist in the score pipeline, but no removal behavior is wired to `expire` yet.

### Board/state checks jokers can use today

Through `boardInspector`, the built-in helpers are:

- `hasBishopPair(color)`
- `getPieceCount(type, color)`

You can also inspect:

- `lastMove.captured`
- `lastMove.promotion`
- `turn.isCastle`
- `turn.isEnPassant`
- `turn.isCheck`
- `turn.isCheckmate`
- `turn.moves`
- `turn.primaryMove`

### Joker editions / cosmetics already supported

Every live joker instance can also have:

- `type`: `P`, `R`, `N`, `B`, `Q`, `K`
- `style`: defaults to `standard`
- `modifiers`: a set of edition-like modifiers
- `color`

The code currently recognizes these modifiers:

- `holo`
- `poly`
- `metal`
- `shine`
- `neon`
- `glass`
- `gold`
- `red`

For jokers specifically, only modifier effects present in `Effects.MODIFIER` matter, and joker edition scoring is applied automatically during `INDEPENDENT`.

### Joker side effects

Jokers may also define:

```js
sideEffects(ctx, state) {
  return [{ type: '...' }];
}
```

However, in the current engine only these command types are actually registered:

- `ADD_SCORE`
- `SCORE_EFFECTS`

So the comments mention things like `MUTATE_PIECE`, but that is not implemented yet. If you want a joker that changes pieces, board state, or inventory, we first need to add a new command handler in `GameController`.

## 2. Good joker ideas that are already possible

With the current engine, jokers can already support:

- Always-on passive bonuses
- Capture bonuses
- Check or checkmate bonuses
- Castle / en passant / promotion bonuses
- Piece-type synergies using `lastMove.piece` or `heldPiece`
- Board-composition synergies using `boardInspector`
- End-of-turn counters stored in `state`
- Retrigger-based combos
- Direct gold generation with `money`

Examples:

- "If the moved piece is a rook, +80 chips"
- "If you gave check this turn, x2 mult"
- "Each non-moved knight gives +10 chips"
- "Every third capture this joker gives +6 mult"
- "Promotions give $2"

## 3. How to add a new joker

1. Open `src/jokers/joker-defs.js`.
2. Add a new entry inside `JOKER_DEFS`.
3. Give it a unique `id`.
4. Set `name`, `description`, `type`, `rarity`, and `price`.
5. Choose one or more `events`.
6. Implement `trigger(ctx, state)`.
7. Return either `null`, one `makeScoringStep(...)`, or an array of them.

Minimal example:

```js
COMET: {
  id: 'COMET',
  name: 'Comet',
  description: 'Check move -> +8 mult',
  type: 'Q',
  rarity: 'uncommon',
  price: 5,
  events: ['ON_MOVE_PLAYED'],
  trigger({ turn }) {
    if (!turn?.isCheck) return null;
    return makeScoringStep({
      event: EventType.ON_MOVE_PLAYED,
      kind: 'mult',
      value: 8,
      source: { type: 'joker', id: 'COMET', label: 'Comet' },
    });
  }
}
```

Notes:

- You do not need to register the joker anywhere else. The shop pool is built from `Object.keys(JOKER_DEFS)`.
- If you use a rarity not covered by `ShopManager`, it can exist, but it will never roll naturally unless the shop weights are updated too.

## 4. What bosses can do today

Bosses are definitions with this shape:

```js
{
  id: 'THE_BOSS',
  name: 'The Boss',
  description: 'What it does',
  multiplier: 2.0,
  reward: 5,
  powers: [
    {
      timing: 'onMove',
      action(ctx, state) {
        return { type: '...' };
      }
    }
  ]
}
```

The boss gets wrapped in an `Opponent` instance with its own mutable `state`.

### Boss power timings

Documented timings are:

- `onGameStart`
- `onMove`
- `onOpponentMove`
- `passive`

Actually wired timings today are:

- `onGameStart`
- `onMove`
- `onOpponentMove`

`passive` is listed in comments but is not triggered anywhere yet.

### Boss command types supported today

Boss powers return commands, not scoring steps directly. The command dispatcher currently supports:

- `ADD_SCORE`
- `SCORE_EFFECTS`

`ADD_SCORE`:

- immediately grants score outside the move pipeline
- useful for start-of-game bonuses or penalties

`SCORE_EFFECTS`:

- injects score effects into the player's move pipeline
- currently maps effect descriptors into `chips`, `mult`, or `xmult` steps
- is the main way to make a boss punish or boost a move

Effect descriptors used by `SCORE_EFFECTS` should look like:

```js
{
  source: 'opponent',
  sourceType: 'THE_BOSS',
  destination: 'add' | 'mult',
  operation: 'add' | 'mult',
  value: 50
}
```

In practice that gives you:

- add chips
- add mult
- multiply mult

Bosses currently cannot directly:

- remove jokers
- mutate pieces
- alter the shop
- alter tournament flow
- apply persistent passive field rules

Those would require new command types and handlers.

## 5. Good boss ideas that are already possible

With the current implementation, bosses are best at:

- Start-of-round score bonuses or penalties
- Punishing captures
- Punishing checks
- Punishing promotions
- Rewarding or punishing specific move types
- Stateful patterns like "every third move" or "first capture each round"

Examples:

- "At game start, gain 100 score"
- "Whenever the player castles, they get -40 chips on that move"
- "Every capture this round gives the player only half mult"
- "Every third player move, apply x0.5 mult"

The boss system is currently much narrower than the joker system. It is mainly a scoring-reactor framework.

## 6. How to add a new boss

1. Open `src/opponents/opponent-defs.js`.
2. Add a new entry inside `BOSS_DEFS`.
3. Set `id`, `name`, `description`, `multiplier`, and `reward`.
4. Add one or more `powers`.
5. For each power, choose `timing` and implement `action(ctx, state)`.
6. Return either `null` or a command object.

Minimal example:

```js
THE_JUDGE: {
  id: 'THE_JUDGE',
  name: 'The Judge',
  description: 'Checks are taxed.',
  multiplier: 2.2,
  reward: 6,
  powers: [
    {
      timing: 'onMove',
      action({ turn }) {
        if (!turn?.isCheck) return null;
        return {
          type: 'SCORE_EFFECTS',
          effects: [{
            source: 'opponent',
            sourceType: 'THE_JUDGE',
            destination: 'mult',
            operation: 'add',
            value: -5,
          }],
        };
      }
    }
  ]
}
```

Notes:

- You do not need to register bosses anywhere else. `TournamentManager` pulls from `Object.keys(BOSS_DEFS)`.
- Bosses are selected without repeats until the pool is exhausted, then the pool refills.

## 7. Design advice

When designing new content, these are the safest patterns for the current engine:

- Prefer score-based effects over board mutation.
- Use `state` for scaling, streaks, cooldowns, and once-per-round behavior.
- Keep boss effects easy to read from the move log: capture, check, castle, promotion, piece type, piece count.
- Use `ON_NON_MOVED_PIECE` for "bench" or "held card" style jokers.
- Be careful with retriggers because they replay the full piece scoring bundle and can scale very fast.

If we want richer designs later, the best engine upgrades would be:

- more `BoardInspector` queries
- real `expire` handling for temporary jokers
- new command types like `MUTATE_PIECE`, `REMOVE_JOKER`, `ADD_JOKER`, or `MODIFY_SHOP`
- a real boss `passive` timing

## 8. Files to look at

- `src/jokers/joker-defs.js`
- `src/jokers/Joker.js`
- `src/scoring/ScoringStep.js`
- `src/scoring/ScoringPipeline.js`
- `src/opponents/opponent-defs.js`
- `src/opponents/Opponent.js`
- `src/opponents/TournamentManager.js`
- `src/opponents/PowerContext.js`
- `src/core/BoardInspector.js`
- `src/shop/ShopManager.js`
