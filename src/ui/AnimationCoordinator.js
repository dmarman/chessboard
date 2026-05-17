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

        // Enqueues game-end scoring animations (alive pieces) — no board slide, no move sound.
        enqueueGameEnd(snapshots) {
            this._queue.push({ move: null, snapshots, isGameEnd: true });
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

        async _process({ move, snapshots, isGameEnd }, gen) {
            if (!isGameEnd) {
                this._soundManager?.play(this._moveSoundKey(move));
                await this._boardUI.slideMove(move);
                if (this._gen !== gen) return;

                // Slide any bundled secondary pieces (castling rook) before scoring begins.
                for (const secondary of move.secondaryMoves ?? []) {
                    await this._boardUI.slideMove(secondary);
                    if (this._gen !== gen) return;
                }
            }

            if (snapshots.length > 0 && !isGameEnd) {
                const labels = this._moveLabels(move);
                if (labels.length) this._hudUI.showMoveLabel(labels);
            }

            for (const snap of snapshots) {
                const { step } = snap;

                // Base move-type steps: scored but not animated — skip board/sound/HUD anim.
                // ScoreEngine already ran them; subsequent animated steps carry the accumulated values.
                if (step.animate === false) continue;

                // expire steps have no scoring popup — only the ghost break animation after the loop.
                if (step.kind === 'expire') continue;

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
                        fxAnim = this._boardUI.animatePieceEffect(move?.toRow, move?.toCol, null);
                    }
                } else if ((step.source.type === 'joker' || step.source.type === 'edition') && this._jokerUI) {
                    fxAnim = this._jokerUI.animateEffect(step.source.id, step.value);
                } else {
                    // Held-piece effects (ON_NON_MOVED_PIECE) carry their own square in source.
                    // Default to the moved piece's destination otherwise.
                    const hasSquare = step.source.row != null && step.source.col != null;
                    const row = hasSquare ? step.source.row : move?.toRow;
                    const col = hasSquare ? step.source.col : move?.toCol;

                    fxAnim = this._boardUI.animatePieceEffect(row, col, step.value, step.kind);
                }

                if (step.kind === 'chips')          { this._soundManager?.play('chips_card'); this._shakeScreen(1); }
                else if (step.kind === 'mult')      { this._soundManager?.play('mult');       this._shakeScreen(2); }
                else if (step.kind === 'xmult')     { this._soundManager?.play('xmult');      this._shakeScreen(3); }
                else if (step.kind === 'retrigger') this._soundManager?.play('pop');

                const hudAnim = snap.isLast
                    ? this._hudUI.update(snap)
                    : this._hudUI.updatePartial(snap);
                await Promise.all([fxAnim, hudAnim]);
                if (this._gen !== gen) return;
            }

            if (!isGameEnd) {
                // After scoring popups, animate any piece-expire (e.g. glass break) at destination.
                const expired = snapshots.some(s => s.step.kind === 'expire' && s.step.source?.type === 'piece');
                if (expired) {
                    await this._boardUI.removePieceAt(move.toRow, move.toCol);
                    if (this._gen !== gen) return;
                }

                this._boardUI.endMove(move.toRow, move.toCol);
            }
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

        _shakeScreen(amplitudePx) {
            const root = document.getElementById('game-layout');
            if (!root) return;

            // Cancel any in-flight shake so back-to-back ticks restart cleanly.
            this._shakeAnim?.cancel();

            const rotAmp = Math.min(2.5, amplitudePx * 0.1); // degrees, capped
            const rand = (min, max) => Math.random() * (max - min) + min;
            const sign = () => (Math.random() < 0.5 ? -1 : 1);

            // 5 random mid-frames + start/end at rest. Each frame randomizes x, y, rotation.
            const frames = [{ transform: 'translate(0,0) rotate(0deg)' }];
            for (let i = 0; i < 4; i++) {
                const x = sign() * rand(amplitudePx * 0.4, amplitudePx);
                const y = sign() * rand(amplitudePx * 0.4, amplitudePx);
                const r = sign() * rand(rotAmp * 0.3, rotAmp);
                frames.push({ transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg)` });
                console.log(`translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg)`)
            }
            frames.push({ transform: 'translate(0,0) rotate(0deg)' });

            this._shakeAnim = root.animate(frames, {
                duration: 400,
                easing: 'ease-out',
                fill: 'none',
            });
        }

        reset() {
            this._queue = [];
            this._gen++;
            // _draining stays true until the in-flight _drain() exits naturally
        }
    }
