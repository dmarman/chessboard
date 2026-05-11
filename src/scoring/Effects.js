    class Effects {
        static PIECE = {
            p:  [{ source: 'piece', sourceType: 'p',  destination: 'add', operation: 'add', value: 200 }],
            n:  [{ source: 'piece', sourceType: 'n',  destination: 'add', operation: 'add', value: 200 }],
            b:  [{ source: 'piece', sourceType: 'b',  destination: 'add', operation: 'add', value: 200 }],
            r:  [{ source: 'piece', sourceType: 'r',  destination: 'add', operation: 'add', value: 200 }],
            q:  [{ source: 'piece', sourceType: 'q',  destination: 'add', operation: 'add', value: 200 }],
            k:  [{ source: 'piece', sourceType: 'k',  destination: 'add', operation: 'add', value: 200 }],
        }

        static STYLE = {
            checkers: [{ source: 'style', sourceType: 'checkers', destination: 'mult', operation: 'mult', value: 10  }],
            rock: [{ source: 'style', sourceType: 'rock', destination: 'mult', operation: 'add', value: 10  }],
        };

        // Each modifier can produce multiple effects; a piece may have several modifiers stacked
        static MODIFIER = {
            holo:    [{ source: 'modifier', sourceType: 'holo',    destination: 'mult', operation: 'add', value: 5   }],
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
    }
