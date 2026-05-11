    // Executes typed command objects returned by power actions.
    // Powers never touch engines directly — they return commands, dispatcher owns execution.
    //
    // Supported command types:
    //   ADD_SCORE   { type: 'ADD_SCORE', amount: Number }  — add (positive) or penalize (negative)
    class CommandDispatcher {
        constructor() {
            this._handlers = new Map();
        }

        // Register a handler for a command type. Returns this for chaining.
        register(type, handler) {
            this._handlers.set(type, handler);
            return this;
        }

        // Execute an array of command objects against the provided engines.
        execute(commands, engines) {
            for (const cmd of commands) {
                const handler = this._handlers.get(cmd.type);
                if (!handler) {
                    console.warn(`[CommandDispatcher] No handler for command type: "${cmd.type}"`);
                    continue;
                }
                handler(cmd, engines);
            }
        }
    }
