    class Effects {
        static PIECE = {
            p:  [{ source: 'piece', sourceType: 'p',  destination: 'add', operation: 'add', value: 100 }],
            n:  [{ source: 'piece', sourceType: 'n',  destination: 'add', operation: 'add', value: 100 }],
            b:  [{ source: 'piece', sourceType: 'b',  destination: 'add', operation: 'add', value: 100 }],
            r:  [{ source: 'piece', sourceType: 'r',  destination: 'add', operation: 'add', value: 100 }],
            q:  [{ source: 'piece', sourceType: 'q',  destination: 'add', operation: 'add', value: 100 }],
            k:  [{ source: 'piece', sourceType: 'k',  destination: 'add', operation: 'add', value: 100 }],
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

        static fromPiece({ style, type, modifiers }) {
            const modifierEffects = modifiers
                ? [...modifiers].flatMap(mod => Effects.MODIFIER[mod.toLowerCase()] ?? [])
                : [];

            return [
                ...(Effects.PIECE[type.toLowerCase()] ?? []),
                ...(Effects.STYLE[style?.toLowerCase()] ?? []),
                ...modifierEffects,
            ];
        }
    }
