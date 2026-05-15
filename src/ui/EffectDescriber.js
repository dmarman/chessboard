    // Translates raw effect data into human-readable strings for UI display.
    // Covers: piece enhancements, editions, move types, joker defs, opponent/boss defs.
    // Domain models stay clean — all presentation logic lives here.
    //
    // Usage:
    //   EffectDescriber.forEnhancement('glass')   → "×2 mult · 25% shatter on move"
    //   EffectDescriber.forEdition('holo')         → "+10 mult"
    //   EffectDescriber.forMoveType('capture')     → "+10 chips · +2 mult"
    //   EffectDescriber.forJoker(JOKER_DEFS.PREDATOR)  → "Capture move → mult ×2"
    //   EffectDescriber.forOpponent(opponentDef)   → uses description field
    //   EffectDescriber.forEffectArray([...])      → generic array → text

    class EffectDescriber {
        // Wraps op+value in a colored span. isNegative forces danger color regardless of kind.
        static _valueSpan(op, value, color, bgColor = null, textColor = null) {
            const bg    = bgColor    ? `background:${bgColor};padding:0 4px;border-radius:6px;` : '';
            const fg    = textColor  ? `color:${textColor};`  : `color:${color};`;
            return `<span style="${fg}${bg}font-weight:600;">${op}${value}</span>`;
        }

        // Converts a single effect object { kind, value, chance } to an HTML string.
        static _effectToken({ kind, value, chance }) {
            const pct = chance !== undefined
                ? ` <span style="color:${THEME.textMuted};font-size:0.85em;">(${Math.round(chance * 100)}%)</span>`
                : '';
            switch (kind) {
                case 'chips':
                    return `${EffectDescriber._valueSpan('+', `${value}`, THEME.scoreChips)} chips ${pct}`;
                case 'mult':
                    return `${EffectDescriber._valueSpan('+', `${value}`, THEME.scoreMult)} mult ${pct}`;
                case 'xmult':
                    return `${EffectDescriber._valueSpan('×', `${value}`, null, THEME.scoreMult, '#fff')} xmult ${pct}`;
                case 'money':
                    return `${EffectDescriber._valueSpan('+$', value, THEME.gold)}${pct}`;
                case 'expire':
                    return `<span style="color:${THEME.rarityUncommonHover};">${`${Math.round(chance * 100)}%`}</span> shatter on move`;
                case 'retrigger': return 'retrigger scored piece';
                case 'message':   return '';
                default:          return `${kind}: ${value}${pct}`;
            }
        }

        // Converts an array of effect objects to a joined readable string.
        // Filters empty tokens (e.g. from 'message' kind).
        static forEffectArray(effects = []) {
            return effects
                .map(e => EffectDescriber._effectToken(e))
                .filter(Boolean)
                .join(' · ');
        }

        // Describes a piece enhancement by key (e.g. 'glass', 'red', 'lucky').
        // Reads Effects.ENHANCEMENT for on-move effects, then appends held/alive/captured notes.
        static forEnhancement(key) {
            if (!key) return '';
            const k = key.toLowerCase();

            const parts = [];

            const onMove = Effects.ENHANCEMENT[k];
            if (onMove?.length) parts.push(EffectDescriber.forEffectArray(onMove));

            const onHeld = Effects.ENHANCEMENT_HELD[k];
            if (onHeld?.length) parts.push(`held: ${EffectDescriber.forEffectArray(onHeld)}`);

            const onAlive = Effects.ENHANCEMENT_ALIVE[k];
            if (onAlive?.length) parts.push(`alive at end: ${EffectDescriber.forEffectArray(onAlive)}`);

            const onCaptured = Effects.ENHANCEMENT_ON_CAPTURED[k];
            if (onCaptured?.length) parts.push(`when captured: ${EffectDescriber.forEffectArray(onCaptured)}`);

            const restriction = Effects.ENHANCEMENT_RESTRICTIONS[k];
            if (restriction?.noCapture) parts.push('cannot capture');
            if (restriction?.mustCapture) parts.push('must capture');

            return parts.join(' · ') || key;
        }

        // Describes a piece edition by key (e.g. 'holo', 'poly', 'shine', 'neon').
        static forEdition(key) {
            if (!key) return '';
            const k = key.toLowerCase();
            const effects = Effects.EDITION[k];
            return effects?.length ? EffectDescriber.forEffectArray(effects) : key;
        }

        // Describes a move type by key (e.g. 'capture', 'check', 'promotion').
        static forMoveType(key) {
            if (!key) return '';
            const def = Effects.MOVE_TYPE[key.toLowerCase()];
            if (!def) return key;
            return [
                EffectDescriber._valueSpan('+', `${def.chips} chips`, THEME.scoreChips),
                EffectDescriber._valueSpan('+', `${def.mult} mult`,   THEME.scoreMult),
            ].join(' · ');
        }

        // Describes a piece type base value by letter (e.g. 'p', 'n', 'q').
        static forPieceType(type) {
            if (!type) return '';
            const effects = Effects.PIECE[type.toLowerCase()];
            return effects?.length ? EffectDescriber.forEffectArray(effects) : '';
        }

        // Returns the joker's description string directly — joker defs own their narrative text.
        // Falls back to mechanically deriving text from trigger output shape is not feasible
        // since trigger() requires live ctx/state. description field is the source of truth.
        static forJoker(jokerDef) {
            if (!jokerDef) return '';
            return jokerDef.description ?? jokerDef.name ?? jokerDef.id ?? '';
        }

        // Returns the opponent/boss description string. Same rationale as forJoker.
        static forOpponent(opponentDef) {
            if (!opponentDef) return '';
            return opponentDef.description ?? opponentDef.name ?? opponentDef.id ?? '';
        }

        // Full summary for a piece — type base + enhancement + edition, each labeled.
        // Returns an array of { label, text } lines for flexible UI rendering.
        static summaryForPiece({ type, enhancement, edition }) {
            const lines = [];

            const hasEnhancement = enhancement && enhancement.toLowerCase() !== 'none';
            const hasEdition = edition && edition.toLowerCase() !== 'base';

            const typeText = EffectDescriber.forPieceType(type);
            if (typeText) lines.push({ label: 'piece', text: typeText });

            if (hasEnhancement) {
                const enhText = EffectDescriber.forEnhancement(enhancement);
                if (enhText) lines.push({ label: enhancement, text: enhText });
            }

            if (hasEdition) {
                const edText = EffectDescriber.forEdition(edition);
                if (edText) lines.push({ label: edition, text: edText });
            }

            return lines;
        }
    }
