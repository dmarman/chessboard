// Detects and buffers game-ending conditions (checkmate, score target) so the
// active move flow can finish animating before the outcome is processed.
class OutcomeResolver {
    constructor(tournamentManager, scoreEngine) {
        this._tournamentManager = tournamentManager;
        this._scoreEngine = scoreEngine;
        this._pending = null;
    }

    // Call from the 'turn' event listener after any move.
    // player: the side that just moved (PLAYER.USER or opponent).
    notifyTurn({ isCheckmate, player }, userPlayer) {
        if (!isCheckmate) return;
        if (player === userPlayer) {
            // User just moved and opponent is in checkmate → user wins
            this._trigger('checkmate');
        } else {
            // Opponent just moved and user is in checkmate → user loses
            this._trigger('loss');
        }
    }

    // Call from scoreEngine 'update' listener.
    notifyScore(total) {
        if (this._tournamentManager.checkBeat(total)) this._trigger('score');
    }

    // Call when a non-move mutation (e.g. glass-enhancement break) leaves the player in check.
    // The position is unrecoverable — user loses.
    notifyIllegal() {
        this._trigger('illegal');
    }

    // Returns pending outcome data and clears it, or null if no outcome pending.
    consume() {
        const outcome = this._pending;
        this._pending = null;
        return outcome;
    }

    _trigger(reason) {
        if (this._pending) return;
        this._pending = {
            reason,
            tournament: this._tournamentManager.currentTournament,
            opponent: this._tournamentManager.currentOpponent,
            score: this._scoreEngine.score,
            reward: this._tournamentManager.getCurrent().reward,
        };
    }
}
