    class Effects {
        static MOVE_TYPE = {
            'capture':      [{ source: 'moveType', sourceType: 'capture',      destination: 'mult', operation: 'add', value: 1 }],
            'check':        [{ source: 'moveType', sourceType: 'check',        destination: 'mult', operation: 'add', value: 2 }],
            'castle king':  [{ source: 'moveType', sourceType: 'castle king',  destination: 'mult', operation: 'add', value: 3 }],
            'castle queen': [{ source: 'moveType', sourceType: 'castle queen', destination: 'mult', operation: 'add', value: 4 }],
            'promotion':    [{ source: 'moveType', sourceType: 'promotion',    destination: 'mult', operation: 'add', value: 20 }],
            'enpassant':    [{ source: 'moveType', sourceType: 'enpassant',    destination: 'mult', operation: 'add', value: 300 }],
        };

        static PIECE = {
            p:  [{ source: 'piece', sourceType: 'p',  destination: 'add', operation: 'add', value: 1 }],
            n:  [{ source: 'piece', sourceType: 'n',  destination: 'add', operation: 'add', value: 3 }],
            b:  [{ source: 'piece', sourceType: 'b',  destination: 'add', operation: 'add', value: 4 }],
            r:  [{ source: 'piece', sourceType: 'r',  destination: 'add', operation: 'add', value: 5 }],
            q:  [{ source: 'piece', sourceType: 'q',  destination: 'add', operation: 'add', value: 8 }],
            k:  [{ source: 'piece', sourceType: 'k',  destination: 'add', operation: 'add', value: 10}],
        }

        static STYLE = {
            checkers: [{ source: 'style', sourceType: 'checkers', destination: 'mult', operation: 'mult', value: 10  }],
            rock: [{ source: 'style', sourceType: 'rock', destination: 'mult', operation: 'add', value: 10  }],
        };

        // Each modifier can produce multiple effects; a piece may have several modifiers stacked
        static MODIFIER = {
            holo:    [{ source: 'modifier', sourceType: 'holo',    destination: 'add',  operation: 'add', value: 5   }],
            poly:    [{ source: 'modifier', sourceType: 'poly',    destination: 'mult', operation: 'add', value: 5   }],
            metal:   [{ source: 'modifier', sourceType: 'metal',   destination: 'add',  operation: 'add', value: 5  }],
            shine:   [{ source: 'modifier', sourceType: 'shine',   destination: 'add',  operation: 'add', value: 5  }],
            neon:    [{ source: 'modifier', sourceType: 'neon',    destination: 'mult', operation: 'add', value: 5   }],
            glass:   [{ source: 'modifier', sourceType: 'glass',   destination: 'mult', operation: 'add', value: 5   }],
            gold:    [{ source: 'modifier', sourceType: 'gold',    destination: 'add',  operation: 'add', value: 5  }],
            stripes: [{ source: 'modifier', sourceType: 'stripes', destination: 'add',  operation: 'add', value: 5  }],
        };

        // Returns ScoringStep[] for the ON_PIECE_SCORED phase.
        // piece: { id, type, style, modifiers, name }
        static stepsFromPiece({ id, type, style, modifiers, name }) {
            const t = type.toLowerCase();
            const label = name ?? t;

            const effectToKind = e =>
                e.destination === 'mult'
                    ? (e.operation === 'mult' ? 'xmult' : 'mult')
                    : 'chips';

            const tableToSteps = (table, key) =>
                (table[key] ?? []).map(e => makeScoringStep({
                    event: EventType.ON_PIECE_SCORED,
                    kind: effectToKind(e),
                    value: e.value,
                    source: { type: 'piece', id, label },
                }));

            const modSteps = modifiers
                ? [...modifiers].flatMap(mod => tableToSteps(Effects.MODIFIER, mod.toLowerCase()))
                : [];

            return [
                ...tableToSteps(Effects.PIECE, t),
                ...tableToSteps(Effects.STYLE, style?.toLowerCase()),
                ...modSteps,
            ];
        }

        // Returns ScoringStep[] for move type effects.
        // moveType: string (e.g. 'capture', 'check', 'promotion')
        static stepsFromMoveType(moveType) {
            const effectToKind = e =>
                e.destination === 'mult'
                    ? (e.operation === 'mult' ? 'xmult' : 'mult')
                    : 'chips';

            return (Effects.MOVE_TYPE[moveType] ?? []).map(e => makeScoringStep({
                event: EventType.ON_MOVE_PLAYED,
                kind: effectToKind(e),
                value: e.value,
                source: { type: 'moveType', label: moveType },
            }));
        }
    }
