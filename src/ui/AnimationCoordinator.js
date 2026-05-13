    // Owns the move animation queue. Receives pre-computed snapshots from the domain layer (GameController)
    // and drives ChessboardUI and HudUI animations in sync: per step, both UIs animate in parallel.
    class AnimationCoordinator {
        constructor(boardUI, hudUI, jokerUI = null, soundManager = null) {
            this._boardUI = boardUI;
            this._hudUI = hudUI;
            this._jokerUI = jokerUI;
            this._soundManager = soundManager;
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
            this._soundManager?.play(this._moveSoundKey(move));
            await this._boardUI.slideMove(move);
            if (this._gen !== gen) return;

            if (snapshots.length > 0) {
                const labels = this._moveLabels(move);
                if (labels.length) this._hudUI.showMoveLabel(labels);
            }

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

                if (step.kind === 'chips') this._soundManager?.play('chips_card');
                else if (step.kind === 'mult')      this._soundManager?.play('mult');
                else if (step.kind === 'xmult')     this._soundManager?.play('xmult');
                else if (step.kind === 'retrigger') this._soundManager?.play('pop');

                const hudAnim = snap.isLast
                    ? this._hudUI.update(snap)
                    : this._hudUI.updatePartial(snap);
                await Promise.all([fxAnim, hudAnim]);
                if (this._gen !== gen) return;
            }

            this._boardUI.endMove(move.toRow, move.toCol);
        }

        _moveLabels(move) {
            const labels = [];
            if (move.isEnPassant)         labels.push('En Passant');
            else if (move.captured)       labels.push('Capture');
            if (move.isCastle)            labels.push('Castle');
            if (move.promotion)           labels.push('Promotion');
            if (move.isCheckmate)         labels.push('Checkmate');
            else if (move.isCheck)        labels.push('Check');
            if (!labels.length)           labels.push('Quiet');
            return labels;
        }

        _moveSoundKey(move) {
            if (move.isCheckmate)    return 'game_end';
            if (move.isCheck)        return 'move_check';
            if (move.promotion)      return 'promote';
            if (move.captured)       return 'capture';
            if (move.isCastle)       return 'castle';
            return move.isOpponent ? 'move_opponent' : 'move_self';
        }

        reset() {
            this._queue = [];
            this._gen++;
            // _draining stays true until the in-flight _drain() exits naturally
        }
    }
