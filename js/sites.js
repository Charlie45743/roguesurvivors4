'use strict';
/* More places to find on the night map: a field hospital whose campfire mends you, standing stones, outposts,
   a library, blood altars, a gambler's camp, an orchard, beacons, slaver stockades, mercenary camps, a
   sewer, a frozen cavern, a sunken forge, a dark obelisk and abandoned camps. Each is defined once in SITES
   and plugged into the structure engine (build, ground, activation, interaction, ambience). */

NPC_SPR.scholar = NPC_SPR.cartographer;
NPC_SPR.gambler = NPC_SPR.merchant.map(f => recolor(f, { '#d8354a': '#9a4fd0', '#ffd35a': '#e27bf0' }));
NPC_SPR.merc = NPC_SPR.hunter.map(f => recolor(f, { '#4fa04a': '#d8354a', '#1f4d33': '#7a1a2a' }));
Object.assign(NPC_NAMES, { scholar: 'Scholar', gambler: 'Gambler', merc: 'Mercenary' });
Object.assign(SHOP_LINES, {
  medic: '"Sit by the fire. Breathe. Let me look at that." The medic has not slept in three nights.',
  scholar: 'The scholar does not look up from the page. "Knowledge costs. Ignorance costs more."',
  merc: '"Swords for hire. Pay up front, and we stay until we fall."',
});

/* ---------- Art ---------- */
function makeMedTent(seed) {
  const W = 64, H = 46;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    const cx = W / 2;
    for (let j = 0; j < 38; j++) {
      const half = Math.min(30, 4 + Math.round(j * 0.72));
      for (let i = cx - half; i < cx + half; i++) {
        const edge = i === cx - half || i === cx + half - 1 || j === 0;
        px(i, 4 + j, edge ? OUTL : (j % 8 === 7 ? '#9a9486' : nz(i, j, seed) < 0.06 ? '#a8a294' : i < cx - 1 ? '#dcd7cb' : '#bcb6a8'));
      }
    }
    px(cx - 6, 26, OUTL, 12, 16); px(cx - 5, 27, '#241616', 10, 15); px(cx - 5, 27, '#3a2222', 10, 2);
    px(cx - 1, 11, OUTL, 5, 13); px(cx - 5, 15, OUTL, 13, 5);
    px(cx, 12, '#d8354a', 3, 11); px(cx - 4, 16, '#d8354a', 11, 3);
    px(cx - 1, 1, '#3a2618', 2, 5); px(cx + 1, 1, '#d8354a', 4, 3);
    for (const sx of [cx - 31, cx + 29]) { px(sx, 41, '#3a2618', 3, 5); px(sx + (sx < cx ? 3 : -2), 38, '#7a7466', 2, 3); }
    px(cx + 9, 28, '#3a2618', 1, 3); px(cx + 8, 31, '#ffd35a', 3, 3); meta.glows.push([cx + 9, 32, '#ffd35a']);
    px(0, H - 1, OUTL, W, 1);
  });
}
function makeOutfall(seed) {
  const W = 72, H = 44;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    for (let j = 0; j < 38; j++) for (let i = 0; i < W; i++) {
      const row = j >> 2, off = (row % 2) * 4, mort = j % 4 === 3 || (i + off) % 8 === 7;
      px(i, 4 + j, i === 0 || i === W - 1 || j === 0 ? OUTL : mort ? '#241f2c' : nz((i + off) >> 3, row, seed) < 0.3 ? '#4a4850' : '#3c3a44');
    }
    for (let j = 0; j < 20; j++) for (let i = 0; i < 30; i++) {
      const d = ((i - 15) / 15) ** 2 + ((j - 10) / 10) ** 2;
      if (d <= 1) px(W / 2 - 15 + i, 14 + j, d > 0.82 ? OUTL : d > 0.6 ? '#2a2830' : j > 12 ? '#3f7a3a' : '#0c120c');
    }
    px(W / 2 - 4, 34, '#4fa04a', 8, 6); px(W / 2 - 6, 38, '#2f6b3a', 12, 4);
    for (let k = 0; k < 14; k++) px(r() * W | 0, 4 + (r() * 30 | 0), '#2f6b3a', 2, 1);
    for (let i = 4; i < W; i += 14) px(i, 4, '#5e557f', 3, 1);
    meta.glows.push([W / 2, 30, '#a6e05a']);
    px(0, H - 1, OUTL, W, 1);
  });
}
Object.assign(PROPS, {
  cot: () => canvasSprite(22, 12, 31, px => {
    px(0, 2, OUTL, 22, 9); px(1, 3, '#e8e4f0', 20, 7); px(1, 3, '#fff', 20, 1);
    px(1, 3, '#fff', 5, 4); px(8, 4, '#d8354a', 12, 6); px(8, 4, '#ff6a7a', 12, 1);
    for (const lx of [1, 19]) px(lx, 10, OUTL, 2, 2);
  }),
  redflag: () => canvasSprite(16, 40, 32, px => {
    px(2, 0, OUTL, 3, 40); px(3, 1, '#7a5236', 1, 38);
    px(4, 3, OUTL, 11, 13); px(5, 4, '#f2eee6', 9, 11); px(8, 5, '#d8354a', 3, 9); px(6, 8, '#d8354a', 7, 3);
  }),
  campfire: () => canvasSprite(20, 10, 33, px => {
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; px(10 + Math.cos(a) * 8, 5 + Math.sin(a) * 3, OUTL, 4, 3); px(10 + Math.cos(a) * 8 + 1, 5 + Math.sin(a) * 3, '#6b6276', 2, 2); }
    px(4, 4, '#3a2618', 12, 3); px(5, 4, '#5a3a28', 10, 1); px(7, 2, '#3a2618', 6, 3); px(8, 3, '#e8742c', 4, 2);
  }),
  menhir: () => canvasSprite(14, 32, 34, (px, r, g, meta) => {
    for (let j = 0; j < 31; j++) {
      const half = j < 6 ? 3 + Math.floor(j * 0.6) : 6;
      for (let i = 7 - half; i < 7 + half; i++) px(i, 1 + j, i === 7 - half || i === 6 + half ? OUTL : i < 5 ? '#8a87a0' : i < 9 ? '#6b6276' : '#4a4258');
    }
    px(6, 12, '#9a4fd0', 2, 8); px(4, 15, '#9a4fd0', 6, 2); px(6, 12, '#e27bf0', 2, 1);
    px(0, 31, OUTL, 14, 1); meta.glows.push([7, 16, '#9a4fd0']);
  }),
  runealtar: () => canvasSprite(30, 22, 35, (px, r, g, meta) => {
    px(2, 8, OUTL, 26, 14); px(3, 9, '#6b6276', 24, 11); px(3, 9, '#8a87a0', 24, 2);
    px(6, 4, OUTL, 18, 6); px(7, 5, '#8a87a0', 16, 4);
    px(13, 12, '#e27bf0', 4, 4); px(11, 14, '#9a4fd0', 8, 1); px(14, 10, '#9a4fd0', 2, 8);
    meta.glows.push([15, 8, '#e27bf0']);
  }),
  obelisk: () => canvasSprite(20, 58, 36, (px, r, g, meta) => {
    for (let j = 0; j < 54; j++) { const half = j < 5 ? 2 + j : 7 - (j > 40 ? Math.floor((j - 40) / 5) : 0); for (let i = 10 - half; i < 10 + half; i++) px(i, 2 + j, i === 10 - half || i === 9 + half ? OUTL : i < 9 ? '#2a2538' : '#1a1624'); }
    for (const [y, c] of [[10, '#9a4fd0'], [20, '#e27bf0'], [30, '#9a4fd0'], [40, '#e27bf0']]) { px(8, y, c, 4, 1); px(9, y - 2, c, 2, 5); }
    px(9, 0, '#e27bf0', 2, 3); px(0, 55, OUTL, 20, 3); px(2, 56, '#36304f', 16, 2);
    meta.glows.push([10, 20, '#9a4fd0']);
  }),
  bloodaltar: () => canvasSprite(34, 24, 37, (px, r, g, meta) => {
    px(2, 10, OUTL, 30, 14); px(3, 11, '#4a2830', 28, 12); px(3, 11, '#7a3a44', 28, 2);
    px(4, 6, OUTL, 26, 6); px(5, 7, '#5a3038', 24, 4); px(9, 3, OUTL, 16, 5); px(10, 4, '#2a1218', 14, 3); px(11, 4, '#d8354a', 12, 1);
    for (let k = 0; k < 9; k++) px(5 + r() * 24, 12 + r() * 9, '#d8354a', 1, 2 + (r() * 4 | 0));
    meta.glows.push([17, 6, '#d8354a']);
  }),
  appletree: () => canvasSprite(34, 44, 38, (px, r) => {
    px(15, 24, OUTL, 5, 20); px(16, 25, '#5a3a28', 3, 18); px(14, 40, OUTL, 7, 4);
    for (let j = 0; j < 30; j++) for (let i = 0; i < 34; i++) { const d = ((i - 17) / 17) ** 2 + ((j - 14) / 15) ** 2; if (d <= 1) px(i, j, d > 0.86 ? '#16341f' : nz(i, j, 38) < 0.3 ? '#2f6b3a' : nz(i, j, 5) < 0.2 ? '#6fb04a' : '#4fa04a'); }
    for (let k = 0; k < 9; k++) { const x = 6 + (r() * 22 | 0), y = 4 + (r() * 22 | 0); px(x, y, OUTL, 3, 3); px(x, y, '#d8354a', 2, 2); }
  }),
  shelf: () => canvasSprite(24, 28, 39, (px, r) => {
    px(0, 0, OUTL, 24, 28); px(1, 1, '#5a3a28', 22, 26);
    for (const y of [2, 10, 18]) { px(1, y + 7, '#3a2618', 22, 1); for (let i = 2; i < 22; i += 3) px(i, y + 1 + (r() * 2 | 0), pick(['#d8354a', '#3f8ee0', '#a6e05a', '#ffd35a', '#9a4fd0', '#e8e4f0']), 2, 6); }
  }),
  gtable: () => canvasSprite(28, 16, 40, px => {
    px(1, 3, OUTL, 26, 8); px(2, 4, '#7a1a2a', 24, 6); px(2, 4, '#d8354a', 24, 1);
    for (const lx of [3, 22]) px(lx, 11, OUTL, 3, 5);
    px(8, 5, '#fff', 3, 3); px(9, 6, OUTL); px(15, 6, '#f2eee6', 4, 3); px(16, 7, '#d8354a');
  }),
  grate: () => canvasSprite(34, 16, 41, (px, r, g, meta) => {
    for (let j = 0; j < 14; j++) for (let i = 0; i < 32; i++) { const d = ((i - 16) / 16) ** 2 + ((j - 7) / 7) ** 2; if (d <= 1) px(1 + i, 1 + j, d > 0.8 ? OUTL : (i % 4 === 0 || j % 4 === 0) ? '#6d6a7c' : '#0e1a0e'); }
    meta.glows.push([17, 8, '#a6e05a']);
  }),
  anvil: () => canvasSprite(20, 14, 42, px => { px(2, 0, OUTL, 17, 6); px(3, 1, '#8a87a0', 15, 3); px(1, 2, OUTL, 5, 3); px(6, 6, OUTL, 8, 8); px(7, 6, '#4a4258', 6, 7); px(4, 12, OUTL, 12, 2); }),
  icespike: () => canvasSprite(16, 30, 43, px => {
    for (let j = 0; j < 28; j++) { const half = Math.max(1, 7 - Math.floor(j * 0.25)); if (j > 20) continue; for (let i = 8 - half; i < 8 + half; i++) px(i, 28 - j - 1, i === 8 - half || i === 7 + half ? OUTL : i < 8 ? '#c9f7ff' : '#8ff0ff'); }
  }),
});

/* ---------- Layout helpers ---------- */
const sCache = (k, f) => cached('site:' + k, f);
const ring = (n, rad, fn, a0 = 0, sq = 0.75) => { for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; fn(Math.cos(a) * rad, Math.sin(a) * rad * sq, i); } };
const siteHex = new Map();
const hx = h => siteHex.get(h) || (siteHex.set(h, hexRGB(h)), siteHex.get(h));
function palisadeRect(pp, hw, hh, gap = 22) {
  for (let x = -hw; x <= hw; x += 26) { pp('palisade', x, -hh, 9); if (Math.abs(x) > gap) pp('palisade', x, hh, 9); }
  for (let y = -hh + 26; y < hh; y += 26) { pp('palisade', -hw, y, 9); pp('palisade', hw, y, 9); }
}
function siteFlame(x, y, now, dt, big = 1) {
  const fl = Math.floor(now * 12 + x) % 3, sx = Math.round(x - camX), sy = Math.round(y - camY);
  ctx.fillStyle = '#e8742c'; ctx.fillRect(sx - 2 * big, sy - 3 - fl % 2, 4 * big, 4);
  ctx.fillStyle = '#ffd35a'; ctx.fillRect(sx - big, sy - 5 - fl, 2 * big, 3);
  if (chance(dt, 6)) addPart(x + rand(-2, 2), y - 4, rand(-3, 3), rand(-26, -14), 0.7, pick(['#ffd35a', '#e8742c']), 1, 0, 0.5);
  light(x, y - 2, 56 * big, 0.9); glowAt(x, y - 2, 16 * big, '#e8742c', 0.5);
}
const sitePuff = (dt, rate, x, y, rx, ry, vy, life, cols) => { if (chance(dt, rate)) addPart(x + rand(-rx, rx), y + rand(-ry, ry), rand(-4, 4), vy, life, pick(cols), 1, 0, 0.4); };
const survivorsHeal = (pl, amt) => { pl.hp = Math.min(pl.maxHp, pl.hp + amt); };
const recalcFor = pl => { const keep = P; P = pl; recalc(); P = keep; };
function giveBonus(pl, key, v) { pl.bonus = pl.bonus || {}; pl.bonus[key] = (pl.bonus[key] || 0) + v; recalcFor(pl); }
const around = (st, n, rad, types, o = {}) => { const out = []; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = spawnEnemy(pick(types), st.x + Math.cos(a) * rad * (0.4 + Math.random() * 0.6), st.y + Math.sin(a) * rad * 0.7 * (0.4 + Math.random() * 0.6), o); e.rise = 0.5; out.push(e); } return out; };

/* Max HP bonuses (field surgery, boons, altars) survive every recalc */
Mods.add({ recalc(p) { p.maxHp += (p.bonus && p.bonus.hp) || 0; } });
const baseRecalc = recalc;
recalc = function () { const keep = P.hp; baseRecalc(); P.hp = Math.min(P.maxHp, Math.max(P.hp, keep)); };

/* ---------- The sites ---------- */
const SITES = {
  fieldhospital: {
    w: 0.75, R: 120, col: '#d8354a', safe: true,
    title: [n => n + ' Field Hospital', 'A red cross, a warm fire, and a medic who has not slept'],
    build(st, r, put, pp) {
      const tent = sCache('medtent', () => makeMedTent(7));
      put(tent, -58, -12, { depth: 22 }); put(tent, 58, -6, { depth: 22 }); put(tent, 0, -58, { depth: 22 });
      pp('campfire', 0, 8, 0);
      for (const [x, y] of [[-30, 26], [-12, 34], [14, 34], [34, 26]]) pp('cot', x, y, 0);
      pp('redflag', -24, -4, 2); pp('redflag', 24, -4, 2); pp('crate', 84, 22, 5); pp('barrel', 92, 28, 5); pp('lamp', -50, 30, 3); pp('lamp', 50, 30, 3);
      st.npcs.push(makeNpc('medic', st.x + 18, st.y + 22));
      st.fire = { x: st.x, y: st.y + 4 };
      st.labelH = 80;
    },
    ground: (x, y, n) => {
      const dd = Math.hypot(x, y * 1.2) / 100;
      if (Math.hypot(x, (y - 4) * 1.3) < 20) return n < 0.5 ? [38, 32, 30] : [28, 24, 24];
      if (Math.hypot(x, (y - 4) * 1.3) < 56 && n < 0.18) return [80, 130, 70, 140];
      if (dd < 1 && n > dd * 0.5) return n > 0.8 ? hx('#4a3d2e') : hx('#3d3226');
      return null;
    },
    amb(st, now, dt) {
      siteFlame(st.fire.x, st.fire.y, now, dt, 2);
      ctx.globalAlpha = 0.18 + Math.sin(now * 2) * 0.06; ringOval(st.fire.x - camX, st.fire.y - camY, 56, '#a6e05a', 0.62); ctx.globalAlpha = 1;
      sitePuff(dt, 4, st.fire.x, st.fire.y - 6, 10, 3, -28, 1.4, ['#a6e05a', '#d8f0a0']);
    },
  },
  standingstones: {
    w: 0.8, R: 90, col: '#9a4fd0',
    title: [n => 'The ' + n + ' Stones', 'The air hums. Touch the stones and be changed'],
    build(st, r, put, pp) {
      ring(8, 54, (x, y) => pp('menhir', x, y, 5));
      pp('runealtar', 0, 8, 7);
      st.door = { x: st.x, y: st.y + 20 };
    },
    ground: (x, y, n) => {
      const d = Math.hypot(x, y * 1.25);
      if (d < 22) return n < 0.5 ? hx('#433e50') : hx('#58526a');
      if (Math.abs(d - 54) < 18 && n > 0.25) return n > 0.85 ? [60, 40, 90, 200] : hx('#16241f');
      return null;
    },
    inter: st => (st.used ? [] : [{ x: st.x, y: st.y + 22, label: 'Touch the standing stones', act: pl => standingStones(st, pl) }]),
    amb(st, now, dt) {
      ring(8, 54, (x, y, i) => { if (Math.sin(now * 2 + i) > 0.2) { light(st.x + x, st.y + y - 14, 26, 0.5); glowAt(st.x + x, st.y + y - 14, 8, '#9a4fd0', 0.4); } });
      if (!st.used) { sitePuff(dt, 6, st.x, st.y - 4, 40, 10, -18, 1.4, ['#e27bf0', '#9a4fd0']); light(st.x, st.y, 50, 0.7); }
    },
  },
  outpost: {
    w: 0.75, R: 130, col: '#d8354a',
    title: [n => n + ' Outpost', 'A ruined fort. Someone has moved in'],
    build(st, r, put, pp) {
      palisadeRect(pp, 90, 66);
      put(sCache('tent', PROPS.tent), -46, -22, { depth: 16 }); put(sCache('tent', PROPS.tent), 44, -24, { depth: 16 });
      pp('rack', -4, -10, 5); pp('banner', -86, 52, 2); pp('banner', 86, 52, 2); pp('crate', 60, 18, 5); pp('barrel', 68, 24, 5); pp('skullpost', -20, 80, 3); pp('skullpost', 20, 80, 3);
      st.labelH = 70;
    },
    ground: (x, y, n) => (Math.abs(x) < 92 && Math.abs(y) < 68 && n > 0.15 ? (n > 0.8 ? hx('#4a3d2e') : hx('#3d3226')) : null),
    act(st) {
      around(st, 12, st.R * 0.8, ['bandit', 'archer', 'bandit']);
      if (Math.random() < 0.45) makeBoss('brute', st.x, st.y - 10, { minor: true, hpMul: G.hpMul, onDeath: e => { dropAt('chest', e.x, e.y, { boss: true }); dropAt('bag', e.x + 10, e.y); } });
      dropAt('chest', st.x - 20, st.y + 10); dropAt('chest', st.x + 24, st.y + 12);
    },
    amb(st, now, dt) { siteFlame(st.x, st.y + 4, now, dt, 1); },
  },
  library: {
    w: 0.5, R: 110, col: '#8ff0ff', safe: true,
    title: [n => n + ' Library', 'Candles, scrolls and a scholar who reads through the night'],
    build(st, r, put, pp) {
      put(sCache('library', () => makeHouse({ w: 92, wallH: 46, roofH: 28, storeys: 2, mat: 'stone', roof: 'blue', seed: 71, chimney: true, sign: 'scroll', gable: true, lit: 0.95 })), 0, -8, { depth: 34 });
      pp('shelf', -74, 20, 6); pp('shelf', 74, 20, 6); pp('lamp', -40, 34, 3); pp('lamp', 40, 34, 3); pp('bench', -24, 40, 0); pp('bench', 24, 40, 0);
      st.npcs.push(makeNpc('scholar', st.x, st.y + 30));
      st.labelH = 110;
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.3); if (d < 96) { const mort = ((y + 200) % 6 === 5) || (((x + 200) % 8) === 7); return mort ? hx('#2a2632') : n < 0.4 ? hx('#4e4858') : hx('#58526a'); } return null; },
  },
  bloodaltar: {
    w: 0.6, R: 80, col: '#d8354a',
    title: [n => 'The ' + n + ' Altar', 'It wants something. Something red'],
    build(st, r, put, pp) {
      pp('bloodaltar', 0, 0, 10);
      for (const [x, y] of [[-40, 14], [40, 14], [-30, -20], [30, -20]]) pp('skullpost', x, y, 3);
      pp('brazier', -52, -2, 4); pp('brazier', 52, -2, 4);
      st.door = { x: st.x, y: st.y + 16 }; st.uses = 3;
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.2); if (d < 64 && n > d / 64 * 0.5) return n > 0.9 ? [122, 26, 42, 230] : [26, 14, 18, 235]; return null; },
    inter: st => (st.uses > 0 ? [{ x: st.x, y: st.y + 18, label: 'Approach the blood altar', act: pl => bloodAltar(st, pl) }] : []),
    amb(st, now, dt) {
      siteFlame(st.x - 52, st.y - 2, now, dt, 1); siteFlame(st.x + 52, st.y - 2, now, dt, 1);
      glowAt(st.x, st.y - 12, 22, '#d8354a', 0.45 + Math.sin(now * 3) * 0.15); light(st.x, st.y - 10, 60, 0.7);
      sitePuff(dt, 3, st.x, st.y - 12, 8, 2, 12, 1, ['#d8354a', '#7a1a2a']);
    },
  },
  gambler: {
    w: 0.65, R: 70, col: '#e27bf0', safe: true,
    title: [n => n + ' Gamblers', 'Dice, cards and a smile that is too wide'],
    build(st, r, put, pp) {
      put(BUILD.wagon, -34, 6, { depth: 12 }); pp('gtable', 20, 10, 6); pp('lamp', 44, 0, 3); pp('lamp', -8, -8, 3); pp('crate', -10, 26, 5); pp('barrel', 50, 24, 5);
      st.npcs.push(makeNpc('gambler', st.x + 4, st.y + 24));
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.3); if (Math.abs(x - 18) < 22 && Math.abs(y - 8) < 12) return [90, 20, 40, 230]; if (d < 64 && n > d / 64 * 0.6) return hx('#3d3226'); return null; },
    amb(st, now, dt) { light(st.x + 20, st.y, 50, 0.8); glowAt(st.x + 20, st.y, 12, '#e27bf0', 0.3); },
  },
  orchard: {
    w: 0.75, R: 110, col: '#a6e05a', safe: true,
    title: [n => n + ' Orchard', 'Apples ripen here in the dark. No one knows why'],
    build(st, r, put, pp) {
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (i || j) pp('appletree', i * 56 + (j % 2) * 8, j * 46 + 8, 6);
      pp('hay', 0, 20, 0); pp('crate', 18, 26, 5);
      st.apples = 6; st.door = { x: st.x, y: st.y + 28 };
      st.labelH = 50;
    },
    ground: (x, y, n) => { const d = Math.hypot(x / 1.1, y * 1.3); if (d < 100 && n > d / 100 * 0.6) return n > 0.8 ? hx('#2f6b3a') : hx('#244a2a'); return null; },
    inter: st => (st.apples > 0 ? [{ x: st.x, y: st.y + 28, label: `Pick apples (${st.apples} left)`, act: pl => pickApple(st, pl) }] : []),
    amb(st, now, dt) {
      for (let i = 0; i < 8; i++) { const a = st.seed + i * 2.1 + now * 0.3, fx = st.x + Math.cos(a) * (40 + i * 10), fy = st.y + Math.sin(a * 1.3) * (30 + i * 7); if (Math.sin(now * 4 + i) > 0) { ctx.fillStyle = '#d8f0a0'; ctx.fillRect(Math.round(fx - camX), Math.round(fy - camY), 1, 1); } }
    },
  },
  beacon: {
    w: 0.65, R: 80, col: '#ffd35a',
    title: [n => n + ' Beacon', 'Light it, and everything in the dark will come'],
    build(st, r, put, pp) {
      const t = put(sCache('beaconTower', () => makeWatchtower(9)), 0, 0, { depth: 12, noSolid: true });
      t.solids = [[-16, -4, 5], [16, -4, 5]];
      pp('crate', 34, 8, 5); pp('barrel', -34, 6, 5); pp('brazier', -52, 18, 4); pp('brazier', 52, 18, 4);
      st.door = { x: st.x, y: st.y + 12 }; st.labelH = 112;
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.4) / 56; if (d < 1 && n > d * 0.6) return n > 0.85 ? hx('#5a4a30') : hx('#3a3238'); return null; },
    inter: st => (!st.done && !st.def ? [{ x: st.x, y: st.y + 14, label: 'Light the beacon (hold out for 45 seconds)', act: pl => lightBeacon(st, pl) }] : []),
    amb(st, now, dt) {
      const t = st.pieces[0], bc = t.spr.meta.beacon;
      if (st.def || st.done) { siteFlame(t.x + bc[0], t.y + bc[1], now, dt, 2); glowAt(t.x + bc[0], t.y + bc[1], 40, '#ffd35a', 0.35); }
      if (st.def) drawText(ctx, String(Math.max(0, Math.ceil(45 - st.def.t))), t.x - camX, t.y - camY - 90, '#ffd35a');
    },
  },
  stockade: {
    w: 0.6, R: 125, col: '#d8354a',
    title: [n => n + ' Stockade', 'Slavers. Someone is crying behind the palisade'],
    build(st, r, put, pp) {
      palisadeRect(pp, 96, 70, 24);
      put(sCache('tent', PROPS.tent), -50, -30, { depth: 16 }); put(sCache('tent', PROPS.tent), 54, -34, { depth: 16 });
      pp('banner', -90, 56, 2); pp('banner', 90, 56, 2); pp('rack', 8, -8, 5); pp('crate', 70, 20, 5);
      for (const [x, y] of [[-26, 12], [30, 14]]) { const n = makeNpc('prisoner', st.x + x, st.y + y); n.caged = true; st.npcs.push(n); }
      st.captives = st.npcs.filter(n => n.kind === 'prisoner'); st.labelH = 60;
    },
    ground: (x, y, n) => (Math.abs(x) < 98 && Math.abs(y) < 72 && n > 0.12 ? (n > 0.8 ? hx('#3a2f24') : hx('#33291f')) : null),
    act(st) {
      st.guards = around(st, 9, st.R * 0.8, ['bandit', 'archer', 'bandit']);
      st.chief = makeBoss('chief', st.x, st.y - 24, { minor: true, hpMul: G.hpMul, onDeath: e => { st.chiefDead = true; banner('The slaver chief is dead', 'Free the captives', '#ffd35a'); dropAt('bag', e.x, e.y); dropAt('chest', e.x + 12, e.y); } });
    },
    inter: st => (st.captives || []).filter(n => !n.dead).map(n => ({ x: n.x, y: n.y, npc: n, label: st.chiefDead ? 'Free the captive' : 'The captive is locked in. Kill the slaver chief', act: pl => { if (st.chiefDead) freeCaptive(st, n, pl); } })),
    amb(st, now, dt) { siteFlame(st.x + 4, st.y + 30, now, dt, 1); },
  },
  mercs: {
    w: 0.65, R: 90, col: '#ffd35a', safe: true,
    title: [n => n + ' Sellswords', 'Swords for hire. They accept gold'],
    build(st, r, put, pp) {
      ring(3, 62, (x, y) => put(sCache('tent', PROPS.tent), x, y + 8, { depth: 16 }), 0.5);
      pp('banner', -28, -30, 2); pp('banner', 32, -28, 2); pp('rack', -14, 30, 5); pp('crate', 40, 22, 5);
      st.npcs.push(makeNpc('merc', st.x - 14, st.y + 12)); st.npcs.push(makeNpc('merc', st.x + 16, st.y + 14));
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.3) / 80; if (d < 1 && n > d * 0.6) return hx('#3d3226'); return null; },
    amb(st, now, dt) { siteFlame(st.x, st.y + 2, now, dt, 1.4); },
  },
  sewer: {
    w: 0.65, R: 60, col: '#a6e05a',
    title: [n => n + ' Outfall', 'Something moves in the pipes'],
    build(st, r, put, pp) {
      put(sCache('outfall', () => makeOutfall(5)), 0, -16, { depth: 20 });
      pp('grate', 0, 20, 0); pp('barrel', 46, 8, 5); pp('rubble', -40, 18, 0);
      st.door = { x: st.x, y: st.y + 22 };
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.2); if (d < 44) return n < 0.3 ? [24, 50, 26, 230] : [32, 44, 36, 230]; if (d < 64 && n > 0.5) return hx('#2a2a30'); return null; },
    inter: st => (!st.done ? [{ x: st.x, y: st.y + 22, label: 'Climb into the sewer', act: pl => goDungeon(pl, 'sewer', st) }] : []),
    amb(st, now, dt) { sitePuff(dt, 5, st.x, st.y + 18, 10, 3, -16, 1.4, ['#a6e05a', '#4fa04a']); light(st.x, st.y + 18, 30, 0.5); },
  },
  frostcave: {
    w: 0.5, R: 60, col: '#8ff0ff',
    title: [n => 'The ' + n + ' Icehall', 'Cold breath rises from the cave mouth'],
    build(st, r, put, pp) {
      put(sCache('icecave', () => recolor(makeMine(3), { '#2e2a38': '#5a6c88', '#4a4258': '#8fa2ba', '#5f5769': '#c9d6e8', '#2f5238': '#dce6f2', '#6b6276': '#c9f7ff' })), 0, 0, { depth: 40 });
      pp('icespike', -50, 10, 4); pp('icespike', 54, 6, 4); pp('icespike', -36, 26, 3); pp('icespike', 38, 28, 3);
      st.door = { x: st.x, y: st.y + 8 }; st.labelH = 70;
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.3) / 66; if (d < 1 && n > d * 0.5) return n > 0.6 ? hx('#dce6f2') : hx('#b9c6d8'); return null; },
    inter: st => (!st.done ? [{ x: st.x, y: st.y + 8, label: 'Enter the frozen cavern', act: pl => goDungeon(pl, 'frost', st) }] : []),
    amb(st, now, dt) { sitePuff(dt, 5, st.x, st.y - 4, 14, 6, -10, 1.6, ['#ffffff', '#c9f7ff']); light(st.x, st.y, 36, 0.5); },
  },
  forge: {
    w: 0.5, R: 70, col: '#e8742c',
    title: [n => 'The Sunken ' + n + ' Forge', 'The anvils still ring. No one is there'],
    build(st, r, put, pp) {
      put(sCache('forge', () => RECIPES.smithy(23, false)), 0, 0, { depth: 28 });
      pp('anvil', -50, 18, 0); pp('brazier', 54, 8, 4); pp('crate', -36, 30, 5); pp('barrel', 40, 28, 5);
      st.door = { x: st.x, y: st.y + 6 }; st.labelH = 72;
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.2) / 70; if (d < 1 && n > d * 0.5) return n > 0.93 ? hx('#e8742c') : n > 0.5 ? [28, 22, 22] : [20, 16, 16]; return null; },
    inter: st => (!st.done ? [{ x: st.x, y: st.y + 8, label: 'Descend into the Sunken Forge', act: pl => goDungeon(pl, 'forge', st) }] : []),
    amb(st, now, dt) { sitePuff(dt, 8, st.x - 50, st.y + 10, 3, 2, -30, 0.8, ['#ffd35a', '#e8742c']); glowAt(st.x, st.y - 6, 30, '#e8742c', 0.35); },
  },
  obelisk: {
    w: 0.65, R: 80, col: '#9a4fd0',
    title: [n => 'The ' + n + ' Obelisk', 'Black stone. Violet glyphs. It is awake'],
    build(st, r, put, pp) {
      pp('obelisk', 0, 4, 8);
      ring(6, 48, (x, y) => pp(Math.random() < 0.5 ? 'rubble' : 'skullpost', x, y + 6, 0), 0.3);
      st.door = { x: st.x, y: st.y + 18 }; st.labelH = 80;
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.2); if (d < 60 && n > d / 60 * 0.4) return n > 0.93 ? [154, 79, 208, 230] : [20, 16, 28, 235]; return null; },
    inter: st => (!st.used ? [{ x: st.x, y: st.y + 18, label: 'Touch the dark obelisk', act: pl => obeliskModal(st, pl) }] : []),
    amb(st, now, dt) {
      if (!st.used || st.champ) { light(st.x, st.y - 20, 70, 0.8); glowAt(st.x, st.y - 22, 24, '#9a4fd0', 0.4 + Math.sin(now * 4) * 0.15); }
      sitePuff(dt, st.used ? 10 : 3, st.x, st.y - 8, 14, 4, -22, 1.2, ['#e27bf0', '#9a4fd0']);
    },
  },
  campsite: {
    w: 1.1, R: 60, col: '#c49a6a',
    title: [n => n + ' Camp', 'A fire, recently cold'],
    build(st, r, put, pp) {
      put(sCache('tent', PROPS.tent), -28, -6, { depth: 16 }); pp('campfire', 18, 8, 0); pp('crate', 40, -4, 5); pp('barrel', 46, 6, 5); pp('bench', 14, 24, 0);
      st.survivor = r() < 0.35; st.ambush = !st.survivor && r() < 0.3;
      if (st.survivor) { const n = makeNpc('prisoner', st.x - 4, st.y + 22); st.npcs.push(n); st.hurt = n; }
    },
    ground: (x, y, n) => { const d = Math.hypot(x, y * 1.25) / 54; if (d < 1 && n > d * 0.6) return hx('#3d3226'); return null; },
    act(st) {
      if (st.ambush) { around(st, 8, 90, ['bandit', 'ghoul']); banner('It was a trap', '', '#d8354a'); }
      else dropAt(Math.random() < 0.6 ? 'chest' : 'bag', st.x + 30, st.y + 4);
    },
    inter: st => (st.hurt && !st.hurt.dead ? [{ x: st.hurt.x, y: st.hurt.y, npc: st.hurt, label: 'Tend to the wounded adventurer', act: pl => tendAdventurer(st, pl) }] : []),
    amb(st, now, dt) { if (!st.ambush) siteFlame(st.x + 18, st.y + 6, now, dt, 1); else sitePuff(dt, 3, st.x + 18, st.y + 4, 3, 1, -12, 1.4, ['#5e557f', '#36304f']); },
  },
};

/* ---------- Interactions ---------- */
const BOONS = [
  { name: 'Boon of Might', desc: '+25% damage for the night', act: pl => giveBonus(pl, 'might', 0.25) },
  { name: 'Boon of Vigor', desc: '+30 max HP and a full heal', act: pl => { giveBonus(pl, 'hp', 30); pl.hp = pl.maxHp; } },
  { name: 'Boon of Fortune', desc: '+2 luck for the night', act: pl => giveBonus(pl, 'luck', 2) },
  { name: 'Boon of the Sky', desc: 'Aegis and Frenzy for 25 seconds', act: () => { G.buffs.aegis = Math.max(G.buffs.aegis || 0, 25); G.buffs.frenzy = Math.max(G.buffs.frenzy || 0, 25); } },
  { name: 'Boon of Plenty', desc: '200 gold', act: pl => { G.gold += Math.round(200 * pl.greed); } },
  { name: 'Boon of Craft', desc: 'A free upgrade, twice', act: pl => { const k = P; P = pl; applyChoice(rollChoices(1)[0]); applyChoice(rollChoices(1)[0]); P = k; } },
];
function standingStones(st, pl) {
  const offer = [...BOONS].sort(() => Math.random() - 0.5).slice(0, 3);
  openModal({
    title: 'The Standing Stones', color: '#9a4fd0', sub: 'The runes wake under your hand', body: '<p class="flavor">Three voices, three gifts. The stones will grant only one.</p>',
    buttons: [...offer.map(b => ({ label: b.name, desc: b.desc, primary: true, act: () => { st.used = true; st.done = true; b.act(pl); Snd.play('evolve'); banner(b.name, b.desc, '#9a4fd0'); } })), { label: 'Walk away' }],
  }, pl);
}
function bloodAltar(st, pl) {
  openModal({
    title: 'The Blood Altar', color: '#d8354a', sub: `${st.uses} offering${st.uses === 1 ? '' : 's'} left`, body: '<p class="flavor">The bowl is dry. It has been dry for a long time. It is very patient.</p>',
    buttons: [
      { label: 'Offer your blood', desc: 'Lose 35% of your life. Receive 120 gold', disabled: pl.hp < pl.maxHp * 0.5, act: () => { survivorsHeal(pl, -pl.maxHp * 0.35); pl.hp = Math.max(1, pl.hp); G.gold += Math.round(120 * pl.greed); st.uses--; burst(pl.x, pl.y, '#d8354a', 20, 80); Snd.play('curse'); if (st.uses > 0) bloodAltar(st, pl); else st.done = true; } },
      { label: 'Offer your strength', desc: 'Lose 20 max HP for good. Two free upgrades', disabled: pl.maxHp <= 60, act: () => { giveBonus(pl, 'hp', -20); pl.hp = Math.min(pl.hp, pl.maxHp); const k = P; P = pl; applyChoice(rollChoices(1)[0]); applyChoice(rollChoices(1)[0]); P = k; st.uses--; Snd.play('evolve'); if (st.uses > 0) bloodAltar(st, pl); else st.done = true; } },
      { label: 'Offer 100 gold', desc: 'Blood Pact: 60% more damage for 90 seconds', disabled: G.gold < 100, act: () => { G.gold -= 100; G.buffs.bloodpact = 90; st.uses--; Snd.play('buff'); if (st.uses > 0) bloodAltar(st, pl); else st.done = true; } },
      { label: 'Leave' },
    ],
  }, pl);
}
function pickApple(st, pl) {
  st.apples--;
  const golden = Math.random() < 0.12;
  survivorsHeal(pl, golden ? pl.maxHp : 40);
  if (golden) { giveBonus(pl, 'hp', 10); banner('A golden apple', '+10 max HP and a full heal', '#ffd35a'); Snd.play('evolve'); } else { addText(pl.x, pl.y - 14, '+40', false, '#a6e05a'); Snd.play('heal'); }
  burst(pl.x, pl.y, '#d8354a', 8, 40);
  if (st.apples <= 0) st.done = true;
}
function lightBeacon(st, pl) {
  st.def = { t: 0, spawn: 0 };
  banner('The beacon burns', 'Hold out for 45 seconds', '#ffd35a'); Snd.play('warn');
}
function freeCaptive(st, n, pl) {
  const type = pick(ALLY_RESCUE);
  n.dead = true; st.freed = (st.freed || 0) + 1;
  if (!(st.captives || []).some(c => !c.dead)) st.done = true;
  rescueModal('The captive', st, pl, null, type);
}
function tendAdventurer(st, pl) {
  const type = pick(ALLY_RESCUE);
  openModal({
    title: 'A wounded adventurer', color: '#ffd35a', sub: 'Barely breathing', body: '<p class="flavor">They grip your sleeve. "Bandages... anything..."</p>',
    buttons: [
      { label: 'Use a bandage kit (25 gold)', desc: ALLY_TYPES[type].name + ' will fight beside you', primary: true, disabled: G.gold < 25 || partyOf().length >= PARTY_MAX, act: () => { G.gold -= 25; st.hurt.dead = true; st.done = true; recruit(type, pl); } },
      { label: 'Take their pack', desc: '+60 gold', act: () => { G.gold += Math.round(60 * pl.greed); st.hurt.dead = true; st.done = true; } },
      { label: 'Leave them' },
    ],
  }, pl);
}
function obeliskModal(st, pl) {
  openModal({
    title: 'The Dark Obelisk', color: '#9a4fd0', sub: 'It has been waiting', body: '<p class="flavor">Touch it, and its keepers wake: a champion and the dead it commands. Slay the champion and the obelisk gives up everything it hoards.</p>',
    buttons: [
      { label: 'Wake the obelisk', desc: 'A champion, a horde, a chest, a relic', primary: true, act: () => {
        st.used = true;
        around(st, 14, 130, ['wraith', 'wraith', 'skel']);
        st.champ = makeBoss('champion', st.x, st.y - 40, { minor: true, hpMul: G.hpMul * 1.3, onDeath: e => {
          st.champ = null; st.done = true;
          dropAt('chest', e.x - 14, e.y, { boss: true }); dropAt('chest', e.x + 14, e.y, { boss: true });
          const owned = new Set(G.players.flatMap(p => p.relics || [])), pool = Object.keys(RELICS).filter(k => !owned.has(k));
          if (pool.length) dropRelic(pick(pool), e.x, e.y + 18);
          dropFragment(e.x, e.y - 14);
          banner('The obelisk falls silent', 'Take what it guarded', '#9a4fd0');
        } });
        banner('The obelisk wakes', 'Slay the champion', '#9a4fd0'); Snd.play('warn'); G.shake = 6;
      } },
      { label: 'Step back' },
    ],
  }, pl);
}

/* Shops */
const SITE_SHOPS = {
  medic(st) {
    const pl = P;
    return [
      { name: 'Bandage kit', desc: 'Restore 60 HP', cost: 20, buy: () => survivorsHeal(pl, 60) },
      { name: 'Field surgery', desc: '+20 max HP for the rest of the night', cost: 110, sold: ((pl.bonus && pl.bonus.hp) || 0) >= 60, buy: () => { giveBonus(pl, 'hp', 20); survivorsHeal(pl, 20); } },
      { name: 'Smelling salts', desc: 'Rise once more if you fall', cost: 260, sold: !!G.salted, buy: () => { G.revivals++; G.salted = true; } },
      { name: 'Hire the Medic', desc: ALLY_TYPES.medic.desc, cost: ALLY_TYPES.medic.cost, sold: !!(st && st.hired) || partyOf().length >= PARTY_MAX, buy: () => { if (recruit('medic', pl) && st) st.hired = true; } },
    ];
  },
  scholar() {
    const pl = P;
    return [
      { name: 'Study at the desk', desc: 'Gain a level at once', cost: 45 + G.level * 14, buy: () => { const k = P; P = pl; gainXp((G.xpNext - G.xp) / pl.growth + 0.05); P = k; } },
      { name: 'Borrow a rare tome', desc: 'One of your weapons gains a level', cost: 70, buy: () => { const w = pl.weapons.filter(x => !x.evo && x.level < WEAPON_MAX(x.id)).sort(() => Math.random() - 0.5)[0]; if (w) { w.level++; recalcFor(pl); refreshSlots(); } else G.gold += 70; } },
      { name: 'Copy a scroll of insight', desc: '+1 reroll for level-ups', cost: 50, buy: () => { G.rerolls++; } },
      { name: 'Forbidden knowledge', desc: 'Learn a random upgrade now', cost: 90, buy: () => { const k = P; P = pl; applyChoice(rollChoices(1)[0]); P = k; } },
    ];
  },
  merc() {
    const pl = P;
    return ['squire', 'ranger', 'hexer', 'runeknight'].map(id => ({ name: 'Hire a ' + ALLY_TYPES[id].name, desc: ALLY_TYPES[id].desc, cost: ALLY_TYPES[id].cost, sold: partyOf().length >= PARTY_MAX, buy: () => { recruit(id, pl); } }));
  },
};
const siteShopItems = shopItems;
shopItems = function (kind, st) { return SITE_SHOPS[kind] ? SITE_SHOPS[kind](st) : siteShopItems(kind, st); };
function gambleModal(st, pl) {
  const odds = Math.min(0.62, 0.44 + (pl.luck || 0) * 0.02), bets = [25, 75, 200];
  openModal({
    title: 'The Gambler', color: '#e27bf0', sub: `${goldLine()} · odds ${Math.round(odds * 100)}%`, body: '<p class="flavor">"One coin, one flip. The house is generous. The dark is not."</p>',
    buttons: [
      ...bets.map(b => ({ label: `Bet ${b} gold`, desc: `Win ${b * 2}`, disabled: G.gold < b, act: () => {
        G.gold -= b;
        if (Math.random() < odds) { G.gold += b * 2; Snd.play('jackpot'); banner('You win', `+${b} gold`, '#ffd35a'); } else { Snd.play('fizzle'); banner('You lose', `-${b} gold`, '#d8354a'); }
        gambleModal(st, pl);
      } })),
      { label: 'Buy a mystery box', desc: 'A random fate. 60 gold', disabled: G.gold < 60, act: () => { G.gold -= 60; openModal(outcomeModal(rollFate(), 'The box opens'), pl); } },
      { label: 'Leave' },
    ],
  }, pl);
}
const siteOpenShop = openShop;
openShop = function (kind, st, pl = P) { if (kind === 'gambler') return gambleModal(st, pl); return siteOpenShop(kind, st, pl); };

/* ---------- Plug the sites into the structure engine ---------- */
for (const [type, d] of Object.entries(SITES)) {
  STRUCT_W[type] = d.w * 0.75; STRUCT_R[type] = d.R; STRUCT_COL[type] = d.col; STRUCT_TITLE[type] = d.title;
}
const siteBuild = buildSite;
buildSite = function (st) {
  const d = SITES[st.type];
  if (!d) { siteBuild(st); return; }
  const r = mulberry32(st.seed), put = (spr, dx, dy, o) => placeBuilding(st, spr, st.x + dx, st.y + dy, o), pp = (k, dx, dy, solid = 0) => placeProp(st, k, st.x + dx, st.y + dy, solid);
  d.build(st, r, put, pp);
};
const siteGround = paintGround;
paintGround = function (st) {
  const d = SITES[st.type];
  if (!d) return siteGround(st);
  const ext = st.R + 60, S = Math.ceil(ext * 2), c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), data = img.data, o = ext;
  for (let py = 0; py < S; py++) for (let pxx = 0; pxx < S; pxx++) {
    const col = d.ground ? d.ground(pxx - o, py - o, nz(pxx >> 1, py >> 1, st.seed), st) : null;
    if (!col) continue;
    const i = (py * S + pxx) * 4; data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = col[3] ?? 255;
  }
  g.putImageData(img, 0, 0);
  for (const p of st.pieces) {
    if (p.grave || !p.spr) continue;
    const bx = p.x - st.x + o, by = p.y - st.y + o, w = p.spr.w;
    g.fillStyle = 'rgba(11,10,18,0.45)';
    if (p.big) { g.fillRect(Math.round(bx - w / 2 + 2), Math.round(by - 1), w, 3); g.fillStyle = 'rgba(11,10,18,0.25)'; g.fillRect(Math.round(bx - w / 2 + 4), Math.round(by + 2), w - 2, 2); }
    else g.fillRect(Math.round(bx - w * 0.4), Math.round(by - 1), Math.round(w * 0.8), 2);
  }
  return { c, ox: st.x - o, oy: st.y - o };
};
const siteActivate = activateStruct;
activateStruct = function (st) { siteActivate(st); const d = SITES[st.type]; if (d && d.act) d.act(st); };
const siteInteractables = interactablesOf;
interactablesOf = function (st) { const list = siteInteractables(st), d = SITES[st.type]; if (d && d.inter && !st.ruined) list.push(...d.inter(st)); return list; };
const siteAmbience = ambience;
ambience = function (st, now, dt) { siteAmbience(st, now, dt); const d = SITES[st.type]; if (d && d.amb) d.amb(st, now, dt); };

/* ---------- Per-frame behaviour: healing fires, safe zones, beacon waves ---------- */
Mods.add({
  update(dt) {
    if (G.dim) return;
    for (const st of regionCache.values()) {
      if (!st || !st.built) continue;
      const d = SITES[st.type];
      if (!d) continue;
      if (d.safe) {
        for (const e of G.enemies) {
          if (e.dead || e.prop || e.boss || e.ai) continue;
          const dx = e.x - st.x, dy = e.y - st.y, dist = Math.hypot(dx, dy);
          if (dist < st.R) { e.x = st.x + dx / (dist || 1) * st.R; e.y = st.y + dy / (dist || 1) * st.R; }
        }
      }
      if (st.type === 'fieldhospital' && st.fire) {
        const fx = st.fire.x, fy = st.fire.y;
        const mend = (who, isAlly) => {
          if (Math.hypot(who.x - fx, (who.y - fy) * 1.2) > 58) return;
          if (isAlly && who.down) { who.reviveT += dt * 2; return; }
          if (who.down || who.hp >= who.maxHp) return;
          who.hp = Math.min(who.maxHp, who.hp + Math.max(5, who.maxHp * 0.06) * dt);
          if (Math.random() < dt * 6) addPart(who.x + rand(-5, 5), who.y - 4, 0, -22, 0.6, '#a6e05a');
          if (!st.mended) { st.mended = true; banner('The fire mends you', 'Rest by the field hospital', '#a6e05a'); }
        };
        for (const pl of G.players) mend(pl, false);
        for (const a of G.allies || []) mend(a, true);
      }
      if (st.type === 'beacon' && st.def) {
        const df = st.def;
        df.t += dt; df.spawn -= dt;
        if (df.spawn <= 0 && df.t < 42) {
          df.spawn = 1.5;
          const wave = WAVES[Math.min(WAVES.length - 1, Math.floor(G.t / 60))];
          for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, e = spawnEnemy(weighted(wave.types), st.x + Math.cos(a) * 250, st.y + Math.sin(a) * 190); e.xp *= 2; }
        }
        if (df.t >= 45) {
          st.def = null; st.done = true;
          for (const e of G.enemies) if (!e.dead && !e.prop && !e.boss && Math.hypot(e.x - st.x, e.y - st.y) < 500) e.dawn = rand(0.2, 1.4);
          dropAt('chest', st.x - 12, st.y + 14, { boss: true }); dropAt('bag', st.x + 14, st.y + 14);
          const owned = new Set(G.players.flatMap(p => p.relics || [])), pool = Object.keys(RELICS).filter(k => !owned.has(k));
          if (pool.length) dropRelic(pick(pool), st.x, st.y + 28);
          banner('The beacon holds', 'Take your reward', '#ffd35a'); Snd.play('levelup');
        }
      }
    }
  },
});
