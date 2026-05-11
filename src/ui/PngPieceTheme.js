    class PngPieceTheme {
        constructor() {
            this._styles = {
                standard: {
                    'p': '/sprites/standard/bp.png',
                    'b': '/sprites/standard/bb.png',
                    'r': '/sprites/standard/br.png',
                    'n': '/sprites/standard/bn.png',
                    'q': '/sprites/standard/bq.png',
                    'k': '/sprites/standard/bk.png',

                    'P': '/sprites/standard/wp.png',
                    'B': '/sprites/standard/wb.png',
                    'R': '/sprites/standard/wr.png',
                    'N': '/sprites/standard/wn.png',
                    'Q': '/sprites/standard/wq.png',
                    'K': '/sprites/standard/wk.png',
                },
                rock: {
                    'p': '/sprites/rock.png',
                    'b': '/sprites/rock.png',
                    'r': '/sprites/rock.png',
                    'n': '/sprites/rock.png',
                    'q': '/sprites/rock.png',
                    'k': '/sprites/rock.png',
                    'P': '/sprites/rock.png',
                    'B': '/sprites/rock.png',
                    'R': '/sprites/rock.png',
                    'N': '/sprites/rock.png',
                    'Q': '/sprites/rock.png',
                    'K': '/sprites/rock.png',
                },
                checkers: {
                    'p': '/sprites/checkers/bp.png',
                    'b': '/sprites/checkers/bb.png',
                    'r': '/sprites/checkers/br.png',
                    'n': '/sprites/checkers/bn.png',
                    'q': '/sprites/checkers/bq.png',
                    'k': '/sprites/checkers/bk.png',

                    'P': '/sprites/checkers/wp.png',
                    'B': '/sprites/checkers/wb.png',
                    'R': '/sprites/checkers/wr.png',
                    'N': '/sprites/checkers/wn.png',
                    'Q': '/sprites/checkers/wq.png',
                    'K': '/sprites/checkers/wk.png',
                },
            };
            this._preload();
        }

        _preload() {
            const seen = new Set();
            for (const family of Object.values(this._styles)) {
                for (const path of Object.values(family)) {
                    if (seen.has(path)) continue;
                    seen.add(path);
                    const img = new Image();
                    img.src = path;
                }
            }
        }

        render(piece) {
            const family = this._styles[piece.style] ?? this._styles.standard;
            const path = family[piece.type];
            if (!path) return '';
            const sprite = `style="--sprite:url(${path})"`;
            const modifiers = Object.entries(PngPieceTheme.MODIFIERS)
                .filter(([mod]) => piece.modifiers?.has(mod))
                .map(([, cls]) => `<div class="${cls}" data-sync-delay ${sprite}></div>`)
                .join('');
            const neonClass = piece.modifiers?.has('neon') ? 'neon' : '';
            const glassClass = piece.modifiers?.has('glass') ? 'glass-tint' : '';
            const colorClass = piece.color() === 'b' ? 'piece-black' : 'piece-white';

            return `<div class="piece-modifier-wrapper ${neonClass} ${glassClass} ${colorClass}">
                <img src="${path}" alt="${piece.type}" draggable="false" data-sync-delay>
                ${modifiers}
            </div>`;
        }
    }
    PngPieceTheme.MODIFIERS = {
        holo:        'holo-overlay',
        poly:        'poly-overlay',
        metal:       'metal-overlay',
        shine:       'shine-overlay',
        neon:        'neon-tint',
        glass:       'glass-overlay',
        gold:        'gold-overlay',
        stripes:     'stripes-overlay',
    };
