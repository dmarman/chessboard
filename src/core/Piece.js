    class Piece {
        constructor(type, options = {}) {
            this.id = options.id ?? crypto.randomUUID();
            this.type = type; // 'R', 'N', 'B', 'Q', 'K', 'P'
            this._originalType = type; // preserved through promotions so deck piece can be reverted
            this.name = options.name || null;
            this.style = options.style || 'classic';
            this.modifiers = new Set(options.modifiers ?? []);
        }

        color() {
            return this.type === this.type.toUpperCase() ? 'w' : 'b';
        }
    }
