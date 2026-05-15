    // Singleton tooltip that shows EffectDescriber text on hover.
    // One DOM element, repositioned per target — no per-element overhead.
    //
    // Usage:
    //   EffectDescriberUI.attach(element, { type: 'piece',    piece:    { type, enhancement, edition, name } });
    //   EffectDescriberUI.attach(element, { type: 'joker',    def:      jokerDef });
    //   EffectDescriberUI.attach(element, { type: 'opponent', def:      opponentDef });
    //   EffectDescriberUI.attach(element, { type: 'moveType', moveType: 'capture' });
    //   EffectDescriberUI.detach(element);  // removes listeners

    class EffectDescriberUI {
        static _tooltip = null;
        static _listeners = new WeakMap(); // element -> { enter, leave }

        // Build and mount the singleton tooltip element.
        static _init() {
            if (EffectDescriberUI._tooltip) return;
            const el = document.createElement('div');
            el.className = 'effect-tooltip';
            el.setAttribute('aria-hidden', 'true');
            document.body.appendChild(el);
            EffectDescriberUI._tooltip = el;
        }

        // Attach hover behaviour to an element.
        // data.type: 'piece' | 'joker' | 'opponent' | 'moveType'
        static attach(element, data) {
            EffectDescriberUI._init();
            EffectDescriberUI.detach(element); // clear any prior listeners

            const enter = () => EffectDescriberUI._show(element, data);
            const leave = () => EffectDescriberUI._hide();

            element.addEventListener('mouseenter', enter);
            element.addEventListener('mouseleave', leave);
            EffectDescriberUI._listeners.set(element, { enter, leave });
        }

        // Remove hover listeners from an element.
        static detach(element) {
            const pair = EffectDescriberUI._listeners.get(element);
            if (!pair) return;
            element.removeEventListener('mouseenter', pair.enter);
            element.removeEventListener('mouseleave', pair.leave);
            EffectDescriberUI._listeners.delete(element);
        }

        static _show(anchor, data) {
            const tooltip = EffectDescriberUI._tooltip;
            tooltip.innerHTML = EffectDescriberUI._buildHTML(data);

            // Position above the anchor; flip below if clipped by viewport top.
            tooltip.classList.remove('effect-tooltip--visible');
            tooltip.style.visibility = 'hidden';
            tooltip.classList.add('effect-tooltip--visible');

            const rect   = anchor.getBoundingClientRect();
            const tRect  = tooltip.getBoundingClientRect();
            const gap    = 8;

            let top  = rect.top - tRect.height - gap + window.scrollY;
            let left = rect.left + rect.width / 2 - tRect.width / 2 + window.scrollX;

            // Flip below if above viewport
            if (top < window.scrollY + gap) {
                top = rect.bottom + gap + window.scrollY;
                tooltip.classList.add('effect-tooltip--below');
            } else {
                tooltip.classList.remove('effect-tooltip--below');
            }

            // Clamp horizontally within viewport
            const viewW = document.documentElement.clientWidth;
            left = Math.max(gap, Math.min(left, viewW - tRect.width - gap));

            tooltip.style.top  = `${top}px`;
            tooltip.style.left = `${left}px`;
            tooltip.style.visibility = '';
        }

        static _hide() {
            EffectDescriberUI._tooltip?.classList.remove('effect-tooltip--visible');
        }

        // Imperative API — call directly when you already have the anchor and data
        // (e.g. from a squareHover event rather than mouseenter listeners).
        static showAt(anchor, data) {
            EffectDescriberUI._init();
            EffectDescriberUI._show(anchor, data);
        }

        static hide() {
            EffectDescriberUI._hide();
        }

        static _buildHTML(data) {
            switch (data.type) {
                case 'piece':    return EffectDescriberUI._pieceHTML(data.piece);
                case 'joker':    return EffectDescriberUI._jokerHTML(data.def);
                case 'opponent': return EffectDescriberUI._opponentHTML(data.def);
                case 'moveType': return EffectDescriberUI._moveTypeHTML(data.moveType);
                default:         return '';
            }
        }

        static _pieceHTML({ type, enhancement, edition, name } = {}) {
            const lines = EffectDescriber.summaryForPiece({ type, enhancement, edition });
            const title = name ?? type ?? '';

            const rows = lines.map(({ label, text }) =>
                `<div class="effect-tooltip__row">
                    <span class="effect-tooltip__label">${label}</span>
                    <span class="effect-tooltip__value">${text}</span>
                </div>`
            ).join('');

            return `
                ${title ? `<div class="effect-tooltip__title">${title}</div>` : ''}
                ${rows || '<div class="effect-tooltip__empty">No effects</div>'}
            `;
        }

        static _jokerHTML(def) {
            if (!def) return '';
            return `
                <div class="effect-tooltip__title">${def.name ?? ''}</div>
                <div class="effect-tooltip__row">
                    <span class="effect-tooltip__value">${EffectDescriber.forJoker(def)}</span>
                </div>
                ${def.rarity ? `<div class="effect-tooltip__rarity effect-tooltip__rarity--${def.rarity}">${def.rarity}</div>` : ''}
            `;
        }

        static _opponentHTML(def) {
            if (!def) return '';
            return `
                <div class="effect-tooltip__title">${def.name ?? ''}</div>
                <div class="effect-tooltip__row">
                    <span class="effect-tooltip__value">${EffectDescriber.forOpponent(def)}</span>
                </div>
                ${def.multiplier != null ? `<div class="effect-tooltip__row"><span class="effect-tooltip__label">Score ×</span><span class="effect-tooltip__value">${def.multiplier}</span></div>` : ''}
            `;
        }

        static _moveTypeHTML(moveType) {
            if (!moveType) return '';
            return `
                <div class="effect-tooltip__title">${moveType}</div>
                <div class="effect-tooltip__row">
                    <span class="effect-tooltip__value">${EffectDescriber.forMoveType(moveType)}</span>
                </div>
            `;
        }
    }
