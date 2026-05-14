    // Canonical scoring step — replaces the old Effect shape throughout the pipeline.
    //
    // kind:
    //   'chips'     → add value to chips (base)
    //   'mult'      → add value to mult
    //   'xmult'     → multiply mult by value
    //   'retrigger' → replay a piece's ON_PIECE_SCORED steps (value = null)
    //   'money'     → grant gold, bypasses chips×mult (value = amount)
    //   'expire'    → mark source for removal after this scoring round (value = null)
    //   'message'   → display-only annotation (value = null)
    //
    // source.type:
    //   'piece'   → the moving piece itself
    //   'joker'   → an active joker instance
    //   'edition' → a joker's edition (holo/poly/shine/neon) — INDEPENDENT phase only

    const EventType = Object.freeze({
        ON_MOVE_PLAYED:      'ON_MOVE_PLAYED',
        ON_PIECE_SCORED:     'ON_PIECE_SCORED',
        ON_PIECE_SCORED_END: 'ON_PIECE_SCORED_END',
        ON_NON_MOVED_PIECE:  'ON_NON_MOVED_PIECE',
        INDEPENDENT:         'INDEPENDENT',
        ON_MOVE_SCORED_END:  'ON_MOVE_SCORED_END',
        ON_GAME_END:         'ON_GAME_END',
    });

    // Ordered pipeline sequence used by ScoringPipeline.build() (per-move pipeline only).
    // ON_GAME_END is handled by ScoringPipeline.buildGameEnd() — separate from move scoring.
    const EVENT_ORDER = [
        EventType.ON_MOVE_PLAYED,
        EventType.ON_PIECE_SCORED,
        EventType.ON_PIECE_SCORED_END,
        EventType.ON_NON_MOVED_PIECE,
        EventType.INDEPENDENT,
        EventType.ON_MOVE_SCORED_END,
    ];

    // Factory — validates event, freezes output.
    function makeScoringStep({ event, kind, value, source }) {
        if (!EventType[event]) throw new Error(`makeScoringStep: unknown event "${event}"`);
        return Object.freeze({
            event,
            kind,
            value: value ?? null,
            source: Object.freeze({ ...source }),
        });
    }
