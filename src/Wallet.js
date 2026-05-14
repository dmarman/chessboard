class Wallet {
    constructor() {
        this._balance = 10;
    }

    get balance() {
        return this._balance;
    }

    add(amount) {
        this._balance += amount;
    }

    canAfford(amount) {
        return this._balance >= amount;
    }

    spend(amount) {
        if (!this.canAfford(amount)) {
            throw new Error(`Insufficient funds: balance ${this._balance}, attempted to spend ${amount}`);
        }
        this._balance -= amount;
    }
}
