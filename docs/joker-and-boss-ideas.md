# Joker and Boss Ideas

These ideas are all compatible with the current engine as it exists today.

That means:

- joker ideas only use current scoring phases, move/turn context, `boardInspector`, `heldPiece`, and per-instance `state`
- boss ideas only use `onGameStart`, `onMove`, `onOpponentMove`, `ADD_SCORE`, and `SCORE_EFFECTS`

## Joker ideas

## 1. Straight passive jokers

These are the easiest to implement and easiest for players to read.

### 1. Comet

- Text: "If your move gives check, +8 mult"
- Event: `ON_MOVE_PLAYED`
- Why it is good: encourages tactical forcing play

### 2. Banker

- Text: "Every move, gain $1"
- Event: `INDEPENDENT`
- Step kind: `money`
- Why it is good: creates a clean economy joker

### 3. Siege Tower

- Text: "Rook move -> +90 chips"
- Event: `ON_PIECE_SCORED`
- Why it is good: simple piece-type reward

### 4. Court Poet

- Text: "Queen move -> +6 mult"
- Event: `ON_PIECE_SCORED`
- Why it is good: pushes flashy queen play

### 5. Ascetic

- Text: "If no capture this move, +60 chips"
- Event: `ON_MOVE_PLAYED`
- Why it is good: rewards patient positional turns

## 2. Capture / tactics jokers

### 6. Executioner

- Text: "Capture move -> x2 mult"
- Event: `ON_PIECE_SCORED`
- Why it is good: big tactical payoff

### 7. Scavenger

- Text: "Capture move -> gain $2"
- Event: `ON_MOVE_PLAYED` or `ON_PIECE_SCORED`
- Why it is good: capture-focused economy design

### 8. Snare

- Text: "En passant -> +150 chips"
- Event: `ON_MOVE_PLAYED`
- Why it is good: rare-event jackpot joker

### 9. Coronation

- Text: "Promotion move -> x3 mult"
- Event: `ON_MOVE_PLAYED`
- Why it is good: memorable high-roll payoff

### 10. Fortress Breaker

- Text: "If the move is checkmate, +300 chips"
- Event: `ON_MOVE_PLAYED`
- Why it is good: clean win-spike moment

## 3. Held-piece / bench jokers

These use `ON_NON_MOVED_PIECE` with `heldPiece`.

### 11. Stablemaster

- Text: "Each non-moved knight gives +15 chips"
- Event: `ON_NON_MOVED_PIECE`
- Why it is good: true bench-value joker

### 12. Choir

- Text: "Each non-moved bishop gives +3 mult"
- Event: `ON_NON_MOVED_PIECE`
- Why it is good: rewards long diagonals and preserving bishops

### 13. Garrison

- Text: "Each non-moved rook gives +25 chips"
- Event: `ON_NON_MOVED_PIECE`
- Why it is good: favors stable structures over immediate rook activity

### 14. Royal Court

- Text: "If your king did not move, +5 mult"
- Event: `ON_NON_MOVED_PIECE`
- Why it is good: flavorful and easy to explain

### 15. Twin Knights

- Text: "If a held knight exists and the moved piece is a knight, +70 chips"
- Event: `ON_NON_MOVED_PIECE`
- Why it is good: pair synergy with a clear build-around

## 4. Board-state jokers

These rely on `boardInspector`.

### 16. Cathedral

- Text: "Bishop pair alive -> +70 chips"
- Event: `INDEPENDENT`
- Why it is good: straightforward positional synergy

### 17. Last Castle

- Text: "If you still have 2 rooks, +7 mult"
- Event: `INDEPENDENT`
- Why it is good: rewards piece preservation

### 18. March

- Text: "If you have 6 or more pawns, +80 chips"
- Event: `INDEPENDENT`
- Why it is good: supports slow, solid play

### 19. Lone Monarch

- Text: "If you have 3 or fewer pieces left, x2 mult"
- Event: `INDEPENDENT`
- Why it is good: comeback / endgame identity

### 20. Full Court

- Text: "If you still have all minor pieces, +10 mult"
- Event: `INDEPENDENT`
- Why it is good: rewards careful development and exchanges avoidance

## 5. Stateful streak / counter jokers

These use the per-instance mutable `state` object.

### 21. Metronome

- Text: "Every third move, +12 mult"
- Event: `ON_MOVE_PLAYED`
- State: `state.count`
- Why it is good: reliable tempo card

### 22. Blood Ledger

- Text: "After 3 captures, gain $5"
- Event: `ON_MOVE_PLAYED`
- State: capture counter
- Why it is good: long-term tactical reward

### 23. Duelist

- Text: "Consecutive captures: +20, +40, +60 chips..."
- Event: `ON_MOVE_PLAYED`
- State: capture streak counter
- Why it is good: creates snowball lines

### 24. Monk

- Text: "For each consecutive non-capture move, +2 mult"
- Event: `ON_MOVE_PLAYED`
- State: quiet-move streak
- Why it is good: slow scaling alternative to capture snowballs

### 25. Alarm Bell

- Text: "First time each board you give check, gain $3"
- Event: `ON_MOVE_PLAYED`
- State: once-per-board flag
- Why it is good: tactical value without becoming repetitive

## 6. Retrigger jokers

These are high-variance and should be costed carefully.

### 26. Echo Knight

- Text: "Knight move -> retrigger scored piece"
- Event: `ON_PIECE_SCORED`
- Step kind: `retrigger`
- Why it is good: very readable combo enabler

### 27. Prism

- Text: "Promotion move -> retrigger scored piece"
- Event: `ON_PIECE_SCORED`
- Why it is good: explosive special-event card

### 28. Cannon Battery

- Text: "Rook move with no capture -> retrigger"
- Event: `ON_PIECE_SCORED`
- Why it is good: unusual line-builder

### 29. Predator Chain

- Text: "Capture move -> retrigger and +2 mult"
- Event: `ON_PIECE_SCORED`
- Why it is good: strong rare/legendary-feeling payoff

### 30. Final Chorus

- Text: "If this move is checkmate, retrigger"
- Event: `ON_PIECE_SCORED`
- Why it is good: dramatic finisher

Note:

- retriggers scale very fast because they replay both piece scoring and all jokers listening on `ON_PIECE_SCORED`
- the current engine caps total retriggers at `5`

## 7. Best joker archetypes for the current codebase

If you want a strong first content batch, these archetypes fit especially well:

- piece family rewards: rook, bishop, knight, queen identities
- chess-event jackpots: check, castle, promotion, en passant
- board-preservation bonuses: bishop pair, pawn count, rook pair
- held-piece economy: "unused pieces still matter"
- streak jokers: captures in a row, quiet moves in a row
- restrained retrigger cards as rare or expensive content

## Boss ideas

Bosses are best when they feel like a rule twist for the board, but are implemented as scoring pressure.

## 1. Simple tax bosses

### 1. The Judge

- Text: "Checks are taxed"
- Timing: `onMove`
- Effect: if `turn.isCheck`, apply `-5 mult`
- Why it is good: easy to understand and immediately felt

### 2. The Miser

- Text: "Captures are worth less"
- Timing: `onMove`
- Effect: if `lastMove.captured`, apply `-80 chips`
- Why it is good: directly attacks common tactical lines

### 3. The Warden

- Text: "Castling is punished"
- Timing: `onMove`
- Effect: if `turn.isCastle`, apply `-10 mult`
- Why it is good: changes one of chess's safest habits into a tradeoff

### 4. The Leech

- Text: "Every move loses 20 chips"
- Timing: `onMove`
- Effect: always inject `-20 chips`
- Why it is good: forces high-efficiency scoring

### 5. The Tollkeeper

- Text: "Promotion is taxed heavily"
- Timing: `onMove`
- Effect: if `lastMove.promotion`, apply `-200 chips`
- Why it is good: memorable boss moment

## 2. Pattern bosses

These use `state` to create pacing.

### 6. The Drummer

- Text: "Every third move suffers -8 mult"
- Timing: `onMove`
- State: move counter
- Why it is good: predictable cadence boss

### 7. The Hunter

- Text: "First capture each round suffers -100 chips"
- Timing: `onMove`
- State: one-shot flag
- Why it is good: encourages route planning

### 8. The Auditor

- Text: "Two quiet moves in a row are punished"
- Timing: `onMove`
- State: quiet-move streak
- Effect: once streak reaches 2, apply `-6 mult`
- Why it is good: pressures passive play

### 9. The Duelmaster

- Text: "Consecutive captures become more expensive"
- Timing: `onMove`
- State: capture streak
- Effect: `-20`, then `-40`, then `-60` chips
- Why it is good: creates tension in tactical sequences

### 10. The Bell

- Text: "Every second check is punished"
- Timing: `onMove`
- State: check counter
- Why it is good: creates a rhythm players can learn around

## 3. Start-of-game bosses

These mostly use `ADD_SCORE`.

### 11. The Head Start

- Text: "Begins with 150 score"
- Timing: `onGameStart`
- Command: `ADD_SCORE`
- Why it is good: very clear pressure increase

### 12. The Climber

- Text: "Begins with 75 score and taxes captures"
- Timings: `onGameStart` and `onMove`
- Why it is good: mixes passive pressure with tactical distortion

### 13. The Marathoner

- Text: "Begins ahead, but punishes slow buildup less"
- Timing: `onGameStart`
- Command: `ADD_SCORE`
- Why it is good: good for bosses meant to feel fair but demanding

## 4. Anti-archetype bosses

These are great once you know which joker families you want players to draft.

### 14. The Pacifist

- Text: "Quiet moves are favored, captures are punished"
- Timing: `onMove`
- Effect: capture -> `-100 chips`
- Why it is good: flips normal tactical instincts

### 15. The Fortress

- Text: "Non-capturing rook and bishop moves are punished"
- Timing: `onMove`
- Effect: piece-type conditional tax
- Why it is good: directly attacks positional engines

### 16. The Mirror

- Text: "Queen moves are taxed"
- Timing: `onMove`
- Effect: if moved piece is queen, `-7 mult`
- Why it is good: clean anti-queen boss

### 17. The Butcher

- Text: "If you do not capture, lose 50 chips"
- Timing: `onMove`
- Effect: non-capture tax
- Why it is good: forces aggression

### 18. The Sentinel

- Text: "Checks are ignored, but material play is safer"
- Timing: `onMove`
- Effect: if check, `-8 mult`; otherwise no tax
- Why it is good: attacks forcing-line decks

## 5. Bosses that react to the opponent move

These trigger on the engine's move, which is a nice way to make the boss feel alive.

### 19. The Counterpuncher

- Text: "When the opponent captures, gain 40 score"
- Timing: `onOpponentMove`
- Command: `ADD_SCORE`
- Why it is good: comeback-feeling boss pacing

### 20. The Opportunist

- Text: "When the opponent gives check, gain 60 score"
- Timing: `onOpponentMove`
- Command: `ADD_SCORE`
- Why it is good: sharp tactical punishment

### 21. The Echo

- Text: "When the opponent promotes, gain 200 score"
- Timing: `onOpponentMove`
- Command: `ADD_SCORE`
- Why it is good: dramatic late-game spike

### 22. The Collector

- Text: "Each opponent capture adds 25 score"
- Timing: `onOpponentMove`
- State: optional running total or escalation
- Why it is good: simple pressure escalator

## 6. Best boss archetypes for the current codebase

The engine favors bosses that:

- start ahead on score
- apply readable move taxes
- punish a specific chess event
- punish a specific piece family
- use counters to create rhythm

The engine does not yet favor bosses that:

- alter board state
- disable specific jokers directly
- change shop or economy rules globally
- apply always-on passive field modifiers outside move events

## 7. Suggested first content batch

If you want a strong first expansion set without engine changes, I would start with:

### Jokers

- Comet
- Banker
- Stablemaster
- Cathedral
- Metronome
- Duelist
- Echo Knight
- Coronation

### Bosses

- The Judge
- The Miser
- The Drummer
- The Head Start
- The Mirror
- The Counterpuncher

That mix gives you:

- economy
- tactical play
- quiet-play support
- held-piece support
- scaling
- anti-archetype bosses
- one or two explosive combo options
