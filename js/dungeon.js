'use strict';
/* Crypts: short side-view action-platformer levels entered from the night map.
   Clear every foe, claim the chest, return to the night. The night's clock stands still meanwhile. */

const DT = 8, CRYPT_PAR = 50;
const CRYPT_NAMES = ['The Sunken Crypt', 'Ossuary of Thorns', 'The Weeping Vault', 'Catacomb of Ash', 'The Hollow Stair'];
// Rooms are rows 1-16 of an 18-row slice; the ceiling (row 0) and floor (row 17) are added as stone. Short rows pad with '.'.
// #  stone   =  plank (jump up through it)   ^  spikes   T  torch   S  start   X  chest   D  exit
// z  ghoul (brawler)   a  skeleton archer   b  bat   k  hollow knight
const CRYPT_ROOMS = {
  start: [
    '#', '#', '#....T..............T', '#', '#', '#.................b', '#', '#',
    '#...............======', '#', '#', '#........................z',
    '#....................##########', '#.S..................##########',
    '#####......########..##########', '#####^^^^^^########..##########',
  ],
  mids: [
    ['', '', '....T...................T', '', '........a..................a', '......#####..........#######', '', '',
      '..............======', '', '', '...z.....====............z', '', '', '', ''],
    ['', '', '.........T...............T', '', '', '', '', '', '..........=====.......=====', '', '',
      '....b......................b', '', '..............................k', '..........######......######', '..........######^^^^^^######'],
    ['', '...................T', '......a.......====........a', '.....###..............######', '', '..........====....====', '', '',
      '....====..........b.....====', '', '', '..........====....====', '....z...................z', '', '.........####......####', '.........####......####'],
    ['', '', '..T.......................T', '', '...............b', '', '', '', '........====........====', '', '',
      '.....z.........a........z', '...######...######...######...######', '', '', '###' + '^'.repeat(34) + '###'],
  ],
  end: [
    '', '', '....T..................T.........T', '', '', '', '', '...........a', '.........=====', '', '', '', '', '', '',
    '......k.....................X.....D',
  ],
};
const CRYPT_FOES = {
  z: { hp: 45, w: 8, h: 13, spd: 42, spr: 'ghoul', color: '#a6e05a', dmg: 14, reach: 18, wind: 0.45 },
  a: { hp: 30, w: 8, h: 14, spd: 0, spr: 'skel', color: '#f2eee6', dmg: 10 },
  b: { hp: 20, w: 9, h: 7, spd: 60, spr: 'bat', color: '#5e557f', dmg: 8, fly: true },
  k: { hp: 150, w: 12, h: 17, spd: 30, spr: 'knight', color: '#b5b2c4', dmg: 24, reach: 26, wind: 0.7 },
};

// D (crypt level) and DP (crypt player) are declared in game.js, which resets them on run changes

/* ---------- Input ---------- */
const ACT = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], down: ['KeyS', 'ArrowDown'],
  jump: ['Space', 'KeyW', 'ArrowUp', 'KeyK'], attack: ['KeyJ', 'KeyX'], roll: ['ShiftLeft', 'ShiftRight', 'KeyL', 'KeyC'],
};
const dpress = {}, touchHeld = {}, bot = {}, ptrPress = {};
let curHold = null;   // what the body being stepped is holding (null: the keyboard and the pointer, as in a solo run)
// A finger or the mouse: the on-screen buttons and the drag stick
function pointerHeld(a) {
  if (touchHeld[a]) return true;
  if (joy.active) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    if (a === 'left') return dx < -12;
    if (a === 'right') return dx > 12;
    if (a === 'down') return dy > 24;
  }
  return false;
}
function held(a) {
  if (curHold) return !!curHold[a];
  if (SIM) return !!bot[a];
  return ACT[a].some(k => keys[k]) || pointerHeld(a);
}
addEventListener('keydown', e => {
  if (state !== 'dungeon') return;
  for (const a in ACT) if (ACT[a].includes(e.code) && !e.repeat) dpress[a] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
document.querySelectorAll('#dpad [data-act]').forEach(b => {
  const a = b.dataset.act, up = () => { touchHeld[a] = false; };
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (state === 'dungeon') { dpress[a] = true; ptrPress[a] = true; } touchHeld[a] = true; });
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});

/* ---------- Level ---------- */
const tileAt = (tx, ty) => (ty < 0 || ty >= D.h || tx < 0 || tx >= D.w ? '#' : D.tiles[ty][tx]);
const isSolid = (tx, ty) => tileAt(tx, ty) === '#';

function buildCrypt() {
  const mids = [...CRYPT_ROOMS.mids].sort(() => Math.random() - 0.5).slice(0, 2);
  const rooms = [CRYPT_ROOMS.start, ...mids, CRYPT_ROOMS.end];
  const RW = 40, RH = 18, tiles = Array.from({ length: RH }, () => []);
  const spawns = [], torches = [];
  let start = null, chestAt = null, doorAt = null;
  rooms.forEach((room, ri) => {
    for (let ty = 0; ty < RH; ty++) {
      let row = ty === 0 || ty === RH - 1 ? '#'.repeat(RW) : (room[ty - 1] || '').padEnd(RW, '.').slice(0, RW);
      if (ri === rooms.length - 1) row = row.slice(0, RW - 1) + '#';
      for (let i = 0; i < RW; i++) {
        const ch = row[i], tx = ri * RW + i, px = tx * DT + DT / 2, py = (ty + 1) * DT;
        let t = ch;
        if (CRYPT_FOES[ch]) { spawns.push({ type: ch, x: px, y: py }); t = '.'; }
        else if (ch === 'S') { start = { x: px, y: py }; t = '.'; }
        else if (ch === 'X') { chestAt = { x: px, y: py }; t = '.'; }
        else if (ch === 'D') { doorAt = { x: px, y: py }; t = '.'; }
        else if (ch === 'T') { torches.push({ x: px, y: ty * DT + 4 }); t = '.'; }
        tiles[ty][tx] = t;
      }
    }
  });
  const mul = 1 + G.t / 400;
  const ents = spawns.map(s => {
    const f = CRYPT_FOES[s.type];
    return { ...s, ...f, frames: SPR[f.spr], hp: f.hp * mul, max: f.hp * mul, vx: 0, vy: 0, face: -1, st: 'idle', t: 0, cd: rand(0.5, 1.5),
      flash: 0, stun: 0, dead: false, anim: Math.random() * 5, onGround: false };
  });
  return {
    tiles, w: tiles[0].length, h: RH, ents, torches, start, chestAt, doorAt, arrows: [], parts: [], texts: [], fx: [],
    t: 0, cleared: false, chest: null, shake: 0, hitstop: 0, hurt: 0, dead: false, name: pick(CRYPT_NAMES),
    canvas: paintCrypt(tiles), hudKey: '',
  };
}

// Bake the static level art (back wall, bricks, planks, spikes) once
function paintCrypt(tiles) {
  const h = tiles.length, w = tiles[0].length;
  const c = document.createElement('canvas'); c.width = w * DT; c.height = h * DT;
  const g = c.getContext('2d'), r = mulberry32(w * 31 + h);
  const solid = (tx, ty) => ty < 0 || ty >= h || tx < 0 || tx >= w || tiles[ty][tx] === '#';
  g.fillStyle = '#0e0b15'; g.fillRect(0, 0, c.width, c.height);
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    if (r() < 0.8) { g.fillStyle = r() < 0.5 ? '#141020' : '#120e1c'; g.fillRect(tx * DT + (ty % 2 ? 4 : 0), ty * DT + 1, 7, 6); }
  }
  for (let i = 0; i < w / 6; i++) {
    const x = r() * w * DT | 0, len = 10 + r() * 40 | 0;
    if (r() < 0.5) { g.fillStyle = '#26213a'; for (let y = DT; y < len; y += 3) g.fillRect(x, y, 1, 2); }
    else { g.fillStyle = '#1b1628'; g.fillRect(x, 20 + r() * 60 | 0, 1 + r() * 2 | 0, 6 + r() * 10 | 0); }
  }
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const t = tiles[ty][tx], x = tx * DT, y = ty * DT;
    if (t === '#') {
      g.fillStyle = '#2a2538'; g.fillRect(x, y, DT, DT);
      g.fillStyle = '#1d1a2a';
      g.fillRect(x, y + 3, DT, 1); g.fillRect(x, y + 7, DT, 1);
      g.fillRect(x + (ty % 2 ? 2 : 6), y, 1, 3); g.fillRect(x + (ty % 2 ? 6 : 2), y + 4, 1, 3);
      if (!solid(tx, ty - 1)) {
        g.fillStyle = '#5e557f'; g.fillRect(x, y, DT, 1);
        for (let i = 0; i < DT; i++) if (r() < 0.35) { g.fillStyle = r() < 0.5 ? '#2f6b3a' : '#4fa04a'; g.fillRect(x + i, y, 1, r() < 0.4 ? 2 : 1); }
      }
      if (!solid(tx, ty + 1)) { g.fillStyle = '#100d18'; g.fillRect(x, y + DT - 1, DT, 1); }
      if (!solid(tx - 1, ty)) { g.fillStyle = '#3b3355'; g.fillRect(x, y, 1, DT); }
      if (!solid(tx + 1, ty)) { g.fillStyle = '#16131f'; g.fillRect(x + DT - 1, y, 1, DT); }
    } else if (t === '=') {
      g.fillStyle = '#5a3a28'; g.fillRect(x, y, DT, 3);
      g.fillStyle = '#9a6a42'; g.fillRect(x, y, DT, 1);
      g.fillStyle = '#0b0a12'; g.fillRect(x, y + 3, DT, 1); g.fillRect(x + 7, y, 1, 3);
      if (tx % 3 === 0) { g.fillStyle = '#3a2618'; g.fillRect(x + 3, y + 4, 2, 3); }
    } else if (t === '^') {
      for (const k of [0, 4]) {
        g.fillStyle = '#6d6a7c'; g.fillRect(x + k, y + 6, 4, 2);
        g.fillStyle = '#b5b2c4'; g.fillRect(x + k + 1, y + 4, 2, 2);
        g.fillStyle = r() < 0.3 ? '#d8354a' : '#f2eee6'; g.fillRect(x + k + 1, y + 3, 1, 1);
      }
    }
  }
  return c;
}

const ROCK = (() => {
  const S = 32, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#1c1828'; g.fillRect(0, 0, S, S);
  for (let ty = 0; ty < S / DT; ty++) for (let tx = 0; tx < S / DT; tx++) {
    const x = tx * DT, y = ty * DT;
    g.fillStyle = '#141120';
    g.fillRect(x, y + 3, DT, 1); g.fillRect(x, y + 7, DT, 1);
    g.fillRect(x + (ty % 2 ? 2 : 6), y, 1, 3); g.fillRect(x + (ty % 2 ? 6 : 2), y + 4, 1, 3);
  }
  return c;
})();

/* ---------- Physics ---------- */
// Bodies are anchored at the middle of their feet (x, y) with a w x h box above
function moveBody(b, dt) {
  b.hitWall = false;
  b.x += b.vx * dt;
  const top = Math.floor((b.y - b.h + 1) / DT), bot = Math.floor((b.y - 1) / DT);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w / 2) / DT);
    for (let ty = top; ty <= bot; ty++) if (isSolid(tx, ty)) { b.x = tx * DT - b.w / 2 - 0.01; b.vx = 0; b.hitWall = true; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor((b.x - b.w / 2) / DT);
    for (let ty = top; ty <= bot; ty++) if (isSolid(tx, ty)) { b.x = (tx + 1) * DT + b.w / 2 + 0.01; b.vx = 0; b.hitWall = true; break; }
  }
  const prevY = b.y;
  b.y += b.vy * dt;
  b.onGround = false;
  const l = Math.floor((b.x - b.w / 2 + 0.5) / DT), r = Math.floor((b.x + b.w / 2 - 0.5) / DT);
  if (b.vy >= 0) {
    const ty = Math.floor(b.y / DT);
    for (let tx = l; tx <= r; tx++) {
      const t = tileAt(tx, ty);
      if (t === '#' || (t === '=' && prevY <= ty * DT + 0.5 && !(b.drop > 0))) { b.y = ty * DT; b.vy = 0; b.onGround = true; break; }
    }
  } else {
    const ty = Math.floor((b.y - b.h) / DT);
    for (let tx = l; tx <= r; tx++) if (isSolid(tx, ty)) { b.y = (ty + 1) * DT + b.h; b.vy = 0; break; }
  }
}
const groundAhead = (b, dir) => {
  const tx = Math.floor((b.x + dir * (b.w / 2 + 2)) / DT), ty = Math.floor((b.y + 2) / DT);
  const t = tileAt(tx, ty);
  return (t === '#' || t === '=') && !isSolid(tx, Math.floor((b.y - 4) / DT));
};
const boxHit = (x0, y0, x1, y1, e) => e.x + e.w / 2 > x0 && e.x - e.w / 2 < x1 && e.y > y0 && e.y - e.h < y1;
const bodiesTouch = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y > b.y - b.h && a.y - a.h < b.y;

/* ---------- Effects ---------- */
function dpart(x, y, vx, vy, life, c, size = 1, grav = 0) {
  if (D.parts.length < 900) D.parts.push({ x, y, vx, vy, life, max: life, c, size, grav });
}
function dburst(x, y, c, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rand(0.3, 1) * spd;
    dpart(x, y, Math.cos(a) * s, Math.sin(a) * s - 30, rand(0.3, 0.7), Math.random() < 0.25 ? '#f2eee6' : c, Math.random() < 0.3 ? 2 : 1, 260);
  }
}
function dtext(x, y, val, crit, color) {
  if (D.texts.length > 40) D.texts.shift();
  D.texts.push({ x, y, s: String(val) + (crit ? '!' : ''), c: color || (crit ? '#ffd35a' : '#f2eee6'), life: 0.7, max: 0.7 });
}

/* ---------- Bodies ----------
   Everyone in the party goes below together: D.bodies holds one body per player. DP and P always name the body and the
   player being stepped (like P in the night), and asBody swaps them in. Outside it, DP is the first body. */
function makeBody(pl, i) {
  const local = !!(G && G.local);
  return { pl, i, x: D.start.x + i * 7, y: D.start.y, vx: 0, vy: 0, w: 8, h: 13, face: 1, onGround: false, coyote: 0, jumpBuf: 0, jumps: 1,
    roll: 0, rollCd: 0, atkT: 0, atkCd: 0, step: 0, lastAtk: -9, inv: 0, drop: 0, anim: 0, plat: null, hurt: 0, out: false,
    hold: local ? {} : null, press: local ? {} : null };
}
const cryptCrew = () => (G.local ? G.players.filter(p => !p.down) : [ME]);
let bodyDepth = 0;
function asBody(b, fn) {
  const kd = DP, kp = P, kh = curHold, top = bodyDepth++ === 0;   // only the outermost swap owns the press flags
  DP = b; P = b.pl; curHold = b.hold;
  if (top && b.press) for (const k in ACT) dpress[k] = !!b.press[k];
  try { return fn(b); } finally {
    if (top && b.press) for (const k in ACT) { b.press[k] = !!dpress[k]; dpress[k] = false; }
    bodyDepth--;
    DP = kd; P = kp; curHold = kh;
  }
}
const eachBody = fn => { for (const b of D.bodies.slice()) { if (!D || D.dead) break; if (!b.out) asBody(b, fn); } };
const nearestBody = (x, y) => {
  let best = null, bd = Infinity;
  for (const b of D.bodies) { if (b.out) continue; const d = Math.abs(b.x - x) + Math.abs(b.y - y) * 2; if (d < bd) { bd = d; best = b; } }
  return best || D.bodies[0];
};
const bodyNear = (x, y, rx, ry) => D.bodies.find(b => !b.out && Math.abs(b.x - x) < rx && Math.abs(b.y - y) < ry);

/* ---------- Enter / leave ---------- */
function enterCrypt(c) {
  if (c) G.crypts = G.crypts.filter(x => x !== c);
  G.nearCrypt = null;
  setState('fading');
  $('fade').classList.add('on');
  Snd.play('dash');
  setTimeout(() => {
    D = buildCrypt();
    DP = { x: D.start.x, y: D.start.y, vx: 0, vy: 0, w: 8, h: 13, face: 1, onGround: false, coyote: 0, jumpBuf: 0, jumps: 1,
      roll: 0, rollCd: 0, atkT: 0, atkCd: 0, step: 0, lastAtk: -9, inv: 0, drop: 0, anim: 0 };
    for (const k in dpress) dpress[k] = false;
    setState('dungeon');
    if (document.activeElement) document.activeElement.blur();
    $('dTitle').textContent = D.name;
    Snd.music(2);
    $('fade').classList.remove('on');
    banner(D.name, 'Slay every foe to claim the treasure', '#e8742c');
  }, 320);
}
function leaveCrypt(after) {
  setState('fading');
  $('fade').classList.add('on');
  setTimeout(() => {
    D = null; DP = null;
    setState('play');
    Snd.music(G.boss ? 2 : 1);
    $('fade').classList.remove('on');
    if (after) after();
  }, 320);
}
function finishCrypt() {
  const swift = D.t <= CRYPT_PAR;
  const gold = Math.round((40 + (swift ? 60 : 0)) * P.greed);
  G.gold += gold;
  if (swift) P.hp = P.maxHp;
  const note = { icon: swift ? 'star' : 'gold', name: `${swift ? 'Swift clear' : 'Crypt cleared'} in ${fmtTime(D.t)}`,
    lv: `+${gold} gold${swift ? ' and a full heal' : `. Clear in under ${fmtTime(CRYPT_PAR)} for more`}` };
  D.dead = true;
  Snd.play('chest');
  leaveCrypt(() => openChest(true, note));
}
function cryptDeath() {
  if (G.revivals > 0) {
    G.revivals--;
    P.hp = P.maxHp * 0.5; DP.inv = 2.5; D.shake = 6;
    for (const e of D.ents) if (!e.dead && Math.abs(e.x - DP.x) < 120) cryptHit(e, 9999, Math.sign(e.x - DP.x) || 1, true);
    banner('Second Dawn', 'You rise again', '#ffd35a');
    Snd.play('evolve');
    return;
  }
  dburst(DP.x, DP.y - 6, '#d8354a', 30, 120);
  Snd.play('death');
  // a partner still stands: this one sits out until the crypt is won
  if (D.bodies.some(b => b !== DP && !b.out)) {
    DP.out = true; P.hp = 0; P.down = true; P.reviveT = 0;
    banner(P.ch.name + ' has fallen', 'The others must finish the crypt', '#d8354a');
    return;
  }
  D.dead = true;
  DP.out = true;
  const last = P;
  setTimeout(() => leaveCrypt(() => { P = last; playerDown(); P = ME; }), 900);
}

/* ---------- Combat ---------- */
function hurtCrypt(dmg, spike) {
  if (DP.inv > 0 || (DP.roll > 0 && !spike) || D.dead || G.god) return;
  const d = Math.max(1, Math.round(dmg * (1 + G.t / 900) - P.armor));
  P.hp -= d; DP.inv = 0.9; D.shake = 4; DP.hurt = 0.3;
  if (!spike) { DP.vx = -DP.face * 140; DP.vy = -150; }
  dtext(DP.x, DP.y - 18, d, false, '#d8354a');
  dburst(DP.x, DP.y - 6, '#d8354a', 6, 60);
  Snd.play('hurt');
  if (P.hp <= 0) cryptDeath();
}
function cryptHit(e, dmg, dir, big) {
  const crit = Math.random() < 0.08 + 0.03 * P.luck;
  const d = Math.max(1, Math.round(dmg * (crit ? 2 : 1) * rand(0.9, 1.1)));
  e.hp -= d; e.flash = 0.12;
  const res = e.type === 'k' ? 0.35 : 1;
  e.vx = dir * (big ? 190 : 110) * res;
  if (!e.fly) e.vy = (big ? -120 : -40) * res;
  e.stun = big ? 0.35 : 0.18;
  if (big && e.type !== 'k' && e.st === 'wind') e.st = 'idle';
  dtext(e.x, e.y - e.h - 2, d, crit);
  dburst(e.x, e.y - e.h / 2, '#f2eee6', 4, 60);
  Snd.play('hit');
  if (e.hp > 0) return;
  e.dead = true;
  dburst(e.x, e.y - e.h / 2, e.color, 18, 110);
  Snd.play('kill');
  G.kills++;
  const g = Math.round(3 * P.greed);
  G.gold += g;
  dtext(e.x, e.y - e.h - 9, '+' + g, false, '#ffd35a');
  if (P.blood) P.hp = Math.min(P.maxHp, P.hp + 0.12 * P.blood);
}
function cryptAttack(p) {
  p.step = D.t - p.lastAtk < 0.55 ? (p.step + 1) % 3 : 0;
  p.lastAtk = D.t;
  const big = p.step === 2, range = big ? 28 : 21;
  p.atkT = big ? 0.3 : 0.2; p.atkCd = big ? 0.42 : 0.24;
  const x0 = p.face > 0 ? p.x : p.x - range, x1 = x0 + range, y0 = p.y - 18, y1 = p.y + 2;
  D.fx.push({ k: 'slash', t: 0, dur: 0.16, r: range, big });
  if (!p.onGround) p.vy = Math.min(p.vy, 30);
  const dmg = 16 * P.might * (1 + G.level * 0.04) * (big ? 1.8 : 1);
  let hit = false;
  for (const e of D.ents) if (!e.dead && boxHit(x0, y0, x1, y1, e)) { cryptHit(e, dmg, p.face, big); hit = true; }
  for (const a of D.arrows) if (a.foe && a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1) { a.foe = false; a.vx = -a.vx * 1.3; a.vy = -a.vy * 0.5; Snd.play('frost'); }
  Snd.play('slash');
  if (hit) { D.hitstop = big ? 0.07 : 0.035; D.shake = Math.max(D.shake, big ? 3 : 1.5); }
}

/* ---------- Update ---------- */
function updateCrypt(dt) {
  if (D.dead) { updateCryptFx(dt); return; }
  if (D.hitstop > 0) { D.hitstop -= dt; return; }
  if (SIM) driveBot();
  D.t += dt;
  D.shake = Math.max(0, D.shake - dt * 16);
  eachBody(() => { DP.hurt = Math.max(0, DP.hurt - dt); updateCryptPlayer(dt); });
  updateCryptFoes(dt);
  updateArrows(dt);
  updateCryptFx(dt);
  if (!D.cleared && D.ents.every(e => e.dead)) {
    D.cleared = true;
    D.chest = { x: D.chestAt.x, y: D.chestAt.y, ph: 0 };
    banner('Crypt cleared', D.t <= CRYPT_PAR ? 'Swift! Claim your bonus treasure' : 'Claim your treasure', '#ffd35a');
    Snd.play('levelup');
  }
  if (D.chest && !D.dead) { const b = bodyNear(D.chest.x, D.chest.y, 10, 14); if (b) asBody(b, finishCrypt); }
  for (const k in dpress) dpress[k] = false;
  for (const b of D.bodies) if (b.press) for (const k in ACT) b.press[k] = false;
  updateCryptHud();
}

function updateCryptPlayer(dt) {
  const p = DP;
  const ax = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  p.jumpBuf = dpress.jump ? 0.12 : p.jumpBuf - dt;
  p.coyote -= dt; p.rollCd -= dt; p.atkCd -= dt; p.inv -= dt; p.drop -= dt; p.atkT -= dt;
  if (p.onGround) { p.coyote = 0.09; p.jumps = 1; }
  if (dpress.roll && p.rollCd <= 0 && p.roll <= 0) { p.roll = 0.32; p.rollCd = 0.6; if (ax) p.face = ax; Snd.play('dash'); }
  if (p.roll > 0) {
    p.roll -= dt; p.vx = p.face * 230;
    if (Math.random() < 0.6) dpart(p.x, p.y - 2, -p.face * 20, -10, 0.3, '#5e557f');
  } else {
    const target = ax * 118 * (p.atkT > 0 && p.onGround ? 0.35 : 1);
    p.vx += (target - p.vx) * Math.min(1, dt * 18);
    if (ax) p.face = ax;
  }
  if (p.jumpBuf > 0) {
    const onPlank = p.onGround && tileAt(Math.floor(p.x / DT), Math.floor(p.y / DT)) === '=';
    if (held('down') && onPlank) { p.drop = 0.25; p.jumpBuf = 0; }
    else if (p.coyote > 0) {
      p.vy = -292; p.coyote = 0; p.jumpBuf = 0;
      for (let i = 0; i < 5; i++) dpart(p.x + rand(-4, 4), p.y, rand(-30, 30), rand(-20, 0), 0.3, '#5e557f');
      Snd.play('hover');
    } else if (p.jumps > 0) {
      p.vy = -250; p.jumps--; p.jumpBuf = 0;
      for (let i = 0; i < 8; i++) dpart(p.x, p.y - 2, Math.cos(i / 8 * TAU) * 50, Math.sin(i / 8 * TAU) * 20 + 20, 0.3, '#a59cc4');
      Snd.play('hover');
    }
  }
  p.vy += 900 * dt;
  if (!held('jump') && p.vy < 0) p.vy += 1500 * dt;
  p.vy = Math.min(p.vy, 330);
  if (dpress.attack && p.atkCd <= 0) cryptAttack(p);
  const wasAir = !p.onGround;
  moveBody(p, dt);
  if (p.onGround && wasAir) for (let i = 0; i < 4; i++) dpart(p.x + rand(-4, 4), p.y, rand(-25, 25), -8, 0.25, '#5e557f');
  if (p.onGround && Math.abs(p.vx) > 20) p.anim += dt * 10;
  if (tileAt(Math.floor(p.x / DT), Math.floor((p.y - 1) / DT)) === '^') { hurtCrypt(12, true); p.vy = -260; }
}

function updateCryptFoes(dt) {
  const keepBody = DP, keepPlayer = P;
  for (const e of D.ents) {
    if (e.dead) continue;
    if (D.bodies.length > 1) { DP = nearestBody(e.x, e.y); P = DP.pl; }
    e.anim += dt; e.flash -= dt; e.t -= dt; e.cd -= dt; e.stun -= dt;
    const dx = DP.x - e.x, dy = (DP.y - 6) - (e.y - e.h / 2), adx = Math.abs(dx);
    const aware = adx < 170 && Math.abs(dy) < 70;
    if (e.fly) {
      if (e.stun > 0) { e.vx *= Math.exp(-4 * dt); e.vy *= Math.exp(-4 * dt); }
      else {
        const away = e.t > 0 ? -1 : 1;
        e.face = Math.sign(dx) || 1;
        if (aware || e.t > 0) {
          e.vx += (away * Math.sign(dx) * e.spd - e.vx) * Math.min(1, dt * 2.5);
          e.vy += (away * clamp(dy, -50, 50) * 1.4 + Math.sin(D.t * 5 + e.anim) * 40 - e.vy) * Math.min(1, dt * 3);
        } else e.vy = Math.sin(D.t * 3 + e.anim) * 12;
      }
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.y = clamp(e.y, DT * 2, (D.h - 1) * DT - 2);
      e.x = clamp(e.x, DT, (D.w - 1) * DT);
    } else {
      if (e.stun > 0) { if (e.onGround) e.vx *= Math.exp(-6 * dt); }
      else if (e.type === 'a') {
        e.vx = 0;
        e.face = Math.sign(dx) || 1;
        if (e.st === 'aim') {
          if (e.t <= 0) {
            const ang = Math.atan2(dy, dx);
            D.arrows.push({ x: e.x + e.face * 4, y: e.y - 9, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, life: 3, foe: true });
            e.st = 'idle'; e.cd = 1.8;
            Snd.play('shoot');
          }
        } else if (aware && adx < 220 && e.cd <= 0) { e.st = 'aim'; e.t = 0.7; }
      } else {
        if (e.st === 'wind') {
          e.vx = 0;
          if (e.t <= 0) {
            e.st = 'strike'; e.t = 0.18; e.vx = e.face * (e.type === 'k' ? 140 : 170);
            const x0 = e.face > 0 ? e.x : e.x - e.reach, x1 = x0 + e.reach;
            if (boxHit(x0, e.y - e.h, x1, e.y + 2, DP)) hurtCrypt(e.dmg);
            D.fx.push({ k: 'claw', x: e.x, y: e.y - e.h / 2, face: e.face, r: e.reach, t: 0, dur: 0.14 });
            Snd.play('slash');
          }
        } else if (e.st === 'strike') {
          e.vx *= Math.exp(-8 * dt);
          if (e.t <= 0) { e.st = 'rest'; e.t = e.type === 'k' ? 0.8 : 0.6; }
        } else if (e.st === 'rest') {
          e.vx = 0;
          if (e.t <= 0) e.st = 'idle';
        } else {
          if (aware) {
            e.face = Math.sign(dx) || 1;
            e.vx = e.face * e.spd * 1.4;
            if (adx < e.reach && Math.abs(dy) < 16) { e.st = 'wind'; e.t = e.wind; e.vx = 0; }
          } else e.vx = e.face * e.spd * 0.6;
          if (e.onGround && !groundAhead(e, e.face)) { if (aware) e.vx = 0; else e.face *= -1; }
        }
      }
      e.vy = Math.min(e.vy + 900 * dt, 330);
      moveBody(e, dt);
      if (e.hitWall && e.st === 'idle') e.face *= -1;
    }
    if (e.type !== 'a' && !(e.stun > 0) && bodiesTouch(DP, e)) {
      hurtCrypt(e.type === 'b' ? e.dmg : 6);
      if (e.fly) e.t = 0.7;
    }
  }
  DP = keepBody; P = keepPlayer;
}

function updateArrows(dt) {
  for (const a of D.arrows) {
    a.vy += 120 * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
    if (a.life <= 0 || isSolid(Math.floor(a.x / DT), Math.floor(a.y / DT))) { a.dead = true; dburst(a.x, a.y, '#b5b2c4', 3, 40); continue; }
    if (a.foe) {
      const b = D.bodies.find(q => !q.out && a.x > q.x - 4 && a.x < q.x + 4 && a.y > q.y - 13 && a.y < q.y);
      if (b) { asBody(b, () => hurtCrypt(10)); a.dead = true; }
    } else {
      for (const e of D.ents) if (!e.dead && boxHit(a.x - 2, a.y - 2, a.x + 2, a.y + 2, e)) { cryptHit(e, 30 * P.might, Math.sign(a.vx), false); a.dead = true; break; }
    }
  }
  D.arrows = D.arrows.filter(a => !a.dead);
}

function updateCryptFx(dt) {
  for (const p of D.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-3 * dt); p.vy += p.grav * dt; p.life -= dt; }
  D.parts = D.parts.filter(p => p.life > 0);
  for (const t of D.texts) { t.life -= dt; t.y -= 24 * dt; }
  D.texts = D.texts.filter(t => t.life > 0);
  for (const f of D.fx) f.t += dt;
  D.fx = D.fx.filter(f => f.t < f.dur);
  if (D.chest) D.chest.ph += dt;
}

function updateCryptHud() {
  const left = D.ents.filter(e => !e.dead).length;
  const key = left + '|' + Math.floor(D.t) + '|' + G.gold;
  if (key === D.hudKey) return;
  D.hudKey = key;
  $('dInfo').textContent = D.cleared ? 'Cleared. Claim the chest'
    : `${left} foe${left === 1 ? '' : 's'} left  ·  ${fmtTime(D.t)}${D.t <= CRYPT_PAR ? `  ·  swift bonus under ${fmtTime(CRYPT_PAR)}` : ''}`;
  $('goldc').textContent = G.gold;
}

// Headless test pilot: chase the nearest foe (then the chest), swing constantly, hop over walls and gaps
function driveBot() {
  let goal = D.chest;
  if (!goal) {
    let bd = Infinity;
    for (const e of D.ents) if (!e.dead && Math.abs(e.x - DP.x) < bd) { bd = Math.abs(e.x - DP.x); goal = e; }
  }
  const dir = goal ? Math.sign(goal.x - DP.x) || 1 : 1;
  bot.right = dir > 0; bot.left = dir < 0;
  bot.jump = DP.vy < 0;
  if (Math.random() < 0.25) dpress.attack = true;
  const above = goal && goal.y < DP.y - 12;
  if (DP.hitWall || (DP.onGround && !groundAhead(DP, dir)) || (above && Math.random() < 0.05) || Math.random() < 0.01) dpress.jump = true;
}

/* ---------- Render ---------- */
function renderCrypt() {
  const now = performance.now() / 1000;
  lights = []; glows = [];
  const lw = D.w * DT, lh = D.h * DT, sh = D.shake;
  const cx = lw <= W ? (lw - W) / 2 : clamp(DP.x - W / 2, 0, lw - W);
  const cy = lh <= H ? (lh - H) / 2 : clamp(DP.y - 10 - H / 2, 0, lh - H);
  camX = Math.round(cx + (sh ? rand(-sh, sh) : 0));
  camY = Math.round(cy + (sh ? rand(-sh, sh) : 0));
  // Solid bedrock fills the screen around the level, scrolling with it
  const R = ROCK.width, ox = -(((camX % R) + R) % R), oy = -(((camY % R) + R) % R);
  for (let x = ox; x < W; x += R) for (let y = oy; y < H; y += R) ctx.drawImage(ROCK, x, y);
  ctx.drawImage(D.canvas, -camX, -camY);

  for (const t of D.torches) {
    const sx = Math.round(t.x - camX), sy = Math.round(t.y - camY), fl = Math.floor(now * 12 + t.x) % 3;
    ctx.fillStyle = '#3a2618'; ctx.fillRect(sx - 1, sy, 3, 4);
    ctx.fillStyle = '#5a3a28'; ctx.fillRect(sx - 2, sy - 1, 5, 2);
    ctx.fillStyle = '#d8354a'; ctx.fillRect(sx - 2, sy - 3, 5, 2);
    ctx.fillStyle = '#e8742c'; ctx.fillRect(sx - 1, sy - 5 - (fl % 2), 3, 3);
    ctx.fillStyle = '#ffd35a'; ctx.fillRect(sx - (fl === 2 ? 0 : 1), sy - 6 - fl, 2, 3);
    light(t.x, t.y - 3, 72 + Math.sin(now * 9 + t.x) * 4, 1);
    glowAt(t.x, t.y - 3, 16, '#e8742c', 0.55);
  }

  if (D.doorAt) {
    const s = SPR.crypt;
    blit(s.c, D.doorAt.x, D.doorAt.y - s.h / 2, s.w, s.h);
    if (D.cleared) { light(D.doorAt.x, D.doorAt.y - 8, 50, 0.8); glowAt(D.doorAt.x, D.doorAt.y - 6, 14, '#ffd35a', 0.4); }
  }
  if (D.chest) {
    const s = SPR.chest, bob = Math.round(Math.sin(D.chest.ph * 4) * 1);
    blit(s.c, D.chest.x, D.chest.y - s.h / 2 + bob, s.w, s.h);
    light(D.chest.x, D.chest.y - 6, 50, 1);
    glowAt(D.chest.x, D.chest.y - 6, 18, '#ffd35a', 0.45 + Math.sin(now * 5) * 0.15);
    if (Math.floor(now * 3) % 2) drawText(ctx, 'V', D.chest.x - camX, D.chest.y - camY - 20, '#ffd35a');
  }

  for (const e of D.ents) {
    if (e.dead) continue;
    const fr = e.frames[Math.floor(e.anim / (e.fly ? 0.11 : 0.22)) % e.frames.length];
    const y = e.y - fr.h / 2 + (e.fly ? fr.h / 2 - 2 : 0), flip = e.face < 0;
    if (!e.fly) shadow(e.x, e.y, Math.max(6, fr.w - 4));
    blit(fr.c, e.x, y, fr.w, fr.h, flip);
    if (e.flash > 0) { ctx.globalAlpha = 0.85; blit(silhouette(fr, '#ffffff'), e.x, y, fr.w, fr.h, flip); ctx.globalAlpha = 1; }
    else if (e.st === 'wind' || e.st === 'aim') {
      ctx.globalAlpha = 0.35 + Math.sin(now * 30) * 0.25;
      blit(silhouette(fr, '#d8354a'), e.x, y, fr.w, fr.h, flip);
      ctx.globalAlpha = 1;
      drawText(ctx, '!', e.x - camX, y - fr.h / 2 - camY - 5, '#d8354a');
    }
    if (e.st === 'aim' && Math.floor(now * 16) % 2) {
      pxLine(e.x - camX, e.y - 9 - camY, DP.x - camX, DP.y - 7 - camY, 'rgba(216,53,74,0.55)', 1);
    }
    if (e.hp < e.max) {
      const bx = Math.round(e.x - camX - 6), by = Math.round(e.y - e.h - camY - 5);
      ctx.fillStyle = '#0b0a12'; ctx.fillRect(bx - 1, by - 1, 14, 3);
      ctx.fillStyle = '#d8354a'; ctx.fillRect(bx, by, Math.round(12 * e.hp / e.max), 1);
    }
    if (e.type === 'b') light(e.x, e.y, 14, 0.4);
  }

  for (const a of D.arrows) {
    const l = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / l, uy = a.vy / l;
    pxLine(a.x - camX, a.y - camY, a.x - ux * 6 - camX, a.y - uy * 6 - camY, a.foe ? '#b5b2c4' : '#8ff0ff', 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(a.x - camX), Math.round(a.y - camY), 1, 1);
    light(a.x, a.y, 14, 0.5);
  }

  // Players
  for (const b of D.bodies) if (!b.out && !D.dead) asBody(b, () => drawBody(now));

  for (const f of D.fx) {
    const k = f.t / f.dur;
    if (f.k === 'slash') {
      const cx2 = DP.x - camX, cy2 = DP.y - 7 - camY;
      const layers = f.big ? ['#fff', '#ffd35a', '#e8742c'] : ['#fff', '#f2eee6', '#a59cc4'];
      ctx.globalAlpha = 1 - k * 0.5;
      for (let L = 0; L < (f.big ? 5 : 4); L++) {
        ctx.fillStyle = layers[Math.min(2, Math.floor(L / 2))];
        const rr = f.r - L;
        for (let a = -Math.PI / 2; a < -Math.PI / 2 + Math.PI * Math.min(1, k * 1.8); a += 0.8 / rr) {
          if (L > Math.sin(Math.PI * (a + Math.PI / 2) / Math.PI) * (f.big ? 5 : 4)) continue;
          const ang = DP.face > 0 ? a : Math.PI - a;
          ctx.fillRect(Math.round(cx2 + Math.cos(ang) * rr), Math.round(cy2 + Math.sin(ang) * rr * 0.8), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    } else if (f.k === 'claw') {
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 3; i++) pxLine(f.x + f.face * 4 - camX, f.y - 6 + i * 4 - camY, f.x + f.face * f.r - camX, f.y - 2 + i * 4 - camY, '#d8354a', 1);
      ctx.globalAlpha = 1;
    }
  }

  for (const q of D.parts) {
    ctx.globalAlpha = Math.min(1, q.life / q.max * 1.6);
    ctx.fillStyle = q.c;
    ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), q.size, q.size);
  }
  ctx.globalAlpha = 1;

  lx.globalCompositeOperation = 'source-over';
  lx.clearRect(0, 0, W, H);
  lx.fillStyle = 'rgba(5,4,12,0.62)'; lx.fillRect(0, 0, W, H);
  lx.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    lx.globalAlpha = L.a;
    lx.drawImage(LIGHT, Math.round(L.x - camX - L.r), Math.round(L.y - camY - L.r), L.r * 2, L.r * 2);
  }
  lx.globalAlpha = 1;
  ctx.drawImage(lc, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const g of glows) { ctx.globalAlpha = g.a; ctx.drawImage(glow(g.c), Math.round(g.x - camX - g.r), Math.round(g.y - camY - g.r), g.r * 2, g.r * 2); }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  for (const t of D.texts) drawText(ctx, t.s, t.x - camX, t.y - camY, t.c, 1);
  if (!D.dead) for (const b of D.bodies) if (!b.out) {
    const bx = Math.round(b.x - camX - 9), by = Math.round(b.y - camY + 3);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(bx - 1, by - 1, 20, 4);
    ctx.fillStyle = '#7a1a2a'; ctx.fillRect(bx, by, 18, 2);
    ctx.fillStyle = '#d8354a'; ctx.fillRect(bx, by, Math.round(18 * clamp(b.pl.hp / b.pl.maxHp, 0, 1)), 2);
    if (D.bodies.length > 1) {   // a coloured marker tells the party apart
      const mx = Math.round(b.x - camX), my = Math.round(b.y - camY) - 26;
      ctx.fillStyle = PLAYER_COLORS[G.players.indexOf(b.pl) % PLAYER_COLORS.length];
      ctx.fillRect(mx - 2, my, 5, 1); ctx.fillRect(mx - 1, my + 1, 3, 1); ctx.fillRect(mx, my + 2, 1, 1);
    }
  }
  if (DP.hurt > 0) { ctx.fillStyle = `rgba(216,53,74,${DP.hurt * 0.6})`; ctx.fillRect(0, 0, W, H); }
}

// One player's body: tumbling when rolling, flickering while invulnerable, lit by its own lantern
function drawBody(now) {
  const p = DP;
  if (!(p.inv > 0 && p.roll <= 0 && Math.floor(now * 20) % 2)) {
    const f = !p.onGround ? P.frames[1] : Math.abs(p.vx) > 20 ? P.frames[Math.floor(p.anim) % 4] : P.frames[0];
    shadow(p.x, p.y, 8);
    if (p.roll > 0) {
      for (let i = 1; i <= 2; i++) { ctx.globalAlpha = 0.25 / i; blit(f.c, p.x - p.face * i * 7, p.y - 8, f.w, f.h, p.face < 0); }
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(Math.round(p.x - camX), Math.round(p.y - 7 - camY));
      ctx.rotate((1 - p.roll / 0.32) * TAU * p.face);
      ctx.drawImage(f.c, -f.w / 2, -f.h / 2);
      ctx.restore();
    } else blit(f.c, p.x, p.y - 8, f.w, f.h, p.face < 0);
  }
  light(p.x, p.y - 8, 90, 1);
}
