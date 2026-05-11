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

        // Execute an array of command objects for immediate side effects only. Return value ignored.
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

        // Execute commands and collect any pipelineSteps handlers return for scoring injection.
        executeAndCollect(commands, engines) {
            const pipelineSteps = [];
            for (const cmd of commands) {
                const handler = this._handlers.get(cmd.type);
                if (!handler) {
                    console.warn(`[CommandDispatcher] No handler for command type: "${cmd.type}"`);
                    continue;
                }
                const result = handler(cmd, engines);
                if (result?.pipelineSteps?.length) pipelineSteps.push(...result.pipelineSteps);
            }
            return pipelineSteps;
        }
    }
