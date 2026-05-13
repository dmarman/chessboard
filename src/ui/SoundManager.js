    // Gain values per sound key (0.0 – 1.0).
    const SOUND_GAIN = {
        chips_card:    0.2,
        mult:          0.1,
        xmult:         0.2,
        pop:           0.4,
        chips_generic: 0.5,
        chips_accum:   0.1,
        card_focus:    0.6,
        card_deselect: 0.6,
        move_self:     1,
        move_opponent: 1,
        capture:       1,
        castle:        1,
        move_check:    1,
        promote:       1,
        game_end:      1,
    };

    class SoundManager {
        constructor(sounds = {}) {
            // Store src paths; preload one Howl per key to prime the audio buffer.
            this._srcs = {};
            for (const [key, src] of Object.entries(sounds)) {
                this._srcs[key] = src;
                new Howl({ src: [src], preload: true });
            }
        }

        // Each call spawns a new Howl so concurrent plays overlap correctly.
        play(key) {
            const src = this._srcs[key];
            if (src) new Howl({ src: [src], volume: SOUND_GAIN[key] ?? 1.0 }).play();
        }
    }
