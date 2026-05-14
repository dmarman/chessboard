    // Executes typed command objects returned by power actions.
    // Powers never touch engines directly — they return commands, dispatcher owns execution.
    class CommandDispatcher {
        constructor() {
            this._handlers = new Map();
        }

        // Register a handler for a command type. Returns this for chaining.
        register(type, handler) {
            this._handlers.set(type, handler);
            return this;
        }

        // Execute commands, collect any pipelineSteps handlers return. Caller ignores when empty.
        // Throws on unknown command type — missing handler is a programmer error, not runtime.
        execute(commands, engines) {
            const pipelineSteps = [];
            for (const cmd of commands) {
                const handler = this._handlers.get(cmd.type);
                if (!handler) throw new Error(`CommandDispatcher: no handler registered for command type "${cmd.type}"`);
                const result = handler(cmd, engines);
                if (result?.pipelineSteps?.length) pipelineSteps.push(...result.pipelineSteps);
            }
            return pipelineSteps;
        }
    }
