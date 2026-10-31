'use strict';
/* Dungeon variety and danger. Rooms are assembled from many procedural layouts instead of four fixed ones; there are
   three new places to descend (sewer, frozen cavern, sunken forge); floors gain moving and crumbling platforms, saw
   blades, healing fonts, captives to rescue, mimic chests and elite foes. Every dungeon can be dived deeper: each level
   is more dangerous and the treasure at the end grows with it. */

const MAX_DEEP = 3;
Object.assign(CRYPT_FOES, {
  K: { ...CRYPT_FOES.k, hp: 300, dmg: 28, spd: 36, elite: true },
  R: { ...CRYPT_FOES.r, hp: 210, elite: true },
  Z: { ...CRYPT_FOES.z, hp: 170, dmg: 20, w: 10, h: 15, spd: 46, elite: true },
  Q: { hp: 330, w: 12, h: 16, spd: 24, spr: 'golem', color: '#8ff0ff', dmg: 28, reach: 24, wind: 0.8, elite: true },
  s: { hp: 40, w: 10, h: 7, spd: 24, spr: 'slime', color: '#4fa04a', dmg: 10, reach: 12, wind: 0.5 },
  w: { hp: 42, w: 12, h: 8, spd: 72, spr: 'wolf', color: '#c9f7ff', dmg: 12, reach: 16, wind: 0.3 },
  h: { hp: 60, w: 12, h: 8, spd: 84, spr: 'hound', color: '#d8354a', dmg: 14, reach: 16, wind: 0.3 },
  g: { hp: 170, w: 12, h: 16, spd: 22, spr: 'golem', color: '#8ff0ff', dmg: 22, reach: 22, wind: 0.85 },
  e: { hp: 28, w: 8, h: 8, spd: 42, spr: 'eye', color: '#3f8ee0', dmg: 8, fly: true, shooter: true },
  i: { hp: 30, w: 8, h: 8, spd: 55, spr: 'imp', color: '#d8354a', dmg: 10, fly: true, shooter: true },
});
const THEME_FOES = {
  crypt: { ground: ['z', 'z', 'u'], range: ['a'], fly: ['b', 'b'], elite: ['K', 'Z'] },
  cellar: { ground: ['z', 'z'], range: ['a'], fly: ['b'], elite: ['Z'] },
  tower: { ground: ['u', 'z'], range: ['a'], fly: ['b'], elite: ['K', 'R'] },
  ruins: { ground: ['u', 'z'], range: ['a'], fly: ['b', 'c'], elite: ['R'] },
  mine: { ground: ['m', 'm', 'z'], range: ['a'], fly: ['b'], elite: ['K'] },
  temple: { ground: ['u'], range: ['a'], fly: ['c', 'b'], elite: ['R', 'K'] },
  mansion: { ground: ['r', 'z'], range: ['c'], fly: ['o', 'c'], elite: ['R'] },
  sewer: { ground: ['s', 'z', 's'], range: ['a'], fly: ['b', 'e'], elite: ['Z'] },
  frost: { ground: ['w', 'w', 'u'], range: ['a'], fly: ['e', 'b'], elite: ['Q'] },
  forge: { ground: ['h', 'm', 'h'], range: ['a'], fly: ['i', 'i'], elite: ['Q', 'K'] },
};
Object.assign(TPAL, {
  bone: { wall: '#6a6270', mortar: '#3a3444', back: ['#14121a', '#1c1824', '#181620'], top: '#c4bccf', moss: ['#8a8496', '#c4bccf'], plank: ['#5a3a28', '#9a6a42'], edge: ['#8a8496', '#24202e'] },
  flood: { wall: '#2a4150', mortar: '#162634', back: ['#0a1219', '#0f1b24', '#0c161e'], top: '#3f8ee0', moss: ['#1d3d7a', '#3f8ee0'], plank: ['#3a3a30', '#7a7a60'], edge: ['#3f6f8e', '#102030'] },
  blood: { wall: '#4a2a34', mortar: '#2a141c', back: ['#1a0a10', '#240e16', '#1e0c12'], top: '#9a3a4a', moss: ['#7a1a2a', '#d8354a'], plank: ['#4a2a20', '#8a5a40'], edge: ['#7a3a4a', '#1a0a10'] },
  sewer: { wall: '#3a4a3a', mortar: '#1f2a1f', back: ['#0a110a', '#101a10', '#0d150d'], top: '#6a8a4a', moss: ['#2f6b3a', '#a6e05a'], plank: ['#4a4a30', '#8a8a5a'], edge: ['#5a7a5a', '#142014'] },
  frost: { wall: '#5a6c88', mortar: '#34425a', back: ['#0e1420', '#141c2c', '#101826'], top: '#dce6f2', moss: ['#c9d6e8', '#ffffff'], plank: ['#5a6c88', '#c9d6e8'], edge: ['#8fa2ba', '#24304a'] },
  forge: { wall: '#3a2e30', mortar: '#1e1618', back: ['#160c0a', '#20100c', '#1a0e0a'], top: '#e8742c', moss: ['#7a1a2a', '#e8742c'], plank: ['#3a2618', '#7a5236'], edge: ['#6a3a2a', '#140a08'] },
});
Object.assign(THEMES.crypt, { pals: ['crypt', 'bone', 'flood', 'blood'] });
Object.assign(THEMES, {
  sewer: { names: ['The Rotting Sewers', 'Outfall Tunnels', 'The Drowned Pipes'], mids: () => [], n: 3, pal: 'sewer' },
  frost: { names: ['The Frozen Cavern', 'Icehall Depths', 'The Glass Grotto'], mids: () => [], n: 3, pal: 'frost' },
  forge: { names: ['The Sunken Forge', 'Furnace Deeps', 'The Slag Halls'], mids: () => [], n: 3, pal: 'forge' },
});

/* ---------- Procedural rooms ---------- */
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickOf = arr => arr[Math.floor(Math.random() * arr.length)];
function newGrid() {
  const g = Array.from({ length: 16 }, () => Array(40).fill('.'));
  g.set = (c, r, ch) => { if (c >= 0 && c < 40 && r >= 0 && r < 16) g[r][c] = ch; };
  g.hl = (c0, c1, r, ch) => { for (let c = c0; c <= c1; c++) g.set(c, r, ch); };
  g.blk = (c0, c1, r0, r1, ch) => { for (let r = r0; r <= r1; r++) g.hl(c0, c1, r, ch); };
  // stand a foe on whatever floor is near this column
  g.stand = (c, r, ch) => {
    for (const dc of [0, 1, -1, 2, -2, 3, -3]) {
      const cc = c + dc;
      if (cc < 2 || cc > 37 || g[r][cc] !== '.') continue;
      if (r === 15 || g[r + 1][cc] === '#' || g[r + 1][cc] === '=') { g[r][cc] = ch; return true; }
    }
    return false;
  };
  g.air = (c, r, ch) => { if (g[r] && g[r][c] === '.') g[r][c] = ch; };
  g.rows = () => g.map(r => r.join(''));
  return g;
}
const ARCH = {
  spikepit(g, F, d) {
    const w = ri(4, 7), c0 = ri(11, 28 - w);
    g.hl(c0, c0 + w - 1, 15, '^');
    if (Math.random() < 0.6) g.hl(c0 - 1, c0 + w, 11, '=');
    g.stand(c0 - 5, 15, pickOf(F.ground)); g.stand(c0 + w + 4, 15, pickOf(F.ground));
    g.air(c0 + (w >> 1), 8, pickOf(F.fly));
    if (d) g.stand(c0 + w + 8, 15, pickOf(F.range));
  },
  stairs(g, F, d) {
    const h = ri(3, 4), step = 3, left = ri(3, Math.max(3, 39 - (h * 6 + 4)));
    for (let i = 0; i < h; i++) g.blk(left + i * step, left + i * step + 2, 15 - i, 15, '#');
    const top = left + h * step;
    g.blk(top, top + 3, 15 - h, 15, '#');
    for (let i = 0; i < h; i++) { const c0 = top + 4 + i * step; g.blk(c0, c0 + 2, 15 - (h - 1 - i), 15, '#'); }
    g.stand(top + 1, 14 - h, pickOf(F.range)); if (d) g.stand(top + 3, 14 - h, pickOf(F.ground));
    g.stand(left - 2, 15, pickOf(F.ground)); g.stand(top + 4 + h * step + 1, 15, pickOf(F.ground)); g.air(top + 2, 7, pickOf(F.fly));
  },
  pillars(g, F, d) {
    const n = ri(3, 4);
    let c = ri(6, 9), tall = 0;
    for (let i = 0; i < n; i++) {
      const h = ri(2, 4);
      g.blk(c, c + 1, 16 - h, 15, '#'); if (h > tall) { tall = h; g.stand(c, 15 - h, pickOf(F.range)); }
      if (i) g.stand(c - 3, 15, pickOf(F.ground));
      c += ri(6, 8);
      if (c > 34) break;
    }
    g.air(20, 6, pickOf(F.fly)); if (d) g.air(28, 8, pickOf(F.fly));
  },
  floating(g, F, d) {
    const n = ri(5, 6), rows = [11, 9, 11, 8, 10, 9];
    for (let i = 0; i < n; i++) g.hl(4 + i * 6, 6 + i * 6, rows[i], '=');
    const ci = ri(1, n - 1);
    if (Math.random() < 0.4) g.set(5 + ci * 6, rows[ci] - 1, 'C');
    g.air(10, 5, pickOf(F.fly)); g.air(24, 6, pickOf(F.fly)); if (d) g.air(32, 5, pickOf(F.fly));
    g.stand(14, 15, pickOf(F.ground)); g.stand(30, 15, pickOf(F.ground)); g.stand(22, 15, pickOf(F.ground));
  },
  gauntlet(g, F, d) {
    for (const c of [ri(10, 14), ri(24, 28)]) { g.set(c, 13, '#'); g.set(c, 14, 'A'); g.set(c, 15, '#'); }
    const n = 4 + d;
    for (let i = 0; i < n; i++) g.stand(6 + Math.floor(i * 28 / n), 15, i % 3 === 2 ? pickOf(F.range) : pickOf(F.ground));
  },
  lowceil(g, F, d) {
    g.blk(8, 31, 0, 8, '#');
    for (const c of [ri(12, 16), ri(22, 27)]) g.hl(c, c + 2, 15, '^');
    g.stand(10, 15, pickOf(F.ground)); g.stand(20, 15, pickOf(F.ground)); g.stand(30, 15, pickOf(F.ground));
    g.air(18, 11, pickOf(F.fly)); g.air(27, 12, pickOf(F.fly)); if (d) g.stand(24, 15, pickOf(F.elite));
  },
  loft(g, F, d) {
    g.hl(5, 7, 12, '='); g.hl(10, 12, 9, '='); g.hl(15, 17, 6, '=');
    g.hl(18, 35, 5, '=');
    g.set(33, 4, 'C'); g.stand(24, 4, pickOf(F.elite)); g.stand(29, 4, pickOf(F.range));
    g.stand(8, 15, pickOf(F.ground)); g.stand(20, 15, pickOf(F.ground)); g.stand(32, 15, pickOf(F.ground));
  },
  trapfield(g, F, d) {
    for (let k = 0; k < 4; k++) { g.hl(9 + k * 6, 11 + k * 6, 15, '^'); g.hl(12 + k * 6, 13 + k * 6, 15, '#'); }
    g.hl(20, 23, 12, '=');
    g.stand(4, 15, pickOf(F.ground)); g.stand(35, 15, pickOf(F.range)); g.air(22, 9, pickOf(F.fly)); if (d) g.stand(21, 11, pickOf(F.range));
  },
  arena(g, F, d) {
    g.blk(12, 13, 14, 15, '#'); g.blk(26, 27, 14, 15, '#');
    g.stand(20, 15, pickOf(F.elite)); g.stand(16, 15, pickOf(F.ground)); g.stand(24, 15, pickOf(F.ground));
    g.air(10, 7, pickOf(F.fly)); g.air(30, 7, pickOf(F.fly)); if (d) g.stand(32, 15, pickOf(F.range));
  },
  shrine(g, F, d) {
    g.set(20, 15, 'H'); g.set(14, 2, 'T'); g.set(26, 2, 'T');
    if (Math.random() < 0.4) g.set(31, 15, 'P');
    g.stand(8, 15, pickOf(F.ground)); g.air(30, 8, pickOf(F.fly));
  },
  cavern(g, F, d) {
    for (let c = 3; c < 37; c += ri(2, 4)) { const len = ri(1, 4), w = ri(1, 2); g.blk(c, c + w - 1, 0, len - 1, '#'); }
    for (let c = 4; c < 36; c += ri(5, 8)) { const w = ri(2, 3), h = ri(1, 2); g.blk(c, c + w - 1, 16 - h, 15, '#'); }
    for (let i = 0; i < 3 + d; i++) g.stand(ri(5, 35), 15, pickOf(F.ground));
    g.air(ri(10, 14), 8, pickOf(F.fly)); g.air(ri(24, 30), 9, pickOf(F.fly));
  },
  sawyard(g, F, d) {
    g.set(14, 15, 'W'); g.set(27, 15, 'W');
    if (d) g.set(20, 10, 'W');
    g.hl(17, 23, 11, '=');
    g.stand(6, 15, pickOf(F.ground)); g.stand(34, 15, pickOf(F.ground)); g.stand(20, 10, pickOf(F.range));
  },
  crumble(g, F, d) {
    const c0 = ri(10, 14), w = 11;
    g.hl(c0, c0 + w - 1, 15, '^');
    g.set(c0 + 1, 13, '1'); g.set(c0 + 5, 12, '1'); g.set(c0 + 8, 13, '1');
    g.stand(c0 - 4, 15, pickOf(F.ground)); g.stand(c0 + w + 3, 15, pickOf(F.ground)); g.air(c0 + 5, 7, pickOf(F.fly));
    if (Math.random() < 0.5) g.set(c0 + 5, 11, 'C');
  },
  chasm(g, F, d) {
    const c0 = ri(11, 14);
    g.hl(c0, c0 + 8, 15, '^');
    g.set(c0 + 3, 12, '2');
    g.stand(c0 - 4, 15, pickOf(F.ground)); g.stand(c0 + 12, 15, pickOf(F.range)); g.air(c0 + 4, 7, pickOf(F.fly));
  },
  elevator(g, F, d) {
    g.hl(20, 36, 6, '#'); g.blk(20, 36, 6, 6, '#');
    g.set(16, 12, '3'); g.set(33, 5, 'C'); g.stand(27, 5, pickOf(F.elite));
    g.stand(8, 15, pickOf(F.ground)); g.stand(26, 15, pickOf(F.ground)); g.air(30, 9, pickOf(F.fly));
  },
  mimicnook(g, F, d) {
    g.blk(26, 33, 9, 9, '#'); g.set(29, 8, 'C'); g.hl(24, 25, 12, '='); g.hl(21, 22, 14, '=');
    g.stand(12, 15, pickOf(F.ground)); g.stand(32, 15, pickOf(F.ground)); g.stand(16, 15, pickOf(F.range)); g.air(28, 5, pickOf(F.fly));
  },
};
const THEME_KINDS = {
  crypt: ['spikepit', 'stairs', 'pillars', 'floating', 'gauntlet', 'loft', 'trapfield', 'arena', 'shrine', 'crumble', 'sawyard', 'mimicnook'],
  cellar: ['spikepit', 'pillars', 'gauntlet', 'lowceil', 'arena', 'shrine', 'cavern'],
  tower: ['stairs', 'pillars', 'floating', 'loft', 'arena', 'chasm', 'elevator', 'sawyard'],
  ruins: ['spikepit', 'pillars', 'floating', 'trapfield', 'crumble', 'arena'],
  mine: ['lowceil', 'cavern', 'gauntlet', 'sawyard', 'spikepit', 'elevator', 'chasm'],
  temple: ['pillars', 'trapfield', 'gauntlet', 'crumble', 'chasm', 'shrine'],
  mansion: ['floating', 'loft', 'gauntlet', 'arena', 'mimicnook', 'shrine'],
  sewer: ['cavern', 'lowceil', 'spikepit', 'floating', 'gauntlet', 'crumble', 'sawyard', 'shrine', 'mimicnook'],
  frost: ['cavern', 'stairs', 'chasm', 'crumble', 'floating', 'arena', 'elevator', 'loft', 'shrine'],
  forge: ['sawyard', 'trapfield', 'crumble', 'chasm', 'arena', 'gauntlet', 'elevator', 'lowceil', 'spikepit'],
};
function genRoom(theme, d) {
  const g = newGrid();
  ARCH[pickOf(THEME_KINDS[theme] || THEME_KINDS.crypt)](g, THEME_FOES[theme] || THEME_FOES.crypt, d);
  g.set(ri(5, 9), 2, 'T'); g.set(ri(26, 33), 2, 'T');
  return g.rows();
}
function genStart(theme) {
  const g = newGrid(), F = THEME_FOES[theme] || THEME_FOES.crypt;
  for (let r = 0; r < 16; r++) g.set(0, r, '#');
  g.set(3, 15, 'S'); g.set(6, 2, 'T'); g.set(24, 2, 'T');
  const v = ri(0, 2);
  if (v === 0) { g.hl(12, 15, 12, '='); g.stand(20, 15, pickOf(F.ground)); g.air(28, 7, pickOf(F.fly)); }
  else if (v === 1) { g.blk(16, 21, 13, 15, '#'); g.stand(18, 12, pickOf(F.range)); g.stand(28, 15, pickOf(F.ground)); }
  else { g.hl(14, 17, 15, '^'); g.hl(13, 18, 11, '='); g.stand(24, 15, pickOf(F.ground)); g.air(30, 8, pickOf(F.fly)); }
  return g.rows();
}
function genEnd(theme, d) {
  const g = newGrid(), F = THEME_FOES[theme] || THEME_FOES.crypt;
  g.set(29, 15, 'X'); g.set(35, 15, 'D'); g.set(5, 2, 'T'); g.set(22, 2, 'T'); g.set(36, 2, 'T');
  const v = ri(0, 2);
  g.stand(22, 15, pickOf(F.elite)); g.stand(34, 6, pickOf(F.range));
  if (v === 0) { g.hl(30, 38, 7, '='); g.hl(8, 11, 12, '='); g.air(14, 7, pickOf(F.fly)); }
  else if (v === 1) { g.hl(15, 18, 15, '^'); g.stand(10, 15, pickOf(F.ground)); g.air(26, 6, pickOf(F.fly)); }
  else { g.blk(12, 13, 13, 15, '#'); g.hl(24, 26, 11, '='); g.stand(8, 15, pickOf(F.ground)); g.air(18, 7, pickOf(F.fly)); }
  if (d) g.stand(26, 15, pickOf(F.elite));
  return g.rows();
}

/* ---------- Building a level ---------- */
function makeFoe(type, x, y, mul, dmgMul = 1) {
  const f = CRYPT_FOES[type];
  return { type, x, y, ...f, dmg: f.dmg * dmgMul, frames: SPR[f.spr], hp: f.hp * mul, max: f.hp * mul, vx: 0, vy: 0, face: -1, st: 'idle', t: 0, cd: rand(0.5, 1.5),
    flash: 0, stun: 0, dead: false, anim: Math.random() * 5, onGround: false };
}
const MODS = {
  frenzied: { name: 'Frenzied foes', desc: 'faster and quicker to strike' },
  armored: { name: 'Armored foes', desc: 'tougher to kill' },
  swarming: { name: 'Swarming foes', desc: 'many more of them' },
};
buildCrypt = function (theme = 'crypt', floor = 1, st = null, deep = 0) {
  const T = THEMES[theme], map = T.map || {};
  const carry = deep ? G.cryptCarry || {} : (G.cryptCarry = null, {});
  const last = !T.floors || floor >= T.floors;
  let mids = [];
  if (T.fixed) {
    mids = [...T.mids()];
    for (let i = 0, n = 1 + (deep >= 2 ? 1 : 0); i < n; i++) mids.splice(ri(0, mids.length), 0, genRoom(theme, deep));
  } else {
    const n = T.n + (Math.random() < 0.5 ? 1 : 0) + (deep >= 2 ? 1 : 0), hand = T.mids();
    while (mids.length < n) mids.push(hand.length && Math.random() < 0.3 ? pickOf(hand) : genRoom(theme, deep));
  }
  const rooms = [genStart(theme), ...mids, T.gate ? GATE_END : genEnd(theme, deep)];
  const RW = 40, RH = 18, tiles = Array.from({ length: RH }, () => []);
  const spawns = [], torches = [], levers = [], gates = [], barrels = [], ores = [], chests = [], traps = [], plats = [], saws = [], fonts = [], captives = [];
  let start = null, chestAt = null, doorAt = null;
  rooms.forEach((room, ri2) => {
    for (let ty = 0; ty < RH; ty++) {
      let row = ty === 0 || ty === RH - 1 ? '#'.repeat(RW) : (room[ty - 1] || '').padEnd(RW, '.').slice(0, RW);
      if (ri2 === rooms.length - 1) row = row.slice(0, RW - 1) + '#';
      for (let i = 0; i < RW; i++) {
        let ch = row[i];
        const tx = ri2 * RW + i, px = tx * DT + DT / 2, py = (ty + 1) * DT;
        if (map[ch]) ch = map[ch];
        let t = ch;
        if (CRYPT_FOES[ch]) { spawns.push({ type: ch, x: px, y: py }); t = '.'; }
        else if (ch === 'S') { start = { x: px, y: py }; t = '.'; }
        else if (ch === 'X') { chestAt = { x: px, y: py }; t = '.'; }
        else if (ch === 'D') { doorAt = { x: px, y: py }; t = '.'; }
        else if (ch === 'T') { torches.push({ x: px, y: ty * DT + 4 }); t = '.'; }
        else if (ch === 'L') { levers.push({ x: px, y: py, on: false }); t = '.'; }
        else if (ch === 'G') { gates.push([tx, ty]); t = '#'; }
        else if (ch === 'B') { barrels.push({ x: px, y: py }); t = '.'; }
        else if (ch === 'O') { ores.push({ x: px, y: py, hp: 3 }); t = '.'; }
        else if (ch === 'C') { chests.push({ x: px, y: py, mimic: Math.random() < 0.16 + 0.05 * deep }); t = '.'; }
        else if (ch === 'A') { traps.push({ tx, ty, t: Math.random() * 2 }); t = '#'; }
        else if (ch === 'H') { fonts.push({ x: px, y: py, used: false }); t = '.'; }
        else if (ch === 'P') { captives.push({ x: px, y: py, freed: false, type: pickOf(ALLY_RESCUE) }); t = '.'; }
        else if (ch === 'W') { saws.push({ x: px, x0: px, y: py - 5, ph: Math.random() * 6, range: 22 }); t = '.'; }
        else if (ch === '1' || ch === '2' || ch === '3') {
          plats.push({ kind: ch === '1' ? 'crumble' : ch === '2' ? 'hmove' : 'vmove', x: px + DT, x0: px + DT, y: ty * DT, y0: ty * DT, py: ty * DT, w: 3 * DT, ph: Math.random() * 6, stand: 0, dead: false, respawn: 0 });
          t = '.';
        }
        tiles[ty][tx] = t;
      }
    }
  });
  // deeper levels: more foes, spikes underfoot and a modifier that changes the fight
  let mod = null;
  if (deep >= 1 && Math.random() < 0.75) mod = pickOf(Object.keys(MODS));
  const F = THEME_FOES[theme] || THEME_FOES.crypt;
  const grounded = spawns.filter(s => !CRYPT_FOES[s.type].fly && s.type !== 'a' && s.x > 7 * DT * 5);
  for (let i = 0; i < deep * 3 && grounded.length; i++) { const s = pickOf(grounded); spawns.push({ type: pickOf(F.ground), x: s.x + ri(-20, 20), y: s.y }); }
  if (deep >= 1) for (let i = 0; i < deep && grounded.length; i++) { const s = pickOf(grounded); s.type = pickOf(F.elite); }
  if (mod === 'swarming') for (const s of [...spawns]) if (Math.random() < 0.4 && !CRYPT_FOES[s.type].elite) spawns.push({ ...s, x: s.x + ri(-14, 14) });
  for (let i = 0; i < deep * 2; i++) {
    const tx = ri(RW * 2, tiles[0].length - RW * 2 - 3);
    if ([0, 1, 2].every(k => tiles[16][tx + k] === '.' && tiles[17][tx + k] === '#') && tiles[16][tx - 1] === '.' && tiles[16][tx + 3] === '.' && !spawns.some(s => Math.abs(s.x - tx * DT) < 30)) for (let k = 0; k < 3; k++) tiles[16][tx + k] = '^';
  }
  const mul = (1 + G.t / 400) * (G.dimMul || 1) * (1 + (floor - 1) * 0.45) * (theme === 'crypt' ? 1 : 1.15) * (1 + 0.5 * deep) * (mod === 'armored' ? 1.35 : 1);
  const ents = spawns.map(s => {
    const e = makeFoe(s.type, s.x, s.y, mul, 1 + 0.25 * deep);
    if (mod === 'frenzied') { e.spd *= 1.3; if (e.wind) e.wind *= 0.8; }
    return e;
  });
  const palKey = T.pals ? pickOf(T.pals) : T.pal || theme;
  const name = pickOf(T.names) + (T.floors ? ` · Floor ${floor}` : '') + (deep ? ` · Depth ${deep + 1}` : '');
  return {
    tiles, w: tiles[0].length, h: RH, ents, torches, start, chestAt, doorAt, arrows: [], parts: [], texts: [], fx: [],
    t: 0, cleared: false, chest: null, shake: 0, hitstop: 0, hurt: 0, dead: false, name, theme, floor, last, st, deep, mod,
    levers, gates, barrels, ores, chests, traps, plats, saws, fonts, captives, rescued: carry.rescued || [], oreCount: carry.ore || 0, pal: palKey,
    canvas: paintCrypt(tiles, palKey, gates), hudKey: '', mul,
  };
};

/* Backgrounds get more character: icicles, drips, cobwebs, chains, embers */
const baseDecorPaint = paintCrypt;
paintCrypt = function (tiles, theme, gates) {
  const c = baseDecorPaint(tiles, theme, gates);
  const g = c.getContext('2d'), h = tiles.length, w = tiles[0].length, r = mulberry32(w * 17 + theme.length * 131);
  const solid = (tx, ty) => ty < 0 || ty >= h || tx < 0 || tx >= w || tiles[ty][tx] === '#';
  for (let ty = 1; ty < h - 1; ty++) for (let tx = 0; tx < w; tx++) {
    if (solid(tx, ty)) continue;
    const x = tx * DT, y = ty * DT, up = solid(tx, ty - 1), down = solid(tx, ty + 1);
    if (up && r() < 0.3) {
      if (theme === 'frost') { g.fillStyle = '#c9f7ff'; const len = 2 + (r() * 5 | 0); for (let k = 0; k < len; k++) g.fillRect(x + 3, y + k, Math.max(1, 3 - (k >> 1)), 1); }
      else if (theme === 'sewer') { g.fillStyle = '#4fa04a'; g.fillRect(x + 3, y, 1, 3 + (r() * 6 | 0)); g.fillStyle = '#a6e05a'; g.fillRect(x + 3, y + 5, 1, 1); }
      else if (theme === 'forge' || theme === 'blood') { g.fillStyle = '#6d6a7c'; for (let k = 0; k < 6 + (r() * 8 | 0); k += 2) g.fillRect(x + 3, y + k, 1, 1); g.fillRect(x + 2, y + 10, 3, 1); }
      else if (theme === 'bone' || theme === 'crypt') { g.fillStyle = 'rgba(200,196,215,0.35)'; g.fillRect(x, y, 1, 2); g.fillRect(x + 1, y + 1, 1, 2); g.fillRect(x + 2, y + 2, 1, 1); }
    }
    if (down && r() < 0.18) {
      if (theme === 'sewer') { g.fillStyle = '#3f7a3a'; g.fillRect(x + 1, y + DT - 2, 6, 2); g.fillStyle = '#a6e05a'; g.fillRect(x + 2, y + DT - 2, 2, 1); }
      else if (theme === 'forge') { g.fillStyle = r() < 0.5 ? '#e8742c' : '#ffd35a'; g.fillRect(x + 1, y + DT - 1, 5, 1); }
      else if (theme === 'frost') { g.fillStyle = '#ffffff'; g.fillRect(x, y + DT - 2, 7, 2); }
      else if (theme === 'bone') { g.fillStyle = '#e8e4f0'; g.fillRect(x + 1, y + DT - 3, 3, 3); g.fillStyle = '#14121a'; g.fillRect(x + 1, y + DT - 2, 1, 1); g.fillRect(x + 3, y + DT - 2, 1, 1); }
    }
  }
  return c;
};

/* ---------- Entering a dungeon ---------- */
enterCrypt = function (c, theme = 'crypt', st = null, floor = 1, deep = 0) {
  if (c) G.crypts = G.crypts.filter(x => x !== c);
  G.nearCrypt = null;
  setState('fading');
  $('fade').classList.add('on');
  Snd.play('dash');
  setTimeout(() => {
    D = buildCrypt(theme, floor, st, deep);
    DP = { x: D.start.x, y: D.start.y, vx: 0, vy: 0, w: 8, h: 13, face: 1, onGround: false, coyote: 0, jumpBuf: 0, jumps: 1,
      roll: 0, rollCd: 0, atkT: 0, atkCd: 0, step: 0, lastAtk: -9, inv: 0, drop: 0, anim: 0, plat: null };
    for (const k in dpress) dpress[k] = false;
    setState('dungeon');
    if (document.activeElement) document.activeElement.blur();
    $('dTitle').textContent = D.name;
    Snd.music(2);
    $('fade').classList.remove('on');
    const sub = D.mod ? `${MODS[D.mod].name}: ${MODS[D.mod].desc}` : D.levers.length ? 'Strike every lever to open the gate' : D.last ? (deep ? `Depth ${deep + 1}. Loot grows with every level` : 'Slay every foe to claim the treasure') : 'Clear the floor, then climb';
    banner(D.name, sub, deep ? '#d8354a' : '#e8742c');
  }, 320);
};

/* ---------- Platforms, saws, fonts, captives, mimics, elites ---------- */
const baseMoveBody = moveBody;
moveBody = function (b, dt) {
  const y0 = b.y;
  b.plat = null;
  baseMoveBody(b, dt);
  if (!D || !D.plats || b.vy < 0 || b.drop > 0) return;
  for (const p of D.plats) {
    if (p.dead || b.x + b.w / 2 <= p.x - p.w / 2 || b.x - b.w / 2 >= p.x + p.w / 2) continue;
    if (y0 <= p.py + 1 && b.y >= p.y - 0.01) { b.y = p.y; b.vy = 0; b.onGround = true; b.plat = p; break; }
  }
};
function spawnMimic(c) {
  banner('A mimic!', 'The chest bites back', '#d8354a'); Snd.play('warn'); D.shake = 6;
  const F = THEME_FOES[D.theme] || THEME_FOES.crypt;
  for (let i = 0; i < 3; i++) D.ents.push(makeFoe(i === 1 ? pickOf(F.elite) : pickOf(F.ground), c.x + (i - 1) * 12, c.y, D.mul, 1 + 0.25 * (D.deep || 0)));
  dburst(c.x, c.y - 6, '#d8354a', 20, 100);
}
const dungeonUpdate = updateCrypt;
updateCrypt = function (dt) {
  if (D.dead) { dungeonUpdate(dt); return; }
  // platforms move first, carrying whatever stood on them last frame
  for (const p of D.plats) {
    p.py = p.y;
    const ox = p.x, oy = p.y;
    if (p.kind === 'hmove') p.x = p.x0 + Math.sin(D.t * 0.9 + p.ph) * 36;
    else if (p.kind === 'vmove') p.y = p.y0 - (0.5 + 0.5 * Math.sin(D.t * 0.8 + p.ph)) * 56;
    else if (p.dead) { p.respawn -= dt; p.fy = (p.fy || p.y) + 200 * dt; if (p.respawn <= 0) { p.dead = false; p.stand = 0; p.fy = 0; p.y = p.y0; p.py = p.y0; } }
    else if (DP.plat === p) {
      p.stand += dt;
      if (p.stand > 0.45) { p.dead = true; p.respawn = 3.5; p.fy = p.y; dburst(p.x, p.y, '#9a6a42', 12, 70); Snd.play('glass'); }
    } else p.stand = Math.max(0, p.stand - dt);
    if (!p.dead && (p.x !== ox || p.y !== oy)) for (const b of [DP, ...D.ents]) if (b.plat === p && !b.dead) { b.x += p.x - ox; b.y += p.y - oy; }
  }
  for (const s of D.saws) {
    s.x = s.x0 + Math.sin(D.t * 1.7 + s.ph) * s.range;
    if (!D.dead && Math.hypot(DP.x - s.x, DP.y - 6 - s.y) < 8) hurtCrypt(16);
  }
  for (const f of D.fonts) if (!f.used && Math.abs(DP.x - f.x) < 9 && Math.abs(DP.y - f.y) < 16) {
    f.used = true;
    const heal = Math.round(P.maxHp * 0.4);
    P.hp = Math.min(P.maxHp, P.hp + heal);
    dtext(f.x, f.y - 18, '+' + heal, false, '#a6e05a'); dburst(f.x, f.y - 8, '#a6e05a', 16, 70); Snd.play('heal');
  }
  for (const c of D.captives) if (!c.freed && Math.abs(DP.x - c.x) < 11 && Math.abs(DP.y - c.y) < 16) {
    if (D.ents.some(e => !e.dead && Math.abs(e.x - c.x) < 90 && !e.fly)) { if (Math.random() < dt * 2) dtext(c.x, c.y - 24, 'guards!', false, '#d8354a'); continue; }
    c.freed = true; D.rescued.push(c.type);
    dtext(c.x, c.y - 24, 'FREED', false, '#ffd35a'); dburst(c.x, c.y - 8, '#ffd35a', 18, 80); Snd.play('chest');
  }
  for (const c of D.chests) if (!c.open && c.mimic && Math.abs(DP.x - c.x) < 9 && Math.abs(DP.y - c.y) < 12) { c.open = true; spawnMimic(c); }
  dungeonUpdate(dt);
  if (!D || D.dead) return;
  // the way down: after clearing the last floor, the door leads deeper for far greater rewards
  if (D.last && D.cleared === true && D.doorAt && (D.deep || 0) < MAX_DEEP && Math.abs(DP.x - D.doorAt.x) < 10 && Math.abs(DP.y - D.doorAt.y) < 16) descendCrypt();
};
function descendCrypt() {
  const deep = D.deep || 0, T = THEMES[D.theme];
  const gold = Math.round(30 * (deep + 1) * P.greed);
  G.gold += gold;
  P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.3);
  G.cryptCarry = { rescued: D.rescued, ore: D.oreCount || 0 };
  const theme = D.theme, st = D.st;
  D.dead = true;
  Snd.play('warn');
  banner('Deeper', `+${gold} gold. The foes below are far worse`, '#d8354a');
  enterCrypt(null, theme, st, T.floors || 1, deep + 1);
}
const baseCryptHit = cryptHit;
cryptHit = function (e, dmg, dir, big) {
  const was = e.dead;
  baseCryptHit(e, dmg, dir, big);
  if (!was && e.dead && e.elite) {
    const g = Math.round(14 * (1 + 0.5 * (D.deep || 0)) * P.greed);
    G.gold += g; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.12);
    dtext(e.x, e.y - e.h - 16, '+' + g, false, '#ffd35a'); dburst(e.x, e.y - e.h / 2, '#ffd35a', 24, 120);
  }
};

/* ---------- Hud and drawing ---------- */
updateCryptHud = function () {
  const left = D.ents.filter(e => !e.dead).length;
  const key = left + '|' + Math.floor(D.t) + '|' + G.gold + '|' + D.deep;
  if (key === D.hudKey) return;
  D.hudKey = key;
  const deep = D.deep || 0, dive = deep ? `  ·  depth ${deep + 1}, loot x${(1 + 0.9 * deep).toFixed(1)}` : '';
  $('dInfo').textContent = (D.cleared === true ? (D.last && deep < MAX_DEEP ? 'Cleared. Take the chest, or dive deeper' : 'Cleared. Claim the chest')
    : D.cleared === 'gated' ? 'Pull every lever to open the gate'
    : `${left} foe${left === 1 ? '' : 's'} left  ·  ${fmtTime(D.t)}${D.t <= CRYPT_PAR * (D.floor || 1) ? `  ·  swift bonus under ${fmtTime(CRYPT_PAR * (D.floor || 1))}` : ''}`) + dive;
  $('goldc').textContent = G.gold;
};
const dungeonRender = renderCrypt;
renderCrypt = function () {
  dungeonRender();
  const now = performance.now() / 1000;
  for (const f of D.fonts) {
    const sx = Math.round(f.x - camX), sy = Math.round(f.y - camY);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(sx - 6, sy - 9, 13, 9);
    ctx.fillStyle = f.used ? '#3a3a40' : '#6d6a7c'; ctx.fillRect(sx - 5, sy - 8, 11, 7);
    ctx.fillStyle = f.used ? '#222' : '#3f8ee0'; ctx.fillRect(sx - 4, sy - 9, 9, 2);
    if (!f.used) { ctx.fillStyle = '#a6e05a'; ctx.fillRect(sx - 1, sy - 15 + Math.round(Math.sin(now * 3) * 1), 3, 3); ctx.fillRect(sx, sy - 16 + Math.round(Math.sin(now * 3) * 1), 1, 5); }
  }
  for (const c of D.captives) {
    const sx = Math.round(c.x - camX), sy = Math.round(c.y - camY), f = NPC_SPR[ALLY_TYPES[c.type].spr][0];
    ctx.globalAlpha = c.freed ? 0.5 : 1;
    ctx.drawImage(f.c, Math.round(sx - f.w / 2), Math.round(sy - f.h));
    if (!c.freed) {
      ctx.fillStyle = '#6d6a7c';
      for (let i = -7; i <= 7; i += 4) ctx.fillRect(sx + i, sy - 18, 1, 18);
      ctx.fillRect(sx - 8, sy - 19, 17, 1);
      if (Math.floor(now * 3) % 2) drawText(ctx, 'HELP', sx, sy - 26, '#ffd35a');
    }
    ctx.globalAlpha = 1;
  }
  for (const p of D.plats) {
    if (p.dead) { if (p.respawn > 0.2) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#5a3a28'; ctx.fillRect(Math.round(p.x - p.w / 2 - camX), Math.round((p.fy || p.y) - camY), p.w, 3); ctx.globalAlpha = 1; } continue; }
    const shake = p.kind === 'crumble' && p.stand > 0 ? Math.round(Math.sin(now * 60)) : 0;
    const x = Math.round(p.x - p.w / 2 - camX) + shake, y = Math.round(p.y - camY);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(x - 1, y - 1, p.w + 2, 6);
    ctx.fillStyle = p.kind === 'crumble' ? '#7a5a3a' : '#6d6a7c'; ctx.fillRect(x, y, p.w, 4);
    ctx.fillStyle = p.kind === 'crumble' ? '#b08a5a' : '#b5b2c4'; ctx.fillRect(x, y, p.w, 1);
    if (p.kind === 'crumble') { ctx.fillStyle = '#2a1a10'; ctx.fillRect(x + 6, y + 1, 1, 3); ctx.fillRect(x + 15, y + 1, 1, 3); }
    else { ctx.fillStyle = '#ffd35a'; ctx.fillRect(x + 2, y + 2, 2, 1); ctx.fillRect(x + p.w - 4, y + 2, 2, 1); }
  }
  for (const s of D.saws) {
    const sx = Math.round(s.x - camX), sy = Math.round(s.y - camY);
    ctx.fillStyle = '#3a3646'; ctx.fillRect(Math.round(s.x0 - s.range - camX), sy, s.range * 2, 1);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(sx - 6, sy - 6, 13, 13);
    const a = now * 14;
    for (let i = 0; i < 8; i++) { const ang = a + i * Math.PI / 4; ctx.fillStyle = i % 2 ? '#b5b2c4' : '#6d6a7c'; ctx.fillRect(sx + Math.round(Math.cos(ang) * 5) - 1, sy + Math.round(Math.sin(ang) * 5) - 1, 3, 3); }
    ctx.fillStyle = '#d8354a'; ctx.fillRect(sx - 1, sy - 1, 3, 3);
    light(s.x, s.y, 14, 0.4);
  }
  for (const e of D.ents) if (!e.dead && e.elite) {
    const fr = e.frames[0], sx = Math.round(e.x - camX), sy = Math.round(e.y - e.h - camY) - 4;
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(sx - 4, sy - 1, 9, 5);
    ctx.fillStyle = '#ffd35a'; ctx.fillRect(sx - 3, sy, 7, 3); ctx.fillRect(sx - 3, sy - 2, 1, 2); ctx.fillRect(sx, sy - 3, 1, 3); ctx.fillRect(sx + 3, sy - 2, 1, 2);
    light(e.x, e.y - e.h / 2, 20, 0.35);
  }
  if (D.last && D.cleared === true && D.doorAt && (D.deep || 0) < MAX_DEEP) {
    const x = D.doorAt.x, y = D.doorAt.y;
    light(x, y - 8, 46, 0.9); glowAt(x, y - 6, 16, '#d8354a', 0.55 + Math.sin(now * 5) * 0.2);
    if (Math.floor(now * 3) % 2) drawText(ctx, 'DEEPER', x - camX, y - camY - 26, '#ff6a7a');
  }
};

/* ---------- Rewards ---------- */
function cryptRelic(theme, deep) {
  const base = { tower: Math.random() < 0.5 ? 'crown' : pick(['minerLamp', 'templeIdol', 'moonPearl']), mine: 'minerLamp', temple: 'templeIdol', mansion: pick(['thiefRing', 'moonPearl']),
    cellar: Math.random() < 0.35 ? 'thiefRing' : null, ruins: null, sewer: Math.random() < 0.4 ? 'thiefRing' : null, frost: 'moonPearl', forge: 'demonHorn', crypt: null }[theme] || null;
  if (deep >= 1 && Math.random() < 0.45 + 0.25 * deep) return pick(Object.keys(RELICS));
  return base;
}
const cryptFrag = (theme, deep, ores) => theme === 'tower' || theme === 'ruins' || theme === 'temple' || (theme === 'mine' && ores >= 3) || (deep >= 1 && (theme === 'forge' || theme === 'frost')) || deep >= 2;
finishCrypt = function () {
  const theme = D.theme || 'crypt', st = D.st, deep = D.deep || 0;
  if (st) st.done = true;
  const swift = D.t <= CRYPT_PAR * (D.floor || 1), lootMul = 1 + 0.9 * deep;
  const gold = Math.round(((theme === 'crypt' ? 40 : 60) + (swift ? 60 : 0)) * lootMul * P.greed);
  G.gold += gold;
  if (swift) P.hp = P.maxHp;
  const relic = cryptRelic(theme, deep), frag = cryptFrag(theme, deep, D.oreCount || 0), rescued = [...D.rescued];
  const note = { icon: swift ? 'star' : 'gold', name: `${D.name.split(' · ')[0]} ${deep ? `conquered at depth ${deep + 1}` : 'conquered'}`,
    lv: `+${gold} gold${swift ? ', a full heal' : ''}${relic ? ', ' + RELICS[relic].name : ''}${frag ? ', a demon fragment' : ''}${deep ? `, ${deep} bonus chest${deep > 1 ? 's' : ''}` : ''}${rescued.length ? ', ' + rescued.length + ' rescued' : ''}` };
  D.dead = true;
  G.cryptCarry = null;
  Snd.play('chest');
  leaveCrypt(() => {
    if (relic) dropRelic(relic, ME.x + 14, ME.y);
    if (frag) dropFragment(ME.x - 14, ME.y);
    for (let i = 0; i < deep; i++) dropAt('chest', ME.x + 18 * (i + 1), ME.y + 10, { boss: true });
    for (const t of rescued) recruit(t, ME);
    openChest(true, note);
  });
};
