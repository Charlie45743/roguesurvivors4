'use strict';
/* Pixel art: every sprite is a string grid, rendered once to an offscreen canvas.
   Most sprites are written as a left half and mirrored to keep them symmetric. */

const PAL = {
  '0': '#0b0a12', '1': '#1c1a2b', '2': '#36304f', '3': '#5e557f', '4': '#a59cc4', '5': '#f2eee6',
  'r': '#7a1a2a', 'R': '#d8354a', 'o': '#e8742c', 'y': '#ffd35a', 'Y': '#fff3b0',
  'g': '#1f4d33', 'G': '#4fa04a', 'l': '#a6e05a',
  'b': '#1d3d7a', 'B': '#3f8ee0', 'c': '#8ff0ff',
  'p': '#4a2470', 'P': '#9a4fd0', 'm': '#e27bf0',
  'k': '#5a3a28', 'K': '#9a6a42', 's': '#e8b48e',
  'w': '#6d6a7c', 'W': '#b5b2c4',
};

function mirror(rows) { return rows.map(r => r + [...r].reverse().join('')); }

function makeSprite(rows, swap) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let ch = rows[j][i];
    if (!ch || ch === '.') continue;
    if (swap && swap[ch]) ch = swap[ch];
    x.fillStyle = PAL[ch] || ch; x.fillRect(i, j, 1, 1);
  }
  return { c, w, h, sil: {} };
}

// Solid-colour silhouette of a sprite (hit flash, freeze tint, elite outline)
function silhouette(spr, color) {
  if (spr.sil[color]) return spr.sil[color];
  const c = document.createElement('canvas'); c.width = spr.w; c.height = spr.h;
  const x = c.getContext('2d');
  x.drawImage(spr.c, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color; x.fillRect(0, 0, spr.w, spr.h);
  return (spr.sil[color] = c);
}

/* ---------- Hero ---------- */
const HERO_HALF = [
  '......00',
  '....00PP',
  '...0PPPP',
  '..0PPPp1',
  '..0PPp11',
  '..0Pp1c1',
  '..0Pp111',
  '...0pp11',
  '..0pPPpp',
  '.0pPPPpy',
  '.0pPPPPp',
  '..0pPPPp',
  '..0pPPPP',
  '...0pppp',
];
const HERO_LEGS = [
  ['....0k0.', '....000.'],
  ['...0k0..', '...000..'],
  ['.....0k0', '.....000'],
];
function heroFrames(swap) {
  return [0, 1, 0, 2].map(i => makeSprite(mirror(HERO_HALF.concat(HERO_LEGS[i])), swap));
}

/* ---------- Enemies ---------- */
const SPR = {};
SPR.bat = [
  makeSprite(mirror(['0.....', '00....', '020.00', '.02203', '..02R3', '...033', '....00'])),
  makeSprite(mirror(['....00', '..0003', '.02203', '0220R3', '020.03', '00...0'])),
];
SPR.slime = [
  makeSprite(mirror(['....00', '..00GG', '.0GG5G', '.0G5GG', '0GGG0G', '0GGGGG', '0gGGGG', '0ggGGG', '.00000'])),
  makeSprite(mirror(['......', '....00', '..00GG', '.0GG5G', '0GG0GG', '0GGGGG', '0gggGG', '000000'])),
];
const SKEL_TOP = ['....00', '...055', '..0555', '..0R05', '..0555', '...050', '....05', '..0W55', '.0W050', '.0W055', '..0050', '...055'];
SPR.skel = [
  makeSprite(mirror(SKEL_TOP.concat(['...050', '...050', '...00.']))),
  makeSprite(mirror(SKEL_TOP.concat(['..050.', '..050.', '..00..']))),
];
const GHOUL_TOP = ['....000', '...0lll', '..0llll', '..0lR0l', '..0llll', '...0l00', '..0kkkk', '.0lkKKk', '.0l0kKk', '.0l0kkk', '..00kkk', '...0kk0'];
SPR.ghoul = [
  makeSprite(mirror(GHOUL_TOP.concat(['...0g0.', '...00..']))),
  makeSprite(mirror(GHOUL_TOP.concat(['..0g0..', '..00...']))),
];
SPR.eye = [
  makeSprite(mirror(['....00', '..00WW', '.0W555', '.0555B', '05555B', '0555Bb', '0555Bb', '05555B', '.0555r', '.0W555', '..00WW', '....00'])),
  makeSprite(mirror(['......', '....00', '..00WW', '.0W555', '05555B', '0555Bb', '0555Bb', '05555B', '.0W555', '..00WW', '....00', '......'])),
];
const WRAITH_TOP = ['....00', '..0044', '.04444', '.040c4', '.04444', '.04434', '043444', '044344', '043443'];
SPR.wraith = [
  makeSprite(mirror(WRAITH_TOP.concat(['04.434', '0..04.', '....0.']))),
  makeSprite(mirror(WRAITH_TOP.concat(['.04.43', '.0..04', '.....0']))),
];
const KNIGHT = ['......0R', '......0R', '....00RR', '...0WWWW', '..0WWWWW', '..0W0000', '..0W0y00', '..0WWWWW', '...0wwww', '.0WW0WWW', '0WWW0WRW', '0WwW0WRR', '0WwW0WWW', '.00.0www', '....0ww0'];
SPR.knight = [
  makeSprite(mirror(KNIGHT.concat(['....0w0.', '....000.']))),
  makeSprite(mirror(KNIGHT.concat(['...0w0..', '...000..']))),
];
const BOSS_ROWS = [
  '..0.........', '.0W0........', '.0WW0.......', '..0WW0..0000', '...0WW00rrrr', '....00rrrRRR',
  '....0rrRRRRR', '...0rrRRRRRR', '...0rRR000RR', '...0rRR0yy0R', '...0rRRR00RR', '..0rrRRRRRRR',
  '..0rRRR00000', '..0rRR0oyyyy', '..0rRR0oyYYY', '..0rRRR0oooo', '.0rrrRRR0000', '0rr0rrRRRRRR',
  '0r0.0rrRRRRR', '00..0rrrrRRR',
];
function bossFrames(swap) {
  return [
    makeSprite(mirror(BOSS_ROWS.concat(['....0rrr0rrr', '....0rr00rrr', '...0rrr0.0rr', '...00000.000'])), swap),
    makeSprite(mirror(BOSS_ROWS.concat(['...0rrr00rrr', '...0rr0.0rrr', '..0rrr0..0rr', '..00000..000'])), swap),
  ];
}

/* ---------- Pickups & props ---------- */
const GEM_HALF = ['..0', '.0c', '0cB', '0BB', '0Bb', '.0b', '..0'];
SPR.gem = [
  makeSprite(mirror(GEM_HALF)),
  makeSprite(mirror(GEM_HALF), { c: 'l', B: 'G', b: 'g' }),
  makeSprite(mirror(GEM_HALF), { c: 'Y', B: 'R', b: 'r' }),
];
SPR.heart = makeSprite(mirror(['.00.', '0RR0', '0R5R', '0RRR', '.0RR', '..0R', '...0']));
SPR.coin = makeSprite(['.0000.', '0yyYy0', '0yYyy0', '0yyyy0', '0kyyk0', '.0000.']);
SPR.bag = makeSprite(mirror(['..00', '.0kK', '..0y', '.0KK', '0KKy', '0KyY', '0KKK', '.000']));
SPR.magnet = makeSprite(['..0000..', '.0RRRR0.', '0RR00RR0', '0R0..0R0', '0R0..0R0', '0W0..0W0', '050..050', '000..000']);
SPR.bomb = makeSprite(['.....0y.', '....0k0.', '..0000..', '.022220.', '02422220', '02222220', '.022220.', '..0000..']);
SPR.chest = makeSprite(mirror(['..0000', '.0KKKK', '0KkkkK', '0kKKKK', '0kkkkk', '000000', '0kKK0y', '0kKKKK', '0kkkkk', '000000']));
SPR.brazier = makeSprite(['00000000', '0kKKKKk0', '.0kKKk0.', '..0kk0..', '..0kk0..', '.0kKKk0.', '00000000']);
SPR.flask = makeSprite(['.00.', '.0k0', '0oo0', '0yo0', '.00.']);
SPR.glaive = makeSprite(['..0000..', '.0WW550.', '0W50000.', '0W0.....', '0W0.....', '0W50000.', '.0WW550.', '..0000..']);
SPR.glaiveEvo = makeSprite(['..0000..', '.0yyYY0.', '0yY0000.', '0y0.....', '0y0.....', '0yY0000.', '.0yyYY0.', '..0000..']);

/* ---------- Ground decor ---------- */
const DECOR = {
  tuft: makeSprite(['.g.g.', 'gGgGg']),
  tuft2: makeSprite(['g..g', '.gg.', 'gGgG']),
  flower: makeSprite(['.y.', 'yoy', '.g.']),
  flower2: makeSprite(['.m.', 'mPm', '.g.']),
  bones: makeSprite(['5...55', '055550', '.5....']),
  stone: makeSprite(['.000.', '02330', '02220', '.000.']),
  mush: makeSprite(['.RRR.', 'R5RRR', '.0W0.', '..W..']),
  grave: makeSprite(['..0000..', '.033330.', '03344330', '03333330', '03300330', '03333330', '03333330', '02222220', '00000000']),
  candle: makeSprite(['.y.', '.o.', '050', '050', '000']),
};

/* ---------- Icons (10x10) ---------- */
const ICON_ROWS = {
  bolt: ['......00..', '....00yy0.', '...0yYYy0.', '..0oyYYy0.', '.0oooyy0..', '0roooo0...', '0rro00....', '.00.......'],
  scythe: ['...00000..', '..0WWWW50.', '.0W000WW0.', '.00..0kW0.', '....0k00..', '...0k0....', '..0k0.....', '.0k0......', '0k0.......', '00........'],
  wisps: ['..00......', '.0cc0.....', '0c5cc0....', '0cccc0....', '.0cc0.00..', '..00.0PP0.', '....0P5PP0', '....0PPPP0', '.....0PP0.', '......00..'],
  nova: ['...0000...', '..0mmmm0..', '.0m0000m0.', '0m0....0m0', '0m0.PP.0m0', '0m0.PP.0m0', '0m0....0m0', '.0m0000m0.', '..0mmmm0..', '...0000...'],
  chain: ['....000...', '...0yY0...', '..0yY0....', '.0yY0000..', '0yYYYYy0..', '..00yY0...', '...0yY0...', '..0yY0....', '..0Y0.....', '..00......'],
  frost: ['....00....', '...0c50...', '...0cB0...', '0000cB0000', '0c5cBBcBB0', '0BBcBBc5c0', '0000Bc0000', '...0Bc0...', '...05c0...', '....00....'],
  glaive: ['...0000...', '..0WW550..', '.0W5000...', '0W50......', '0W50......', '0W50......', '0W50......', '.0W5000...', '..0WW550..', '...0000...'],
  cinder: ['...0000...', '....0k0...', '...0WW0...', '...0WW0...', '..0WooW0..', '.0WoyyoW0.', '0WoyYYyoW0', '0WooyyooW0', '.0WooooW0.', '..000000..'],
  might: ['....0.....', '...0R0....', '...0RR0...', '..0RoR0.0.', '..0RooR0R0', '.0RoyyoRR0', '.0RoyYyoR0', '.0RoyYyoR0', '..0RooooR0', '...000000.'],
  haste: ['.00000000.', '0bBBBBBBb0', '0bB0000Bb0', '0bB0yy0Bb0', '0bB0y00Bb0', '0bB0000Bb0', '0bBBBBBBb0', '0bBBBBBBb0', '0555555550', '.00000000.'],
  area: ['..0000....', '.0cccc0...', '0c5ccBc0..', '0c5cBBc0..', '0cBBBBc0..', '0cBBBBc0..', '.0cccc00..', '..0000k0..', '......0k0.', '.......00.'],
  amount: ['..........', '.00...00..', '0PP0.0PP0.', '0P5P00P5P0', '0PPP00PPP0', '.0PP0.0PP0', '..00...00.', '....00....', '...0mm0...', '....00....'],
  duration: ['0000000000', '0kkkkkkkk0', '.0yyyyyy0.', '..0yyyy0..', '...0yy0...', '...0yy0...', '..01yy10..', '.0yyyyyy0.', '0kkkkkkkk0', '0000000000'],
  speed: ['..00000...', '..0KKK0...', '..0KKK0...', '..0KKK0...', '..0KKK00..', '..0KKKKK0.', '0W0KKKKKK0', '0WW0kkkkk0', '.00000000.', '..........'],
  vitality: ['.00..00...', '0RR00RR0..', '0R5RRRR0..', '0RRRRRR0..', '.0RRRR0...', '..0RR0....', '...00.....'],
  magnet: ['..0000..', '.0RRRR0.', '0RR00RR0', '0R0..0R0', '0R0..0R0', '0W0..0W0', '050..050', '000..000'],
  growth: ['..........', '0...00...0', '00.0yy0.00', '0y00yy00y0', '0yy0yy0yy0', '0yyyyyyyy0', '0yRyyByRy0', '0yyyyyyyy0', '0000000000'],
  armor: ['0000000000', '0WWWWWWWW0', '0W5WWWWwW0', '0W5WRRWwW0', '0WWWRRWwW0', '.0WWWWww0.', '.0WWWWww0.', '..0WWww0..', '...0ww0...', '....00....'],
  skull: ['.0000.', '055550', '0R55R0', '055550', '.0505.', '.0000.'],
  gold: ['.0000.', '0yyYy0', '0yYyy0', '0yyyy0', '0kyyk0', '.0000.'],
  heal: ['..00..', '.0RR0.', '0RRRR0', '0RRRR0', '.0RR0.', '..00..'],
};
const ICON = {};
const ICON_URL = {};
for (const k in ICON_ROWS) {
  ICON[k] = makeSprite(ICON_ROWS[k]);
  ICON_URL[k] = ICON[k].c.toDataURL();
}
function spriteURL(spr) { return spr.c.toDataURL(); }

/* ---------- Light & glow textures ---------- */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// Posterised, dithered radial light: reads as pixel-art lighting when scaled up
const LIGHT = (() => {
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S), STEPS = 6;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const d = Math.hypot(i - S / 2 + 0.5, j - S / 2 + 0.5) / (S / 2);
    let a = Math.max(0, 1 - d); a = a * a * (3 - 2 * a);
    const q = Math.min(1, Math.floor(a * STEPS + BAYER[(j % 4) * 4 + (i % 4)] / 16) / STEPS);
    const o = (j * S + i) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = q * 255;
  }
  x.putImageData(img, 0, 0);
  return c;
})();
const glowCache = {};
function glow(color) {
  if (glowCache[color]) return glowCache[color];
  const S = 32, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return (glowCache[color] = c);
}

/* ---------- 3x5 bitmap font for in-world numbers ---------- */
const GLYPHS = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111',
  'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111', 'J': '001001001101010',
  'K': '101101110101101', 'L': '100100100100111', 'M': '101111111101101', 'N': '110101101101101', 'O': '010101101101010',
  'P': '110101110100100', 'Q': '010101101110011', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010',
  'U': '101101101101111', 'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101', 'Y': '101101010010010',
  'Z': '111001010100111', '!': '010010010000010', '+': '000010111010000', '-': '000000111000000', '.': '000000000000010',
  ':': '000010000010000', ' ': '000000000000000', '/': '001001010100100', '%': '101001010100101',
};
const FONT_CHARS = Object.keys(GLYPHS);
const fontCache = {};
// Atlas: each glyph is 5x7 (3x5 plus a 1px dark outline)
function fontAtlas(color) {
  if (fontCache[color]) return fontCache[color];
  const c = document.createElement('canvas'); c.width = FONT_CHARS.length * 5; c.height = 7;
  const x = c.getContext('2d');
  FONT_CHARS.forEach((ch, n) => {
    const g = GLYPHS[ch], ox = n * 5;
    x.fillStyle = '#0b0a12';
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1')
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) x.fillRect(ox + 1 + i + dx, 1 + j + dy, 1, 1);
    x.fillStyle = color;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') x.fillRect(ox + 1 + i, 1 + j, 1, 1);
  });
  return (fontCache[color] = c);
}
function drawText(ctx, str, x, y, color, scale = 1) {
  str = String(str).toUpperCase();
  const atlas = fontAtlas(color), adv = 4 * scale;
  let cx = Math.round(x - (str.length * adv) / 2);
  const cy = Math.round(y - 3.5 * scale);
  for (const ch of str) {
    const n = FONT_CHARS.indexOf(ch);
    if (n >= 0) ctx.drawImage(atlas, n * 5, 0, 5, 7, cx, cy, 5 * scale, 7 * scale);
    cx += adv;
  }
}

/* ---------- Characters: each wanderer has their own silhouette ----------
   Bodies are mirrored halves (8 wide) padded to 20 wide, then asymmetric props are patched on. */
const LEGS_HALF = [['....0L0.', '....000.'], ['...0L0..', '...000..'], ['.....0L0', '.....000']];
function patch(rows, list) {
  const g = rows.map(r => r.split(''));
  for (const [x, y, str] of list) for (let i = 0; i < str.length; i++) if (str[i] !== ' ' && g[y]) g[y][x + i] = str[i];
  return g.map(r => r.join(''));
}
const column = (x, y0, y1, ch) => Array.from({ length: y1 - y0 + 1 }, (_, i) => [x, y0 + i, ch]);
const CHAR_ART = {
  wren: { half: HERO_HALF, swap: { P: 'o', p: 'r', c: 'y' }, leg: 'k',
    patch: [[17, 6, 'o'], [16, 7, 'oyo'], [16, 8, 'yYy'], [17, 9, 'o']] },
  morrow: { leg: 'k', half: ['......00', '.....022', '.....022', '.0000000', '...0ssss', '...0s0ss', '...0sWWW', '....0WWW',
    '..0ww0WW', '.0wwww0W', '.0wWwww0', '.0wWwwwy', '.0wwwwww', '..0wwwww'],
    patch: [[1, 9, '0'], [0, 10, '0y0'], [0, 11, '0Y0'], [0, 12, '000']] },
  isolde: { leg: 'b', half: ['........', '......00', '.....055', '....0555', '...055cc', '...05sss', '...05s0s', '..055sss',
    '..05bbBB', '.055bBBc', '.05bbBBB', '..0bbBBB', '..0bBBBB', '..0bbbbb'],
    patch: [[16, 0, '.0.'], [16, 1, '0c0'], [16, 2, '0c0'], [16, 3, '.0.'], ...column(17, 4, 15, 'k')] },
  pell: { leg: 'w', half: ['......00', '.....0kk', '....0kkk', '..000000', '...0WWWW', '...0W0y0', '...0WWWW', '....0WWW',
    '..0kKkkk', '.0kKkkkk', '.0kKkkKk', '.0kKkkkk', '.0kkkkkk', '..0kkkkk'],
    patch: [[10, 7, 'WWW0'], [11, 8, '0WW0'], [12, 9, '00'], [2, 10, '0'], [1, 11, '0o0'], [1, 12, '0y0'], [1, 13, '000']] },
  nyx: { leg: 'W', half: ['......00', '....00WW', '...0W555', '..0W5bbb', '..0W5bcb', '..0W5bbb', '...0W555', '..0BBW55',
    '.0BBBBcc', '.0BbBBBc', '.0BbBBBB', '..0bBBBB', '..0bbBBB', '...0bbbb'],
    patch: [[16, 2, '.0.'], [16, 3, '0c0'], [16, 4, '0B0'], [16, 5, '.0.']] },
  brask: { leg: 'w', half: ['.0......', '.0W0....', '..0W0000', '...0WWWW', '..0WWWWW', '..0W0000', '..0W0y00', '..0WWWWW',
    '.0ww0WWW', '0WWW0wWW', '0WWW0wRR', '.0000wRR', '....0wRR', '....0www'] },
  sable: { leg: 'p', half: ['.......0', '......0p', '......0P', '.....0pP', '....0mmm', '..000000', '...0ssss', '...0smss',
    '...0Psss', '..0pPpPP', '.0pPPPmm', '.0pPPPPm', '..0pPPPP', '..0ppppp'],
    patch: [[0, 8, '.m.'], [0, 9, 'm5m'], [0, 10, '.m.']] },
  vesper: { leg: 'p', half: ['......00', '....00PP', '...0PPPP', '..0PP555', '..0P5555', '..0P50m5', '..0P5555', '..0PP555',
    '..0pPPP5', '.0pPPPPP', '.0ppPPPP', '0pp0pPPP', '0p0.0pPP', '00..0ppP'],
    legs: [['....0p0.', '.....0..'], ['...0p0..', '....0...'], ['.....0p0', '......0.']] },
};
// A real stride: legs are drawn full-width (not mirrored) so one foot lifts while the other plants.
// Frames: both planted, left foot up, both planted, right foot up.
const STRIDE = [
  ['....0L0..0L0....', '....000..000....'],
  ['....000..0L0....', '.........000....'],
  ['....0L0..0L0....', '....000..000....'],
  ['....0L0..000....', '....000.........'],
];
function legRows(i, leg) { return STRIDE[i].map(r => r.replace(/L/g, leg || 'k')); }
function strideFrames(art) {
  return [0, 1, 2, 3].map(i => {
    let rows = art.legs
      ? mirror(art.half.concat(art.legs[[0, 1, 0, 2][i]])) // floating figures (Vesper) drift instead of stepping
      : mirror(art.half).concat(legRows(i, art.leg));
    rows = rows.map(r => '..' + r + '..');
    if (art.patch) rows = patch(rows, art.patch);
    return makeSprite(rows, art.swap);
  });
}
function charFrames(id) { return strideFrames(CHAR_ART[id] || CHAR_ART.wren); }

/* ---------- New icons ---------- */
Object.assign(ICON_ROWS, {
  starfall: ['0.........', '.0o.......', '..0oo.....', '...0yo00..', '....0yYy0.', '....0YYYy0', '....0yYYy0', '.....0yy0.', '......00..'],
  lance: ['........00', '.......050', '......050.', '.....050..', '....050...', '...050....', '..0W0.....', '.0WW0.....', '0WW0......', '000.......'],
  aura: ['..0g00g0..', '.0GGllGG0.', '0G0....0G0', 'gl0....0lg', '0G0....0G0', '0G0....0G0', 'gl0....0lg', '0G0....0G0', '.0GGllGG0.', '..0g00g0..'],
  totem: ['...0000...', '..0wWWw0..', '..0w00w0..', '..0woyw0..', '..0w00w0..', '..0wWWw0..', '..0wwww0..', '..0wWWw0..', '.0wwwwww0.', '.00000000.'],
  luck: ['0000000000', '0555555550', '0505555050', '0555555550', '0555055550', '0555555550', '0505555050', '0555555550', '0444444440', '0000000000'],
  blood: ['....00....', '...0RR0...', '...0RR0...', '..0RRRR0..', '..0R5RR0..', '.0R5RRRR0.', '.0RRRRRr0.', '.0RRRRrr0.', '..0rrrr0..', '...0000...'],
  thorns: ['g..0000..g', '.g0WWWW0g.', '0gWWWWWWg0', '0WgWWWWgW0', '0WWgWWgWW0', '.0WWggWW0.', '.0WWgWWW0.', '..0gWWg0..', '...0WW0...', '....00....'],
  midas: ['...0RR0...', '..0yRRy0..', '.0y0000y0.', '0y0....0y0', '0Y0....0y0', '0y0....0y0', '0y0....0y0', '.0y0000y0.', '..0yyyy0..', '...0000...'],
  star: ['....00....', '...0yy0...', '...0yy0...', '0000yY0000', '0yyyYYyyy0', '.0yyYYyy0.', '..0yyyy0..', '.0yy00yy0.', '.0y0..0y0.', '.00....00.'],
  rune: ['...0000...', '..0PPPP0..', '.0PmmmmP0.', '0Pm5mm5mP0', '0Pmm55mmP0', '0Pmm55mmP0', '0Pm5mm5mP0', '.0PmmmmP0.', '..0PPPP0..', '...0000...'],
});
for (const k in ICON_ROWS) if (!ICON[k]) { ICON[k] = makeSprite(ICON_ROWS[k]); ICON_URL[k] = ICON[k].c.toDataURL(); }

/* ---------- Shrine, totem, buff orbs ---------- */
SPR.shrine = makeSprite(mirror(['..000000', '.0333333', '.0344444', '..022222', '...03333', '...03P33', '...03333', '...03m33', '...03333', '..033333', '.0222222', '00000000']));
SPR.crystal = makeSprite(mirror(['...0', '..0m', '.0mP', '0m5P', '0mPP', '0mPp', '.0Pp', '..0p', '...0']));
SPR.totem = makeSprite(mirror(['..00', '.0wW', '0wWW', '0w0y', '0wWW', '0www', '0wWW', '0www', '.0ww', '0www', '0000']));
const ORB = mirror(['..00', '.0XX', '0X5X', '0XXX', '0XXX', '.0xX', '..00']);
SPR.buff = {
  rage: makeSprite(ORB, { X: 'R', x: 'r' }),
  frenzy: makeSprite(ORB, { X: 'y', x: 'o' }),
  aegis: makeSprite(ORB, { X: 'B', x: 'b' }),
  timestop: makeSprite(ORB, { X: 'c', x: 'B' }),
};

/* ---------- Terrain props ---------- */
DECOR.tree = makeSprite(mirror(['......00', '.....0gg', '....0gGl', '....0gGG', '...0gGGg', '....0ggG', '...0gGGl', '..0gGGGG',
  '...0gggG', '..0gGGGl', '.0gGGGGG', '0gGGGGgg', '0ggggggg', '.0000ggg', '....0000', '......0k', '......0K', '......0K', '.....0kK', '....00kk']));
DECOR.deadtree = makeSprite(['..0.....0...', '..02...03...', '...02.03..0.', '....023..03.', '..0..03.03..', '..30.0332...', '...0302.0...',
  '.....030....', '.....020....', '.....030....', '....03320...', '...0220220..']);
DECOR.rock = makeSprite(mirror(['..000', '.0333', '03G43', '03333', '02333', '.0222', '..000']));
DECOR.obsidian = makeSprite(mirror(['..000', '.0222', '02P12', '02222', '01222', '.0111', '..000']));
DECOR.pillar = makeSprite(patch(mirror(['0000', '0444', '0343', '0343', '0343', '0343', '0343', '0343', '0343', '0343', '0343', '0444', '0000']),
  [[4, 0, '....'], [5, 1, '...'], [6, 2, '..']]));
DECOR.ashpile = makeSprite(['..www..', '.wWWWw.', 'wwwwwww']);
DECOR.reeds = makeSprite(['.G..G', 'G.Gl.', 'lGgG.', '.gGg.', '..g.g', '..g..']);
DECOR.glowmush = makeSprite(['.ccc.', 'c5ccc', '.0W0.', '..W..']);
DECOR.vent = makeSprite(['0..0..0', '.0r0r0.', '..0o0..']);
DECOR.cobble = (() => {
  const c = document.createElement('canvas'); c.width = 30; c.height = 18;
  const x = c.getContext('2d'), r = (() => { let a = 5; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (let j = 0; j < 18; j += 6) for (let i = -(j % 12 ? 4 : 0); i < 30; i += 8) {
    if (r() < 0.18) continue;
    x.fillStyle = '#121118'; x.fillRect(i, j, 8, 6);
    x.fillStyle = r() < 0.5 ? '#2a2738' : '#25222f'; x.fillRect(i + 1, j + 1, 6, 4);
    x.fillStyle = '#34304a'; x.fillRect(i + 1, j + 1, 6, 1);
  }
  return { c, w: 30, h: 18, sil: {} };
})();

/* ---------- Crypt entrance ---------- */
SPR.crypt = makeSprite(mirror(['.....00000', '...0033333', '..03344444', '.033400000', '.034011111', '0340111111', '0340111111',
  '0340111111', '0330111111', '0340111111', '0340111111', '03401111rr', '0340111rro', '0222222222', '0000000000']));
