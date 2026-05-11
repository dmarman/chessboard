    // Manages tournament/opponent progression and boss-pool selection.
    // Drives OpponentRegistry — call start() to initialize, advanceOpponent() to progress.
    // Emits 'opponentChange' on every opponent transition.
    class TournamentManager extends EventEmitter {
        constructor(opponentRegistry) {
            super();
            this._registry = opponentRegistry;
            this._tournament = 1;
            this._opponent = 'SMALL'; // 'SMALL' | 'BIG' | 'BOSS'
            this._currentBossId = null;
            this._bossPool = [];
        }

        get currentTournament() { return this._tournament; }
        get currentOpponent() { return this._opponent; }
        get currentBossId() { return this._currentBossId; }

        // Initialize — sets tournament 1, Small opponent, pre-rolls first boss
        start() {
            this._tournament = 1;
            this._opponent = 'SMALL';
            this._rollBoss();
            this._applyToRegistry();
        }

        // Advance Small→Big→Boss, then Boss→Small of next tournament
        advanceOpponent() {
            if (this._opponent === 'SMALL') {
                this._opponent = 'BIG';
            } else if (this._opponent === 'BIG') {
                this._opponent = 'BOSS';
            } else {
                // Boss beaten — increment tournament (cap at MAX_TOURNAMENT)
                if (this._tournament < MAX_TOURNAMENT) {
                    this._tournament++;
                }
                this._opponent = 'SMALL';
                this._rollBoss();
            }
            this._applyToRegistry();
        }

        getCurrentScoreTarget() {
            const multiplier = this._currentMultiplier();
            return getScoreTarget(this._tournament, multiplier);
        }

        // Call on every score update — returns true if current opponent is beaten
        checkBeat(score) {
            return this._registry.checkResign(score);
        }

        _currentMultiplier() {
            if (this._opponent === 'SMALL') return OPPONENT_CONFIG.SMALL.multiplier;
            if (this._opponent === 'BIG')   return OPPONENT_CONFIG.BIG.multiplier;
            return BOSS_DEFS[this._currentBossId].multiplier;
        }

        _currentDef() {
            if (this._opponent === 'SMALL') return OPPONENT_CONFIG.SMALL;
            if (this._opponent === 'BIG')   return OPPONENT_CONFIG.BIG;
            return BOSS_DEFS[this._currentBossId];
        }

        _rollBoss() {
            if (this._bossPool.length === 0) {
                // Refill when exhausted
                this._bossPool = Object.keys(BOSS_DEFS);
            }
            const idx = Math.floor(Math.random() * this._bossPool.length);
            this._currentBossId = this._bossPool.splice(idx, 1)[0];
        }

        _applyToRegistry() {
            const def = this._currentDef();
            const scoreAtLeast = getScoreTarget(this._tournament, def.multiplier);
            // Pass def object directly — registry accepts either id string or def object
            this._registry.set(def, { scoreAtLeast });
            this.emit('opponentChange', {
                tournament: this._tournament,
                opponent: this._opponent,
                bossId: this._currentBossId,
                scoreAtLeast,
            });
        }
    }
