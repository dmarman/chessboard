This project is a game on top of classic chess with specific scoring system inspired by balatro gameplay.
So it is balatro but with chess.

About ChessGame Chessboard and chess.js weird responsabilities is because it's not a normal game of chess. It will have an additional scoring system on top of chess. It plays with pieces that have effects and that effect could be in one pawn but not all of them. So i need to keep the board game state in two places, one for the classic rules of chess and the other for my own specific scoring system.

chess.js is legality-only; all piece reads for scoring, identity, or display must go through Chessboard/Piece domain objects — never chess.board(), chess.get(), or raw chess.js piece shapes.

Domain boundaries: each model owns its data. Cross the boundary only through an explicit adapter — never by reading the other model's raw internals.

It's not multiplayer. Only one player plays. And to remove the cognitive burden of chess, the user will have to 
choose the next movement based on a limited set of engine moves. Not implemented yet.

I know everything is one file now, but i will fix that soon. 
The important thing is everything is in its own class and we keep concerns decoupled and clean code.

Do not delete comments in the code