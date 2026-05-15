const THEME = {
    // Page / board
    pageBg:               '#1a1a1a',
    boardBorder:          '#797979ad',
    squareLight:          '#797979ad',
    squareDark:           '#00000000',
    squareSelected:       'rgba(255, 220, 60, 0.40)',
    legalMoveDot:         '#7575757d',
    legalMoveCapture:     'rgba(0, 0, 0, 0.32)',
    squareHover:          'rgba(255, 255, 255, 0.7)',
    pieceShadow:          'rgba(0,0,0,0.6)',

    // Score
    scorePositive:        '#e2f3e4',
    scoreNegative:        '#f87171',
    scoreChips:           '#3b82f6',
    scoreMult:            '#ef4444',
    gold:                 '#ffcd00',

    // UI panels (shared across modals)
    panelBg:              '#1a1a2e',
    panelBorder:          '#3a3a5c',
    panelInnerBg:         '#12122a',
    panelInnerBorder:     '#2e2e50',
    panelDisabledBg:      '#444466',
    panelDisabledHover:   '#555588',
    panelDisabledText:    '#666688',
    cardSelectedBg:       '#1e1e3a',
    cardSelectedGlow:     'rgba(224, 201, 127, 0.35)',

    // Text
    textMuted:            '#aaaacc',
    textSecondary:        '#9090bb',
    textLight:            '#eee',
    // Semantic
    danger:               '#e05555',
    dangerHover:          '#c03838',

    // Primary (purple / joker)
    primary:              '#7c4dff',
    primaryHover:         '#5c35cc',
    primaryLight:         '#b388ff',
    primaryBg:            'rgba(124, 77, 255, 0.15)',
    primaryBorder:        'rgba(124, 77, 255, 0.4)',

    // Rarity
    rarityCommon:         '#aaaaaa',
    rarityUncommon:       '#4caf50',
    rarityUncommonHover:  '#388e3c',
    rarityRare:           '#2196f3',
    rarityLegendary:      '#ff9800',

    // HUD
    hudBg:                '#333',
    hudDark:              '#222',
    hudDarker:            '#111',
    hudSubLabel:          '#7a7aaa',
    hudBlue:              '#00b4ff',
    hudBlueShadow:        '#0044ff',
    hudRedShadow:         '#880101',

    // Piece enhancement effects
    pieceNeon:            '#00ff00',
    pieceBlue:            '#028be7',
    pieceRedA:            '#b7152b',
    pieceRedB:            '#d61731',
    pieceShine:           '#8d8d8d',

    // Pack labels
    packNeon:             '#94ff00',
    packPurple:           '#c6b9da',
    packStroke:           '#ff1414',
};

function applyTheme() {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(THEME)) {
        const cssVar = '--color-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.setProperty(cssVar, value);
    }
}
applyTheme();

const PLAYER = { USER: 'user', CPU: 'cpu', AUTO: 'auto-user' };

const PIECE_NAMES = {
    'P': 'Pawn',
    'R': 'Rook',
    'N': 'Knight',
    'B': 'Bishop',
    'Q': 'Queen',
    'K': 'King'
};

const ALL_ENHANCEMENTS = ['none', 'metal', 'glass', 'gold', 'red', 'blue', 'checkers', 'rock'];
const ALL_EDITIONS     = ['base', 'holo', 'poly', 'shine', 'neon'];
