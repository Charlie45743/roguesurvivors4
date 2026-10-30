'use strict';
/* Procedural animation for heroes and creatures, the pixel-shatter death, and the art for
   new creatures, NPCs, bosses and buildings. Loaded right after game.js (it uses its helpers). */

/* ---------- Animation helpers ---------- */
// Draw a horizontal band of a sprite, optionally mirrored, at screen position (x, y) of the sprite's top-left
function band(img, w, sy, sh, x, y, flip, sw = w, sx = 0) {
  if (sh <= 0) return;
  if (flip) {
    ctx.save(); ctx.translate(x + w, y + sy); ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, sh * (w / sw));
    ctx.restore();
  } else ctx.drawImage(img, sx, sy, sw, sh, x, y + sy, w, sh * (w / sw));
}

const HERO_FLAIR = {
  wren: { c: '#e8742c', light: 22 }, morrow: { c: '#ffd35a', light: 26 }, isolde: { c: '#8ff0ff', light: 18 },
  pell: { c: '#a6e05a', light: 0 }, nyx: { c: '#c9f7ff', light: 14 }, brask: { c: '#b5b2c4', light: 0 },
  sable: { c: '#e27bf0', light: 18 }, vesper: { c: '#e27bf0', light: 20 },
};

// Heroes: a four-step stride (each foot lifts in turn) with the body rising as a foot lifts;
// a slow breathing bob when idle; a flinch when hurt; each wanderer trails their own motes of light
function animateHero(p, now) {
  const step = Math.floor(p.anim) % 4;
  const f = p.moving ? p.frames[step] : p.frames[0];
  const bob = p.moving ? (step % 2 ? -1 : 0) : (Math.floor(now * 1.25) % 2 ? -1 : 0);
  const flinch = p.hurtT > 0 ? Math.round(-p.face * p.hurtT * 8) : 0;
  const flip = p.face < 0;
  shadow(p.x, p.y + 8, p.moving && step % 2 ? 9 : 10);
  if (p.moving && step % 2 && p.stepDust !== step + Math.floor(p.anim / 4) * 4) {
    p.stepDust = step + Math.floor(p.anim / 4) * 4;
    addPart(p.x + (step === 1 ? 3 : -3), p.y + 8, rand(-10, 10), rand(-8, -2), 0.3, '#36304f');
  }
  const x = Math.round(p.x - camX - f.w / 2) + flinch, y = Math.round(p.y - camY - f.h / 2) + bob;
  if (flip) { ctx.save(); ctx.translate(x + f.w, y); ctx.scale(-1, 1); ctx.drawImage(f.c, 0, 0); ctx.restore(); }
  else ctx.drawImage(f.c, x, y);
  if (p.hurtT > 0) {
    ctx.globalAlpha = p.hurtT * 3;
    if (flip) { ctx.save(); ctx.translate(x + f.w, y); ctx.scale(-1, 1); ctx.drawImage(silhouette(f, '#ffffff'), 0, 0); ctx.restore(); }
    else ctx.drawImage(silhouette(f, '#ffffff'), x, y);
    ctx.globalAlpha = 1;
  }
  const fl = HERO_FLAIR[p.ch.id];
  if (fl) {
    if (Math.random() < (p.moving ? 0.35 : 0.12)) addPart(p.x + rand(-5, 5), p.y + rand(-4, 6), rand(-6, 6) - p.ax * 10, rand(-18, -6), rand(0.4, 0.8), fl.c);
    if (fl.light) { light(p.x, p.y - 2, fl.light, 0.5); glowAt(p.x, p.y, 10, fl.c, 0.18); }
  }
}

// A fallen co-op partner lies on their side, flickering
function drawFallen(p, now) {
  const f = p.frames[0];
  shadow(p.x, p.y + 6, 14);
  ctx.save();
  ctx.translate(Math.round(p.x - camX), Math.round(p.y - camY + 4));
  ctx.rotate(Math.PI / 2 * p.face);
  ctx.globalAlpha = 0.55 + Math.sin(now * 5) * 0.2;
  ctx.drawImage(f.c, -f.w / 2, -f.h / 2);
  ctx.restore();
  ctx.globalAlpha = 1;
}

const WALKERS = new Set(['skel', 'ghoul', 'knight', 'bandit', 'archer', 'chief', 'golem', 'wolf', 'hound', 'crawler', 'miner', 'imp', 'villager', 'brute']);
// Creatures: rise out of the ground when they spawn; slimes squash; eyes track you and blink;
// wraiths flicker with afterimages; walkers step and sway; anything hit squashes for a beat
function animateEnemy(e, fr, w, h, bob, flip, now) {
  const x = Math.round(e.x - camX - w / 2), y = Math.round(e.y - camY - h / 2) + bob;
  const rising = e.rise > 0;
  if (rising) {
    const k = 1 - e.rise / 0.35, ground = y + h;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 4, y - h, w + 8, h * 2); ctx.clip();
    ctx.beginPath(); ctx.rect(x - 4, y - h, w + 8, ground - (y - h)); ctx.clip();
    if (Math.random() < 0.5) addPart(e.x + rand(-w / 2, w / 2), e.y + h / 2, rand(-20, 20), rand(-30, -10), 0.4, '#36304f');
    drawScaled(fr, x, y + Math.round((1 - k) * h), w, h, flip, 1, 1);
    ctx.restore();
    return;
  }
  let sx = 1, sy = 1;
  if (e.flash > 0) { sx = 1.12; sy = 0.88; }
  const t = e.type;
  if (t === 'slime' || t === 'magmaslime') { const s = Math.sin(e.anim * 7 + e.id); sx *= 1 + 0.13 * s; sy *= 1 - 0.13 * s; }
  if (t === 'wraith' || t === 'stalker') {
    ctx.globalAlpha = 0.25;
    drawScaled(fr, x - (e.dir || 1) * 3, y + 1, w, h, flip, sx, sy);
    ctx.globalAlpha = 0.72 + Math.sin(now * 13 + e.id) * 0.18;
    drawScaled(fr, x, y, w, h, flip, sx, sy);
    ctx.globalAlpha = 1;
    return;
  }
  // walkers rise a pixel on every other step, in time with their two-frame leg cycle
  const lift = WALKERS.has(t) && Math.floor(e.anim / (e.d.anim || 0.25) + 0.5) % 2 ? Math.round(e.scale || 1) : 0;
  drawScaled(fr, x, y - lift, w, h, flip, sx, sy);
  if (t === 'eye' || t === 'swarmeye') {
    const blink = (Math.floor(now * 1.3 + e.id * 0.37) % 6 === 0) && (now * 1.3 + e.id * 0.37) % 1 < 0.15;
    const tp = nearestPlayer(e.x, e.y), a = Math.atan2(tp.y - e.y, tp.x - e.x);
    const cx = Math.round(e.x - camX + Math.cos(a) * 1.6 * (e.scale || 1)), cy = Math.round(e.y - camY + bob + Math.sin(a) * 1.2 * (e.scale || 1));
    if (blink) { ctx.fillStyle = '#a59cc4'; ctx.fillRect(x + 1, Math.round(y + h / 2) - 1, w - 2, 2); }
    else { ctx.fillStyle = '#0b0a12'; ctx.fillRect(cx - 1, cy - 1, 2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1, cy - 1, 1, 1); }
  }
}
function drawScaled(fr, x, y, w, h, flip, sx, sy) {
  const dw = Math.round(w * sx), dh = Math.round(h * sy);
  const dx = x + Math.round((w - dw) / 2), dy = y + (h - dh);
  if (flip) { ctx.save(); ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(fr.c, 0, 0, dw, dh); ctx.restore(); }
  else ctx.drawImage(fr.c, dx, dy, dw, dh);
}

// Shatter a sprite into its own coloured pixels
function spritePixels(spr) {
  if (spr.pix) return spr.pix;
  const d = spr.c.getContext('2d').getImageData(0, 0, spr.w, spr.h).data, out = [];
  for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) {
    const o = (j * spr.w + i) * 4;
    if (d[o + 3] > 0 && (d[o] + d[o + 1] + d[o + 2]) > 60) out.push([i, j, `rgb(${d[o]},${d[o + 1]},${d[o + 2]})`]);
  }
  return (spr.pix = out);
}
function disintegrate(ent, spr, scale = 1) {
  if (!spr || !G) return;
  const px = spritePixels(spr);
  if (!px.length) return;
  const n = Math.min(px.length, ent.boss ? 160 : ent.elite ? 50 : ent.isPlayer ? 80 : 14);
  for (let i = 0; i < n; i++) {
    const [ix, iy, c] = px[(Math.random() * px.length) | 0];
    const wx = ent.x - spr.w * scale / 2 + ix * scale, wy = ent.y - spr.h * scale / 2 + iy * scale;
    addPart(wx, wy, (wx - ent.x) * rand(1, 4), rand(-50, -10) + (wy - ent.y) * 2, rand(0.4, 0.9), c, scale > 1.5 ? 2 : 1, 90, 2.5);
  }
}

/* ---------- Creatures ---------- */
const SX = (rows, swap) => makeSprite(rows, swap);
const MX = (rows, swap) => makeSprite(mirror(rows), swap);
const WOLF_TOP = ['...........0.0..', '..........0W0W0.', '0........0WWWWc0', 'W00000000WWWWW00', '0WWWWWWWWWWWW0..', '.0WWWWWWWWWWW0..', '..0W00000W0W0...'];
SPR.wolf = [SX(WOLF_TOP.concat(['..0W0...0W0W0...', '..00....00.00...'])), SX(WOLF_TOP.concat(['.0W0.....0W0W0..', '.00......00.00..']))];
SPR.hound = SPR.wolf.map(f => recolor(f, { '#b5b2c4': '#d8354a', '#8ff0ff': '#ffd35a', '#f2eee6': '#e8742c' }));
const IMP_A = ['0....', 'R0...', '.R000', '..0RR', '..0yR', '..0RR', '0r00R', 'rr0RR', '0r0RR', '..0R0', '..00.'];
const IMP_B = ['0....', 'R0...', '.R000', '..0RR', '..0yR', 'rr0RR', '0r00R', '..0RR', '..0RR', '..0R0', '..00.'];
SPR.imp = [MX(IMP_A), MX(IMP_B)];
SPR.magmaslime = SPR.slime.map(f => recolor(f, { '#4fa04a': '#e8742c', '#1f4d33': '#7a1a2a', '#f2eee6': '#ffd35a' }));
SPR.crawler = [MX(['......', '..0000', '0.0pPP', 'p0PmPP', '0pPPPP', '.0pppp', '0.0.0.', '0.0.0.']), MX(['......', '..0000', '0.0pPP', 'p0PmPP', '0pPPPP', '.0pppp', '.0.0.0', '.0.0.0'])];
SPR.stalker = SPR.wraith.map(f => recolor(f, { '#a59cc4': '#9a4fd0', '#5e557f': '#4a2470', '#8ff0ff': '#e27bf0' }));
SPR.swarmeye = SPR.eye.map(f => recolor(f, { '#3f8ee0': '#e27bf0', '#1d3d7a': '#4a2470' }));
const GOLEM_TOP = ['...0000', '..0cc5c', '..0cBBB', '..0c0BB', '..0cBBB', '00ccBBB', '0ccBBcc', '0cBB0BB', '0cB0cBB', '0B0.0BB', '00..0cB', '...0cBB'];
SPR.golem = [MX(GOLEM_TOP.concat(['...0c0.', '...000.'])), MX(GOLEM_TOP.concat(['..0c0..', '..000..']))];
SPR.snowwisp = [MX(['..00', '.0cc', '0c55', '0c5c', '0ccc', '.0cc', '..00', '.c..']), MX(['..00', '.0cc', '0c55', '0c5c', '0ccc', '.0cc', '..00', '..c.'])];
const BANDIT = ['...000', '..0kkk', '.0kkkk', '.0RRRR', '.0ss0s', '.0RRRR', '..0sss', '.0kkKk', '0skKkk', '0s0kKK', '0s0kkk', '..0kyy', '..0wkk'];
SPR.bandit = [MX(BANDIT.concat(['...0w0', '...000'])), MX(BANDIT.concat(['..0w0.', '..000.']))];
SPR.archer = SPR.bandit.map(f => recolor(f, { '#5a3a28': '#1f4d33', '#d8354a': '#2f6b3a' }));
SPR.chief = SPR.bandit.map(f => recolor(f, { '#5a3a28': '#7a1a2a', '#9a6a42': '#d8354a', '#d8354a': '#ffd35a' }));
SPR.brute = SPR.ghoul.map(f => recolor(f, { '#a6e05a': '#b5b2c4', '#5a3a28': '#36304f' }));
SPR.miner = SPR.ghoul.map(f => recolor(f, { '#5a3a28': '#9a6a42', '#a6e05a': '#8fb26a' }));
SPR.villager = [MX(['......00', '.....0kk', '....0kkk', '....0sss', '....0s0s', '....0sss', '.....0ss', '...0KKKK', '..0sKKKK', '..0s0KKK', '....0KKK', '....0kkk', '....0kkk', '....0k0.', '....000.']),
  MX(['......00', '.....0kk', '....0kkk', '....0sss', '....0s0s', '....0sss', '.....0ss', '...0KKKK', '..0sKKKK', '..0s0KKK', '....0KKK', '....0kkk', '....0kkk', '...0k0..', '...000..'])];
function recolor(spr, map) {
  const c = document.createElement('canvas'); c.width = spr.w; c.height = spr.h;
  const x = c.getContext('2d');
  x.drawImage(spr.c, 0, 0);
  const img = x.getImageData(0, 0, spr.w, spr.h), d = img.data;
  const tab = Object.entries(map).map(([a, b]) => [hexRgb(a), hexRgb(b)]);
  for (let i = 0; i < d.length; i += 4) for (const [a, b] of tab) if (d[i] === a[0] && d[i + 1] === a[1] && d[i + 2] === a[2]) { d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; break; }
  x.putImageData(img, 0, 0);
  return { c, w: spr.w, h: spr.h, sil: {} };
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

// Mansion & tower side-view foes
SPR.armor = SPR.knight.map(f => recolor(f, { '#ffd35a': '#e27bf0', '#d8354a': '#9a4fd0', '#b5b2c4': '#8a87a0' }));
SPR.candle = [SX(['y..y..y', 'o..o..o', 'W..W..W', 'WWWWWWW', '...W...', '..0W0..', '..0m0..', '...W...', '..WWW..', '.WWWWW.']), SX(['.y..y.y', 'o..o..o', 'W..W..W', 'WWWWWWW', '...W...', '..0W0..', '..0m0..', '...W...', '..WWW..', '.WWWWW.'])];
SPR.book = [SX(['.0....0.', '0R0..0R0', '0RR00RR0', '0RRRRRR0', '.0RRRR0.', '..0000..']), SX(['........', '...00...', '..0RR0..', '.0RRRR0.', '0RR55RR0', '00000000'])];

/* ---------- NPCs (village folk, all front-facing like the heroes) ---------- */
const NPC_ART = {
  witch: { leg: 'p', half: ['.......0', '......0p', '.....0pP', '....0ppp', '..000000', '....0lll', '....0l0l', '....0lll', '...0p0ll', '..0ppppp', '..0pPPpp', '..0ppppp', '..0ppppp', '...0pppp'] },
  smith: { leg: 'k', half: ['......00', '.....0ss', '....0sss', '....0s0s', '....0sss', '....0kkk', '...0kkkk', '..0sswww', '..0s0www', '..0s0www', '....0www', '....0www', '....0kkk', '....0kkk'],
    patch: [[1, 7, '000'], [0, 8, '0ww0'], [1, 9, '0k0'], [2, 10, 'k'], [2, 11, 'k']] },
  alchemist: { leg: 'w', swap: { k: 'g', K: 'G' }, half: CHAR_ART.pell.half, patch: CHAR_ART.pell.patch },
  cartographer: { leg: 'b', swap: { w: 'b', W: 'B', 2: '3' }, half: CHAR_ART.morrow.half, patch: [[15, 10, '0550'], [15, 11, '0y50'], [15, 12, '0000']] },
  hunter: { leg: 'k', swap: { P: 'G', p: 'g', c: 'y' }, half: HERO_HALF, patch: [...column(17, 4, 13, 'k'), [16, 3, '0'], [16, 14, '0']] },
  merchant: { leg: 'k', half: ['......00', '.....0yy', '....0yyy', '....0sss', '....0s0s', '....0sss', '.....0ss', '...0RRRR', '..0sRRRR', '..0s0RRR', '....0RRR', '....0kkk', '....0kkk', '....0kkk'],
    patch: [[13, 6, '00000'], [13, 7, '0KKK0'], [13, 8, '0KyK0'], [13, 9, '0KKK0'], [13, 10, '00000']] },
  priest: { leg: 'W', swap: { P: '5', p: 'W', c: 'y' }, half: HERO_HALF, patch: [[8, 0, '.yyyy.'], [7, 1, 'y....y']] },
  prisoner: { leg: '2', swap: { K: 'w', k: '2' }, half: ['......00', '.....0kk', '....0kkk', '....0sss', '....0s0s', '....0sss', '.....0ss', '...0KKKK', '..0sKKKK', '..0s0KKK', '....0KKK', '....0kkk', '....0kkk', '....0kkk'] },
  lamplighter: { leg: 'k', half: ['......00', '.....022', '.....022', '.0000000', '...0ssss', '...0sysy', '...0sWWW', '....0WWW', '..022022', '.0222202', '.0222220', '.022222y', '.0222222', '..022222'],
    patch: [[1, 9, '0'], [0, 10, '0Y0'], [0, 11, '0y0'], [0, 12, '000'], ...column(1, 0, 8, 'k')] },
};
NPC_ART.villager = { leg: 'k', half: ['......00', '.....0kk', '....0kkk', '....0sss', '....0s0s', '....0sss', '.....0ss', '...0KKKK', '..0sKKKK', '..0s0KKK', '....0KKK', '....0kkk', '....0kkk'] };
const npcFrames = id => strideFrames(NPC_ART[id]);
const NPC_SPR = {};
for (const k in NPC_ART) NPC_SPR[k] = npcFrames(k);
NPC_SPR.villager2 = NPC_SPR.villager.map(f => recolor(f, { '#9a6a42': '#3f8ee0', '#5a3a28': '#ffd35a' }));

/* ---------- Bosses with their own bodies ---------- */
SPR.colossus = [MX(['........0000', '.......05555', '......055555', '......055005', '......0550R5', '......055555', '.......05050', '........0555', '..00000.0055',
  '.0555550.055', '055000550555', '050..0505055', '050..0505005', '050..0550555', '050...050005', '00....055555', '.05...005555', '..0....05505', '......055.05',
  '......050..0', '......050...', '.....0550...', '.....0000...'])];
SPR.gravekeeper = (() => {
  let rows = mirror(CHAR_ART.morrow.half.concat(LEGS_HALF[0].map(r => r.replace(/L/g, 'k')))).map(r => '..' + r + '..');
  rows = patch(rows, [...column(17, 0, 15, 'k'), [16, 13, '0WW0'], [16, 14, '0WW0'], [16, 15, '.00.']]);
  return [makeSprite(rows, { s: 'l', w: '2', W: '3', y: 'G' })];
})();
SPR.stag = [MX(['0.......0...', '0.0.....0..0', '.000....0.00', '..00.....00.', '...00...00..', '....00000...', '.......00000', '......0wwwww', '.....0wWWWww', '.....0w0yWWw', '.....0wwWWww', '......0wwwww', '.......0wwww', '..000000WWww', '.0wwwwwwWWWw',
  '0wwwwwwwwwww', '0wWwwwwwwwww', '0wwwwwwwwwww', '.0ww0....0ww', '.0w0......0w', '.00.......00'], { w: 'k', W: 'K', y: 'c' })];

/* ---------- Buildings (painted with code, pixel by pixel) ---------- */
function paint(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = mulberry32(w * 131 + h * 7);
  const px = (x, y, col, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  fn(px, r, g);
  return { c, w, h, sil: {} };
}
function paintHouse(ruined, roof = '#7a1a2a', seed = 1) {
  return paint(34, 30, (px, r) => {
    const roofD = ruined ? '#36304f' : roof;
    for (let j = 0; j < 12; j++) {
      const inset = 12 - j;
      for (let i = inset; i < 34 - inset; i++) {
        if (ruined && r() < 0.18 && j > 2) continue;
        px(i, j, (i + j) % 4 === 0 ? '#0b0a12' : j < 2 ? '#a59cc4' : roofD);
      }
    }
    px(1, 12, '#0b0a12', 32, 1);
    for (let j = 13; j < 29; j++) for (let i = 2; i < 32; i++) {
      if (ruined && j < 18 && r() < 0.3) continue;
      const brick = (j % 4 === 0) || ((i + (Math.floor(j / 4) % 2) * 3) % 6 === 0);
      px(i, j, brick ? '#2a2538' : ruined ? '#4a4258' : '#6b5d78');
    }
    px(2, 13, '#0b0a12', 1, 16); px(31, 13, '#0b0a12', 1, 16); px(2, 28, '#0b0a12', 30, 1);
    // door and windows
    px(14, 20, '#0b0a12', 7, 9); px(15, 21, ruined ? '#1c1a2b' : '#5a3a28', 5, 8); px(19, 25, '#ffd35a');
    for (const wx of [5, 25]) {
      px(wx - 1, 16, '#0b0a12', 6, 6);
      px(wx, 17, ruined ? '#1c1a2b' : (seed % 2 ? '#ffd35a' : '#e8742c'), 4, 4);
      px(wx + 1, 17, '#0b0a12', 1, 4); px(wx, 18, '#0b0a12', 4, 1);
    }
    if (ruined) for (let i = 0; i < 18; i++) px(2 + (r() * 30 | 0), 12 + (r() * 16 | 0), '#2f6b3a');
  });
}
const BUILD = {
  house: [paintHouse(false, '#7a1a2a', 1), paintHouse(false, '#1d3d7a', 2), paintHouse(false, '#1f4d33', 3)],
  ruin: [paintHouse(true, '#36304f', 1), paintHouse(true, '#36304f', 2)],
  well: paint(14, 14, px => { px(1, 0, '#5a3a28', 12, 2); px(2, 2, '#0b0a12', 1, 5); px(11, 2, '#0b0a12', 1, 5); px(6, 2, '#9a6a42', 2, 3);
    px(0, 7, '#0b0a12', 14, 7); px(1, 8, '#5e557f', 12, 5); px(3, 9, '#14303a', 8, 2); px(1, 8, '#a59cc4', 12, 1); }),
  lamp: paint(5, 16, px => { px(2, 4, '#0b0a12', 1, 12); px(0, 0, '#0b0a12', 5, 5); px(1, 1, '#ffd35a', 3, 3); px(1, 15, '#0b0a12', 3, 1); }),
  hut: paint(26, 28, (px, r) => {
    for (let j = 0; j < 14; j++) { const inset = Math.max(0, 11 - j); for (let i = inset; i < 26 - inset; i++) px(i, j, (i * 7 + j * 3) % 5 === 0 ? '#2f6b3a' : j < 1 ? '#0b0a12' : '#4a3a1c'); }
    px(10, 0, '#1f4d33', 6, 3);
    for (let j = 14; j < 27; j++) for (let i = 3; i < 23; i++) px(i, j, (i % 4 === 0) ? '#3a2618' : '#5a3a28');
    px(3, 26, '#0b0a12', 20, 1); px(10, 18, '#0b0a12', 6, 9); px(11, 19, '#1f4d33', 4, 8); px(5, 17, '#a6e05a', 3, 3);
    px(17, 3, '#36304f', 2, 4); px(18, 1, '#5e557f', 1, 2);
  }),
  tower: paint(28, 72, (px, r) => {
    for (let j = 6; j < 72; j++) for (let i = 4; i < 24; i++) px(i, j, ((j % 5 === 0) || ((i + Math.floor(j / 5) * 3) % 7 === 0)) ? '#2a2538' : j < 40 ? '#5e557f' : '#4a4258');
    for (let i = 2; i < 26; i += 4) px(i, 0, '#0b0a12', 3, 7);
    px(2, 6, '#0b0a12', 24, 2); px(4, 8, '#0b0a12', 1, 64); px(23, 8, '#0b0a12', 1, 64);
    for (const wy of [16, 32, 48]) { px(12, wy, '#0b0a12', 4, 7); px(13, wy + 1, '#ffd35a', 2, 5); }
    px(10, 60, '#0b0a12', 8, 12); px(11, 61, '#1c1a2b', 6, 11);
    for (let k = 0; k < 30; k++) px(4 + (r() * 20 | 0), 8 + (r() * 64 | 0), '#2f6b3a');
  }),
  watchtower: paint(20, 40, (px, r) => {
    for (let j = 10; j < 40; j++) { px(3, j, '#3a2618'); px(16, j, '#3a2618'); px(4, j, '#5a3a28'); px(15, j, '#5a3a28'); }
    for (let j = 14; j < 40; j += 6) for (let i = 4; i < 16; i++) px(i, j + Math.floor((i - 4) / 2) % 6, '#3a2618');
    px(0, 6, '#0b0a12', 20, 6); px(1, 7, '#9a6a42', 18, 4); px(1, 7, '#c49a6a', 18, 1);
    for (let i = 0; i < 20; i += 3) px(i, 2, '#5a3a28', 2, 4);
    if (r() < 2) { px(6, 11, '#0b0a12', 3, 1); px(12, 11, '#0b0a12', 3, 1); }
  }),
  tent: paint(24, 18, px => {
    for (let j = 0; j < 16; j++) { const half = Math.floor(j * 0.75) + 1; for (let i = 12 - half; i < 12 + half; i++) px(i, j + 1, i < 12 ? '#7a5a3a' : '#5a3a28'); }
    px(11, 7, '#0b0a12', 2, 10); px(0, 17, '#0b0a12', 24, 1); px(11, 0, '#3a2618', 2, 2);
  }),
  cage: paint(16, 18, px => { px(0, 0, '#0b0a12', 16, 2); px(0, 16, '#0b0a12', 16, 2); for (let i = 0; i < 16; i += 3) px(i, 2, '#6d6a7c', 1, 14); }),
  campfire: paint(12, 6, px => { px(1, 3, '#3a2618', 10, 2); px(3, 2, '#5a3a28', 6, 1); px(0, 5, '#36304f', 12, 1); }),
  mine: paint(30, 26, (px, r) => {
    for (let j = 6; j < 26; j++) for (let i = 0; i < 30; i++) { const d = Math.abs(i - 15); if (j > 8 + d * 0.5 - 10 && d < 15 - (j < 10 ? 10 - j : 0)) px(i, j, r() < 0.3 ? '#4a4258' : '#36304f'); }
    px(8, 8, '#0b0a12', 14, 18); px(9, 9, '#07060c', 12, 17);
    px(7, 6, '#5a3a28', 16, 3); px(7, 6, '#9a6a42', 16, 1); px(7, 9, '#5a3a28', 2, 17); px(21, 9, '#5a3a28', 2, 17);
    for (let i = 9; i < 21; i += 3) px(i, 24, '#6d6a7c', 2, 1); px(9, 23, '#9a6a42', 12, 1); px(9, 25, '#9a6a42', 12, 1);
  }),
  gate: paint(40, 44, (px, r) => {
    for (let j = 0; j < 44; j++) for (let i = 0; i < 40; i++) {
      const pillar = i < 8 || i > 31, arch = j < 10 && Math.hypot(i - 19.5, j - 12) > 9 && Math.hypot(i - 19.5, j - 12) < 15;
      if (pillar || arch) px(i, j, (i + j) % 6 === 0 ? '#1c1a2b' : (r() < 0.1 ? '#7a1a2a' : '#2a2538'));
    }
    for (let k = 0; k < 6; k++) { px(2 + k % 2 * 32, 8 + k * 6, '#d8354a', 3, 3); }
    px(0, 42, '#0b0a12', 40, 2);
  }),
  temple: paint(48, 34, (px, r) => {
    for (let j = 0; j < 8; j++) { const inset = 8 - j; for (let i = inset * 3; i < 48 - inset * 3; i++) px(i, j, j === 7 ? '#0b0a12' : '#8a87a0'); }
    for (let c = 0; c < 5; c++) for (let j = 8; j < 30; j++) { px(4 + c * 10, j, '#b5b2c4', 4, 1); px(4 + c * 10, j, '#d8d5e8'); px(7 + c * 10, j, '#6d6a7c'); }
    px(0, 30, '#6d6a7c', 48, 4); px(0, 30, '#b5b2c4', 48, 1);
    px(20, 14, '#0b0a12', 8, 16); px(21, 15, '#07060c', 6, 15);
    for (let k = 0; k < 40; k++) px(r() * 48 | 0, 8 + (r() * 22 | 0), '#2f6b3a');
  }),
  mansion: paint(56, 46, (px, r) => {
    for (let j = 0; j < 14; j++) { const inset = Math.max(0, 13 - j); for (let i = inset * 2; i < 56 - inset * 2; i++) px(i, j, (i + j) % 5 === 0 ? '#0b0a12' : '#36304f'); }
    px(24, 0, '#2a2538', 8, 6); px(26, 2, '#e27bf0', 4, 3);
    for (let j = 14; j < 45; j++) for (let i = 2; i < 54; i++) px(i, j, (j % 3 === 0 || (i + Math.floor(j / 3) * 2) % 5 === 0) ? '#2a2538' : '#4a3a4f');
    px(2, 44, '#0b0a12', 52, 2);
    for (const wx of [7, 17, 35, 45]) for (const wy of [18, 30]) { px(wx - 1, wy - 1, '#0b0a12', 6, 8); px(wx, wy, r() < 0.4 ? '#e27bf0' : '#1c1a2b', 4, 6); }
    px(23, 30, '#0b0a12', 10, 15); px(24, 31, '#3a1c2a', 8, 14); px(31, 37, '#ffd35a');
  }),
  hatch: paint(14, 10, px => { px(0, 0, '#0b0a12', 14, 10); px(1, 1, '#5a3a28', 12, 8); for (let i = 1; i < 13; i += 3) px(i, 1, '#3a2618', 1, 8); px(6, 4, '#6d6a7c', 2, 2); }),
  wagon: paint(30, 20, px => {
    px(2, 0, '#c4c4cf', 22, 2);
    for (let j = 2; j < 12; j++) px(1, j, j % 3 === 0 ? '#a59cc4' : '#e8e4f0', 24, 1);
    px(0, 12, '#0b0a12', 26, 1); px(1, 13, '#5a3a28', 24, 3); px(24, 14, '#3a2618', 6, 1);
    for (const wx of [5, 19]) { px(wx - 3, 15, '#0b0a12', 7, 5); px(wx - 2, 16, '#9a6a42', 5, 3); px(wx, 17, '#0b0a12'); }
  }),
  barrel: paint(8, 10, px => { px(1, 0, '#0b0a12', 6, 10); px(0, 1, '#0b0a12', 8, 8); px(1, 1, '#d8354a', 6, 8); px(1, 3, '#7a1a2a', 6, 1); px(1, 6, '#7a1a2a', 6, 1); px(3, 4, '#ffd35a', 2, 2); }),
  ore: paint(8, 7, px => { px(1, 1, '#0b0a12', 6, 6); px(0, 2, '#0b0a12', 8, 4); px(1, 2, '#36304f', 6, 4); px(2, 3, '#8ff0ff', 2, 1); px(5, 2, '#ffd35a'); px(4, 4, '#e27bf0'); }),
  key: paint(10, 5, px => { px(0, 0, '#0b0a12', 5, 5); px(1, 1, '#ffd35a', 3, 3); px(2, 2, '#0b0a12'); px(4, 2, '#ffd35a', 6, 1); px(7, 3, '#ffd35a'); px(9, 3, '#ffd35a'); }),
  fragment: paint(7, 9, px => { px(3, 0, '#0b0a12'); px(2, 1, '#0b0a12', 3, 1); px(1, 2, '#0b0a12', 5, 5); px(2, 2, '#d8354a', 3, 5); px(3, 3, '#ffd35a'); px(2, 7, '#0b0a12', 3, 1); px(3, 8, '#0b0a12'); }),
};
