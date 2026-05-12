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

    spend(amount) {
        this._balance -= amount;
    }
}
