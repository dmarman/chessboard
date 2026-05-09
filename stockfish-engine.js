class StockfishEngine {
    /**
     * @param {string} workerPath - Path to stockfish .js worker file
     */
    constructor(workerPath = "node_modules/stockfish/bin/stockfish-18-lite-single.js") {
        this._workerPath = workerPath;
        this._worker = null;
        this._ready = false;
        this._initPromise = null;
    }

    /**
     * Initialize the engine. Called automatically on first search.
     * @returns {Promise<void>}
     */
    async init() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            this._worker = new Worker(this._workerPath);

            this._worker.addEventListener("error", reject);

            const onUciOk = (e) => {
                if (e.data === "uciok") {
                    this._worker.removeEventListener("message", onUciOk);
                    this._ready = true;
                    resolve();
                }
            };

            this._worker.addEventListener("message", onUciOk);
            this._worker.postMessage("uci");
        });

        return this._initPromise;
    }

    /**
     * Search for the best move(s) from a position.
     *
     * @param {object} options
     * @param {string}  options.fen         - FEN string of the position (required)
     * @param {number} [options.depth]      - Search depth (default: 15)
     * @param {number} [options.movetime]   - Search time in ms (overrides depth when set)
     * @param {number} [options.multiPv=1]  - Number of PV lines to return
     * @param {number} [options.elo]        - Target Elo (enables UCI_LimitStrength automatically)
     * @param {boolean}[options.limitStrength] - Explicitly toggle UCI_LimitStrength
     *
     * @returns {Promise<SearchResult[]>}
     *   Always return array even if multiPv === 1.
     *   SearchResult: { move: string, score: { type: 'cp'|'mate', value: number } }
     */
    async search({ fen, depth, movetime, multiPv = 1, elo, limitStrength }) {
        if (!fen) throw new Error("StockfishEngine.search: fen is required");

        if (!this._ready) await this.init();
        await this._sync();

        return new Promise((resolve) => {
            const pvLines = {};

            const onMessage = (e) => {
                const line = e.data;

                if (typeof line !== "string") return;

                if (line.startsWith("info") && line.includes(" pv ")) {
                    const parsed = _parseInfoLine(line);
                    if (parsed) pvLines[parsed.multipv] = parsed;
                }

                if (line.startsWith("bestmove")) {
                    this._worker.removeEventListener("message", onMessage);

                    const results = Object.values(pvLines)
                        .sort((a, b) => a.multipv - b.multipv)
                        .map(({ move, score }) => ({ move, score }));

                    resolve(multiPv === 1 ? (results ?? null) : results);
                }
            };

            this._worker.addEventListener("message", onMessage);

            this._applyOptions({ multiPv, elo, limitStrength });
            this._worker.postMessage(`position fen ${fen}`);
            this._worker.postMessage(_buildGoCommand({ depth, movetime }));
        });
    }

    /**
     * Stop any running search and terminate the worker.
     */
    destroy() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
            this._ready = false;
            this._initPromise = null;
        }
    }

    // --- private ---

    _applyOptions({ multiPv, elo, limitStrength }) {
        const limitStr = elo !== undefined ? true : (limitStrength ?? false);
        this._worker.postMessage(`setoption name UCI_LimitStrength value ${limitStr}`);

        if (elo !== undefined) {
            this._worker.postMessage(`setoption name UCI_Elo value ${elo}`);
        }

        this._worker.postMessage(`setoption name MultiPV value ${multiPv}`);
        this._worker.postMessage("ucinewgame");
    }

    _sync() {
        return new Promise((resolve) => {
            const onReadyOk = (e) => {
                if (e.data === "readyok") {
                    this._worker.removeEventListener("message", onReadyOk);
                    resolve();
                }
            };
            this._worker.addEventListener("message", onReadyOk);
            this._worker.postMessage("stop");
            this._worker.postMessage("isready");
        });
    }
}

// --- module-level helpers (no state, no side effects) ---

function _parseInfoLine(line) {
    const multipvMatch = line.match(/\bmultipv (\d+)/);
    const multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;

    const cpMatch = line.match(/\bscore cp (-?\d+)/);
    const mateMatch = line.match(/\bscore mate (-?\d+)/);

    let score = null;
    if (cpMatch) {
        score = { type: "cp", value: parseInt(cpMatch[1], 10) };
    } else if (mateMatch) {
        score = { type: "mate", value: parseInt(mateMatch[1], 10) };
    }

    const pvMatch = line.match(/\bpv (\S+)/);
    const move = pvMatch ? pvMatch[1] : null;

    if (!move || !score) return null;

    return { multipv, move, score };
}

function _buildGoCommand({ depth, movetime }) {
    if (movetime !== undefined) return `go movetime ${movetime}`;
    return `go depth ${depth ?? 15}`;
}
