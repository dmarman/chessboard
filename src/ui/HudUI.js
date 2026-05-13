    class HudUI {
        constructor(element, options = {}) {
            this._el = typeof element === 'string' ? document.getElementById(element) : element;
            this._onScoreCalculate = options.onScoreCalculate ?? null;
            this._onScoreAccum = options.onScoreAccum ?? null;
            this._buildDOM();
            this._currentTotal = 0;
            this._chain = Promise.resolve();
        }

        get opponentSlot() { return this._opponentSlot; }

        _buildDOM() {
            this._el.innerHTML = `
                <div class="hud-panel">
                    <div class="hud-opponent-slot"></div>
                    <div class="hud-section total-score">
                        <span class="hud-label">
                            <span>Game</span>
                            <span>score</span>
                        </span>
                        <span class="hud-value">0</span>
                    </div>
                    <div class="hud-section hud-chip-score-card">
                        <div class="hud-row">
                            <span class="hud-sub-value gained">&mdash;</span>
                        </div>
                        <div class="hud-row">
                            <span class="hud-row-chips"><span class="hud-sub-value chips"></span></span>
                            <span class="hud-row-x hud-sub-value">X</span>
                            <span class="hud-row-mult"><span class="hud-sub-value mult"></span></span>
                        </div>
                    </div>
                    <div class="hud-section hud-money-section">
                        <span class="hud-money-value">$0</span>
                    </div>
                    <div class="hud-progress-section">
                        <div class="hud-section">
                            <div class="hud-progress-col">
                                <span class="hud-label">Tournament</span>
                                <span class="hud-progress-tournament">1/8</span>
                            </div>
                        </div>
                        <div class="hud-section">
                            <div class="hud-progress-col">
                                <span class="hud-label">Round</span>
                                <span class="hud-progress-round">1/3</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this._opponentSlot = this._el.querySelector('.hud-opponent-slot');
            this._scoreVal  = this._el.querySelector('.total-score .hud-value');
            this._chipsVal  = this._el.querySelector('.hud-sub-value.chips');
            this._multVal   = this._el.querySelector('.hud-sub-value.mult');
            this._gainedVal = this._el.querySelector('.hud-sub-value.gained');
            this._moneyVal            = this._el.querySelector('.hud-money-value');
            this._progressTournament  = this._el.querySelector('.hud-progress-tournament');
            this._progressRound       = this._el.querySelector('.hud-progress-round');
        }

        _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

        _enqueue(fn) {
            const result = this._chain.then(() => fn());
            this._chain = result.catch(() => {});
            return result;
        }

        async _runSteps(steps) {
            for (const step of steps) {
                if (Array.isArray(step)) await Promise.all(step.map(s => s()));
                else await step();
            }
        }

        _setAndPulse(el, text, { twist = 0, duration = 200 } = {}) {
            if (el.textContent === text) return Promise.resolve();
            el.innerHTML = [...text].map(ch => `<span class="hud-digit">${ch}</span>`).join('');
            const spans = [...el.querySelectorAll('.hud-digit')];
            if (!spans.length) return Promise.resolve();
            spans.forEach((span, i) => this._startFloat(span, i*1000));
            const anims = spans.map((span, i) =>
                span.animate(
                    [
                        { transform: `scale(1.6) rotate(${twist}deg)` },
                        { transform: `scale(1.3) rotate(${-twist/2}deg)` },
                        { transform: `scale(0.9) rotate(${twist/4}deg)` },
                        { transform: 'scale(1) rotate(0deg)' }
                    ],
                    { duration: duration, delay: i * 50, easing: 'ease-out', fill: 'forwards', composite: 'add' }
                )
            );
            return anims[anims.length - 1].finished;
        }

        // Idle float on a single span — random phase so digits drift out of sync.
        _startFloat(span, delay) {
            span.animate(
                [
                    { transform: 'translateY(0px)',  easing: 'ease-out' },
                    { transform: 'translateY(-1px)', easing: 'ease-in' },
                    { transform: 'translateY(0px)',  easing: 'ease-out' },
                    { transform: 'translateY(1px)',  easing: 'ease-in' },
                    { transform: 'translateY(0px)' },
                ],
                { duration: 2000, delay: delay, iterations: Infinity }
            );
        }

        // Each digit shakes independently in a loop. Fire-and-forget — store anims on el for cancellation.
        _shakeDigits(el, intensity = 1) {
            const s = intensity;
            const spans = [...el.querySelectorAll('.hud-digit')];
            el._shakeAnims = spans.map(span => {
                span.style.transformOrigin = `${Math.random()*100}% ${Math.random()*50}%`;
                const delay    = Math.random() * 60;
                const duration = 200 + Math.random() * 100;
                return span.animate(
                    [
                        { transform: 'rotate(0deg)' },
                        { transform: `rotate(${(-6 + Math.random()*4)*s}deg)` },
                        { transform: `rotate(${(5  + Math.random()*4)*s}deg)` },
                        { transform: 'rotate(0deg)' },
                    ],
                    { duration, delay, easing: 'linear', iterations: Infinity, composite: 'add' }
                );
            });
        }

        _stopShakeDigits(el) {
            el._shakeAnims?.forEach(a => a.cancel());
            el._shakeAnims = null;
        }

        // Ticks a number from `from` to `to` over `duration` ms, writing plain text directly.
        _animateCount(el, from, to, duration, format = v => `${v}`) {
            if (el._countRaf) cancelAnimationFrame(el._countRaf);
            return new Promise(resolve => {
                const start = performance.now();
                const tick = (now) => {
                    const t = Math.min((now - start) / duration, 1);
                    el.textContent = format(Math.round(from + (to - from) * t));
                    if (t < 1) {
                        el._countRaf = requestAnimationFrame(tick);
                    } else {
                        el._countRaf = null;
                        if (to === 0) el.textContent = '';
                        resolve();
                    }
                };
                el._countRaf = requestAnimationFrame(tick);
            });
        }

        showMoveLabel(labels) {
            return this._enqueue(() => this._setAndPulse(this._gainedVal, labels.join(' + ')));
        }

        updatePartial({ base, mult }) {
            return this._enqueue(() => this._runSteps([
                [
                    () => this._setAndPulse(this._chipsVal, base > 0 ? `${base}` : '0'),
                    () => this._setAndPulse(this._multVal, `${mult}`, { twist: 30, duration: 300 }),
                ],
            ]));
        }

        update({ gained, total, base, mult }) {
            const prevTotal = this._currentTotal;
            return this._enqueue(() => this._runSteps([
                [
                    () => this._setAndPulse(this._chipsVal, base > 0 ? `${base}` : '0'),
                    () => this._setAndPulse(this._multVal, `${mult}`, { twist: 30, duration: 300 }),
                ],
                () => this._sleep(500),
                [
                    () => this._onScoreCalculate?.(),
                    () => this._setAndPulse(this._chipsVal, '0'),
                    () => this._setAndPulse(this._multVal, '0', { twist: 30, duration: 300 }),
                    () => this._setAndPulse(this._gainedVal, gained > 0 ? `${gained}` : ''),
                ],
                () => this._shakeDigits(this._gainedVal, 0.5),
                () => this._sleep(500),
                [
                    () => { this._onScoreAccum?.(); this._stopShakeDigits(this._gainedVal); return this._animateCount(this._gainedVal, gained, 0, Math.min(gained*10, 200)); },
                    () => this._animateCount(this._scoreVal, prevTotal, total, Math.min(total*10, 200), v => v.toLocaleString()),
                ],
                () => { this._currentTotal = total; },
                () => this._sleep(400),
            ]));
        }

        setMoney(amount) {
            this._moneyVal.textContent = `$${amount}`;
        }

        setProgress(tournament, maxTournament, opponent) {
            const roundMap = { SMALL: 1, BIG: 2, BOSS: 3 };
            this._progressTournament.innerHTML = `<span class="hud-progress-current">${tournament}</span><span class="hud-progress-total">/${maxTournament}</span>`;
            this._progressRound.innerHTML = `<span class="hud-progress-current">${roundMap[opponent]}</span>`;
        }

        reset({ score }) {
            this._chain = Promise.resolve();
            this._currentTotal = score;
            this._enqueue(() => this._runSteps([
                [
                    () => this._setAndPulse(this._scoreVal, score.toLocaleString()),
                    () => this._setAndPulse(this._chipsVal, '0'),
                    () => this._setAndPulse(this._multVal, '0', { twist: 30, duration: 300 }),
                    () => { this._stopShakeDigits(this._gainedVal); return this._setAndPulse(this._gainedVal, ''); },
                ],
            ]));
        }
    }
