    // Owns the move animation queue. Receives pre-computed snapshots from the domain layer (GameController)
    // and drives ChessboardUI and HudUI animations in sync: per step, both UIs animate in parallel.
    class AnimationCoordinator {
        constructor(boardUI, hudUI, jokerUI = null) {
            this._boardUI = boardUI;
            this._hudUI = hudUI;
            this._jokerUI = jokerUI;
            this._queue = [];
            this._draining = false;
            this._gen = 0;
            this._onDrain = null;
        }

        enqueue(move, snapshots) {
            this._queue.push({ move, snapshots });
            if (!this._draining) this._drain();
        }

        // Resolves when the queue is fully drained (or immediately if already idle)
        done() {
            if (!this._draining) return Promise.resolve();
            return new Promise(res => {
                const prev = this._onDrain;
                this._onDrain = () => { prev?.(); res(); };
            });
        }

        async _drain() {
            this._draining = true;
            const gen = this._gen;
            while (this._queue.length) {
                if (this._gen !== gen) break;
                const item = this._queue.shift();
                try {
                    await this._process(item, gen);
                } catch (err) {
                    if (this._gen !== gen) break;
                    throw err;
                }
            }
            this._draining = false;
            const cb = this._onDrain;
            this._onDrain = null;
            cb?.();
        }

        async _process({ move, snapshots }, gen) {
            await this._boardUI.slideMove(move);
            if (this._gen !== gen) return;

            for (const snap of snapshots) {
                const { step } = snap;

                // Route by source type:
                //   joker/edition retrigger → joker card UI
                //   joker/edition scoring → joker card UI
                //   piece retrigger → board pulse with no number
                //   piece scoring → board square at destination
                let fxAnim;
                if (step.kind === 'retrigger') {
                    if ((step.source.type === 'joker' || step.source.type === 'edition') && this._jokerUI) {
                        fxAnim = this._jokerUI.animateEffect(step.source.id, null);
                    } else {
                        fxAnim = this._boardUI.animatePieceEffect(move.toRow, move.toCol, null);
                    }
                } else if ((step.source.type === 'joker' || step.source.type === 'edition') && this._jokerUI) {
                    fxAnim = this._jokerUI.animateEffect(step.source.id, step.value);
                } else {
                    fxAnim = this._boardUI.animatePieceEffect(move.toRow, move.toCol, step.value);
                }

                const hudAnim = snap.isLast
                    ? this._hudUI.update(snap)
                    : this._hudUI.updatePartial(snap);
                await Promise.all([fxAnim, hudAnim]);
                if (this._gen !== gen) return;
            }

            this._boardUI.endMove(move.toRow, move.toCol);
        }

        reset() {
            this._queue = [];
            this._gen++;
            // _draining stays true until the in-flight _drain() exits naturally
        }
    }
