    class Piece {
        constructor(type, options = {}) {
            this.id = options.id ?? crypto.randomUUID();
            this.type = type; // 'R', 'N', 'B', 'Q', 'K', 'P'
            this._originalType = type; // preserved through promotions so deck piece can be reverted
            this.name = options.name || null;
            this.enhancement = options.enhancement ?? 'none';
            this.edition = options.edition ?? 'base';
        }

        color() {
            return this.type === this.type.toUpperCase() ? 'w' : 'b';
        }

        revertToOriginalType() {
            this.type = this._originalType;
        }

        // Returns new Piece with promoted type; same id/effects, _originalType preserved for revert.
        promote(newType) {
            const promoted = new Piece(newType, {
                id: this.id,
                name: this.name,
                enhancement: this.enhancement,
                edition: this.edition,
            });
            promoted._originalType = this._originalType;
            return promoted;
        }

        toSnapshot() {
            return Object.freeze({
                id: this.id,
                type: this.type,
                color: this.color(),
                enhancement: this.enhancement,
                edition: this.edition,
                name: this.name,
                label: this.name ?? this.type,
            });
        }
    }
