This project is a game on top of classic chess with specific scoring system inspired by balatro gameplay.
So it is balatro but with chess.

About ChessGame Chessboard and chess.js weird responsabilities is because it's not a normal game of chess. It will have an additional scoring system on top of chess. It plays with pieces that have effects and that effect could be in one pawn but not all of them. So i need to keep the board game state in two places, one for the classic rules of chess and the other for my own specific scoring system.

chess.js is legality-only; all piece reads for scoring, identity, or display must go through Chessboard/Piece domain objects — never chess.board(), chess.get(), or raw chess.js piece shapes.

Domain boundaries: each model owns its data. Cross the boundary only through an explicit adapter — never by reading the other model's raw internals.

It's not multiplayer. Only one player plays. And to remove the cognitive burden of chess, the user will have to 
choose the next movement based on a limited set of engine moves. Not implemented yet.

The important thing is everything is in its own class and we keep concerns decoupled and clean code.

Do not delete comments in the code

Error handling strategy — one per layer:
- Domain core (Chessboard, ChessGame, Piece, JokerRegistry): throw on invariant violation or programmer error (missing piece, unknown id, illegal move bubbled from chess.js). No null/false returns to signal bugs.
- Orchestration (CommandDispatcher, pipelines, GameController): throw on unknown handler / unregistered type. No warn + continue — silent skips hide wiring bugs.
- Expected-empty results (getPieceAt on empty square, remove of missing id): return null / no-op. Reserve null returns for genuinely valid "nothing here" outcomes, never for failures.
- Boundary parsers (setPiecesFromFen and similar best-effort loaders): may warn + continue when partial state is acceptable. Document the leniency at the call site.

Balatro to our chess terms translation:
Hand -> Move: we score per chess move.
Card -> Piece: we have pieces, not cards.
Held card -> not moved pieces. So the pieces that were not involved in the chess move.
Blind -> Opponent/Pairing: we play against someone in chess.
Antes -> Tournaments?: to be defined. Our run contains tournaments.
Run -> chess carreer?: to be defined.

here you have the Balatro basecode if you have questions: /Users/domingo/Downloads/balatro-gba-main

Ignore html buttons and behavior, their are only for testing.