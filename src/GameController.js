// Orchestrates a complete chess run: piece setup, move flow, scoring, shop, and tournament progression.
// State machine: idle → playerMove → cpuMove → resolveOutcome → shop → tournamentSelect → idle
class GameController {
    static PLAYER_COLOR = 'w';

    constructor() {
        this._state = 'idle';

        this._wallet = new Wallet();
        this._scoreEngine = new ScoreEngine();
        this._chessboard = new Chessboard();
        this._chessSet = new ChessSet();
        this._chessGame = new ChessGame(this._chessboard);
        this._pngTheme = new PngPieceTheme();
        this._engine = new StockfishEngine();
        this._chessBoardUI = new ChessboardUI('chessboard', {
            orientation: GameController.PLAYER_COLOR,
            renderPiece: piece => this._pngTheme.render(piece)
        });
        this._hudUI = new HudUI('hud');
        this._jokerRegistry = new JokerRegistry();
        this._jokersUI = new JokersUI('jokers', piece => this._pngTheme.render(piece));
        this._animationCoordinator = new AnimationCoordinator(
            this._chessBoardUI, this._hudUI, this._scoreEngine, this._jokersUI
        );
        this._tournamentManager = new TournamentManager(
            { regular: OPPONENT_CONFIG, bossDefs: BOSS_DEFS },
            { getScoreTarget, maxTournament: MAX_TOURNAMENT }
        );
        this._outcomeResolver = new OutcomeResolver(this._tournamentManager, this._scoreEngine);
        this._commandDispatcher = new CommandDispatcher()
            .register('ADD_SCORE', ({ amount }, { scoreEngine }) => {
                scoreEngine.processEffects([{ destination: 'add', operation: 'add', value: amount }]);
            })
            // SCORE_EFFECTS: opponent powers that need base/mult chain scoring (outside animation)
            .register('SCORE_EFFECTS', ({ effects }, { scoreEngine }) => {
                scoreEngine.processEffects(effects);
            });
        this._opponentUI = new OpponentUI(this._hudUI.opponentSlot);
        this._tournamentUI = new TournamentUI();
        this._tournamentUI.mount(document.body);
        this._shopManager = new ShopManager();
        this._shopUI = new ShopUI();
        this._shopUI.mount(document.body);

        this._initChessSet();
        this._wireEvents();
    }

    async start() {
        document.body.style.background = THEME.pageBg;
        this._tournamentManager.start();
        this._shopManager.init();
        await this.resetChessboard();
    }

    async resetChessboard() {
        if (this._state !== 'idle') return;
        this._transitionTo('playerMove');
        this._animationCoordinator.reset();
        this._chessGame.reset();
        this._scoreEngine.reset();

        this._chessSet.shufflePieces();
        this._chessGame.setPiecesFromFen(
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            this._chessSet.getPieces()
        );
        this._chessBoardUI.initBoard(this._chessboard.getState());

        const gameStartCtx = buildPowerContext({
            chessGame: this._chessGame,
            chessboard: this._chessboard,
            scoreEngine: this._scoreEngine,
            playerColor: GameController.PLAYER_COLOR
        });
        const startCommands = this._tournamentManager.triggerPowers('onGameStart', gameStartCtx);
        this._commandDispatcher.execute(startCommands, { scoreEngine: this._scoreEngine, chessGame: this._chessGame });

        console.log(this._chessGame);
        try {
            if (GameController.PLAYER_COLOR === 'b') {
                const results = await this._engine.search({ fen: this._chessGame.fen(), movetime: 100 });
                this._chessGame.move(results[0].move);
            }
        } finally {
            await this._animationCoordinator.done();
            this._transitionTo('idle');
        }
    }

    async randomMove() {
        if (this._state !== 'idle' || this._chessGame.isGameOver()) return;
        this._transitionTo('playerMove');
        try {
            const moves = this._chessGame.moves({ verbose: true });
            const pickedMove = moves[Math.floor(Math.random() * moves.length)];
            this._chessGame.move(pickedMove, PLAYER.USER);

            if (this._chessGame.isGameOver()) return;

            this._transitionTo('cpuMove');
            const results = await this._engine.search({ fen: this._chessGame.fen(), movetime: 100 });
            this._chessGame.move(results[0].move, PLAYER.CPU);
        } finally {
            await this._animationCoordinator.done();
            this._transitionTo('resolveOutcome');
            this._resolveOutcome();
        }
    }

    async autoMove() { // No scoring, intentional
        if (this._state !== 'idle' || this._chessGame.isGameOver()) return;
        this._transitionTo('playerMove');
        try {
            let results = await this._engine.search({ fen: this._chessGame.fen(), movetime: 10 });
            this._chessGame.move(results[0].move, PLAYER.AUTO);

            if (this._chessGame.isGameOver()) return;

            this._transitionTo('cpuMove');
            results = await this._engine.search({ fen: this._chessGame.fen(), movetime: 10 });
            this._chessGame.move(results[0].move, PLAYER.CPU);
        } finally {
            await this._animationCoordinator.done();
            this._transitionTo('resolveOutcome');
            this._resolveOutcome();
        }
    }

    showTournament(activeSlot) {
        this._tournamentUI.show(this._tournamentManager.getTournamentOpponents(activeSlot));
    }

    // --- Private ---

    static _TRANSITIONS = {
        idle:             ['playerMove'],
        playerMove:       ['idle', 'cpuMove', 'resolveOutcome'],
        cpuMove:          ['resolveOutcome'],
        resolveOutcome:   ['idle', 'shop', 'game-over'],
        shop:             ['tournamentSelect'],
        tournamentSelect: ['idle'],
        'game-over':      [],
    };

    _transitionTo(next) {
        const allowed = GameController._TRANSITIONS[this._state];
        if (!allowed) {
            console.warn(`[StateMachine] Unknown state "${this._state}" — cannot transition to "${next}"`);
            this._state = next;
            return;
        }
        if (!allowed.includes(next)) {
            throw new Error(`[StateMachine] Illegal transition: "${this._state}" → "${next}". Allowed: [${allowed.join(', ')}]`);
        }
        this._state = next;
    }

    _resolveOutcome() {
        const outcome = this._outcomeResolver.consume();
        if (!outcome) {
            this._transitionTo('idle');
            return;
        }
        const { reason, tournament, opponent, score, reward } = outcome;
        if (reason === 'loss') {
            console.log(`[GAME RESULT] Loss by checkmate. Tournament: ${tournament}, Opponent: ${opponent}, Score: ${score}.`);
            this._transitionTo('game-over');
            return;
        }
        this._wallet.add(reward);
        this._hudUI.setMoney(this._wallet.balance);
        console.log(`[GAME RESULT] Win by ${reason}. Tournament: ${tournament}, Opponent: ${opponent}, Score: ${score}. Reward: $${reward}. Money: $${this._wallet.balance}`);
        this._transitionTo('shop');
        const slots = this._shopManager.roll();
        this._shopUI.show(slots, this._wallet.balance);
    }

    _initChessSet() {
        for (const type of ['P','P','P','P','P','P','P','P','p','p','p','p','p','p','p','p','r','n','b','q','k','b','n','r','R','N','B','Q','K','B','N','R']) {
            this._chessSet.addPiece(type, {
                //modifiers: randomSubset(ALL_MODIFIERS, 3), // no need to use fisher-yates, test function only
                //style: ALL_STYLES[Math.floor(Math.random() * ALL_STYLES.length)],
            });
        }
    }

    _wireEvents() {
        this._tournamentUI.on('select', id => {
            this._tournamentManager.advanceOpponent();
            this._transitionTo('idle');
            this.resetChessboard();
        });

        this._shopUI.on('buy', jokerId => {
            const def = this._shopManager.buy(jokerId);
            this._wallet.spend(def.price);
            this._hudUI.setMoney(this._wallet.balance);
            this._jokerRegistry.add(jokerId);
            this._shopUI.refresh(this._shopManager.currentSlots(), this._wallet.balance);
        });

        this._shopUI.on('reroll', () => {
            this._wallet.spend(this._shopManager.getRerollCost());
            this._hudUI.setMoney(this._wallet.balance);
            const newSlots = this._shopManager.reroll();
            this._shopUI.refresh(newSlots, this._wallet.balance);
        });

        this._shopUI.on('leave', () => {
            this._shopManager.leave();
            this._shopUI.hide();
            this._transitionTo('tournamentSelect');
            this.showTournament(this._tournamentManager.peekNextOpponent());
        });

        this._jokerRegistry.on('change', jokers => this._jokersUI.render(jokers));

        this._tournamentManager.on('change', opp => {
            this._opponentUI.render(opp);
            this._hudUI.setProgress(
                this._tournamentManager.currentTournament,
                this._tournamentManager.maxTournament,
                this._tournamentManager.currentOpponent
            );
        });

        this._chessGame.on('turn', turn => {
            const { player, moves, primaryMove, isCheckmate } = turn;

            if (player !== PLAYER.USER) {
                // Opponent/engine turn: animate all physical moves (both pieces for castling),
                // then let opponent powers react to the engine's move.
                for (const m of moves) {
                    this._animationCoordinator.enqueue({ ...m, promotion: !!m.promotion }, []);
                }
                const cpuCtx = buildPowerContext({
                    chessGame: this._chessGame,
                    chessboard: this._chessboard,
                    scoreEngine: this._scoreEngine,
                    turn,
                    lastMove: primaryMove,
                    playerColor: GameController.PLAYER_COLOR
                });
                const cpuCommands = this._tournamentManager.triggerPowers('onOpponentMove', cpuCtx);
                this._commandDispatcher.execute(cpuCommands, { scoreEngine: this._scoreEngine, chessGame: this._chessGame });
                // Opponent just moved — if user is now in checkmate, user loses
                this._outcomeResolver.notifyTurn({ isCheckmate, player }, PLAYER.USER);
                return;
            }

            // User turn: build scoring pipeline, fire jokers, trigger opponent powers.
            // Secondary moves (castling rook) animate without scoring.
            const gameCtx = buildPowerContext({
                chessGame: this._chessGame,
                chessboard: this._chessboard,
                scoreEngine: this._scoreEngine,
                turn,
                lastMove: primaryMove,
                playerColor: GameController.PLAYER_COLOR
            });
            const moveCommands = this._tournamentManager.triggerPowers('onMove', gameCtx);

            // Non-scoring joker side effects (MUTATE_PIECE, etc.) execute immediately
            const jokerSideEffects = this._jokerRegistry.collectSideEffects(gameCtx);
            this._commandDispatcher.execute([...jokerSideEffects, ...moveCommands], { scoreEngine: this._scoreEngine, chessGame: this._chessGame });

            // Build ordered ScoringStep[] for the full pipeline and enqueue for animation
            const scoringSteps = ScoringPipeline.build(turn, gameCtx, this._jokerRegistry, this._chessboard.getState());
            this._animationCoordinator.enqueue({ ...primaryMove, promotion: !!primaryMove.promotion }, scoringSteps);
            for (const m of moves.slice(1)) {
                this._animationCoordinator.enqueue({ ...m, promotion: !!m.promotion }, []);
            }
            // User just moved — if CPU is now in checkmate, player won by chess
            this._outcomeResolver.notifyTurn({ isCheckmate, player }, PLAYER.USER);
        });

        this._scoreEngine.on('reset', data => this._hudUI.reset(data));
        this._scoreEngine.on('update', ({ total }) => {
            this._outcomeResolver.notifyScore(total);
        });
        this._scoreEngine.on('money', ({ amount }) => {
            this._wallet.add(amount);
            this._hudUI.setMoney(this._wallet.balance);
        });
    }
}
