class EventEmitter {
    constructor() {
        this._listeners = {};
    }

    on(event, fn) {
        (this._listeners[event] ??= []).push(fn);
    }

    emit(event, data) {
        (this._listeners[event] ?? []).forEach(fn => fn(data));
    }
}
