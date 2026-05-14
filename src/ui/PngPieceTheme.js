    class PngPieceTheme {
        constructor() {
            // CSS var(--sprite) resolves url() relative to the stylesheet, not the document.
            // Use absolute URLs so the path is unambiguous regardless of CSS file location.
            const base = new URL('sprites/', document.baseURI).href;
            const s = p => base + p;
            this._spriteFamilies = {
                standard: {
                    'p': s('standard/bp.png'),
                    'b': s('standard/bb.png'),
                    'r': s('standard/br.png'),
                    'n': s('standard/bn.png'),
                    'q': s('standard/bq.png'),
                    'k': s('standard/bk.png'),

                    'P': s('standard/wp.png'),
                    'B': s('standard/wb.png'),
                    'R': s('standard/wr.png'),
                    'N': s('standard/wn.png'),
                    'Q': s('standard/wq.png'),
                    'K': s('standard/wk.png'),
                },
                rock: {
                    'p': s('rock.png'),
                    'b': s('rock.png'),
                    'r': s('rock.png'),
                    'n': s('rock.png'),
                    'q': s('rock.png'),
                    'k': s('rock.png'),
                    'P': s('rock.png'),
                    'B': s('rock.png'),
                    'R': s('rock.png'),
                    'N': s('rock.png'),
                    'Q': s('rock.png'),
                    'K': s('rock.png'),
                },
                checkers: {
                    'p': s('checkers/bp.png'),
                    'b': s('checkers/bb.png'),
                    'r': s('checkers/br.png'),
                    'n': s('checkers/bn.png'),
                    'q': s('checkers/bq.png'),
                    'k': s('checkers/bk.png'),

                    'P': s('checkers/wp.png'),
                    'B': s('checkers/wb.png'),
                    'R': s('checkers/wr.png'),
                    'N': s('checkers/wn.png'),
                    'Q': s('checkers/wq.png'),
                    'K': s('checkers/wk.png'),
                },
            };
            this._preload();
        }

        _preload() {
            const seen = new Set();
            for (const family of Object.values(this._spriteFamilies)) {
                for (const path of Object.values(family)) {
                    if (seen.has(path)) continue;
                    seen.add(path);
                    const img = new Image();
                    img.src = path;
                }
            }
        }

        // Pick sprite family from enhancement. Enhancements that don't swap sprites fall back to standard.
        _familyFor(enhancement) {
            if (enhancement === 'rock' || enhancement === 'checkers') return this._spriteFamilies[enhancement];
            return this._spriteFamilies.standard;
        }

        render(piece) {
            const enhancement = piece.enhancement ?? 'none';
            const edition     = piece.edition ?? 'base';
            const family = this._familyFor(enhancement);
            const path = family[piece.type];
            if (!path) return '';
            const sprite = `style="--sprite:url(${path})"`;
            const pieceColor = typeof piece.color === 'function' ? piece.color() : piece.color;

            const overlayClasses = [
                PngPieceTheme.ENHANCEMENT_OVERLAYS[enhancement],
                PngPieceTheme.EDITION_OVERLAYS[edition],
            ].filter(Boolean);
            const overlays = overlayClasses
                .map(cls => `<div class="${cls}" data-sync-delay ${sprite}></div>`)
                .join('');

            const neonClass  = edition === 'neon'        ? 'neon'       : '';
            const glassClass = enhancement === 'glass'   ? 'glass-tint' : '';
            const colorClass = pieceColor === 'b' ? 'piece-black' : 'piece-white';

            return `<div class="piece-modifier-wrapper ${neonClass} ${glassClass} ${colorClass}">
                <img src="${path}" alt="${piece.type}" draggable="false" data-sync-delay>
                ${overlays}
            </div>`;
        }
    }
    // Single-overlay-per-axis: enhancement contributes one, edition contributes one.
    PngPieceTheme.ENHANCEMENT_OVERLAYS = {
        metal:   'metal-overlay',
        glass:   'glass-overlay',
        gold:    'gold-overlay',
        stripes: 'stripes-overlay',
        // checkers + rock swap sprite family — no overlay div needed
    };
    PngPieceTheme.EDITION_OVERLAYS = {
        holo:  'holo-overlay',
        poly:  'poly-overlay',
        shine: 'shine-overlay',
        neon:  'neon-tint',
    };
