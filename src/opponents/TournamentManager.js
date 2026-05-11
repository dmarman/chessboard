    // Manages tournament/opponent progression and boss-pool selection.
    // TournamentManager does not represent a real tournament model with pairing system. It's our own tournament interpretation: small and big opponent + a boss.
    // Single owner of active-opponent state — call start() to initialize, advanceOpponent() to progress.
    // Emits 'change' (Opponent instance) on every opponent transition.
    //
    // opponentCatalog: { regular: { SMALL, BIG }, bossDefs: { [id]: def } }
    // scoreRules: { getScoreTarget(tournamentNumber, multiplier), maxTournament }
    class TournamentManager extends EventEmitter {
        constructor(opponentCatalog, scoreRules) {
            super();
            this._catalog = opponentCatalog;
            this._scoreRules = scoreRules;
            this._current = null;
            this._tournament = 1;
            this._opponent = 'SMALL'; // 'SMALL' | 'BIG' | 'BOSS'
            this._currentBossId = null;
            this._bossPool = [];
        }

        get currentTournament() { return this._tournament; }
        get maxTournament() { return this._scoreRules.maxTournament; }
        get currentOpponent() { return this._opponent; }
        get currentBossId() { return this._currentBossId; }
        getCurrent() { return this._current; }

        // Initialize — sets tournament 1, Small opponent, pre-rolls first boss
        start() {
            this._tournament = 1;
            this._opponent = 'SMALL';
            this._rollBoss();
            this._applyOpponent();
        }

        // Advance Small→Big→Boss, then Boss→Small of next tournament
        advanceOpponent() {
            if (this._opponent === 'SMALL') {
                this._opponent = 'BIG';
            } else if (this._opponent === 'BIG') {
                this._opponent = 'BOSS';
            } else {
                // Boss beaten — increment tournament (cap at maxTournament)
                if (this._tournament < this._scoreRules.maxTournament) {
                    this._tournament++;
                }
                this._opponent = 'SMALL';
                this._rollBoss();
            }
            this._applyOpponent();
        }

        getCurrentScoreTarget() {
            const multiplier = this._currentMultiplier();
            return this._scoreRules.getScoreTarget(this._tournament, multiplier);
        }

        // True when player has reached or passed the current opponent's resign threshold
        checkBeat(score) {
            if (!this._current) return false;
            return score >= this._current.scoreAtLeast;
        }

        // Safe to call when no opponent is set — returns empty array
        triggerPowers(timing, ctx) {
            if (!this._current) return [];
            return this._current.triggerPowers(timing, ctx);
        }

        // Returns display read-models for [small, big, boss] — no domain behavior exposed
        // isActive: true only on the given activeSlot (defaults to current opponent)
        getTournamentOpponents(activeSlot = this._opponent) {
            const t = this._tournament;
            const { regular, bossDefs } = this._catalog;
            const boss = bossDefs[this._currentBossId];
            const slotOrder = ['SMALL', 'BIG', 'BOSS'];
            return [regular.SMALL, regular.BIG, boss].map((def, i) => ({
                id: def.id,
                name: def.name,
                description: def.description,
                scoreAtLeast: this._scoreRules.getScoreTarget(t, def.multiplier),
                reward: def.reward ?? 0,
                isActive: slotOrder[i] === activeSlot,
            }));
        }

        // Returns what the next opponent slot will be without advancing state
        peekNextOpponent() {
            if (this._opponent === 'SMALL') return 'BIG';
            if (this._opponent === 'BIG') return 'BOSS';
            return 'SMALL';
        }

        _currentMultiplier() {
            if (this._opponent === 'SMALL') return this._catalog.regular.SMALL.multiplier;
            if (this._opponent === 'BIG')   return this._catalog.regular.BIG.multiplier;
            return this._catalog.bossDefs[this._currentBossId].multiplier;
        }

        _currentDef() {
            if (this._opponent === 'SMALL') return this._catalog.regular.SMALL;
            if (this._opponent === 'BIG')   return this._catalog.regular.BIG;
            return this._catalog.bossDefs[this._currentBossId];
        }

        _rollBoss() {
            if (this._bossPool.length === 0) {
                // Refill when exhausted
                this._bossPool = Object.keys(this._catalog.bossDefs);
            }
            const idx = Math.floor(Math.random() * this._bossPool.length);
            this._currentBossId = this._bossPool.splice(idx, 1)[0];
        }

        _applyOpponent() {
            const def = this._currentDef();
            const scoreAtLeast = this._scoreRules.getScoreTarget(this._tournament, def.multiplier);
            this._current = new Opponent({ ...def, scoreAtLeast });
            this.emit('change', this._current);
        }
    }
