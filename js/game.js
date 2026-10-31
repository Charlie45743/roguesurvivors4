'use strict';
/* ROGUE SURVIVORS 3: simulation, rendering and UI */

const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
const lc = document.createElement('canvas'), lx = lc.getContext('2d');
let W = 480, H = 270, SCALE = 3, camX = 0, camY = 0;

function resize() {
  SCALE = Math.max(2, Math.round(Math.min(innerWidth / 440, innerHeight / 250)));
  W = Math.ceil(innerWidth / SCALE); H = Math.ceil(innerHeight / SCALE);
  cv.width = lc.width = W; cv.height = lc.height = H;
  cv.style.width = W * SCALE + 'px'; cv.style.height = H * SCALE + 'px';
  ctx.imageSmoothingEnabled = false; lx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
resize();

/* ---------- Helpers ---------- */
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function weighted(obj) {
  let tot = 0;
  for (const k in obj) tot += obj[k];
  let r = Math.random() * tot;
  for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fmtTime = s => {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

/* ---------- Save ---------- */
const SAVE_KEY = 'cinderwake.v1';
const save = { gold: 0, shop: {}, unlocked: {}, best: 0, vol: { sfx: 0.7, mus: 0.5 }, muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { /* storage blocked */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

function applyVolume() {
  Snd.setVol('sfx', save.muted ? 0 : save.vol.sfx);
  Snd.setVol('mus', save.muted ? 0 : save.vol.mus);
  $('mute').textContent = save.muted ? 'Sound off' : 'Sound on';
}

/* ---------- World: biomes, ground, props and obstacles ---------- */
function makeGround(seed, base, blobs, cols, blades, extra) {
  const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), r = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const blob = (x, y, rad, col) => {
    g.fillStyle = col;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) for (let j = -rad; j <= rad; j++) {
      const w = Math.floor(Math.sqrt(rad * rad - j * j) * 1.4);
      g.fillRect(x + dx - w, y + dy + j, w * 2 + 1, 1);
    }
  };
  for (const [col, n, min, span] of blobs) for (let i = 0; i < n; i++) blob(r() * S | 0, r() * S | 0, min + r() * span | 0, col);
  for (let i = 0; i < 1700; i++) { g.fillStyle = cols[r() * cols.length | 0]; g.fillRect(r() * S | 0, r() * S | 0, 1, 1); }
  for (let i = 0; i < 90; i++) {
    const x = r() * S | 0, y = r() * S | 0;
    g.fillStyle = blades[0]; g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y + 1, 1, 1);
    g.fillStyle = blades[1]; g.fillRect(x + 1, y + 1, 1, 1);
  }
  if (extra) extra(g, r, S);
  return c;
}
const GROUNDS = {
  moss: makeGround(1337, '#18211d', [['#1b2621', 10, 8, 16], ['#151c19', 8, 5, 12], ['#211d20', 5, 4, 8]],
    ['#1f2b25', '#131a16', '#24302a', '#1c2420', '#29252a'], ['#2a3c30', '#1f2d25']),
  ash: makeGround(7, '#1e1a1b', [['#252022', 10, 8, 16], ['#161314', 8, 5, 12], ['#2a221e', 6, 4, 9]],
    ['#2a2426', '#131012', '#30292a', '#1c1819', '#3a2a22'], ['#3a2c26', '#2a201c'], (g, r, S) => {
      for (let i = 0; i < 14; i++) {
        let x = r() * S | 0, y = r() * S | 0;
        for (let k = 0; k < 10; k++) {
          g.fillStyle = '#110e0f'; g.fillRect(x, y, 1, 1);
          if (r() < 0.15) { g.fillStyle = '#7a2a1c'; g.fillRect(x, y, 1, 1); }
          x = (x + (r() < 0.5 ? 1 : 0) + S) % S; y = (y + (r() < 0.5 ? 1 : -1) + S) % S;
        }
      }
    }),
  grave: makeGround(99, '#191823', [['#1e1c29', 10, 8, 16], ['#14131b', 8, 5, 12], ['#23212c', 6, 4, 9]],
    ['#221f2d', '#121119', '#29263a', '#1b1a24'], ['#2a2838', '#211f2c'], (g, r, S) => {
      for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? '#2c2a3a' : '#34304a'; g.fillRect(r() * S | 0, r() * S | 0, 2, 1); }
    }),
  bog: makeGround(42, '#132021', [['#162729', 10, 8, 16], ['#0e1718', 8, 5, 12], ['#1a221f', 5, 4, 8]],
    ['#182a2b', '#0f1919', '#1e3232', '#152223'], ['#23383a', '#1a2c2d'], (g, r, S) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = '#0c1415'; g.fillRect(r() * S | 0, r() * S | 0, 4 + r() * 6 | 0, 2); }
    }),
};

function hash2(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Two smooth fields (heat, damp) carve the night into biomes; the clearing you start in is always moss
let biomeOverride = null; // set by dims.js while inside another dimension
function biomeAt(x, y) {
  if (biomeOverride) return biomeOverride(x, y);
  if (x * x + y * y < 220 * 220) return 'moss';
  const so = G ? (G.seed % 9973) * 37 : 0;
  x += so; y -= so;
  const t = vnoise(x / 620, y / 620, 11) * 0.7 + vnoise(x / 180, y / 180, 12) * 0.3;
  const m = vnoise(x / 540, y / 540, 21) * 0.7 + vnoise(x / 160, y / 160, 22) * 0.3;
  if (t > 0.6) return 'ash';
  if (m > 0.6) return 'bog';
  if (t < 0.4 && m < 0.47) return 'grave';
  return 'moss';
}
const biomeCache = new Map();
function biomeCell(cx, cy) {
  const k = cx * 100003 + cy;
  let b = biomeCache.get(k);
  if (b) return b;
  if (biomeCache.size > 20000) biomeCache.clear();
  b = biomeAt(cx * 32 + 16, cy * 32 + 16);
  biomeCache.set(k, b);
  return b;
}

const BIOME_DECOR = {
  moss: { tuft: 8, tuft2: 5, flower: 3, flower2: 2, stone: 2, mush: 1, tree: 3.6, rock: 1.4, pillar: 0.3, candle: 0.2 },
  ash: { ashpile: 4, bones: 2.5, stone: 2, vent: 1.4, deadtree: 2.4, obsidian: 1.6, candle: 0.3 },
  grave: { tuft: 3, bones: 2, grave: 2.6, candle: 1.1, cobble: 1.2, pillar: 0.9, deadtree: 0.7, flower2: 0.8 },
  bog: { reeds: 5, tuft2: 3, glowmush: 1.8, pond: 1.2, tree: 1.6, rock: 0.5 },
};
// Tall props are drawn in the y-sort with the creatures; solid ones block walkers at their base
const PROP = { tree: 5, deadtree: 3, rock: 5, obsidian: 5, pillar: 4, grave: 4 };
const CH = 128;
const chunkCache = new Map(), solidCells = new Map();
const worldSeed = () => (G ? (G.seed + (G.dim ? G.dim.length * 7919 + G.dim.charCodeAt(0) * 104729 : 0)) | 0 : 0);
function resetWorldCache() { chunkCache.clear(); solidCells.clear(); biomeCache.clear(); if (G) Mods.call('solidsCleared'); }
function pickWeighted(obj, r) {
  let tot = 0;
  for (const k in obj) tot += obj[k];
  let v = r() * tot;
  for (const k in obj) { v -= obj[k]; if (v <= 0) return k; }
  return Object.keys(obj)[0];
}
function addSolid(o) {
  const pad = o.r + 20;
  for (let cx = Math.floor((o.x - pad) / 32); cx <= Math.floor((o.x + pad) / 32); cx++)
    for (let cy = Math.floor((o.y - pad) / 32); cy <= Math.floor((o.y + pad) / 32); cy++) {
      const k = gkey(cx, cy), b = solidCells.get(k);
      if (b) b.push(o); else solidCells.set(k, [o]);
    }
}
function chunk(cx, cy) {
  const key = cx * 100003 + cy;
  let c = chunkCache.get(key);
  if (c) return c;
  if (chunkCache.size > 900) { chunkCache.clear(); solidCells.clear(); Mods.call('solidsCleared'); }
  const r = mulberry32((cx * 73856093) ^ (cy * 19349663) ^ worldSeed());
  c = [];
  const solids = [];
  const n = 7 + Math.floor(r() * 7);
  for (let i = 0; i < n; i++) {
    const x = cx * CH + Math.floor(r() * CH), y = cy * CH + Math.floor(r() * CH);
    if (Mods.call('blocked', x, y)) continue;
    const bk = biomeAt(x, y);
    if (bk === 'sea') continue;
    const k = pickWeighted(BIOME_DECOR[bk], r);
    const d = { x, y, k, s: DECOR[k], seed: r() * 100 };
    if (PROP[k] || k === 'pond') {
      if (x * x + y * y < 70 * 70) continue;
      const rad = k === 'pond' ? 12 + Math.floor(r() * 10) : PROP[k];
      if (solids.some(o => (o.x - x) ** 2 + (o.y - y) ** 2 < (o.r + rad + 14) ** 2)) continue;
      const o = { x, y: k === 'pond' ? y : y - 2, r: rad, water: k === 'pond' };
      solids.push(o); addSolid(o);
      d.r = rad;
      if (PROP[k]) { d.tall = true; d.isDecor = true; }
    }
    c.push(d);
  }
  chunkCache.set(key, c);
  return c;
}
function ensureChunks(x, y) {
  for (let cx = Math.floor((x - W) / CH); cx <= Math.floor((x + W) / CH); cx++)
    for (let cy = Math.floor((y - H) / CH); cy <= Math.floor((y + H) / CH); cy++) chunk(cx, cy);
}
// Push a walker out of trees, rocks and pillars; reports whether it is wading in a pond
function collideSolids(e, r) {
  const b = solidCells.get(gkey(Math.floor(e.x / 32), Math.floor(e.y / 32)));
  if (!b) return false;
  let wet = false;
  for (const o of b) {
    const dx = e.x - o.x, dy = e.y - o.y;
    if (o.water) { if (dx * dx / (o.r * o.r) + dy * dy / (o.r * o.r * 0.3) < 1) wet = true; continue; }
    const rr = r + o.r, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1; e.x = o.x + dx / d * rr; e.y = o.y + dy / d * rr; }
  }
  return wet;
}

/* ---------- Input ---------- */
const keys = {};
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
// Typing the code below after dying brings a solo run back to life
const REVIVE_CODE = 'zxopzxop123';
let codeBuf = '';
function tryRevive() {
  if (!G || !G.over || G.won || G.local || G.coop || G.remote || state === 'menu') return;
  if (G.earnedGold) { save.gold -= G.earnedGold; G.earnedGold = 0; persist(); }   // the run is not over after all
  G.over = false; G.deathT = 0; G.slowT = 0;
  P = ME; ME.down = false; ME.hp = ME.maxHp; ME.inv = 3;
  for (const e of G.enemies) {
    if (e.dead || e.prop) continue;
    const dx = e.x - ME.x, dy = e.y - ME.y;
    if (Math.hypot(dx, dy) < 170) { if (e.boss) hitEnemy(e, 500, null, dx, dy, 0); else hitEnemy(e, 99999, null, dx, dy, 0); }
  }
  G.fx.push({ k: 'shock', x: ME.x, y: ME.y, t: 0, dur: 0.6, r: 170 });
  G.whiteFlash = 1; G.shake = 8;
  setState('play');
  Snd.music(G.boss ? 2 : 1);
  banner('Second Dawn', 'You rise again', '#ffd35a');
  Snd.play('evolve');
}
addEventListener('keydown', e => {
  if (e.key && e.key.length === 1) { codeBuf = (codeBuf + e.key.toLowerCase()).slice(-REVIVE_CODE.length); if (codeBuf === REVIVE_CODE) { codeBuf = ''; tryRevive(); } }
  keys[e.code] = true;
  Snd.init(); applyVolume();
  onKey(e);
});
addEventListener('keyup', e => { keys[e.code] = false; });
// In co-op (online or on this screen), losing focus must not pause: it would freeze the partners too
const inCoop = () => !!(G && (G.coop || G.remote || G.local));
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if ((state === 'play' || state === 'dungeon') && !inCoop()) openPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'play' || state === 'dungeon') && !inCoop()) openPause(); });
addEventListener('pointerdown', () => { Snd.init(); applyVolume(); });
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' && state !== 'dungeon') return;   // the mouse steers like a finger, in the night and below
  if (e.pointerType === 'mouse' && e.button !== 0) return;   // right click interacts instead of steering
  joy.active = true; joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
});
addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
addEventListener('pointerup', e => { if (e.pointerId === joy.id) joy.active = false; });
addEventListener('pointercancel', e => { if (e.pointerId === joy.id) joy.active = false; });

// Same roll as the crypt platformer: a short invulnerable tumble on Shift / L / C (or the Roll button on touch)
const ROLL_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyL', 'KeyC'];
const ROLL_T = 0.28, ROLL_CD = 0.7, ROLL_SPEED = 3;
document.querySelector('#dpad [data-act="roll"]').addEventListener('pointerdown', () => { if (state === 'play' && ME) ME.rollReq = 0.15; });

function inputVec() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x--;
  if (keys.KeyD || keys.ArrowRight) x++;
  if (keys.KeyW || keys.ArrowUp) y--;
  if (keys.KeyS || keys.ArrowDown) y++;
  if (joy.active) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
    if (d > 6) { const m = Math.min(1, d / 40); x = dx / d * m; y = dy / d * m; }
  }
  const l = Math.hypot(x, y);
  return l > 1 ? [x / l, y / l] : [x, y];
}

/* ---------- Run state ---------- */
let state = 'menu';
let G = null, P = null;
let D = null, DP = null; // active crypt and its player body (see dungeon.js)
let uid = 1;
let ME = null; // the player this screen controls; P is whichever player is currently acting

// Modules (art, bosses, world, dims, story, net) plug in here. call() returns the first truthy result.
const Mods = {
  list: [],
  add(m) { this.list.push(m); return m; },
  call(fn, ...a) {
    let r;
    for (const m of this.list) if (m[fn]) { const v = m[fn](...a); if (v && r === undefined) r = v; }
    return r;
  },
  first(fn, ...a) { for (const m of this.list) if (m[fn]) { const v = m[fn](...a); if (v) return v; } return undefined; },
};
const HUD_STATES = new Set(['play', 'levelup', 'chest', 'shrine', 'pause', 'dungeon', 'fading']);
function nearestPlayer(x, y) {
  let best = null, bd = Infinity;
  for (const p of G.players) {
    if (p.down) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best || ME;
}
function makePlayer(cid, x = 0, y = 0) {
  const ch = CHARS.find(c => c.id === cid) || CHARS[0];
  return { isPlayer: true, id: uid++, ch, x, y, r: 5, hp: 1, maxHp: 0, inv: 0, face: 1, ax: 1, ay: 0, anim: 0, moving: false,
    frames: charFrames(ch.id), weapons: [], passives: {}, down: false, reviveT: 0, input: [0, 0], hurtT: 0 };
}

function newRun(cid, opts = {}) {
  D = null; DP = null;
  G = {
    t: 0, enemies: [], projs: [], bullets: [], gems: [], items: [], parts: [], texts: [], fx: [], pools: [],
    level: 1, xp: 0, xpNext: xpFor(1), kills: 0, gold: 0,
    shake: 0, slowT: 0, hurtFlash: 0, whiteFlash: 0, spawnAcc: 0, evIdx: 0, boss: null, pending: 0,
    propT: 2, gemCombo: 0, lastGemT: 0, won: false, over: false, winT: 0, deathT: 0, mobs: 0, hpMul: 1,
    rerolls: 2 + (save.shop.reroll || 0), revivals: save.shop.revival || 0, choices: [], chest: null,
    buffs: {}, totems: [], shrines: [], shrineT: 35, shrineCost: 25, cursePending: 0, shrine: null, nearShrine: null,
    crypts: [], cryptT: 95, nearCrypt: null, pausedFrom: null,
    seed: opts.seed ?? (Math.random() * 1e9 | 0), dim: null, players: [], coop: opts.coop || null, story: opts.story || null, local: !!opts.local, localDevs: opts.local || null,
  };
  // Builds live on each player; these keep the single-player code paths reading "the acting player's" build
  Object.defineProperties(G, {
    weapons: { get: () => P.weapons }, passives: { get: () => P.passives }, ch: { get: () => P.ch }, p: { get: () => ME },
  });
  resetWorldCache();
  ME = P = makePlayer(cid);
  G.players.push(ME);
  addWeapon(ME.ch.weapon);
  ME.hp = ME.maxHp;
  if (opts.coop) {
    P = makePlayer(opts.coop.guestChar, 18, 0);
    G.players.push(P);
    addWeapon(P.ch.weapon);
    P.hp = P.maxHp;
    P = ME;
  }
  // Local co-op: every seat plays in this run, each driven by its own device (see local.js)
  if (opts.local) {
    ME.dev = opts.local[0];
    opts.local.slice(1).forEach((dev, i) => {
      P = makePlayer(dev.ch, 18 * (i + 1), 0);
      P.dev = dev;
      G.players.push(P);
      addWeapon(P.ch.weapon);
      P.hp = P.maxHp;
    });
    P = ME;
  }
  for (let i = 0; i < 5; i++) {
    const a = rand(0, TAU), R = rand(50, 110);
    spawnProp(Math.cos(a) * R, Math.sin(a) * R);
  }
  $('bossbar').classList.add('hidden');
  $('timer').classList.remove('boss');
  setState('play');
  refreshSlots();
  Snd.music(1);
  Mods.call('newRun', opts);
}

function addWeapon(id) {
  G.weapons.push({ id, level: 1, evo: false, t: 0.4, dealt: 0, uid: uid++, burst: 0, bt: 0, n: 0, ang: 0, active: 0 });
  recalc();
}

function recalc() {
  const m = G.ch.mods || {}, sh = save.shop, lv = id => G.passives[id] || 0;
  P.might = 1 + 0.1 * lv('might') + 0.05 * (sh.might || 0) + (m.might || 0);
  P.cooldown = Math.max(0.35, 1 - 0.08 * lv('haste') - 0.03 * (sh.haste || 0) - (m.cooldown || 0));
  P.area = 1 + 0.1 * lv('area') + (m.area || 0);
  P.amount = lv('amount') + (m.amount || 0);
  P.duration = 1 + 0.12 * lv('duration') + (m.duration || 0);
  P.speed = 72 * (1 + 0.1 * lv('speed') + 0.04 * (sh.swift || 0) + (m.speed || 0));
  const maxHp = 100 + 20 * lv('vitality') + 10 * (sh.vit || 0) + (m.maxHp || 0);
  if (P.maxHp && maxHp > P.maxHp) P.hp += maxHp - P.maxHp;
  P.maxHp = maxHp; P.hp = Math.min(P.hp, P.maxHp);
  P.regen = 0.3 * lv('vitality');
  P.magnet = 32 * (1 + 0.35 * lv('magnet') + 0.15 * (sh.magnet || 0) + (m.magnet || 0));
  P.growth = 1.4 + 0.1 * lv('growth') + 0.05 * (sh.growth || 0);
  P.armor = lv('armor') + (m.armor || 0);
  P.luck = lv('luck') + (sh.fate || 0) + (m.luck || 0);
  P.blood = lv('blood');
  P.thorns = lv('thorns');
  P.midas = lv('midas');
  P.greed = 1 + 0.1 * (sh.greed || 0) + 0.25 * P.midas;
  Mods.call('recalc', P);
  P.hp = Math.min(P.hp, P.maxHp);
  for (const w of G.weapons) w.s = weaponStats(w);
}

function weaponStats(w) {
  const d = WEAPONS[w.id], s = { ...d.base };
  for (let i = 0; i < w.level - 1; i++) {
    const u = d.lv[i];
    for (const k in u) {
      if (k === 'cd' || k === 'speed' || k === 'dur') s[k] *= 1 + u[k];
      else s[k] += u[k];
    }
  }
  if (w.evo) Object.assign(s, d.evoStats);
  // a Runesmith fusion: both halves of a super weapon hit harder, wider and with more projectiles
  if (w.superWith || w.fusedInto) { s.dmg *= 1.75; s.area *= 1.3; s.amount += 1; s.cd *= 0.8; }
  s.dmg *= P.might; s.cd *= P.cooldown; s.amount += P.amount; s.area *= P.area; s.dur *= P.duration;
  return s;
}
const canEvolve = w => !w.evo && w.level >= WEAPON_MAX(w.id) && (G.passives[WEAPONS[w.id].evo] || 0) > 0;

/* ---------- Spatial grid ---------- */
const GRID = 32;
const grid = new Map();
const gkey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
function buildGrid() {
  grid.clear();
  for (const e of G.enemies) {
    if (e.dead) continue;
    const k = gkey(Math.floor(e.x / GRID), Math.floor(e.y / GRID));
    const b = grid.get(k);
    if (b) b.push(e); else grid.set(k, [e]);
  }
}
function query(x, y, r) {
  const out = [], pad = r + 24;
  const x0 = Math.floor((x - pad) / GRID), x1 = Math.floor((x + pad) / GRID);
  const y0 = Math.floor((y - pad) / GRID), y1 = Math.floor((y + pad) / GRID);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const b = grid.get(gkey(cx, cy));
    if (!b) continue;
    for (const e of b) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.r;
      if (dx * dx + dy * dy < rr * rr) out.push(e);
    }
  }
  return out;
}
function target(range, random) {
  let best = null, bd = range * range;
  const cand = [];
  for (const e of G.enemies) {
    if (e.prop || e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = dx * dx + dy * dy;
    if (d < range * range) {
      if (random) cand.push(e);
      if (d < bd) { bd = d; best = e; }
    }
  }
  return random && cand.length ? pick(cand) : best;
}

/* ---------- Spawning ---------- */
function edgePos(pad = 16, a = P) {
  const keep = P; P = a;
  const out = edgePosFor(pad);
  P = keep;
  return out;
}
function edgePosFor(pad) {
  const hw = W / 2 + pad, hh = H / 2 + pad;
  let r = Math.random() * 2 * (hw + hh), x, y;
  if (r < 2 * hw) { x = -hw + r; y = Math.random() < 0.5 ? -hh : hh; }
  else { r -= 2 * hw; y = -hh + r; x = Math.random() < 0.5 ? -hw : hw; }
  return [P.x + x, P.y + y];
}

function spawnEnemy(type, x, y, opt = {}) {
  const d = ENEMIES[type];
  const e = {
    id: uid++, type, d, x, y, r: d.r, hp: d.hp * G.hpMul * (opt.hpMul || 1) * (G.buffs.greed > 0 ? 1.5 : 1) * (G.dimMul || 1), spd: d.spd * (opt.spdMul || 1) * rand(0.92, 1.08),
    dmg: d.dmg * (1 + G.t / 900) * (G.dimMul ? 1 + (G.dimMul - 1) * 0.5 : 1), xp: d.xp, kx: 0, ky: 0, flash: 0, slow: 0, freeze: 0, anim: Math.random() * 10,
    cd: {}, frames: SPR[d.spr], elite: !!d.elite, dead: false, dir: 1, swarm: opt.swarm || null, scale: 1,
  };
  e.maxHp = e.hp;
  e.hh = e.frames[0].h / 2;
  e.rise = 0.35;
  G.enemies.push(e);
  return e;
}

function spawnProp(x, y) {
  G.enemies.push({ id: uid++, prop: true, x, y, r: 5, hp: 1, maxHp: 1, d: { color: '#e8742c', kb: 0 }, cd: {}, frames: [SPR.brazier],
    flash: 0, anim: Math.random() * 10, kx: 0, ky: 0, dead: false, hh: 4, scale: 1 });
}

function spawnBoss(tier) {
  const [x, y] = edgePos(30);
  makeBoss(['colossus', 'mother', 'maw'][tier], x, y);
}

function runEvent(ev) {
  if (G.won) return;
  switch (ev.k) {
    case 'swarm': {
      const a = Math.random() * TAU, R = Math.hypot(W, H) / 2 + 30;
      const cx = P.x + Math.cos(a) * R, cy = P.y + Math.sin(a) * R, dir = a + Math.PI;
      for (let i = 0; i < ev.n; i++) {
        spawnEnemy(ev.type, cx + rand(-34, 34), cy + rand(-34, 34),
          { spdMul: 1.7, swarm: { dx: Math.cos(dir), dy: Math.sin(dir), life: 12 } });
      }
      banner('A swarm descends', 'Get out of its path', '#a59cc4');
      break;
    }
    case 'ring': {
      const R = Math.max(W, H) * 0.55;
      for (let i = 0; i < ev.n; i++) {
        const a = i / ev.n * TAU;
        spawnEnemy(ev.type, P.x + Math.cos(a) * R, P.y + Math.sin(a) * R, { spdMul: 0.75 });
      }
      banner('They close in', 'Break the circle', '#d8354a');
      break;
    }
    case 'elite':
      for (let i = 0; i < ev.n; i++) { const [x, y] = edgePos(20); spawnEnemy('knight', x, y); }
      banner(ev.n > 1 ? 'Hollow Knights approach' : 'A Hollow Knight approaches', 'It carries treasure', '#ffd35a');
      break;
    case 'warn':
      if (!G.story) break; // the boss now comes from the boss portal
      Snd.play('warn');
      G.shake = Math.max(G.shake, 3);
      banner('Warning', BOSSES[ev.tier].name + ' stirs', '#d8354a');
      break;
    case 'boss':
      if (!G.story) break;
      spawnBoss(ev.tier);
      G.final = ev.tier === BOSSES.length - 1 ? G.boss : G.final;
      banner(BOSSES[ev.tier].name, ev.tier === 2 ? 'Destroy it before dawn' : 'Slay it for great treasure', '#d8354a');
      break;
  }
}

function director(dt) {
  const minute = G.t / 60, m = Math.min(WAVES.length - 1, Math.floor(minute * 0.8));
  G.hpMul = 1 + minute * 0.16 + minute * minute * 0.011;
  while (G.evIdx < EVENTS.length && G.t >= EVENTS[G.evIdx].t) runEvent(EVENTS[G.evIdx++]);
  if (G.won) return;
  const wave = WAVES[m], cap = Math.min(650, 80 + m * 32);
  G.spawnAcc += wave.rate * 0.65 * (G.boss ? 0.45 : 1) * (G.spawnMul || 1) * dt;
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.mobs < cap) { const [x, y] = edgePos(); spawnEnemy(weighted(wave.types), x, y); }
  }
  G.propT -= dt;
  if (G.propT <= 0) {
    G.propT = rand(8, 13);
    if (G.enemies.filter(e => e.prop).length < 6) {
      const a = Math.random() * TAU, R = Math.max(W, H) * 0.5 + rand(10, 80);
      spawnProp(P.x + Math.cos(a) * R, P.y + Math.sin(a) * R);
    }
  }
}

/* ---------- Particles, texts, pickups ---------- */
function addPart(x, y, vx, vy, life, c, size = 1, grav = 0, drag = 4) {
  if (G.parts.length > 1800) return;
  G.parts.push({ x, y, vx, vy, life, max: life, c, size, grav, drag });
}
function burst(x, y, c, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rand(0.25, 1) * spd;
    addPart(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.65), Math.random() < 0.25 ? '#f2eee6' : c, Math.random() < 0.3 ? 2 : 1, 0, 5);
  }
}
function addText(x, y, val, crit, color) {
  if (G.texts.length > 90) G.texts.shift();
  G.texts.push({ x, y, s: String(val) + (crit ? '!' : ''), c: color || (crit ? '#ffd35a' : '#f2eee6'), life: 0.6, max: 0.6, scale: typeof val === 'number' && val >= 250 ? 2 : 1 });
}
const gemTier = v => (v >= 20 ? 2 : v >= 4 ? 1 : 0);
function dropGem(x, y, v) {
  if (G.gems.length >= 450) {
    const g = G.gems[Math.floor(Math.random() * G.gems.length)];
    g.v += v; g.tier = gemTier(g.v);
    return;
  }
  G.gems.push({ x: x + rand(-2, 2), y: y + rand(-2, 2), v, tier: gemTier(v), fly: false, sp: 0, ph: Math.random() * 6 });
}

/* ---------- Combat ---------- */
function hitEnemy(e, dmg, w, kx, ky, kb) {
  if (e.dead) return false;
  if (e.prop) { breakProp(e); return true; }
  const crit = Math.random() < 0.08 + 0.03 * P.luck;
  const d = Math.max(1, Math.round(dmg * (crit ? 2 : 1) * (G.buffs.rage > 0 ? 2 : 1) * (G.buffs.bloodpact > 0 ? 1.6 : 1) * rand(0.9, 1.1)));
  e.hp -= d; e.flash = 0.1;
  if (w) w.dealt += d;
  if (kb) {
    const l = Math.hypot(kx, ky) || 1, res = e.d.kb ?? 1;
    e.kx += kx / l * kb * res; e.ky += ky / l * kb * res;
  }
  addText(e.x + rand(-3, 3), e.y - e.hh * e.scale, d, crit);
  Snd.play('hit');
  if (e.hp <= 0) { killEnemy(e); return true; }
  return false;
}

function killEnemy(e) {
  e.dead = true;
  G.kills++;
  Mods.call('kill', e);
  disintegrate(e, e.frames[0], e.scale || 1);
  burst(e.x, e.y, e.d.color, e.boss ? 60 : e.elite ? 20 : 3, e.boss ? 160 : 70);
  G.fx.push({ k: 'pop', x: e.x, y: e.y, t: 0, dur: 0.14, r: e.r + 3 });
  Snd.play('kill');
  if (e.boss) { bossDown(e); return; }
  if (P.blood) P.hp = Math.min(P.maxHp, P.hp + 0.12 * P.blood);
  dropGem(e.x, e.y, e.xp * (G.buffs.bloodmoon > 0 ? 2 : 1) * (G.dimMul || 1));
  if (e.elite) {
    G.items.push({ k: 'chest', x: e.x, y: e.y, ph: 0 });
    G.shake = Math.max(G.shake, 4);
    Snd.play('boom');
  } else if (Math.random() < 0.004) G.items.push({ k: 'heart', x: e.x, y: e.y, ph: 0 });
  else if (Math.random() < (0.015 + 0.006 * P.midas) * (G.buffs.greed > 0 ? 3 : 1)) G.items.push({ k: 'coin', x: e.x, y: e.y, ph: 0 });
  else if (Math.random() < 0.0015) dropBuff(e.x, e.y);
  else if (Math.random() < 0.0012) dropRare(e.x, e.y);
}

function breakProp(e) {
  e.dead = true;
  burst(e.x, e.y - 3, '#e8742c', 16, 70);
  Snd.play('glass');
  const r = Math.random();
  if (r < 0.2) { dropBuff(e.x, e.y); return; }
  if (r > 0.96) { dropRare(e.x, e.y); return; }
  const k = r < 0.42 ? 'heart' : r < 0.7 ? 'coin' : r < 0.8 ? 'bag' : r < 0.9 ? 'magnet' : 'bomb';
  G.items.push({ k, x: e.x, y: e.y, ph: 0 });
}

function bossDown(e) {
  if (G.boss === e) G.boss = null;
  if (e.onDeath) {
    G.slowT = 1.2; G.whiteFlash = 1; G.shake = 10;
    Snd.play('bigboom');
    if (!G.boss) { $('bossbar').classList.add('hidden'); $('timer').classList.remove('boss'); Snd.music(G.dim ? 2 : 1); }
    e.onDeath(e);
    return;
  }
  G.slowT = 1.2; G.whiteFlash = 1; G.shake = 10;
  Snd.play('bigboom');
  for (let i = 0; i < 4; i++) G.fx.push({ k: 'ring', x: e.x, y: e.y, t: -i * 0.12, dur: 0.6, r: 40 + i * 30, c: '#ffd35a' });
  for (let i = 0; i < 18; i++) dropGem(e.x + rand(-30, 30), e.y + rand(-30, 30), 20);
  $('bossbar').classList.add('hidden');
  $('timer').classList.remove('boss');
  Snd.music(1);
  if (e === G.final) {
    G.won = true; G.winT = 4;
    for (const pl of G.players) pl.inv = 99;
    for (const o of G.enemies) if (!o.dead && !o.prop) o.dawn = rand(0.3, 2.4);
    banner('Dawn breaks', 'The night is over', '#ffd35a');
  } else {
    G.items.push({ k: 'chest', x: e.x, y: e.y, ph: 0, boss: true });
    dropRare(e.x + 18, e.y + 6);
    dropBuff(e.x - 18, e.y + 6);
  }
}

function explode(x, y, r, dmg, w) {
  for (const e of query(x, y, r)) hitEnemy(e, dmg, w, e.x - x, e.y - y, 50);
  G.fx.push({ k: 'ring', x, y, t: 0, dur: 0.25, r, c: '#e8742c' });
  burst(x, y, '#e8742c', 8, 60);
  Snd.play('boom');
}

function hurtPlayer(dmg, pl = P) {
  const keep = P; P = pl;
  hurtActing(dmg);
  P = keep;
}
function hurtActing(dmg) {
  if (P.inv > 0 || P.down || G.over || G.won || G.buffs.aegis > 0) return;
  P.hurtT = 0.25;
  const d = Math.max(1, Math.round(dmg - P.armor));
  P.hp -= d; P.inv = 0.45;
  if (P === ME) { G.shake = Math.max(G.shake, 3); G.hurtFlash = 0.3; }
  addText(P.x, P.y - 12, d, false, '#d8354a');
  burst(P.x, P.y, '#d8354a', 6, 50);
  if (P.thorns) {
    for (const e of query(P.x, P.y, 44)) hitEnemy(e, 14 * P.thorns * P.might, null, e.x - P.x, e.y - P.y, 120);
    G.fx.push({ k: 'ring', x: P.x, y: P.y, t: 0, dur: 0.3, r: 44, c: '#4fa04a' });
  }
  Snd.play('hurt');
  if (P.hp <= 0) playerDown();
}

function playerDown() {
  if (G.revivals > 0) {
    G.revivals--;
    P.hp = P.maxHp * 0.5; P.inv = 2.5; G.whiteFlash = 1; G.shake = 8;
    for (const e of G.enemies) {
      if (e.dead || e.prop) continue;
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
      if (d < 170) { if (e.boss) hitEnemy(e, 500, null, dx, dy, 0); else hitEnemy(e, 99999, null, dx, dy, 0); }
    }
    G.fx.push({ k: 'shock', x: P.x, y: P.y, t: 0, dur: 0.6, r: 170 });
    banner('Second Dawn', 'You rise again', '#ffd35a');
    Snd.play('evolve');
    return;
  }
  if (G.players.some(o => o !== P && !o.down)) {
    P.down = true; P.hp = 0; P.reviveT = 0;
    burst(P.x, P.y, '#d8354a', 30, 80);
    banner(P.ch.name + ' has fallen', 'Stand beside them for 3 seconds to revive', '#d8354a');
    Snd.play('death');
    return;
  }
  G.over = true; G.deathT = 2; G.slowT = 2;
  burst(P.x, P.y, '#d8354a', 40, 90);
  disintegrate(P, P.frames[0]);
  Snd.play('death');
}

function levelShock() {
  G.fx.push({ k: 'shock', x: P.x, y: P.y, t: 0, dur: 0.45, r: 100 });
  for (const e of G.enemies) {
    if (e.prop || e.boss || e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
    if (d < 100) { e.kx += dx / (d || 1) * 260; e.ky += dy / (d || 1) * 260; }
  }
  G.whiteFlash = 0.2;
  burst(P.x, P.y, '#ffd35a', 26, 120);
}

/* ---------- Weapons ---------- */
// Shared burst cadence: when the cooldown ends, fire `amount` shots `gap` seconds apart
function cadence(w, s, dt, gap, fire) {
  w.t -= dt;
  if (w.t <= 0 && w.burst <= 0) { w.burst = s.amount; w.bt = 0; w.t = s.cd; }
  if (w.burst > 0) {
    w.bt -= dt;
    if (w.bt <= 0) { w.bt = gap; w.burst--; fire(s.amount - w.burst - 1); }
  }
}
function jagged(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 10));
    for (let j = 1; j < n; j++) out.push([ax + (bx - ax) * j / n + rand(-4, 4), ay + (by - ay) * j / n + rand(-4, 4)]);
    out.push([bx, by]);
  }
  return out;
}

const WUPD = {
  bolt(w, s, dt) {
    cadence(w, s, dt, 0.06, i => {
      const tg = target(240, i > 0);
      let a = tg ? Math.atan2(tg.y - P.y, tg.x - P.x) : Math.atan2(P.ay, P.ax);
      a += rand(-0.06, 0.06);
      G.projs.push({ k: 'bolt', x: P.x, y: P.y - 3, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: 3 * s.area,
        dmg: s.dmg, pierce: s.pierce, life: s.dur, w, hits: [], evo: w.evo, area: s.area });
      Snd.play('shoot');
    });
  },
  scythe(w, s, dt) {
    cadence(w, s, dt, 0.14, i => {
      const ang = (P.face > 0 ? 0 : Math.PI) + [0, Math.PI, -Math.PI / 2, Math.PI / 2][i % 4];
      const R = 46 * s.area, arc = w.evo ? TAU : Math.PI * 0.95;
      G.fx.push({ k: 'slash', ang, arc, r: R, t: 0, dur: 0.2, evo: w.evo, o: P });
      let healed = 0;
      for (const e of query(P.x, P.y, R)) {
        if (!w.evo) {
          const da = Math.atan2(e.y - P.y, e.x - P.x) - ang;
          if (Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) > arc / 2 + 0.15) continue;
        }
        const killed = hitEnemy(e, s.dmg, w, e.x - P.x, e.y - P.y, 70);
        if (w.evo && killed && healed < 4 && !e.prop) { P.hp = Math.min(P.maxHp, P.hp + 1); healed++; }
      }
      Snd.play('slash');
    });
  },
  wisps(w, s, dt) {
    w.ang += s.speed * dt;
    if (w.active > 0) { w.active -= dt; if (w.active <= 0) w.t = s.cd; }
    else { w.t -= dt; if (w.t <= 0) w.active = s.dur; }
    if (w.active <= 0) return;
    const R = 34 * s.area;
    for (let i = 0; i < s.amount; i++) {
      const a = w.ang + i * TAU / s.amount;
      const ox = P.x + Math.cos(a) * R, oy = P.y - 2 + Math.sin(a) * R;
      if (Math.random() < 0.5) addPart(ox, oy, rand(-6, 6), rand(-6, 6), 0.3, w.evo ? '#e27bf0' : '#8ff0ff');
      for (const e of query(ox, oy, 5 * s.area)) {
        if ((e.cd[w.uid] || 0) > G.t) continue;
        e.cd[w.uid] = G.t + 0.4;
        hitEnemy(e, s.dmg, w, e.x - P.x, e.y - P.y, 45);
      }
    }
  },
  nova(w, s, dt) {
    cadence(w, s, dt, 0.18, () => {
      G.fx.push({ k: 'nova', r: 0, max: 74 * s.area, t: 0, dur: 0.38, w, dmg: s.dmg, hit: new Set(), evo: w.evo, o: P });
      Snd.play('nova');
    });
  },
  chain(w, s, dt) {
    cadence(w, s, dt, 0.1, () => {
      let e = target(210, true);
      if (!e) return;
      const pts = [[e.x + rand(-12, 12), e.y - 150]], hit = new Set();
      for (let j = 0; j <= s.pierce && e; j++) {
        pts.push([e.x, e.y - 2]); hit.add(e.id);
        hitEnemy(e, s.dmg, w, 0, 0, 0);
        burst(e.x, e.y, '#8ff0ff', 4, 50);
        let nx = null, nd = Infinity;
        for (const o of query(e.x, e.y, 80 * s.area)) {
          if (hit.has(o.id) || o.prop) continue;
          const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
          if (d < nd) { nd = d; nx = o; }
        }
        e = nx;
      }
      G.fx.push({ k: 'bolt', pts: jagged(pts), t: 0, dur: 0.22 });
      G.whiteFlash = Math.max(G.whiteFlash, 0.06);
      Snd.play('zap');
    });
  },
  frost(w, s, dt) {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = s.cd;
    const off = Math.random() * TAU;
    for (let i = 0; i < s.amount; i++) {
      const a = off + i * TAU / s.amount;
      G.projs.push({ k: 'shard', x: P.x, y: P.y - 3, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, ang: a,
        r: 3 * s.area, dmg: s.dmg, pierce: s.pierce, life: s.dur, w, hits: [], evo: w.evo });
    }
    Snd.play('frost');
  },
  glaive(w, s, dt) {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = s.cd;
    const tg = target(220, false);
    const base = tg ? Math.atan2(tg.y - P.y, tg.x - P.x) : Math.atan2(P.ay, P.ax);
    const spread = s.amount > 3 ? TAU / s.amount : 0.55;
    for (let i = 0; i < s.amount; i++) {
      const a = base + (i - (s.amount - 1) / 2) * spread;
      G.projs.push({ k: 'glaive', x: P.x, y: P.y - 3, a, spd: s.speed, ret: false, dist: 0, range: 125 * s.area,
        r: 6 * s.area, dmg: s.dmg, w, cd: new Map(), rot: 0, life: 6, evo: w.evo, area: s.area });
    }
    Snd.play('slash');
  },
  starfall(w, s, dt) {
    cadence(w, s, dt, 0.15, () => {
      const tg = target(230, true);
      const x = tg ? tg.x + rand(-6, 6) : P.x + rand(-120, 120), y = tg ? tg.y + rand(-6, 6) : P.y + rand(-80, 80);
      G.fx.push({ k: 'meteor', x, y, t: 0, delay: 0.55, dur: 0.6, r: 28 * s.area, dmg: s.dmg, w, evo: w.evo });
      Snd.play('meteor');
    });
  },
  lance(w, s, dt) {
    cadence(w, s, dt, 0.07, i => {
      const a = Math.atan2(P.ay, P.ax) + (i - (s.amount - 1) / 2) * 0.12;
      G.projs.push({ k: 'lance', x: P.x, y: P.y - 3, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, ang: a,
        r: 3 * s.area, dmg: s.dmg, pierce: s.pierce, life: s.dur, w, hits: [], evo: w.evo });
      Snd.play('shoot');
    });
  },
  aura(w, s, dt) {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = s.cd;
    for (const e of query(P.x, P.y - 2, 30 * s.area)) {
      hitEnemy(e, s.dmg, w, e.x - P.x, e.y - P.y, 18);
      if (w.evo && !e.boss && !e.dead) e.slow = 0.6;
    }
  },
  totem(w, s, dt) {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = s.cd;
    for (let i = 0; i < s.amount; i++) {
      const a = i / s.amount * TAU + Math.random(), r = s.amount > 1 ? 22 : 0;
      G.totems.push({ isTotem: true, x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, life: s.dur, max: s.dur, fireT: 0.3, w });
      burst(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, '#e8742c', 8, 50);
    }
    Snd.play('dash');
  },
  cinder(w, s, dt) {
    cadence(w, s, dt, 0.12, () => {
      const tg = target(170, true);
      const tx = tg ? tg.x + rand(-10, 10) : P.x + rand(-90, 90), ty = tg ? tg.y + rand(-10, 10) : P.y + rand(-70, 70);
      G.projs.push({ k: 'flask', x0: P.x, y0: P.y - 4, tx, ty, t: 0, dur: 0.55, x: P.x, y: P.y, z: 0, w,
        r: 22 * s.area, dmg: s.dmg, life: s.dur, evo: w.evo });
    });
  },
};

/* ---------- Update ---------- */
function update(rdt) {
  if (G.remote) { Mods.call('remoteUpdate', rdt); return; }
  let dt = rdt;
  if (G.slowT > 0) { G.slowT -= rdt; dt *= 0.3; }
  G.shake = Math.max(0, G.shake - rdt * 18);
  G.hurtFlash = Math.max(0, G.hurtFlash - rdt);
  G.whiteFlash = Math.max(0, G.whiteFlash - rdt * 2.2);
  if (G.over) {
    G.deathT -= rdt;
    updateFx(dt); updateParts(dt); updateTexts(dt);
    if (G.deathT <= 0) gameOver(false);
    return;
  }
  if (G.won) { G.winT -= rdt; if (G.winT <= 0) { gameOver(true); return; } }
  if (!G.dim) G.t += dt;
  buildGrid();
  for (const pl of G.players) { P = pl; ensureChunks(pl.x, pl.y); updatePlayer(dt); }
  P = ME;
  if (!Mods.call('director', dt)) director(dt);
  for (const k in G.buffs) G.buffs[k] = Math.max(0, G.buffs[k] - dt);
  const wdt = G.buffs.frenzy > 0 ? dt * 1.8 : dt;
  for (const pl of G.players) {
    if (pl.down) continue;
    P = pl;
    for (const w of pl.weapons) WUPD[w.id](w, w.s, wdt);
    if (G.buffs.echo > 0) for (const w of pl.weapons) WUPD[w.id](w, w.s, wdt);
  }
  P = ME;
  updateTotems(dt);
  if (!G.dim || G.dimStructs) { updateShrines(dt); updateCrypts(dt); }
  Mods.call('update', dt);
  P = ME;
  updateEnemies(dt);
  updateProjs(dt);
  updateBullets(dt);
  updatePools(dt);
  updateGems(dt);
  updateItems(dt);
  updateFx(dt);
  updateParts(dt);
  updateTexts(dt);
  P = ME;
  if (G.enemies.some(e => e.dead)) G.enemies = G.enemies.filter(e => !e.dead);
  updateHud();
  if (G.pending > 0 && state === 'play' && !G.over) openLevelUp();
}

function updatePlayer(dt) {
  P.hurtT = Math.max(0, P.hurtT - dt);
  if (P.down) { P.moving = false; return; }
  const [ix, iy] = P.dev ? devVec(P.dev) : P === ME ? inputVec() : (P.input || [0, 0]);
  P.moving = !!(ix || iy);
  P.rollCd = Math.max(0, (P.rollCd || 0) - dt);
  P.rollReq = Math.max(0, (P.rollReq || 0) - dt);
  if (P.rollReq > 0 && P.rollCd <= 0 && !(P.roll > 0)) {
    P.rollReq = 0; P.roll = ROLL_T; P.rollCd = ROLL_CD;
    if (P.moving) { const l = Math.hypot(ix, iy); P.ax = ix / l; P.ay = iy / l; }
    P.inv = Math.max(P.inv, ROLL_T + 0.02);
    Snd.play('dash');
  }
  if (P.roll > 0) {
    P.roll -= dt;
    const spd = P.speed * ROLL_SPEED;
    P.x += P.ax * spd * dt; P.y += P.ay * spd * dt;
    if (Math.abs(P.ax) > 0.1) P.face = P.ax > 0 ? 1 : -1;
    P.moving = false;
    if (Math.random() < 0.6) addPart(P.x + rand(-3, 3), P.y + 6, -P.ax * 20, -P.ay * 20 - 8, 0.3, '#36304f');
  } else if (P.moving) {
    const spd = P.speed * (P.wet ? 0.6 : 1) * (G.buffs.haste > 0 ? 1.4 : 1);
    P.x += ix * spd * dt; P.y += iy * spd * dt;
    const l = Math.hypot(ix, iy);
    P.ax = ix / l; P.ay = iy / l;
    if (Math.abs(ix) > 0.1) P.face = ix > 0 ? 1 : -1;
    P.anim += dt * 8 * (P.speed / 72);
    if (Math.random() < dt * 10) addPart(P.x + rand(-3, 3), P.y + 7, rand(-8, 8), rand(-12, -2), 0.35, '#36304f');
  }
  const foot = { x: P.x, y: P.y + 6 };
  P.wet = collideSolids(foot, 4);
  P.x = foot.x; P.y = foot.y - 6;
  if (P.wet && P.moving && Math.random() < dt * 12) addPart(P.x + rand(-4, 4), P.y + 7, rand(-10, 10), rand(-20, -8), 0.3, '#4a7c86');
  P.inv = Math.max(0, P.inv - dt);
  if (P.regen) P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);
  for (const o of G.players) {
    if (o === P || !o.down) continue;
    if (Math.hypot(o.x - P.x, o.y - P.y) < 22) {
      o.reviveT += dt;
      if (Math.random() < dt * 20) addPart(o.x + rand(-6, 6), o.y + 4, 0, -30, 0.5, '#ffd35a');
      if (o.reviveT >= 3) {
        o.down = false; o.hp = o.maxHp * 0.5; o.inv = 2; o.reviveT = 0;
        G.fx.push({ k: 'shock', x: o.x, y: o.y, t: 0, dur: 0.5, r: 60 });
        banner(o.ch.name + ' rises', '', '#ffd35a');
        Snd.play('heal');
      }
    } else o.reviveT = Math.max(0, o.reviveT - dt);
  }
}

function updateEnemies(dt) {
  const far = Math.max(W, H) * 0.85 + 80;
  let mobs = 0;
  const drag = Math.exp(-10 * dt);
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.prop) {
      e.anim += dt;
      const np = nearestPlayer(e.x, e.y);
      if (Math.abs(e.x - np.x) > 700 || Math.abs(e.y - np.y) > 700) e.dead = true;
      continue;
    }
    mobs++;
    e.anim += dt;
    if (e.dawn !== undefined) {
      e.dawn -= dt;
      if (e.dawn <= 0) { e.dead = true; burst(e.x, e.y, '#ffd35a', 8, 50); continue; }
    }
    if (e.rise > 0) e.rise -= dt;
    const tp = nearestPlayer(e.x, e.y);
    const dx = tp.x - e.x, dy = tp.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.boss || e.ai) {
      if (!(G.buffs.timestop > 0)) { P = tp; if (e.ai) e.ai(e, dt, tp, dx, dy, d); else bossAI(e, dt, dx, dy, d); P = ME; }
    }
    else {
      let spd = G.buffs.timestop > 0 ? 0 : e.spd * (G.buffs.haste > 0 ? 1.4 : 1);
      if (e.freeze > 0) { e.freeze -= dt; spd = 0; }
      else if (e.slow > 0) { e.slow -= dt; spd *= 0.45; }
      if (e.swarm) {
        e.x += e.swarm.dx * spd * dt; e.y += e.swarm.dy * spd * dt;
        e.dir = e.swarm.dx < 0 ? -1 : 1;
        e.swarm.life -= dt;
        if (e.swarm.life <= 0) { e.dead = true; continue; }
      } else {
        e.x += dx / d * spd * dt; e.y += dy / d * spd * dt;
        e.dir = dx < 0 ? -1 : 1;
        if (d > far && !e.anchored) { const [nx, ny] = edgePos(10, tp); e.x = nx; e.y = ny; }
      }
      if (e.d.shoot && e.freeze <= 0 && !(G.buffs.timestop > 0)) {
        e.shootT = (e.shootT ?? rand(1, e.d.shoot)) - dt;
        if (e.shootT <= 0) {
          e.shootT = e.d.shoot;
          if (d < 200) {
            G.bullets.push({ x: e.x, y: e.y, vx: dx / d * 75, vy: dy / d * 75, r: 2, life: 5, dmg: e.dmg * 0.8, c: '#8ff0ff' });
            Snd.play('bullet');
          }
        }
      }
    }
    e.x += e.kx * dt; e.y += e.ky * dt;
    e.kx *= drag; e.ky *= drag;
    if (!e.boss && !e.swarm && e.type !== 'bat' && e.type !== 'eye' && e.type !== 'wraith') collideSolids(e, e.r * 0.7);
  }
  G.mobs = mobs;

  // Soft separation so hordes spread into crowds instead of stacking
  for (const e of G.enemies) {
    if (e.dead || e.prop) continue;
    const cx = Math.floor(e.x / GRID), cy = Math.floor(e.y / GRID);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const b = grid.get(gkey(cx + ox, cy + oy));
      if (!b) continue;
      for (const o of b) {
        if (o.id <= e.id || o.dead || o.prop) continue;
        let ddx = o.x - e.x, ddy = o.y - e.y;
        const rr = (e.r + o.r) * 0.85, d2 = ddx * ddx + ddy * ddy;
        if (d2 >= rr * rr) continue;
        if (d2 < 0.0001) { ddx = rand(-1, 1); ddy = rand(-1, 1); }
        const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1, push = (rr - Math.sqrt(d2)) * 0.5;
        ddx /= dd; ddy /= dd;
        const we = e.boss ? 0.05 : 1, wo = o.boss ? 0.05 : 1;
        e.x -= ddx * push * we; e.y -= ddy * push * we;
        o.x += ddx * push * wo; o.y += ddy * push * wo;
      }
    }
  }

  for (const pl of G.players) {
    if (pl.down || pl.inv > 0) continue;
    let worst = 0;
    for (const e of query(pl.x, pl.y, pl.r)) if (!e.prop && e.dawn === undefined && !e.harmless) worst = Math.max(worst, e.dmg);
    if (worst) hurtPlayer(worst, pl);
  }
}

function bossAI(e, dt, dx, dy, d) {
  const enr = e.hp < e.maxHp * 0.5 ? 1.35 : 1;
  const b = e.bdef;
  const toChase = () => { e.st = 'chase'; e.stT = rand(2, 3.2) / enr; };
  const fire = (a, spd) => G.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 3, life: 7, dmg: 12 + e.tier * 6, c: '#e27bf0' });
  e.dir = dx < 0 ? -1 : 1;
  e.stT -= dt;
  switch (e.st) {
    case 'chase':
      e.x += dx / d * e.spd * enr * dt; e.y += dy / d * e.spd * enr * dt;
      if (d > Math.max(W, H)) { e.x += dx / d * 200 * dt; e.y += dy / d * 200 * dt; }
      if (e.stT <= 0) {
        const opts = ['burst', 'dash', 'summon'];
        if (e.tier >= 1) opts.push('spiral', 'dash');
        e.st = pick(opts); e.n = 0; e.sub = 0;
        e.stT = { burst: 1.6, dash: 99, summon: 1, spiral: 2.6 + e.tier * 0.6 }[e.st];
      }
      break;
    case 'burst':
      e.sub -= dt;
      if (e.sub <= 0 && e.n < 3) {
        e.sub = 0.45 / enr;
        const off = e.n * 0.2 + Math.random();
        for (let i = 0; i < b.bullets; i++) fire(off + i * TAU / b.bullets, 62 + e.tier * 8);
        e.n++; Snd.play('bullet');
        G.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, dur: 0.25, r: 26, c: '#e27bf0' });
      }
      if (e.stT <= 0) toChase();
      break;
    case 'spiral':
      e.sub -= dt;
      if (e.sub <= 0) {
        e.sub = 0.08 / enr; e.ang += 0.33;
        for (let k = 0; k < 3; k++) fire(e.ang + k * TAU / 3, 70);
        Snd.play('bullet');
      }
      if (e.stT <= 0) toChase();
      break;
    case 'dash':
      if (e.n === 0) { e.n = 1; e.wind = 0.75; e.tx = P.x; e.ty = P.y; Snd.play('warn'); }
      else if (e.wind > 0) {
        e.wind -= dt;
        if (e.wind <= 0) {
          const ddx = e.tx - e.x, ddy = e.ty - e.y, l = Math.hypot(ddx, ddy) || 1;
          e.dvx = ddx / l * 300 * enr; e.dvy = ddy / l * 300 * enr; e.dashT = 0.6;
          Snd.play('dash'); G.shake = Math.max(G.shake, 4);
        }
      } else {
        e.x += e.dvx * dt; e.y += e.dvy * dt; e.dashT -= dt;
        addPart(e.x + rand(-12, 12), e.y + rand(-12, 12), 0, 0, 0.4, b.color, 2);
        if (e.dashT <= 0) toChase();
      }
      break;
    case 'summon':
      if (e.n === 0) {
        e.n = 1;
        const n = 8 + e.tier * 5, pool = [['skel', 'bat'], ['ghoul', 'eye', 'skel'], ['wraith', 'ghoul', 'eye']][e.tier];
        for (let i = 0; i < n; i++) { const a = i / n * TAU; spawnEnemy(pick(pool), e.x + Math.cos(a) * 46, e.y + Math.sin(a) * 46); }
        G.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, dur: 0.5, r: 50, c: b.color });
        Snd.play('nova');
      }
      if (e.stT <= 0) toChase();
      break;
  }
}

function updateProjs(dt) {
  for (const p of G.projs) {
    if (p.dead) continue;
    if (p.k === 'bolt' || p.k === 'shard' || p.k === 'lance') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      if (p.k === 'bolt' && Math.random() < 0.8)
        addPart(p.x + rand(-1, 1), p.y + rand(-1, 1), -p.vx * 0.1 + rand(-12, 12), -p.vy * 0.1 + rand(-12, 12), rand(0.15, 0.3), pick(['#ffd35a', '#e8742c', '#d8354a']));
      for (const e of query(p.x, p.y, p.r)) {
        if (p.hits.includes(e.id)) continue;
        p.hits.push(e.id);
        const killed = hitEnemy(e, p.dmg, p.w, p.vx, p.vy, p.k === 'bolt' ? 30 : 15);
        if (p.k === 'lance' && p.evo && killed && !e.prop) P.hp = Math.min(P.maxHp, P.hp + 0.5);
        if (p.k === 'shard' && !e.boss && !e.dead) { if (p.evo) e.freeze = 1.4; else e.slow = 1.6; }
        if (p.k === 'bolt' && p.evo) explode(p.x, p.y, 24 * p.area, p.dmg * 0.6, p.w);
        if (--p.pierce <= 0) { p.dead = true; break; }
      }
      if (p.dead && p.k === 'bolt') burst(p.x, p.y, '#e8742c', 4, 40);
    } else if (p.k === 'glaive') {
      p.rot += 20 * dt; p.life -= dt;
      if (!p.ret) {
        const sp = p.spd * (1 - 0.6 * p.dist / p.range);
        p.x += Math.cos(p.a) * sp * dt; p.y += Math.sin(p.a) * sp * dt; p.dist += sp * dt;
        if (p.dist >= p.range) { p.ret = true; p.spd = 40; }
      } else {
        p.spd = Math.min(420, p.spd + 520 * dt);
        const dx = P.x - p.x, dy = P.y - 3 - p.y, d = Math.hypot(dx, dy) || 1;
        p.x += dx / d * p.spd * dt; p.y += dy / d * p.spd * dt;
        if (d < 8) p.dead = true;
      }
      if (p.life <= 0) p.dead = true;
      for (const e of query(p.x, p.y, p.r)) {
        if ((p.cd.get(e.id) || 0) > G.t) continue;
        p.cd.set(e.id, G.t + 0.3);
        hitEnemy(e, p.dmg, p.w, e.x - p.x, e.y - p.y, 40);
      }
    } else if (p.k === 'flask') {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.x0 + (p.tx - p.x0) * k; p.y = p.y0 + (p.ty - p.y0) * k; p.z = Math.sin(k * Math.PI) * 34;
      if (k >= 1) {
        p.dead = true;
        G.pools.push({ x: p.tx, y: p.ty, r: p.r, life: p.life, max: p.life, tick: 0, dmg: p.dmg, w: p.w, evo: p.evo, seed: Math.random() * 1000 });
        burst(p.tx, p.ty, '#e8742c', 12, 80);
        Snd.play('glass');
      }
    }
  }
  G.projs = G.projs.filter(p => !p.dead);
}

function updateBullets(dt) {
  for (const b of G.bullets) {
    if (!(G.buffs.timestop > 0)) { if (b.upd) b.upd(b, dt); b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
    if (b.life <= 0) { b.dead = true; continue; }
    for (const pl of G.players) {
      if (pl.down) continue;
      const dx = b.x - pl.x, dy = b.y - pl.y;
      if (b.dmg && dx * dx + dy * dy < (b.r + pl.r - 1) ** 2 && pl.inv <= 0) { hurtPlayer(b.dmg, pl); b.dead = true; break; }
    }
  }
  G.bullets = G.bullets.filter(b => !b.dead);
}

function updatePools(dt) {
  for (const p of G.pools) {
    p.life -= dt; p.tick -= dt;
    if (p.tick <= 0) {
      p.tick = 0.3;
      for (const e of query(p.x, p.y, p.r * 0.9)) {
        hitEnemy(e, p.dmg, p.w, 0, 0, 0);
        if (p.evo && !e.boss && !e.dead) e.slow = 0.6;
      }
    }
    if (Math.random() < dt * p.r * 0.6) addPart(p.x + rand(-p.r, p.r) * 0.8, p.y + rand(-p.r, p.r) * 0.45, 0, rand(-30, -14), rand(0.3, 0.6), pick(['#ffd35a', '#e8742c', '#d8354a']), 1, 0, 1);
  }
  G.pools = G.pools.filter(p => p.life > 0);
}

function gainXp(v) {
  G.xp += v * P.growth;
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext; G.level++; G.xpNext = xpFor(G.level); G.pending++;
  }
}

function updateGems(dt) {
  for (const g of G.gems) {
    const pl = g.to || nearestPlayer(g.x, g.y);
    const dx = pl.x - g.x, dy = pl.y - g.y, d2 = dx * dx + dy * dy;
    if (!g.fly && d2 < pl.magnet * pl.magnet) { g.fly = true; g.sp = -60; g.to = pl; }
    if (!g.fly) continue;
    g.sp += 650 * dt;
    const d = Math.sqrt(d2) || 1;
    g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt;
    if (d < 7) {
      g.dead = true;
      G.gemCombo = G.t - G.lastGemT < 0.35 ? G.gemCombo + 1 : 0;
      G.lastGemT = G.t;
      P = pl; gainXp(g.v); P = ME;
      Snd.play('gem', G.gemCombo);
    }
  }
  if (G.gems.some(g => g.dead)) G.gems = G.gems.filter(g => !g.dead);
}

function updateItems(dt) {
  for (const it of G.items) {
    it.ph += dt;
    P = nearestPlayer(it.x, it.y);
    const dx = P.x - it.x, dy = P.y - it.y, d = Math.hypot(dx, dy) || 1;
    if ((it.k === 'coin' || it.k === 'bag') && d < P.magnet) { it.x += dx / d * 140 * dt; it.y += dy / d * 140 * dt; }
    if (d > P.r + 7) continue;
    it.dead = true;
    switch (it.k) {
      case 'heart': P.hp = Math.min(P.maxHp, P.hp + 30); addText(P.x, P.y - 14, '+30', false, '#a6e05a'); Snd.play('heal'); break;
      case 'coin': G.gold += Math.round(3 * P.greed); Snd.play('coin'); break;
      case 'bag': G.gold += Math.round(30 * P.greed); addText(P.x, P.y - 14, '+' + Math.round(30 * P.greed), false, '#ffd35a'); Snd.play('coin'); break;
      case 'magnet':
        for (const g of G.gems) if (!g.fly) { g.fly = true; g.sp = -40; }
        G.fx.push({ k: 'ring', x: P.x, y: P.y, t: 0, dur: 0.4, r: 60, c: '#3f8ee0' });
        Snd.play('pickup'); break;
      case 'bomb':
        for (const e of G.enemies) {
          if (e.dead || e.prop) continue;
          if (Math.abs(e.x - P.x) < W / 2 + 10 && Math.abs(e.y - P.y) < H / 2 + 10) hitEnemy(e, e.boss ? 400 : 99999, null, e.x - P.x, e.y - P.y, 0);
        }
        G.whiteFlash = 1; G.shake = 8; Snd.play('bigboom'); break;
      case 'chest': if (P !== ME && Mods.call('remoteChest', P, it.boss)) break; openChest(it.boss); break;
      case 'buff': giveBuff(it.b, BUFFS[it.b].dur); break;
      default: Mods.call('pickup', it);
    }
  }
  P = ME;
  if (G.items.some(i => i.dead)) G.items = G.items.filter(i => !i.dead);
}

function updateFx(dt) {
  for (const f of G.fx) {
    f.t += dt;
    if (f.k === 'nova' && f.t > 0) {
      const k = Math.min(1, f.t / f.dur);
      f.r = f.max * (1 - (1 - k) * (1 - k));
      const o = f.o || P;
      for (const e of query(o.x, o.y, f.r)) {
        if (f.hit.has(e.id)) continue;
        f.hit.add(e.id);
        hitEnemy(e, f.dmg, f.w, e.x - o.x, e.y - o.y, 150);
        if (f.evo && !e.boss && !e.dead) e.slow = 2;
      }
      for (const b of G.bullets) {
        const dx = b.x - o.x, dy = b.y - o.y;
        if (dx * dx + dy * dy < f.r * f.r) { b.dead = true; addPart(b.x, b.y, 0, 0, 0.2, '#e27bf0', 2); }
      }
    }
  }
  for (const f of G.fx) {
    if (f.k === 'meteor' && !f.hit && f.t >= f.delay) {
      f.hit = true;
      explode(f.x, f.y, f.r, f.dmg, f.w);
      burst(f.x, f.y, '#ffd35a', 10, 90);
      G.shake = Math.max(G.shake, 2);
    }
  }
  G.fx = G.fx.filter(f => f.t < f.dur);
}
function updateParts(dt) {
  for (const p of G.parts) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    const f = Math.exp(-p.drag * dt);
    p.vx *= f; p.vy = p.vy * f + p.grav * dt;
    p.life -= dt;
  }
  G.parts = G.parts.filter(p => p.life > 0);
}
function updateTexts(dt) {
  for (const t of G.texts) { t.life -= dt; t.y -= 26 * dt * (t.life / t.max + 0.2); }
  G.texts = G.texts.filter(t => t.life > 0);
}

function updateTotems(dt) {
  for (const t of G.totems) {
    t.life -= dt; t.fireT -= dt;
    if (t.fireT > 0) continue;
    const s = t.w.s;
    t.fireT = t.w.evo ? 0.32 : 0.5;
    let best = null, bd = 200 * 200;
    for (const e of G.enemies) {
      if (e.prop || e.dead) continue;
      const d = (e.x - t.x) ** 2 + (e.y - t.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) continue;
    const base = Math.atan2(best.y - t.y + 6, best.x - t.x);
    for (const off of t.w.evo ? [-0.18, 0, 0.18] : [0]) {
      G.projs.push({ k: 'bolt', x: t.x, y: t.y - 6, vx: Math.cos(base + off) * s.speed, vy: Math.sin(base + off) * s.speed,
        r: 3 * s.area, dmg: s.dmg, pierce: s.pierce, life: 1.2, w: t.w, hits: [], evo: false, area: s.area });
    }
    Snd.play('shoot');
  }
  for (const t of G.totems) if (t.life <= 0) burst(t.x, t.y - 4, '#a59cc4', 8, 40);
  G.totems = G.totems.filter(t => t.life > 0);
}

function giveBuff(b, dur) {
  const d = BUFFS[b];
  G.buffs[b] = Math.max(G.buffs[b] || 0, dur);
  addText(P.x, P.y - 18, d.name, false, d.color);
  G.fx.push({ k: 'ring', x: P.x, y: P.y, t: 0, dur: 0.45, r: 50, c: d.color });
  Snd.play('buff');
}
const BASE_BUFFS = ['rage', 'frenzy', 'aegis', 'timestop'];
function dropBuff(x, y) {
  const b = pick(BASE_BUFFS);
  G.items.push({ k: 'buff', b, spr: SPR.buff[b], x, y, ph: 0 });
}

/* ---------- Shrines of Fortune ---------- */
function spawnShrine() {
  const a = Math.random() * TAU, R = rand(240, 340);
  G.shrines.push({ isShrine: true, id: uid++, x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R, uses: 3, ph: Math.random() * 6, spent: 0 });
  banner('A shrine has appeared', 'Follow the violet arrow and test your fate', '#e27bf0');
  Snd.play('shrine');
}
function updateShrines(dt) {
  if (!G.won) {
    G.shrineT -= dt;
    if (G.shrineT <= 0) {
      G.shrineT = rand(75, 115);
      if (G.shrines.filter(s => s.uses > 0).length < 2) spawnShrine();
    }
  }
  G.nearShrine = null;
  for (const s of G.shrines) {
    s.ph += dt;
    const dx = P.x - s.x, dy = P.y - s.y, d = Math.hypot(dx, dy) || 1;
    if (d < 9) { P.x = s.x + dx / d * 9; P.y = s.y + dy / d * 9; }
    if (s.uses <= 0) { s.spent += dt; continue; }
    if (d < 22) G.nearShrine = s;
    if (Math.random() < dt * 4) addPart(s.x + rand(-6, 6), s.y - 4, rand(-4, 4), rand(-26, -10), 0.8, pick(['#e27bf0', '#9a4fd0']));
  }
  G.shrines = G.shrines.filter(s => s.spent < 10 && Math.abs(s.x - P.x) < 1600 && Math.abs(s.y - P.y) < 1600);
}

let shrineSpinning = false;
function openShrine(s) {
  G.shrine = s;
  setState('shrine');
  document.querySelectorAll('.reel').forEach(r => { r.className = 'reel'; r.querySelector('img').src = ICON_URL.rune; });
  $('shrineResult').innerHTML = '';
  refreshShrine();
  Snd.play('shrine');
}
function refreshShrine() {
  const s = G.shrine, cost = G.shrineCost;
  $('shrineGold').textContent = G.gold;
  $('shrineUses').textContent = s.uses;
  $('btnPull').textContent = s.uses <= 0 ? 'The shrine is spent' : `Offer ${cost} gold`;
  $('btnPull').disabled = shrineSpinning || s.uses <= 0 || G.gold < cost;
  $('btnLeave').disabled = shrineSpinning;
}
function rollShrine() {
  const L = P.luck;
  const table = {};
  for (const o of SHRINE_OUTCOMES) {
    let w = o.w;
    if (o.id === 'nothing' || o.id === 'curse') w *= Math.max(0.35, 1 - 0.1 * L);
    else if (o.id === 'jackpot') w *= 1 + 0.25 * L;
    else w *= 1 + 0.05 * L;
    table[o.id] = w;
  }
  const id = weighted(table);
  return SHRINE_OUTCOMES.find(o => o.id === id);
}
function shrineSymbols(out) {
  if (out.sym) return [out.sym, out.sym, out.sym];
  // A loss still teases: half the time two reels match and the third breaks the line
  const a = pick(SHRINE_SYMS);
  let b = pick(SHRINE_SYMS.filter(x => x !== a));
  if (Math.random() < 0.5) return [a, a, b];
  let c = pick(SHRINE_SYMS.filter(x => x !== a && x !== b));
  return [a, b, c];
}
function pullShrine() {
  const s = G.shrine, cost = G.shrineCost;
  if (!s || shrineSpinning || s.uses <= 0 || G.gold < cost) return;
  G.gold -= cost; s.uses--;
  G.shrineCost = Math.round(cost * 1.6);
  shrineSpinning = true;
  refreshShrine();
  $('shrineResult').innerHTML = '';
  const out = rollShrine(), syms = shrineSymbols(out);
  const reels = [...document.querySelectorAll('.reel')];
  reels.forEach(r => { r.className = 'reel spin'; });
  const stopAt = [700, 1150, 1700], start = performance.now(), done = [false, false, false];
  const iv = setInterval(() => {
    const t = performance.now() - start;
    reels.forEach((r, i) => {
      if (done[i]) return;
      if (t < stopAt[i]) { r.querySelector('img').src = ICON_URL[pick(SHRINE_SYMS)]; return; }
      done[i] = true;
      r.querySelector('img').src = ICON_URL[syms[i]];
      r.className = 'reel land';
      Snd.play('reel');
    });
    Snd.play('tick');
    if (done[2]) { clearInterval(iv); setTimeout(() => resolveShrine(out, cost, reels), 250); }
  }, 70);
}
function resolveShrine(out, cost, reels) {
  let text = '';
  switch (out.id) {
    case 'nothing':
      text = 'The shrine takes your gold and stays silent.';
      Snd.play('fizzle');
      break;
    case 'gold':
      G.gold += cost * 2;
      text = `It pays back ${cost * 2} gold.`;
      Snd.play('coin'); Snd.play('chest');
      break;
    case 'heal':
      P.hp = P.maxHp;
      text = 'Your wounds close completely.';
      Snd.play('heal');
      break;
    case 'buff': {
      const b = pick(BASE_BUFFS);
      G.buffs[b] = Math.max(G.buffs[b] || 0, 25);
      text = `${BUFFS[b].name} for 25 seconds: ${BUFFS[b].desc}.`;
      Snd.play('buff');
      break;
    }
    case 'upgrade': {
      const c = rollChoices(1)[0];
      const info = choiceInfo(c);
      applyChoice(c);
      text = `${info.name}${info.lv ? ' · ' + info.lv : ''}. ${info.desc}`;
      Snd.play('levelup');
      break;
    }
    case 'curse':
      G.cursePending = G.t > 600 ? 3 : 2;
      P.hp = Math.max(1, P.hp - Math.round(P.maxHp * 0.2));
      text = 'It drinks your blood. Hollow Knights answer the call, but they carry treasure.';
      Snd.play('curse');
      break;
    case 'jackpot': {
      const parts = [];
      const evoW = G.weapons.find(canEvolve);
      if (evoW) { evoW.evo = true; evoW.level = WEAPON_MAX(evoW.id); parts.push(WEAPONS[evoW.id].evoName + ' awakens'); recalc(); refreshSlots(); }
      for (let i = 0; i < 3; i++) { const c = rollChoices(1)[0]; const info = choiceInfo(c); applyChoice(c); parts.push(info.name); }
      P.hp = P.maxHp;
      G.gold += cost * 3;
      text = parts.join(', ') + `, a full heal and ${cost * 3} gold.`;
      Snd.play('jackpot');
      break;
    }
  }
  if (out.sym) reels.forEach(r => r.classList.add('win'));
  $('shrineResult').innerHTML = `<div class="t" style="color:${out.color}">${out.title}</div><div class="d">${text}</div>`;
  shrineSpinning = false;
  refreshShrine();
}
function leaveShrine() {
  if (shrineSpinning) return;
  G.shrine = null;
  setState('play');
  if (G.cursePending) {
    for (let i = 0; i < G.cursePending; i++) { const [x, y] = edgePos(20); spawnEnemy('knight', x, y); }
    banner('The shrine is angered', 'Hollow Knights approach', '#d8354a');
    G.cursePending = 0;
  }
}
$('btnPull').onclick = pullShrine;
$('btnLeave').onclick = () => { Snd.play('select'); leaveShrine(); };
$('shrinePrompt').onclick = () => interact();
function interact() {
  if (state !== 'play') return;
  if (Mods.first('interact', ME)) return;
  if (G.nearCrypt) enterCrypt(G.nearCrypt);
  else if (G.nearShrine) openShrine(G.nearShrine);
}

/* ---------- Crypt entrances on the night map ---------- */
function spawnCrypt() {
  const a = Math.random() * TAU, R = rand(250, 340);
  const c = { isCrypt: true, x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R, ph: 0 };
  ensureChunks(c.x, c.y);
  for (let i = 0; i < 3; i++) collideSolids(c, 16);
  G.crypts.push(c);
  banner('A crypt has opened', 'Follow the orange arrow. Treasure waits below', '#e8742c');
  Snd.play('warn');
}
function updateCrypts(dt) {
  if (!G.won && !G.boss) {
    G.cryptT -= dt;
    if (G.cryptT <= 0) { G.cryptT = rand(150, 200); if (!G.crypts.length) spawnCrypt(); }
  }
  G.nearCrypt = null;
  const crew = G.local ? G.players : [ME];   // on a shared screen anyone can lead the party down
  for (const c of G.crypts) {
    c.ph += dt;
    for (const pl of crew) {
      if (pl.down) continue;
      const dx = pl.x - c.x, dy = pl.y + 6 - c.y, d = Math.hypot(dx, dy) || 1;
      if (d < 20 && (pl === ME || !G.nearCrypt)) G.nearCrypt = c;
      if (d < 8) { pl.x = c.x + dx / d * 8; pl.y = c.y + dy / d * 8 - 6; }
    }
    if (Math.random() < dt * 2) addPart(c.x + rand(-6, 6), c.y - 8, rand(-3, 3), rand(-14, -6), 1, '#36304f', 2);
  }
  G.crypts = G.crypts.filter(c => crew.some(pl => Math.abs(c.x - pl.x) < 1600 && Math.abs(c.y - pl.y) < 1600));
}

/* ---------- Rendering ---------- */
let lights = [], glows = [];
const light = (x, y, r, a = 1) => { if (lights.length < 110) lights.push({ x, y, r, a }); };
const glowAt = (x, y, r, c, a = 0.6) => { if (glows.length < 160) glows.push({ x, y, r, c, a }); };
const onScreen = (x, y, m = 20) => x > camX - m && x < camX + W + m && y > camY - m && y < camY + H + m;

function blit(img, x, y, w, h, flip) {
  const dx = Math.round(x - camX - w / 2), dy = Math.round(y - camY - h / 2);
  if (flip) { ctx.save(); ctx.translate(dx + w, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); ctx.restore(); }
  else ctx.drawImage(img, dx, dy, w, h);
}
function shadow(x, y, w) {
  const sx = Math.round(x - camX - w / 2), sy = Math.round(y - camY);
  ctx.fillStyle = 'rgba(5,4,12,0.45)';
  ctx.fillRect(sx + 1, sy - 1, w - 2, 1); ctx.fillRect(sx, sy, w, 1); ctx.fillRect(sx + 1, sy + 1, w - 2, 1);
}
function pxRing(cx, cy, r, color, thick = 1) {
  ctx.fillStyle = color;
  for (let t = 0; t < thick; t++) {
    const rr = r - t;
    if (rr <= 0) break;
    const n = Math.max(12, Math.ceil(TAU * rr));
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
    }
  }
}
function pxLine(x0, y0, x1, y1, color, w = 1) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, o = Math.floor(w / 2);
  for (let guard = 0; guard < 2000; guard++) {
    ctx.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function pxDisc(cx, cy, r, color, squash = 0.55) {
  ctx.fillStyle = color;
  const ry = Math.max(1, Math.round(r * squash));
  for (let j = -ry; j <= ry; j++) {
    const w = Math.round(r * Math.sqrt(1 - (j / ry) ** 2));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + j), w * 2 + 1, 1);
  }
}

function drawGround() {
  const S = 192, C = 32, t = performance.now() / 1000, md = v => ((v % S) + S) % S;
  const x0 = Math.floor(camX / C), x1 = Math.floor((camX + W) / C), y0 = Math.floor(camY / C), y1 = Math.floor((camY + H) / C);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const wx = cx * C, wy = cy * C;
    ctx.drawImage(GROUNDS[biomeCell(cx, cy)], md(wx), md(wy), C, C, wx - camX, wy - camY, C, C);
  }
  // Ragged borders: each biome bites into its neighbour so edges read as ground, not tiles
  for (let cy = y0 - 1; cy <= y1; cy++) for (let cx = x0 - 1; cx <= x1; cx++) {
    const b = biomeCell(cx, cy), rb = biomeCell(cx + 1, cy), db = biomeCell(cx, cy + 1);
    if (rb !== b) for (let j = 0; j < 8; j++) {
      const w = Math.floor(hash2(cx, cy * 8 + j, 5) * 9);
      if (!w) continue;
      const wx = (cx + 1) * C - w, wy = cy * C + j * 4;
      ctx.drawImage(GROUNDS[rb], md(wx), md(wy), w, 4, wx - camX, wy - camY, w, 4);
    }
    if (db !== b) for (let j = 0; j < 8; j++) {
      const h = Math.floor(hash2(cx * 8 + j, cy, 6) * 9);
      if (!h) continue;
      const wx = cx * C + j * 4, wy = (cy + 1) * C - h;
      ctx.drawImage(GROUNDS[db], md(wx), md(wy), 4, h, wx - camX, wy - camY, 4, h);
    }
  }
  const c0 = Math.floor(camX / CH) - 1, c1 = Math.floor((camX + W) / CH) + 1;
  const r0 = Math.floor(camY / CH) - 1, r1 = Math.floor((camY + H) / CH) + 1;
  for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) {
    for (const d of chunk(cx, cy)) {
      if (d.tall) continue;
      const sx = d.x - camX, sy = d.y - camY;
      if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
      if (d.k === 'pond') { drawPond(d, sx, sy, t); continue; }
      ctx.drawImage(d.s.c, Math.round(sx - d.s.w / 2), Math.round(sy - d.s.h));
      if (d.k === 'candle') {
        light(d.x, d.y - 4, 26 * (1 + Math.sin(t * 13 + d.x) * 0.1), 0.8);
        glowAt(d.x, d.y - 4, 10, '#e8742c', 0.5);
      } else if (d.k === 'vent') {
        light(d.x, d.y - 2, 24, 0.7);
        glowAt(d.x, d.y - 1, 9, '#e8742c', 0.45 + Math.sin(t * 4 + d.seed) * 0.2);
        if (G && state === 'play' && Math.random() < 0.04) addPart(d.x + rand(-2, 2), d.y - 2, rand(-4, 4), rand(-30, -14), 0.8, pick(['#e8742c', '#ffd35a']));
      } else if (d.k === 'glowmush') {
        light(d.x, d.y - 2, 20, 0.7);
        glowAt(d.x, d.y - 3, 8, '#8ff0ff', 0.4 + Math.sin(t * 2 + d.seed) * 0.15);
      }
    }
  }
}
function drawPond(d, sx, sy, t) {
  pxDisc(sx, sy, d.r + 1, '#0b0a12', 0.55);
  pxDisc(sx, sy, d.r, '#14303a', 0.55);
  pxDisc(sx - 1, sy - 1, d.r * 0.72, '#173a45', 0.55);
  ctx.fillStyle = '#4a7c86';
  for (let i = 0; i < 3; i++) {
    const a = d.seed + i * 2.1 + t * 0.4, ph = (t * 1.5 + i) % 2;
    if (ph < 1.2) ctx.fillRect(Math.round(sx + Math.cos(a) * d.r * 0.5 - 1), Math.round(sy + Math.sin(a * 1.3) * d.r * 0.25), 3, 1);
  }
  ctx.fillStyle = '#2f6b3a'; ctx.fillRect(Math.round(sx + d.r * 0.4), Math.round(sy - 2), 3, 2);
  ctx.fillStyle = '#4fa04a'; ctx.fillRect(Math.round(sx + d.r * 0.4), Math.round(sy - 2), 1, 1);
  light(d.x, d.y, d.r * 1.2, 0.25);
}
function drawDecor(d) {
  const s = d.s;
  shadow(d.x, d.y, Math.round(s.w * 0.8));
  const behind = (d.k === 'tree' || d.k === 'deadtree' || d.k === 'pillar') && P && Math.abs(P.x - d.x) < s.w / 2 + 2 && P.y + 8 < d.y && P.y + 8 > d.y - s.h + 2;
  if (behind) ctx.globalAlpha = 0.45;
  ctx.drawImage(s.c, Math.round(d.x - camX - s.w / 2), Math.round(d.y - camY - s.h));
  ctx.globalAlpha = 1;
}
function sortY(e) {
  if (e.isDecor || e.isCrypt) return e.y;
  if (e.isPlayer) return e.y + 8;
  if (e.sortY !== undefined) return e.sortY;
  if (e.isShrine || e.isTotem) return e.y + 6;
  return e.y + (e.hh || 4) * (e.scale || 1);
}
function drawCrypt(c, now) {
  const s = SPR.crypt;
  shadow(c.x, c.y, s.w);
  blit(s.c, c.x, c.y - s.h / 2, s.w, s.h);
  for (const side of [-1, 1]) {
    const tx = c.x + side * 13, ty = c.y - 12, fl = Math.floor(now * 12 + side) % 3;
    const sx = Math.round(tx - camX), sy = Math.round(ty - camY);
    ctx.fillStyle = '#3a2618'; ctx.fillRect(sx - 1, sy, 2, 6);
    ctx.fillStyle = '#e8742c'; ctx.fillRect(sx - 1, sy - 3 - fl % 2, 3, 3);
    ctx.fillStyle = '#ffd35a'; ctx.fillRect(sx, sy - 4 - fl, 1, 2);
    light(tx, ty - 2, 40, 0.9);
    glowAt(tx, ty - 2, 10, '#e8742c', 0.5);
  }
  glowAt(c.x, c.y - 4, 12, '#d8354a', 0.35 + Math.sin(c.ph * 3) * 0.15);
  if (G.nearCrypt === c && Math.floor(now * 3) % 2) drawText(ctx, 'E', c.x - camX, c.y - camY - 24, '#ffd35a');
}

const PLAYER_COLORS = ['#ffd35a', '#8ff0ff', '#e27bf0', '#a6e05a'];
function render() {
  if (G) P = ME;
  if (G && D && (state === 'dungeon' || (state === 'pause' && G.pausedFrom === 'dungeon') || (state === 'dialogue' && typeof DLG !== 'undefined' && DLG && DLG.from === 'dungeon'))) { renderCryptViews(); drawJoystick(); return; }
  if (!G || state === 'menu' || state === 'chars' || state === 'altar') { renderMenuBg(); return; }
  if (G.local && G.players.length > 1 && state !== 'cine') renderSplit(drawScene);
  else drawScene();
  Mods.call('postRender');   // zoom, sky, fades, letterbox
  drawJoystick();
}
// The drag stick, shown wherever the mouse or a finger is steering
function drawJoystick() {
  if (!joy.active || (state !== 'play' && state !== 'dungeon')) return;
  const ox = joy.ox / SCALE, oy = joy.oy / SCALE;
  pxRing(ox, oy, 18, 'rgba(242,238,230,0.35)', 2);
  let dx = (joy.x - joy.ox) / SCALE, dy = (joy.y - joy.oy) / SCALE;
  const d = Math.hypot(dx, dy);
  if (d > 14) { dx = dx / d * 14; dy = dy / d * 14; }
  pxDisc(ox + dx, oy + dy, 6, 'rgba(242,238,230,0.5)', 1);
}
// One view of the night, centred on P. Split-screen calls this once per player (see local.js).
function drawScene() {
  const view = P;
  lights = []; glows = [];
  const pointers = [];
  const sh = G.shake;
  camX = Math.round(P.x - W / 2 + (sh ? rand(-sh, sh) : 0));
  camY = Math.round(P.y - H / 2 + (sh ? rand(-sh, sh) : 0));
  Mods.call('camera');   // a cutscene can take the camera
  const now = performance.now() / 1000;

  drawGround();
  Mods.call('drawGround', now);

  // Fire pools
  for (const p of G.pools) {
    if (!onScreen(p.x, p.y, p.r + 4)) continue;
    const a = Math.min(1, p.life / 0.4);
    ctx.globalAlpha = a;
    pxDisc(p.x - camX, p.y - camY, p.r, p.evo ? 'rgba(122,26,42,0.55)' : 'rgba(90,20,30,0.5)');
    pxDisc(p.x - camX, p.y - camY, p.r * 0.7, 'rgba(232,116,44,0.25)');
    const rr = mulberry32(Math.floor(now * 10) + Math.floor(p.seed));
    const n = Math.floor(p.r * 1.4);
    for (let i = 0; i < n; i++) {
      const ang = rr() * TAU, dd = Math.sqrt(rr()) * p.r;
      const fx = p.x - camX + Math.cos(ang) * dd, fy = p.y - camY + Math.sin(ang) * dd * 0.55;
      const h = 1 + Math.floor(rr() * 3);
      ctx.fillStyle = h === 3 ? '#ffd35a' : h === 2 ? '#e8742c' : '#d8354a';
      ctx.fillRect(Math.round(fx), Math.round(fy) - h, 1, h);
    }
    ctx.globalAlpha = 1;
    light(p.x, p.y, p.r * 2.2, 0.8 * a);
    glowAt(p.x, p.y, p.r * 1.4, '#e8742c', 0.35 * a);
  }

  // Gems
  for (const g of G.gems) {
    if (!onScreen(g.x, g.y, 8)) continue;
    const s = SPR.gem[g.tier], bob = Math.round(Math.sin(now * 4 + g.ph));
    blit(s.c, g.x, g.y + bob, s.w, s.h);
    if ((now * 2 + g.ph) % 3 < 0.12) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(g.x - camX) - 1, Math.round(g.y - camY + bob) - 2, 1, 1); }
    if (g.tier === 2) light(g.x, g.y, 18, 0.6);
  }

  // Items
  for (const it of G.items) {
    const spr = it.spr || SPR[it.k];
    const bob = it.k === 'chest' ? 0 : Math.round(Math.sin(it.ph * 4) * 1.5);
    if (!onScreen(it.x, it.y, 12)) { if (it.k === 'chest') pointers.push(it); continue; }
    shadow(it.x, it.y + spr.h / 2, spr.w - 2);
    blit(spr.c, it.x, it.y + bob - 2, spr.w, spr.h);
    if (it.k === 'chest') {
      light(it.x, it.y, 46, 1); glowAt(it.x, it.y, 22, '#ffd35a', 0.35 + Math.sin(now * 5) * 0.15);
      if (Math.random() < 0.15) addPart(it.x + rand(-6, 6), it.y - 6, 0, -14, 0.6, '#ffd35a');
    } else if (it.k === 'buff') {
      const c = BUFFS[it.b].color;
      light(it.x, it.y, 30, 0.9); glowAt(it.x, it.y, 14, c, 0.45 + Math.sin(now * 6) * 0.2);
      if (Math.random() < 0.08) addPart(it.x + rand(-4, 4), it.y - 4, 0, -16, 0.5, c);
    } else light(it.x, it.y, 20, 0.7);
  }

  for (const s of G.shrines) if (s.uses > 0 && !onScreen(s.x, s.y, 12)) pointers.push(s);
  for (const c of G.crypts) if (!onScreen(c.x, c.y, 12)) pointers.push(c);

  // Entities, y-sorted
  const ents = [];
  for (const e of G.enemies) if (!e.dead && onScreen(e.x, e.y, e.cull || 30 * (e.scale || 1))) ents.push(e);
  for (let cx = Math.floor(camX / CH) - 1; cx <= Math.floor((camX + W) / CH) + 1; cx++)
    for (let cy = Math.floor(camY / CH) - 1; cy <= Math.floor((camY + H) / CH) + 1; cy++)
      for (const d of chunk(cx, cy)) if (d.tall && onScreen(d.x, d.y - 10, 30)) ents.push(d);
  for (const c of G.crypts) if (onScreen(c.x, c.y, 30)) ents.push(c);
  for (const s of G.shrines) if (onScreen(s.x, s.y, 30)) ents.push(s);
  for (const t of G.totems) if (onScreen(t.x, t.y, 20)) ents.push(t);
  for (const pl of G.players) if (!(G.over && pl === ME)) ents.push(pl);
  Mods.call('ents', ents);
  ents.sort((a, b) => sortY(a) - sortY(b));
  for (const e of ents) {
    if (e.isPlayer) { P = e; drawPlayer(now); P = view; }
    else if (e.draw) e.draw(now);
    else if (e.isDecor) drawDecor(e);
    else if (e.isCrypt) drawCrypt(e, now);
    else if (e.isShrine) drawShrine(e, now);
    else if (e.isTotem) drawTotem(e, now);
    else if (e.prop) drawProp(e, now);
    else drawEnemy(e, now);
  }

  for (const pl of G.players) {
  if (pl.down) continue;
  P = pl;
  // Wisps
  for (const w of G.weapons) {
    if (w.id !== 'wisps' || w.active <= 0) continue;
    const s = w.s, R = 34 * s.area;
    const fade = Math.min(1, w.active / 0.25, (s.dur - w.active) / 0.2 + 0.2);
    for (let i = 0; i < s.amount; i++) {
      const a = w.ang + i * TAU / s.amount;
      const ox = P.x + Math.cos(a) * R, oy = P.y - 2 + Math.sin(a) * R;
      const c1 = w.evo ? '#e27bf0' : '#8ff0ff', c2 = w.evo ? '#9a4fd0' : '#3f8ee0';
      ctx.globalAlpha = Math.max(0, fade);
      const sx = Math.round(ox - camX), sy = Math.round(oy - camY), rad = Math.round(2 * s.area) + 1;
      ctx.fillStyle = c2; ctx.fillRect(sx - rad, sy - rad + 1, rad * 2 + 1, rad * 2 - 1); ctx.fillRect(sx - rad + 1, sy - rad, rad * 2 - 1, rad * 2 + 1);
      ctx.fillStyle = c1; ctx.fillRect(sx - rad + 1, sy - rad + 1, rad * 2 - 1, rad * 2 - 1);
      ctx.fillStyle = '#fff'; ctx.fillRect(sx - 1, sy - 1, 2, 2);
      ctx.globalAlpha = 1;
      light(ox, oy, 26, 0.9 * fade); glowAt(ox, oy, 14, c1, 0.5 * fade);
    }
  }

  // Thorn aura
  for (const w of G.weapons) {
    if (w.id !== 'aura') continue;
    const R = 30 * w.s.area, cx = P.x - camX, cy = P.y - 2 - camY;
    pxDisc(cx, cy, R, w.evo ? 'rgba(79,160,74,0.16)' : 'rgba(79,160,74,0.1)', 0.62);
    ctx.fillStyle = w.evo ? '#a6e05a' : '#4fa04a';
    const n = Math.round(R * 0.9);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + now * (w.evo ? 1.2 : 0.7);
      const rr = R + (i % 3 === 0 ? 1 : 0);
      ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.62), 1, i % 3 === 0 ? 2 : 1);
    }
  }
  // Aegis shimmer
  if (G.buffs.aegis > 0 && !G.over) {
    ctx.globalAlpha = 0.5 + Math.sin(now * 10) * 0.25;
    pxRing(P.x - camX, P.y - 2 - camY, 13, '#8ff0ff', 1);
    pxRing(P.x - camX, P.y - 2 - camY, 12, '#3f8ee0', 1);
    ctx.globalAlpha = 1;
    light(P.x, P.y, 40, 0.6);
  }
  }
  P = view;

  // Projectiles
  for (const p of G.projs) {
    if (!onScreen(p.x, p.y, 20)) continue;
    const sx = Math.round(p.x - camX), sy = Math.round(p.y - camY);
    if (p.k === 'bolt') {
      const r = p.evo ? 2 : 1;
      ctx.fillStyle = '#d8354a'; ctx.fillRect(sx - r - 1, sy - r, r * 2 + 3, r * 2 + 1); ctx.fillRect(sx - r, sy - r - 1, r * 2 + 1, r * 2 + 3);
      ctx.fillStyle = '#ffd35a'; ctx.fillRect(sx - r, sy - r, r * 2 + 1, r * 2 + 1);
      ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 1, 1);
      light(p.x, p.y, 30, 0.9); glowAt(p.x, p.y, 12 * p.area, '#e8742c', 0.7);
    } else if (p.k === 'lance') {
      const cx = Math.cos(p.ang), cy = Math.sin(p.ang);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = '#0b0a12';
        ctx.fillRect(Math.round(sx - cx * i) - 1, Math.round(sy - cy * i), 3, 1);
      }
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i < 2 ? '#fff' : i < 7 ? (p.evo ? '#ff9aa6' : '#f2eee6') : (p.evo ? '#d8354a' : '#a59cc4');
        ctx.fillRect(Math.round(sx - cx * i), Math.round(sy - cy * i), 1, 1);
      }
      light(p.x, p.y, 16, 0.5);
      if (p.evo) glowAt(p.x, p.y, 10, '#d8354a', 0.5);
    } else if (p.k === 'shard') {
      const cx = Math.cos(p.ang), cy = Math.sin(p.ang);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i < 2 ? '#fff' : i < 4 ? (p.evo ? '#c9f7ff' : '#8ff0ff') : '#3f8ee0';
        ctx.fillRect(Math.round(sx - cx * i), Math.round(sy - cy * i), 1, 1);
      }
      light(p.x, p.y, 18, 0.6); glowAt(p.x, p.y, 8, '#8ff0ff', 0.4);
    } else if (p.k === 'glaive') {
      const spr = p.evo ? SPR.glaiveEvo : SPR.glaive, sz = Math.round(8 * p.area);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot); ctx.drawImage(spr.c, -sz / 2, -sz / 2, sz, sz); ctx.restore();
      light(p.x, p.y, 26, 0.7); glowAt(p.x, p.y, 12, p.evo ? '#ffd35a' : '#c4c4cf', 0.4);
    } else if (p.k === 'flask') {
      shadow(p.x, p.y + 2, 4);
      blit(SPR.flask.c, p.x, p.y - p.z, 4, 5);
      light(p.x, p.y - p.z, 14, 0.6);
    }
  }

  // Enemy bullets
  for (const b of G.bullets) {
    if (!onScreen(b.x, b.y, 6)) continue;
    if (b.draw) { b.draw(b); continue; }
    const sx = Math.round(b.x - camX), sy = Math.round(b.y - camY), r = b.r;
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(sx - r - 1, sy - r, r * 2 + 3, r * 2 + 1); ctx.fillRect(sx - r, sy - r - 1, r * 2 + 1, r * 2 + 3);
    ctx.fillStyle = b.c; ctx.fillRect(sx - r, sy - r, r * 2 + 1, r * 2 + 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 1, 1);
    light(b.x, b.y, 16, 0.5); glowAt(b.x, b.y, 10, b.c, 0.5);
  }

  drawFx();

  // Particles
  for (const p of G.parts) {
    if (!onScreen(p.x, p.y, 4)) continue;
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  Mods.call('drawTop', now);

  // Lighting: darkness deepens toward 10:00, then lifts at dawn
  light(P.x, P.y - 4, 118 + Math.sin(now * 3) * 3, 1);
  let dark = 0.5 + 0.22 * Math.min(1, G.t / 600);
  if (G.won) dark *= Math.max(0, G.winT / 4);
  if (G.darkMul) dark = Math.min(0.92, dark * G.darkMul);
  lx.globalCompositeOperation = 'source-over';
  lx.clearRect(0, 0, W, H);
  lx.fillStyle = `rgba(7,5,18,${dark})`;
  lx.fillRect(0, 0, W, H);
  lx.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    lx.globalAlpha = L.a;
    lx.drawImage(LIGHT, Math.round(L.x - camX - L.r), Math.round(L.y - camY - L.r), L.r * 2, L.r * 2);
  }
  lx.globalAlpha = 1;
  ctx.drawImage(lc, 0, 0, W, H, 0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const g of glows) {
    ctx.globalAlpha = g.a;
    ctx.drawImage(glow(g.c), Math.round(g.x - camX - g.r), Math.round(g.y - camY - g.r), g.r * 2, g.r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (G.won) { ctx.fillStyle = `rgba(255,200,120,${0.25 * (1 - G.winT / 4)})`; ctx.fillRect(0, 0, W, H); }

  if (G.buffs.timestop > 0) {
    ctx.fillStyle = 'rgba(143,240,255,0.1)'; ctx.fillRect(0, 0, W, H);
  }
  Mods.call('drawOverlay', now);
  Mods.call('pointers', pointers);
  for (const it of pointers) drawPointer(it);

  // Damage numbers
  for (const t of G.texts) {
    if (t.life < 0.15 && Math.floor(t.life * 40) % 2) continue;
    drawText(ctx, t.s, t.x - camX, t.y - camY, t.c, t.scale);
  }

  // Player HP bars (and revive progress for a fallen partner)
  for (const pl of G.players) {
    if (G.over && pl === ME) continue;
    const bx = Math.round(pl.x - camX - 9), by = Math.round(pl.y - camY + 10);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(bx - 1, by - 1, 20, 4);
    if (pl.down) {
      ctx.fillStyle = '#36304f'; ctx.fillRect(bx, by, 18, 2);
      ctx.fillStyle = '#ffd35a'; ctx.fillRect(bx, by, Math.round(18 * pl.reviveT / 3), 2);
      if (Math.floor(now * 2) % 2) drawText(ctx, 'HELP', pl.x - camX, pl.y - camY - 16, '#ffd35a');
      continue;
    }
    ctx.fillStyle = '#7a1a2a'; ctx.fillRect(bx, by, 18, 2);
    ctx.fillStyle = pl === ME ? '#d8354a' : '#3f8ee0'; ctx.fillRect(bx, by, Math.round(18 * clamp(pl.hp / pl.maxHp, 0, 1)), 2);
    if (G.players.length > 1) drawText(ctx, 'P' + (G.players.indexOf(pl) + 1), pl.x - camX, pl.y - camY - 15, PLAYER_COLORS[G.players.indexOf(pl)] || '#fff');
    if (G.local && !pl.down) { const it = nearInteract(pl); if (it) drawText(ctx, pl.dev ? pl.dev.hint : 'A', pl.x - camX, pl.y - camY - 24, '#ffd35a'); }
  }

  // Boss telegraph
  if (G.boss && G.boss.st === 'dash' && G.boss.wind > 0 && Math.floor(now * 14) % 2) {
    const b = G.boss;
    pxLine(b.x - camX, b.y - camY, b.tx - camX, b.ty - camY, '#d8354a', 2);
  }

  // Screen overlays
  if (G.hurtFlash > 0) {
    ctx.fillStyle = `rgba(216,53,74,${G.hurtFlash * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (!G.over && !P.down && P.hp / P.maxHp < 0.3) {
    const a = 0.25 + Math.sin(now * 6) * 0.15;
    ctx.fillStyle = `rgba(216,53,74,${a})`;
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 1 - i * 0.25;
      ctx.fillRect(0, i * 2, W, 2); ctx.fillRect(0, H - 2 - i * 2, W, 2);
      ctx.fillRect(i * 2, 0, 2, H); ctx.fillRect(W - 2 - i * 2, 0, 2, H);
    }
    ctx.globalAlpha = 1;
  }
  if (G.whiteFlash > 0) {
    ctx.fillStyle = `rgba(255,248,230,${Math.min(0.85, G.whiteFlash)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPlayer(now) {
  if (P.down) { drawFallen(P, now); return; }
  if (P.roll > 0) {
    const f = P.frames[0], x = Math.round(P.x - camX), y = Math.round(P.y - camY);
    shadow(P.x, P.y + 8, 10);
    for (let i = 1; i <= 2; i++) {
      ctx.globalAlpha = 0.25 / i;
      ctx.drawImage(f.c, Math.round(x - P.ax * i * 7 - f.w / 2), Math.round(y - P.ay * i * 7 - f.h / 2));
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((1 - P.roll / ROLL_T) * TAU * P.face);
    ctx.drawImage(f.c, -f.w / 2, -f.h / 2);
    ctx.restore();
    return;
  }
  if (P.inv > 0 && P.inv < 5 && Math.floor(now * 20) % 2) return;
  animateHero(P, now);
}

function drawShrine(s, now) {
  const base = SPR.shrine;
  shadow(s.x, s.y + 6, 16);
  if (s.uses <= 0) {
    ctx.globalAlpha = Math.max(0, 1 - s.spent / 10);
    blit(base.c, s.x, s.y, base.w, base.h);
    ctx.globalAlpha = 1;
    return;
  }
  blit(base.c, s.x, s.y, base.w, base.h);
  const bob = Math.round(Math.sin(s.ph * 2) * 2);
  blit(SPR.crystal.c, s.x, s.y - 15 + bob, SPR.crystal.w, SPR.crystal.h);
  light(s.x, s.y - 10, 64 + Math.sin(now * 3) * 4, 1);
  glowAt(s.x, s.y - 14 + bob, 18, '#e27bf0', 0.55);
  for (let i = 0; i < s.uses; i++) { ctx.fillStyle = '#e27bf0'; ctx.fillRect(Math.round(s.x - camX) - 4 + i * 3, Math.round(s.y - camY) + 8, 2, 1); }
  if (G.nearShrine === s && Math.floor(now * 3) % 2) drawText(ctx, 'E', s.x - camX, s.y - camY - 30, '#ffd35a');
}

function drawTotem(t, now) {
  if (t.life < 1 && Math.floor(now * 12) % 2) return;
  const s = SPR.totem;
  shadow(t.x, t.y + 5, 8);
  blit(s.c, t.x, t.y - 1, s.w, s.h);
  const c = t.w.evo ? '#ffd35a' : '#e8742c';
  light(t.x, t.y - 4, 34, 0.9);
  glowAt(t.x, t.y - 4, 10, c, 0.6);
}

function drawProp(e, now) {
  const s = e.frames[0];
  shadow(e.x, e.y + 4, 8);
  blit(s.c, e.x, e.y, s.w, s.h);
  const sx = Math.round(e.x - camX), sy = Math.round(e.y - camY - 4);
  const fl = Math.floor(now * 12 + e.id) % 3;
  ctx.fillStyle = '#d8354a'; ctx.fillRect(sx - 3, sy - 2, 6, 2);
  ctx.fillStyle = '#e8742c'; ctx.fillRect(sx - 2, sy - 4 - fl % 2, 4, 3);
  ctx.fillStyle = '#ffd35a'; ctx.fillRect(sx - 1 + (fl === 2 ? 1 : 0), sy - 5 - fl, 2, 3);
  if (Math.random() < 0.1) addPart(e.x + rand(-2, 2), e.y - 9, rand(-4, 4), rand(-24, -10), 0.6, '#ffd35a');
  light(e.x, e.y - 6, 52 + Math.sin(now * 11 + e.id) * 3, 1);
  glowAt(e.x, e.y - 6, 16, '#e8742c', 0.55);
}

function drawEnemy(e, now) {
  if (e.drawFn) { e.drawFn(e, now); return; }
  const fr = e.frames[Math.floor(e.anim / e.d.anim) % e.frames.length];
  const sc = e.scale || 1, w = fr.w * sc, h = fr.h * sc;
  const floaty = e.type === 'bat' || e.type === 'eye' || e.type === 'wraith';
  const bob = floaty ? Math.round(Math.sin(e.anim * 5 + e.id) * 1.5) - 2 : 0;
  shadow(e.x, e.y + h / 2 - (floaty ? -2 : 1), Math.max(6, Math.round(w * 0.7)));
  const flip = e.dir < 0;
  if (e.elite || e.boss) {
    const oc = e.boss ? '#d8354a' : '#ffd35a';
    ctx.globalAlpha = 0.6 + Math.sin(now * 8) * 0.3;
    const sil = silhouette(fr, oc);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) blit(sil, e.x + ox, e.y + bob + oy, w, h, flip);
    ctx.globalAlpha = 1;
    light(e.x, e.y, e.boss ? 70 : 34, 0.7);
  }
  if (e.dawn !== undefined) {
    blit(fr.c, e.x, e.y + bob, w, h, flip);
    ctx.globalAlpha = clamp(1 - e.dawn / 2, 0, 1);
    blit(silhouette(fr, '#ffd35a'), e.x, e.y + bob, w, h, flip);
    ctx.globalAlpha = 1;
    return;
  }
  animateEnemy(e, fr, w, h, bob, flip, now);
  if (e.flash > 0.05) { ctx.globalAlpha = e.boss ? 0.45 : 0.85; blit(silhouette(fr, '#ffffff'), e.x, e.y + bob, w, h, flip); ctx.globalAlpha = 1; }
  else if (e.freeze > 0) { ctx.globalAlpha = 0.65; blit(silhouette(fr, '#8ff0ff'), e.x, e.y + bob, w, h, flip); ctx.globalAlpha = 1; }
  else if (e.slow > 0) { ctx.globalAlpha = 0.35; blit(silhouette(fr, '#3f8ee0'), e.x, e.y + bob, w, h, flip); ctx.globalAlpha = 1; }
  if (e.type === 'eye') light(e.x, e.y + bob, 12, 0.4);
  if (e.elite && e.hp < e.maxHp) {
    const bx = Math.round(e.x - camX - 9), by = Math.round(e.y - camY - h / 2 - 5);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(bx - 1, by - 1, 20, 4);
    ctx.fillStyle = '#ffd35a'; ctx.fillRect(bx, by, Math.round(18 * e.hp / e.maxHp), 2);
  }
}

function drawPointer(it) {
  const cx = W / 2, cy = H / 2, dx = it.x - camX - cx, dy = it.y - camY - cy;
  const k = Math.min((W / 2 - 12) / Math.abs(dx || 1), (H / 2 - 12) / Math.abs(dy || 1));
  const px = cx + dx * k, py = cy + dy * k, a = Math.atan2(dy, dx);
  const t = performance.now() / 1000;
  const pulse = 1 + Math.sin(t * 8) * 0.5;
  ctx.fillStyle = it.pcolor || (it.isShrine ? '#e27bf0' : it.isCrypt ? '#e8742c' : '#ffd35a');
  for (let i = 0; i < 5; i++) for (let j = -i; j <= i; j++) {
    const lx0 = 4 - i, ly0 = j * 0.8;
    ctx.fillRect(Math.round(px + Math.cos(a) * (lx0 + pulse) - Math.sin(a) * ly0), Math.round(py + Math.sin(a) * (lx0 + pulse) + Math.cos(a) * ly0), 1, 1);
  }
  const icon = it.picon || (it.isShrine ? SPR.crystal : it.isCrypt ? SPR.crypt : SPR.chest);
  ctx.drawImage(icon.c, Math.round(px - Math.cos(a) * 12 - icon.w / 2), Math.round(py - Math.sin(a) * 12 - icon.h / 2));
}

function drawFx() {
  for (const f of G.fx) {
    if (f.t < 0) continue;
    const p = f.t / f.dur;
    if (f.k === 'slash') {
      const a0 = f.ang - f.arc / 2, sweep = f.arc * Math.min(1, p * 1.7);
      const o = f.o || P, cx = o.x - camX, cy = o.y - 3 - camY;
      const layers = f.evo ? ['#fff', '#ffd1d6', '#d8354a', '#7a1a2a'] : ['#fff', '#f2eee6', '#a59cc4', '#5e557f'];
      ctx.globalAlpha = 1 - p * 0.6;
      for (let L = 0; L < 7; L++) {
        ctx.fillStyle = layers[Math.min(3, Math.floor(L / 2))];
        const rr = f.r - L;
        for (let a = a0; a < a0 + sweep; a += 0.8 / rr) {
          const k = (a - a0) / f.arc;
          if (L > Math.sin(Math.PI * k) * 7 * (1 - p * 0.5)) continue;
          ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
      light(o.x + Math.cos(f.ang) * f.r * 0.6, o.y + Math.sin(f.ang) * f.r * 0.6, f.r, 0.5 * (1 - p));
    } else if (f.k === 'nova') {
      const o = f.o || P, cx = o.x - camX, cy = o.y - 3 - camY;
      ctx.globalAlpha = 1 - p * 0.7;
      pxRing(cx, cy, f.r, f.evo ? '#d8354a' : '#9a4fd0', 3);
      pxRing(cx, cy, f.r - 1, f.evo ? '#ffd35a' : '#e27bf0', 1);
      pxRing(cx, cy, f.r * 0.6, 'rgba(226,123,240,0.3)', 1);
      ctx.globalAlpha = 1;
      light(o.x, o.y, f.r + 10, 0.45 * (1 - p));
    } else if (f.k === 'bolt') {
      if (Math.floor(f.t * 60) % 3 === 2) continue;
      for (let i = 1; i < f.pts.length; i++) {
        const [ax, ay] = f.pts[i - 1], [bx, by] = f.pts[i];
        pxLine(ax - camX, ay - camY, bx - camX, by - camY, '#3f8ee0', 3);
      }
      for (let i = 1; i < f.pts.length; i++) {
        const [ax, ay] = f.pts[i - 1], [bx, by] = f.pts[i];
        pxLine(ax - camX, ay - camY, bx - camX, by - camY, p < 0.5 ? '#fff' : '#8ff0ff', 1);
      }
      for (let i = 0; i < f.pts.length; i += 3) light(f.pts[i][0], f.pts[i][1], 34, 0.7 * (1 - p));
    } else if (f.k === 'pop') {
      pxRing(f.x - camX, f.y - camY, f.r * (0.5 + p), '#f2eee6', 1);
    } else if (f.k === 'ring') {
      ctx.globalAlpha = 1 - p;
      pxRing(f.x - camX, f.y - camY, f.r * (f.rev ? 1 - p * 0.7 : 0.3 + p * 0.7), f.c, 2);   // rev: a ring that closes in
      ctx.globalAlpha = 1;
      light(f.x, f.y, f.r * 1.3, 0.6 * (1 - p));
    } else if (f.k === 'meteor') {
      if (f.t >= f.delay) continue;
      const k = f.t / f.delay, sx = f.x - camX, sy = f.y - camY;
      ctx.globalAlpha = 0.4 + k * 0.5;
      pxDisc(sx, sy, f.r * (0.3 + 0.7 * k), 'rgba(216,53,74,0.22)');
      pxRing(sx, sy, f.r * (0.3 + 0.7 * k), '#d8354a', 1);
      ctx.globalAlpha = 1;
      const mx = sx - 70 * (1 - k), my = sy - 150 * (1 - k);
      pxLine(mx, my, mx - 10, my - 22, '#e8742c', 2);
      pxLine(mx, my, mx - 5, my - 11, '#ffd35a', 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 3, 3);
      light(f.x - 70 * (1 - k), f.y - 150 * (1 - k), 30, 0.9);
      glowAt(f.x - 70 * (1 - k), f.y - 150 * (1 - k), 14, '#e8742c', 0.7);
    } else if (f.k === 'shock') {
      ctx.globalAlpha = 1 - p;
      pxRing(f.x - camX, f.y - 3 - camY, f.r * (1 - (1 - p) ** 3), '#ffd35a', 3);
      ctx.globalAlpha = 1;
    }
  }
}

/* ---------- Menu backdrop ---------- */
let menuT = 0;
const menuBats = [], menuEmbers = [];
function renderMenuBg() {
  lights = []; glows = [];
  camX = Math.round(menuT * 10); camY = Math.round(menuT * 4);
  drawGround();
  const tall = [];
  for (let cx = Math.floor(camX / CH) - 1; cx <= Math.floor((camX + W) / CH) + 1; cx++)
    for (let cy = Math.floor(camY / CH) - 1; cy <= Math.floor((camY + H) / CH) + 1; cy++)
      for (const d of chunk(cx, cy)) if (d.tall) tall.push(d);
  tall.sort((a, b) => a.y - b.y).forEach(drawDecor);
  if (Math.random() < 0.02 && menuBats.length < 8) {
    const y = rand(0.15, 0.85) * H;
    for (let i = 0; i < 5; i++) menuBats.push({ x: -20 - i * 14 - rand(0, 10), y: y + rand(-14, 14), v: rand(40, 60), ph: Math.random() * 6 });
  }
  for (const b of menuBats) {
    b.x += b.v / 60;
    const fr = SPR.bat[Math.floor(menuT / 0.11 + b.ph) % 2];
    ctx.drawImage(fr.c, Math.round(b.x), Math.round(b.y + Math.sin(menuT * 4 + b.ph) * 3));
  }
  for (let i = menuBats.length - 1; i >= 0; i--) if (menuBats[i].x > W + 20) menuBats.splice(i, 1);
  if (menuEmbers.length < 70) menuEmbers.push({ x: rand(0, W), y: H + 4, vy: rand(-22, -8), ph: Math.random() * 6, c: pick(['#ffd35a', '#e8742c', '#d8354a']) });
  for (const m of menuEmbers) {
    m.y += m.vy / 60;
    m.x += Math.sin(menuT * 2 + m.ph) * 0.2;
    ctx.fillStyle = m.c; ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    glows.push({ x: m.x + camX, y: m.y + camY, r: 4, c: m.c, a: 0.5 });
  }
  for (let i = menuEmbers.length - 1; i >= 0; i--) if (menuEmbers[i].y < -4) menuEmbers.splice(i, 1);
  lights.push({ x: camX + W / 2, y: camY + H * 0.6, r: Math.max(W, H) * 0.55, a: 1 });
  lx.globalCompositeOperation = 'source-over';
  lx.clearRect(0, 0, W, H);
  lx.fillStyle = 'rgba(7,5,18,0.78)'; lx.fillRect(0, 0, W, H);
  lx.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    lx.globalAlpha = L.a;
    lx.drawImage(LIGHT, Math.round(L.x - camX - L.r), Math.round(L.y - camY - L.r), L.r * 2, L.r * 2);
  }
  lx.globalAlpha = 1;
  ctx.drawImage(lc, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const g of glows) { ctx.globalAlpha = g.a; ctx.drawImage(glow(g.c), Math.round(g.x - camX - g.r), Math.round(g.y - camY - g.r), g.r * 2, g.r * 2); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

/* ---------- UI ---------- */
const SCREENS = ['menu', 'chars', 'altar', 'levelup', 'chest', 'shrine', 'pause', 'over'];
function setState(s) {
  state = s;
  for (const id of SCREENS) $(id).classList.toggle('hidden', id !== s);
  if (!SCREENS.includes(s) && !HUD_STATES.has(s)) Mods.call('screen', s);
  $('hud').classList.toggle('hidden', !HUD_STATES.has(s));
  Mods.call('state', s);
  if (s !== 'play') { $('shrinePrompt').classList.add('hidden'); hudLast.prompt = ''; }
  $('dhud').classList.toggle('hidden', s !== 'dungeon');
  $('dpad').classList.toggle('hidden', s !== 'dungeon' && s !== 'play');
  $('dpad').classList.toggle('roll-only', s === 'play');
  $('mute').classList.toggle('hidden', ['play', 'levelup', 'chest', 'shrine', 'dungeon', 'fading'].includes(s));
  joy.active = false;
}

function banner(t, s, c) {
  const b = $('banner');
  $('bannerT').textContent = t; $('bannerT').style.color = c || '#f2eee6';
  $('bannerS').textContent = s || '';
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

let hudLast = {};
function updateHud() {
  const set = (id, v) => { if (hudLast[id] !== v) { hudLast[id] = v; $(id).textContent = v; } };
  $('xpfill').style.width = `calc(${clamp(G.xp / G.xpNext, 0, 1) * 100}% - 4px)`;
  set('lvl', 'LV ' + G.level);
  const L = typeof levelLeft === 'function' ? levelLeft() : null, chainClock = L !== null && L !== undefined && !G.story;
  set('timer', fmtTime(chainClock ? (G.dimPhase === 'done' ? Math.max(0, G.advanceT || 0) : dimClock()) : G.t));
  if (chainClock) $('timer').classList.toggle('boss', (L < 60 && G.dimPhase !== 'done') || !!G.boss);
  set('kills', G.kills);
  set('goldc', G.gold);
  const bk = Object.keys(G.buffs).filter(k => G.buffs[k] > 0).map(k => k + Math.ceil(G.buffs[k])).join();
  if (hudLast.buffs !== bk) {
    hudLast.buffs = bk;
    $('buffs').innerHTML = Object.keys(G.buffs).filter(k => G.buffs[k] > 0).map(k =>
      `<div class="buff" style="--bc:${BUFFS[k].color}"><img src="${ICON_URL[BUFFS[k].icon]}" alt="">${BUFFS[k].name} ${Math.ceil(G.buffs[k])}</div>`).join('');
  }
  const label = state !== 'play' ? '' : Mods.first('promptLabel') || (G.nearCrypt ? 'E · Enter the crypt' : G.nearShrine ? `E · Make an offering (${G.shrineCost} gold)` : '');
  if (hudLast.prompt !== label) {
    hudLast.prompt = label;
    $('shrinePrompt').classList.toggle('hidden', !label);
    $('shrinePrompt').textContent = label;
  }
  Mods.call('hud');
  if (G.boss) $('bossfill').style.width = `calc(${clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100}% - 4px)`;
}

function refreshSlots() {
  $('wslots').innerHTML = G.weapons.filter(w => !w.fusedInto).map(w => w.superWith
    ? `<div class="slot super" title="${superName(w)}"><img src="${ICON_URL[w.id]}" alt=""><img class="fused" src="${ICON_URL[w.superWith]}" alt=""></div>`
    : `<div class="slot${w.evo ? ' evo' : ''}"><img src="${ICON_URL[w.id]}" alt=""><b>${w.evo ? '' : w.level}</b></div>`).join('');
  $('pslots').innerHTML = Object.entries(G.passives).map(([id, l]) => `<div class="slot"><img src="${ICON_URL[id]}" alt=""><b>${l}</b></div>`).join('');
}

function lvDesc(u, unit) {
  return Object.entries(u).map(([k, v]) => {
    switch (k) {
      case 'dmg': return `+${v} damage`;
      case 'amount': return `+${v} ${unit}${v > 1 ? 's' : ''}`;
      case 'pierce': return unit === 'strike' ? `Chains ${v} more time` : `Pierces ${v} more foe`;
      case 'area': return `+${Math.round(v * 100)}% area`;
      case 'cd': return `${Math.round(-v * 100)}% faster cooldown`;
      case 'speed': return `+${Math.round(v * 100)}% speed`;
      case 'dur': return `+${Math.round(v * 100)}% duration`;
    }
    return '';
  }).join(', ').replace(/^./, c => c.toUpperCase());
}

function rollChoices(n, ownedOnly) {
  const pool = [];
  for (const w of G.weapons) if (!w.evo && w.level < WEAPON_MAX(w.id)) pool.push({ k: 'w', id: w.id, wt: 3 });
  if (!ownedOnly && G.weapons.filter(w => !w.fusedInto).length < 6) for (const id in WEAPONS) if (!G.weapons.find(w => w.id === id)) pool.push({ k: 'w', id, wt: 1.6 });
  const pc = Object.keys(G.passives).length;
  for (const id in PASSIVES) {
    const l = G.passives[id] || 0;
    if (l > 0 && l < PASSIVES[id].max) pool.push({ k: 'p', id, wt: 2.2 });
    else if (!ownedOnly && l === 0 && pc < 6) pool.push({ k: 'p', id, wt: 1.2 });
  }
  const out = [];
  while (out.length < n && pool.length) {
    let r = Math.random() * pool.reduce((a, b) => a + b.wt, 0), i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].wt; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  if (!out.length && !ownedOnly) out.push({ k: 'heal' }, { k: 'gold' });
  return out;
}

function choiceInfo(c) {
  if (c.k === 'w') {
    const d = WEAPONS[c.id], w = G.weapons.find(x => x.id === c.id);
    const hint = { hint: `Evolves with ${PASSIVES[d.evo].name}`, hintIcon: d.evo };
    if (!w) return { icon: c.id, name: d.name, lv: 'New weapon', cls: 'new', desc: d.desc, ...hint };
    const next = w.level + 1, max = next === WEAPON_MAX(c.id);
    return { icon: c.id, name: d.name, lv: `Level ${next}${max ? ' (max)' : ''}`, desc: lvDesc(d.lv[w.level - 1], d.unit), ...hint };
  }
  if (c.k === 'p') {
    const d = PASSIVES[c.id], l = G.passives[c.id] || 0;
    const evoOf = Object.keys(WEAPONS).find(k => WEAPONS[k].evo === c.id);
    return { icon: c.id, name: d.name, lv: l ? `Level ${l + 1}` : 'New relic', cls: l ? '' : 'new', desc: d.desc,
      ...(evoOf ? { hint: `Evolves ${WEAPONS[evoOf].name}`, hintIcon: evoOf } : {}) };
  }
  if (c.k === 'heal') return { icon: 'heal', name: 'Ember Broth', lv: '', desc: 'Restore 40 HP.' };
  return { icon: 'gold', name: 'Pouch of Gold', lv: '', desc: '+40 gold.' };
}

function applyChoice(c) {
  if (c.k === 'w') { const w = G.weapons.find(x => x.id === c.id); if (w) w.level++; else addWeapon(c.id); }
  else if (c.k === 'p') G.passives[c.id] = (G.passives[c.id] || 0) + 1;
  else if (c.k === 'heal') P.hp = Math.min(P.maxHp, P.hp + 40);
  else if (c.k === 'gold') G.gold += 40;
  recalc();
  refreshSlots();
}

function withPlayer(pl, fn) {
  const keep = P; P = pl;
  try { return fn(); } finally { P = keep; }
}
// Shown above a menu that belongs to one player of a shared screen
function whoLabel(pl, what) {
  const i = G.players.indexOf(pl);
  return G.local && i >= 0 ? { text: `Player ${i + 1} · ${pl.ch.name}${what}`, color: PLAYER_COLORS[i % PLAYER_COLORS.length] } : { text: '', color: '' };
}
function setWho(id, pl, what) {
  const w = whoLabel(pl, what), el = $(id);
  el.textContent = w.text; el.style.color = w.color;
}

// Menus can belong to one player of a shared screen; local co-op vetoes clicks from anyone else (see local.js)
const menuClickAllowed = () => !Mods.first('menuClickBlocked');
let luSel = 0;
// Every level gives every standing player an upgrade of their own. They choose one after another while the rest wait.
function openLevelUp() {
  if (Mods.first('levelUp')) return;   // split-screen co-op shows every player's choices at once (see local.js)
  if (!G.lvQueue || !G.lvQueue.length) G.lvQueue = G.local ? G.players.filter(p => !p.down) : [ME];
  if (!G.lvQueue.length) G.lvQueue = [ME];
  G.chooser = G.lvQueue.shift();
  setState('levelup');
  Snd.play('levelup');
  $('xpbar').classList.add('flash');
  G.choices = withPlayer(G.chooser, () => rollChoices(Math.random() < 0.2 ? 4 : 3));
  setWho('luWho', G.chooser, G.lvQueue.length ? ' chooses · the others wait' : ' chooses');
  withPlayer(G.chooser, renderChoices);
}
function renderChoices() {
  const box = $('luCards');
  box.innerHTML = '';
  G.choices.forEach((c, i) => {
    const info = choiceInfo(c);
    const b = document.createElement('button');
    b.className = 'card';
    b.style.animationDelay = i * 0.06 + 's';
    b.innerHTML = `<span class="key">${i + 1}</span>
      <div class="top"><div class="ic"><img src="${ICON_URL[info.icon]}" alt=""></div>
      <div><div class="name">${info.name}</div><div class="lv ${info.cls || ''}">${info.lv}</div></div></div>
      <div class="desc">${info.desc}</div>
      ${info.hint ? `<div class="hint"><img src="${ICON_URL[info.hintIcon]}" alt="">${info.hint}</div>` : ''}`;
    b.onclick = () => { if (menuClickAllowed()) pickChoice(i); };
    b.onmouseenter = () => { if (luSel !== i) { luSel = i; markSel(); Snd.play('hover'); } };
    box.appendChild(b);
  });
  $('btnReroll').textContent = `Reroll (${G.rerolls})`;
  $('btnReroll').disabled = G.rerolls <= 0;
  luSel = 0; markSel();
}
function markSel() { [...$('luCards').children].forEach((c, i) => c.classList.toggle('sel', i === luSel)); }
function pickChoice(i) {
  const c = G.choices[i];
  if (!c || state !== 'levelup') return;
  Snd.play('select');
  withPlayer(G.chooser || P, () => applyChoice(c));
  refreshSlots();
  finishLevel();
}
function finishLevel() {
  if (G.lvQueue && G.lvQueue.length) { openLevelUp(); return; }   // the next player's upgrade for this same level
  G.pending--;
  if (G.pending > 0) { openLevelUp(); return; }
  $('xpbar').classList.remove('flash');
  setState('play');
  levelShock();
}
$('btnReroll').onclick = () => {
  if (G.rerolls <= 0 || !menuClickAllowed()) return;
  G.rerolls--; Snd.play('select');
  G.choices = withPlayer(G.chooser || P, () => rollChoices(G.choices.length));
  withPlayer(G.chooser || P, renderChoices);
};
$('btnSkip').onclick = () => { if (!menuClickAllowed()) return; Snd.play('select'); finishLevel(); };

/* ---------- Chest ---------- */
const CHEST_URL = (() => {
  const c = document.createElement('canvas'); c.width = 12; c.height = 10;
  c.getContext('2d').drawImage(SPR.chest.c, 0, 0);
  return c.toDataURL();
})();
// A chest belongs to the player it is opened for: what comes out of it goes to them alone
function openChest(isBoss, note, owner = P) {
  setState('chest');
  G.chest = { boss: !!isBoss, opened: false, note, owner };
  setWho('chestWho', owner, "'s chest");
  $('chestImg').src = CHEST_URL;
  $('chestList').innerHTML = '';
  $('chest').classList.remove('open', 'shake');
  $('btnChest').textContent = 'Open';
  $('btnChest').disabled = false;
  Snd.play('pickup');
}
// One chest for each of the given players, one after another
function openChestsFor(players, isBoss, note) {
  G.chestQueue = players.slice(1);
  openChest(isBoss, note, players[0]);
}
function revealChest() {
  const ch = G.chest;
  if (ch.opened) {
    const next = G.chestQueue && G.chestQueue.shift();
    if (next) openChest(ch.boss, null, next);
    else setState('play');
    return;
  }
  ch.opened = true;
  $('btnChest').disabled = true;
  $('chest').classList.add('shake');
  Snd.play('chest');
  setTimeout(() => {
    $('chest').classList.remove('shake');
    $('chest').classList.add('open');
    const rows = [];
    withPlayer(ch.owner || P, () => {
      const evoW = G.weapons.find(canEvolve);
      if (evoW) {
        evoW.evo = true; evoW.level = WEAPON_MAX(evoW.id);
        const d = WEAPONS[evoW.id];
        rows.push({ icon: evoW.id, name: d.evoName, lv: `Evolved from ${d.name}. ${d.evoDesc}`, evo: true });
        Snd.play('evolve');
        recalc();
      }
      const total = ch.boss ? 3 : Math.random() < 0.25 + 0.05 * P.luck ? 3 : 1;
      while (rows.length < total) {
        const c = rollChoices(1, true)[0];
        if (!c) break;
        const info = choiceInfo(c);
        applyChoice(c);
        rows.push({ icon: info.icon, name: info.name, lv: info.lv + ' · ' + info.desc });
      }
      const gold = Math.round(rand(15, 40) * (ch.boss ? 3 : 1) * P.greed);
      G.gold += gold;
      rows.push({ icon: 'gold', name: `${gold} gold`, lv: 'Spend it at shrines, or at the Altar of Embers' });
    });
    refreshSlots();
    if (ch.note) rows.push(ch.note);
    $('chestList').innerHTML = rows.map((r, i) => `<div class="rew${r.evo ? ' evo' : ''}" style="animation-delay:${0.15 + i * 0.25}s">
      <div class="ic"><img src="${ICON_URL[r.icon]}" alt=""></div><div><div class="name">${r.name}</div><div class="lv">${r.lv}</div></div></div>`).join('');
    $('btnChest').textContent = 'Continue';
    setTimeout(() => { $('btnChest').disabled = false; }, 300 + rows.length * 250);
  }, 750);
}
$('btnChest').onclick = () => { if (menuClickAllowed()) revealChest(); };

/* ---------- Pause ---------- */
function openPause() {
  if ((state !== 'play' && state !== 'dungeon') || G.over) return;
  G.pausedFrom = state;
  setState('pause');
  const items = [
    ...G.weapons.map(w => ({ icon: w.id, name: w.evo ? WEAPONS[w.id].evoName : WEAPONS[w.id].name, lv: w.evo ? 'Evolved' : `Level ${w.level}/${WEAPON_MAX(w.id)}` })),
    ...Object.entries(G.passives).map(([id, l]) => ({ icon: id, name: PASSIVES[id].name, lv: `Level ${l}/${PASSIVES[id].max}` })),
  ];
  $('buildList').innerHTML = items.map(i => `<div class="bi"><img src="${ICON_URL[i.icon]}" alt=""><div><div class="name">${i.name}</div><div class="lv">${i.lv}</div></div></div>`).join('');
  $('volSfx').value = save.vol.sfx; $('volMus').value = save.vol.mus;
}
$('btnResume').onclick = () => { Snd.play('select'); setState(G.pausedFrom || 'play'); };
$('btnQuit').onclick = () => { G.over = true; gameOver(false); };
$('pausebtn').onclick = openPause;
$('volSfx').oninput = e => { save.vol.sfx = +e.target.value; save.muted = false; applyVolume(); persist(); };
$('volMus').oninput = e => { save.vol.mus = +e.target.value; save.muted = false; applyVolume(); persist(); };

/* ---------- Game over ---------- */
function gameOver(won) {
  if (Mods.call('gameOver', won)) return;
  D = null; DP = null;
  const timeBonus = Math.floor(G.t / 60) * 10, killBonus = Math.floor(G.kills / 25);
  const earned = G.gold + Math.round((timeBonus + killBonus + (won ? 300 : 0)) * P.greed);
  save.gold += earned;
  G.earnedGold = earned;
  save.best = Math.max(save.best || 0, Math.min(G.t, RUN_LENGTH));
  persist();
  setState('over');
  $('overT').textContent = won ? 'Dawn breaks' : 'You fell';
  $('overT').classList.toggle('win', won);
  $('overS').textContent = won ? `${G.ch.name} ${G.ch.title} survived the night.` : `The night claimed ${G.ch.name} at ${fmtTime(G.t)}.`;
  const ws = [...G.weapons].sort((a, b) => b.dealt - a.dealt);
  const top = Math.max(1, ws[0] ? ws[0].dealt : 1);
  $('overStats').innerHTML = `
    <div class="srow"><span>Survived</span><b>${fmtTime(G.t)}</b></div>
    <div class="srow"><span>Level reached</span><b>${G.level}</b></div>
    <div class="srow"><span>Enemies slain</span><b>${G.kills}</b></div>
    <div class="sep"></div>
    ${ws.map(w => `<div class="wrow"><img src="${ICON_URL[w.id]}" alt=""><div>${w.evo ? WEAPONS[w.id].evoName : WEAPONS[w.id].name}<div class="bar" style="width:${Math.max(2, w.dealt / top * 100)}%"></div></div><b>${w.dealt.toLocaleString()}</b></div>`).join('')}
    <div class="sep"></div>
    <div class="gold-earned"><img src="${ICON_URL.gold}" alt=""> +${earned} gold</div>`;
  Snd.play(won ? 'win' : 'select');
  Snd.music(0);
  lastChar = G.ch.id;
}
let lastChar = 'wren';
$('btnAgain').onclick = () => { Snd.play('select'); if (G && G.local) restartLocal(); else newRun(lastChar); };
$('btnMenu').onclick = () => { Snd.play('select'); openMenu(); };

/* ---------- Menu, characters, altar ---------- */
function openMenu() {
  D = null; DP = null;
  G = null; P = null;
  setState('menu');
  $('menuGold').textContent = save.gold;
  $('menuBest').textContent = save.best ? fmtTime(save.best) : '--:--';
  Snd.music(0);
}
function openChars() {
  setState('chars');
  const box = $('charList');
  box.innerHTML = '';
  CHARS.forEach((ch, i) => {
    const locked = ch.cost && !save.unlocked[ch.id];
    const b = document.createElement('button');
    b.className = 'card char' + (locked ? ' locked' : '');
    b.style.animationDelay = i * 0.06 + 's';
    const portrait = charFrames(ch.id)[0].c.toDataURL();
    b.innerHTML = `<img class="portrait" src="${portrait}" alt="">
      <div><div class="name">${ch.name}</div><div class="title2">${ch.title}</div></div>
      <div class="start"><img src="${ICON_URL[ch.weapon]}" alt="">${WEAPONS[ch.weapon].name}</div>
      <div class="desc">${ch.desc}</div>
      ${locked ? `<div class="price"><img src="${ICON_URL.gold}" alt=""> ${ch.cost} to unlock</div>` : ''}`;
    b.onmouseenter = () => Snd.play('hover');
    b.onclick = () => {
      if (locked) {
        if (save.gold >= ch.cost) { save.gold -= ch.cost; save.unlocked[ch.id] = true; persist(); Snd.play('chest'); openChars(); }
        else { Snd.play('hurt'); b.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 180 }); }
        return;
      }
      Snd.play('select');
      lastChar = ch.id;
      newRun(ch.id);
    };
    box.appendChild(b);
  });
}
function openAltar() {
  setState('altar');
  $('altarGold').textContent = save.gold;
  const box = $('altarList');
  box.innerHTML = '';
  for (const a of ALTAR) {
    const rank = save.shop[a.id] || 0, maxed = rank >= a.max, cost = altarCost(a, rank);
    const b = document.createElement('button');
    b.className = 'alt' + (!maxed && save.gold < cost ? ' cant' : '');
    b.disabled = maxed;
    b.innerHTML = `<div class="ic"><img src="${ICON_URL[a.icon]}" alt=""></div><div style="flex:1">
      <div class="name">${a.name}</div><div class="pips">${Array.from({ length: a.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</div>
      <div class="desc">${a.desc}</div></div>
      <div class="price${maxed ? ' max' : ''}">${maxed ? 'Max' : `<img src="${ICON_URL.gold}" alt=""> ${cost}`}</div>`;
    b.onmouseenter = () => Snd.play('hover');
    b.onclick = () => {
      if (maxed) return;
      if (save.gold < cost) { Snd.play('hurt'); return; }
      save.gold -= cost; save.shop[a.id] = rank + 1; persist();
      Snd.play('coin');
      openAltar();
    };
    box.appendChild(b);
  }
}
$('btnPlay').onclick = () => { Snd.play('select'); openChars(); };
$('btnAltar').onclick = () => { Snd.play('select'); openAltar(); };
document.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => { Snd.play('select'); openMenu(); }; });
$('mute').onclick = () => { save.muted = !save.muted; persist(); applyVolume(); };
document.querySelectorAll('img[data-icon]').forEach(img => { img.src = ICON_URL[img.dataset.icon]; });

function onKey(e) {
  if (Mods.call('key', e)) return;
  if (e.code === 'KeyM') { save.muted = !save.muted; persist(); applyVolume(); return; }
  if (state === 'play' && e.code === 'KeyE') { interact(); return; }
  if (state === 'play' && !e.repeat && ROLL_KEYS.includes(e.code) && ME) { ME.rollReq = 0.15; return; }
  if (state === 'shrine') {
    if (e.code === 'Escape') leaveShrine();
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); pullShrine(); }
    return;
  }
  if (state === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) { openPause(); return; }
  if (state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { setState(G.pausedFrom || 'play'); return; }
  if (state === 'dungeon' && (e.code === 'Escape' || e.code === 'KeyP')) { openPause(); return; }
  if (state === 'levelup') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= G.choices.length) { pickChoice(n - 1); return; }
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown' || e.code === 'KeyD' || e.code === 'KeyS') { luSel = (luSel + 1) % G.choices.length; markSel(); Snd.play('hover'); }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowUp' || e.code === 'KeyA' || e.code === 'KeyW') { luSel = (luSel + G.choices.length - 1) % G.choices.length; markSel(); Snd.play('hover'); }
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); pickChoice(luSel); }
    if (e.code === 'KeyR') $('btnReroll').click();
    return;
  }
  if (state === 'chest' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); if (!$('btnChest').disabled) revealChest(); return; }
}

/* ---------- Main loop ---------- */
let lastT = performance.now();
function frame(now) {
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;
  menuT += dt;
  frames++;
  const t0 = performance.now();
  Mods.call('input');   // device presses (controllers) are read before the frame advances
  if (state === 'play' && G) update(dt);
  else if (state === 'dungeon' && D) updateCrypt(dt);
  else Mods.call('frame', state, dt);
  render();
  frameMs = frameMs * 0.95 + (performance.now() - t0) * 0.05;
  if (SIM) setTimeout(() => frame(performance.now()), 16); else requestAnimationFrame(frame);
}
let frames = 0, frameMs = 0;

applyVolume();
openMenu();

// Dev/test entry: ?auto=<char>&t=<seconds>&lv=<upgrades>&evo=1&god=1&pending=<n>&chest=1&weak=1&screen=chars|altar
// Headless capture helpers: sim=1 (timer-driven loop + auto menus), snap=<ms> (canvas PNG into DOM), debug=1
const QS = new URLSearchParams(location.search);
const SIM = !!QS.get('sim');
// ?gold=<amount> sets your saved gold once, then cleans the address so a refresh doesn't repeat it
if (QS.get('gold') !== null && !isNaN(+QS.get('gold'))) {
  save.gold = Math.max(0, Math.floor(+QS.get('gold')));
  persist();
  $('menuGold').textContent = save.gold;
  history.replaceState(null, '', location.pathname);
}
if (QS.get('weak')) for (const b of BOSSES) b.hp = 60;
// Test entry runs once every module has loaded
addEventListener('load', () => {
  if (QS.get('auto')) {
    newRun(QS.get('auto'));
    if (QS.get('t')) {
      G.t = +QS.get('t');
      G.evIdx = EVENTS.findIndex(ev => ev.t >= G.t);
      if (G.evIdx < 0) G.evIdx = EVENTS.length;
    }
    for (let i = 0; i < (+QS.get('lv') || 0); i++) { const c = rollChoices(1)[0]; if (c) applyChoice(c); }
    for (const w of G.weapons) if (QS.get('evo') && canEvolve(w)) w.evo = true;
    recalc(); refreshSlots();
    P.hp = P.maxHp;
    if (QS.get('god')) { P.inv = 1e9; G.god = true; }
    if (QS.get('pending')) G.pending = +QS.get('pending');
    if (QS.get('chest')) openChest(true);
    if (QS.get('at')) { const [ax, ay] = QS.get('at').split(',').map(Number); P.x = ax; P.y = ay; }
    if (QS.get('crypt')) addEventListener('load', () => enterCrypt(null));
    if (QS.get('cryptclear')) setTimeout(() => { if (D) D.ents.forEach(e => { e.dead = true; }); }, +QS.get('cryptclear'));
    if (QS.get('cryptdoor')) { G.cryptT = 0; }
    for (const id of (QS.get('w') || '').split(',').filter(Boolean)) { if (!G.weapons.find(w => w.id === id)) addWeapon(id); const w = G.weapons.find(x => x.id === id); w.level = WEAPON_MAX(id); if (QS.get('evo')) w.evo = true; }
    if (QS.get('buff')) G.buffs[QS.get('buff')] = 99;
    if (QS.get('shrine')) { G.gold += +QS.get('shrine'); G.shrines.push({ isShrine: true, id: uid++, x: P.x + 40, y: P.y, uses: 3, ph: 0, spent: 0 }); if (QS.get('open')) openShrine(G.shrines[0]); }
  }
  if (QS.get('screen') === 'chars') openChars();
  if (QS.get('screen') === 'altar') openAltar();
});
// In sim mode, auto-answer menus so a headless capture keeps playing
if (SIM) setInterval(() => {
  if (state === 'levelup') pickChoice(0);
  else if (state === 'chest' && !$('btnChest').disabled) revealChest();
  else if (state === 'shrine' && !shrineSpinning) { if (!$('btnPull').disabled) pullShrine(); else leaveShrine(); }
}, 400);
if (QS.get('snap')) setTimeout(() => { const o = document.createElement('pre'); o.id = 'snap'; const big = document.createElement('canvas'); big.width = W * 3; big.height = H * 3; const bx = big.getContext('2d'); bx.imageSmoothingEnabled = false; bx.drawImage(cv, 0, 0, W * 3, H * 3); o.textContent = big.toDataURL(); document.body.appendChild(o); }, +QS.get('snap'));
if (QS.get('debug')) setInterval(() => { $('err').textContent = `state=${state} frames=${frames} t=${G ? G.t.toFixed(1) : '-'} enemies=${G ? G.enemies.length : '-'} cam=${camX},${camY} P=${P && P.x},${P && P.y} hp=${ME && ME.hp.toFixed(0)}/${ME && ME.maxHp} near=${G && G.enemies.filter(e => !e.prop && Math.hypot(e.x - ME.x, e.y - ME.y) < 30).length} won=${G && G.won} lvl=${G && G.level} ms=${frameMs.toFixed(2)} parts=${G && G.parts.length} gems=${G && G.gems.length} errs=${window.__errs.join('|')}`; }, 250);
addEventListener('load', () => requestAnimationFrame(frame));
