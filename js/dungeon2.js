'use strict';
/* Themed side-view dungeons built on the crypt engine: cellars, the Ancient Tower (three floors),
   buried ruins and the temple (lever puzzles behind a gate), the mine (barrels and ore), and the locked mansion. */

Object.assign(CRYPT_FOES, {
  r: { hp: 90, w: 10, h: 16, spd: 34, spr: 'armor', color: '#e27bf0', dmg: 18, reach: 22, wind: 0.6 },
  m: { hp: 55, w: 8, h: 13, spd: 44, spr: 'miner', color: '#9a6a42', dmg: 14, reach: 18, wind: 0.45 },
  u: { hp: 70, w: 8, h: 14, spd: 30, spr: 'skel', color: '#c4b48a', dmg: 16, reach: 18, wind: 0.5 },
  c: { hp: 26, w: 7, h: 10, spd: 40, spr: 'candle', color: '#ffd35a', dmg: 10, fly: true, shooter: true },
  o: { hp: 16, w: 8, h: 6, spd: 80, spr: 'book', color: '#d8354a', dmg: 8, fly: true },
});

const ROOM_LEVER = ['', '', '....T................T..............T', '', '...L...........................L', '..###.........................###', '', '', '.............======', '', '', '...z..........L..............z', '.............###', '', '', ''];
const ROOM_MINE = ['', '', '....T..........T..........T', '', '', '', '', '......====.......====', '', '', '..O.........B.........O', '.#####.....#####.....#####', '', '', '', '....z.....B......O........z'];
const ROOM_MINE2 = ['', '', '..T..............T', '', '..........O', '.........###', '', '...B...............====.....B', '..####..............', '', '', '.......z.........O.........z', '......#####....######', '', '', '..B.........B...........B'];
const ROOM_TRAP = ['', '', '...T.................T', '', 'A', 'A', '', '.......======.......======', '', '', 'A', '', '..........^^^^........^^^^', '..........####........####', '', '.....z...................z'];
const ROOM_HALL = ['', '..T..........T...........T', '', '...C........b...........C', '########====######====#######', '', '..T......a.........T', '', '..........z..........C', '####====##########====####', '', '', '', '', '', '...C.z...............z'];
const ROOM_HALL2 = ['', '...T...........T............T', '', '.........b..........b', '', '..C...........k...........C', '#######====########====#####', '', '', '....a................a', '', '', '', '', '', '.....z......C.........z'];
const GATE_END = (() => { const r = [...CRYPT_ROOMS.end]; for (let i = 0; i < 16; i++) r[i] = (r[i] || '').padEnd(30, '.').slice(0, 30) + 'G' + (r[i] || '').padEnd(40, '.').slice(31); return r; })();

const TPAL = {
  crypt: { wall: '#2a2538', mortar: '#1d1a2a', back: ['#0e0b15', '#141020', '#120e1c'], top: '#5e557f', moss: ['#2f6b3a', '#4fa04a'], plank: ['#5a3a28', '#9a6a42'], edge: ['#3b3355', '#16131f'] },
  cellar: { wall: '#3a2a22', mortar: '#241812', back: ['#120c0a', '#1a120e', '#160f0c'], top: '#6a5040', moss: ['#a59cc4', '#5e557f'], plank: ['#4a3020', '#7a5a3a'], edge: ['#4a3a2e', '#1a120e'] },
  tower: { wall: '#4a4666', mortar: '#2e2a44', back: ['#151324', '#1c1a2b', '#181628'], top: '#8a87a0', moss: ['#2f6b3a', '#a59cc4'], plank: ['#5a3a28', '#9a6a42'], edge: ['#6a6688', '#24203a'] },
  ruins: { wall: '#5a4a30', mortar: '#3a2e1c', back: ['#16110a', '#1e1810', '#1a140c'], top: '#8a7a52', moss: ['#2f6b3a', '#4fa04a'], plank: ['#5a3a28', '#9a6a42'], edge: ['#7a6a46', '#2a2014'] },
  mine: { wall: '#3a2e26', mortar: '#241c16', back: ['#0f0b09', '#140f0c', '#120d0a'], top: '#6a5a4a', moss: ['#5a4a3a', '#8a7a6a'], plank: ['#5a3a28', '#9a6a42'], edge: ['#4a3c32', '#140f0c'] },
  temple: { wall: '#8a87a0', mortar: '#5e557f', back: ['#14121c', '#1c1a26', '#181622'], top: '#ffd35a', moss: ['#2f6b3a', '#ffd35a'], plank: ['#b5b2c4', '#f2eee6'], edge: ['#b5b2c4', '#36304f'] },
  mansion: { wall: '#4a2a1c', mortar: '#2a160e', back: ['#1e0e16', '#2a1420', '#24101a'], top: '#9a6a42', moss: ['#e27bf0', '#9a4fd0'], plank: ['#5a3a28', '#9a6a42'], edge: ['#6a4030', '#1a0c08'] },
};
const THEMES = {
  crypt: { names: CRYPT_NAMES, mids: () => CRYPT_ROOMS.mids, n: 2 },
  cellar: { names: ['The Drowned Cellar', 'A Hidden Basement'], mids: () => CRYPT_ROOMS.mids, n: 1, map: { k: 'z' } },
  tower: { names: ['The Ancient Tower'], mids: () => CRYPT_ROOMS.mids, n: 2, floors: 3, map: { z: 'u' } },
  ruins: { names: ['The Buried Ruins'], mids: () => [ROOM_LEVER, pick(CRYPT_ROOMS.mids)], n: 2, fixed: true, gate: true, map: { z: 'u' } },
  mine: { names: ['The Abandoned Mine'], mids: () => [ROOM_MINE, ROOM_MINE2], n: 2, fixed: true, map: { z: 'm', k: 'm' } },
  temple: { names: ['The Forgotten Temple'], mids: () => [ROOM_TRAP, ROOM_LEVER], n: 2, fixed: true, gate: true, map: { z: 'u' } },
  mansion: { names: ['The Locked Mansion'], mids: () => [ROOM_HALL, ROOM_HALL2], n: 2, fixed: true, map: { z: 'r', a: 'c', b: 'o' } },
};

buildCrypt = function (theme = 'crypt', floor = 1, st = null) {
  const T = THEMES[theme], map = T.map || {};
  let mids = T.mids();
  if (!T.fixed) mids = [...mids].sort(() => Math.random() - 0.5);
  mids = mids.slice(0, T.n);
  const last = !T.floors || floor >= T.floors;
  const rooms = [CRYPT_ROOMS.start, ...mids, T.gate ? GATE_END : CRYPT_ROOMS.end];
  const RW = 40, RH = 18, tiles = Array.from({ length: RH }, () => []);
  const spawns = [], torches = [], levers = [], gates = [], barrels = [], ores = [], chests = [], traps = [];
  let start = null, chestAt = null, doorAt = null;
  rooms.forEach((room, ri) => {
    for (let ty = 0; ty < RH; ty++) {
      let row = ty === 0 || ty === RH - 1 ? '#'.repeat(RW) : (room[ty - 1] || '').padEnd(RW, '.').slice(0, RW);
      if (ri === rooms.length - 1) row = row.slice(0, RW - 1) + '#';
      for (let i = 0; i < RW; i++) {
        let ch = row[i];
        const tx = ri * RW + i, px = tx * DT + DT / 2, py = (ty + 1) * DT;
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
        else if (ch === 'C') { chests.push({ x: px, y: py }); t = '.'; }
        else if (ch === 'A') { traps.push({ tx, ty, t: Math.random() * 2 }); t = '#'; }
        tiles[ty][tx] = t;
      }
    }
  });
  const mul = (1 + G.t / 400) * (G.dimMul || 1) * (1 + (floor - 1) * 0.45) * (theme === 'crypt' ? 1 : 1.15);
  const ents = spawns.map(s => {
    const f = CRYPT_FOES[s.type];
    return { ...s, ...f, frames: SPR[f.spr], hp: f.hp * mul, max: f.hp * mul, vx: 0, vy: 0, face: -1, st: 'idle', t: 0, cd: rand(0.5, 1.5),
      flash: 0, stun: 0, dead: false, anim: Math.random() * 5, onGround: false };
  });
  const name = pick(T.names) + (T.floors ? ` · Floor ${floor}` : '');
  return {
    tiles, w: tiles[0].length, h: RH, ents, torches, start, chestAt, doorAt, arrows: [], parts: [], texts: [], fx: [],
    t: 0, cleared: false, chest: null, shake: 0, hitstop: 0, hurt: 0, dead: false, name, theme, floor, last, st,
    levers, gates, barrels, ores, chests, traps, canvas: paintCrypt(tiles, theme, gates), hudKey: '', mul,
  };
};

paintCrypt = function (tiles, theme = 'crypt', gates = []) {
  const pal = TPAL[theme] || TPAL.crypt;
  const h = tiles.length, w = tiles[0].length;
  const c = document.createElement('canvas'); c.width = w * DT; c.height = h * DT;
  const g = c.getContext('2d'), r = mulberry32(w * 31 + h + theme.length);
  const isGate = (tx, ty) => gates.some(([a, b]) => a === tx && b === ty);
  const solid = (tx, ty) => ty < 0 || ty >= h || tx < 0 || tx >= w || tiles[ty][tx] === '#';
  g.fillStyle = pal.back[0]; g.fillRect(0, 0, c.width, c.height);
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) if (r() < 0.8) { g.fillStyle = r() < 0.5 ? pal.back[1] : pal.back[2]; g.fillRect(tx * DT + (ty % 2 ? 4 : 0), ty * DT + 1, 7, 6); }
  if (theme === 'tower' || theme === 'mansion') for (let i = 0; i < w / 10; i++) {
    const x = (i * 10 + 4) * DT, y = 3 * DT;
    g.fillStyle = '#0b0a12'; g.fillRect(x - 1, y - 1, 12, 18);
    g.fillStyle = theme === 'tower' ? '#2a3a5a' : '#3a1c2a'; g.fillRect(x, y, 10, 16);
    g.fillStyle = theme === 'tower' ? '#c9d6e8' : '#e27bf0'; g.fillRect(x + 6, y + 3, 2, 2);
    g.fillStyle = '#0b0a12'; g.fillRect(x + 5, y, 1, 16); g.fillRect(x, y + 8, 10, 1);
  }
  if (theme === 'mansion') for (let i = 0; i < w / 6; i++) { const x = r() * w * DT | 0, y = 20 + r() * 80 | 0; g.fillStyle = '#5a3a28'; g.fillRect(x, y, 10, 12); g.fillStyle = '#1c1a2b'; g.fillRect(x + 1, y + 1, 8, 10); g.fillStyle = '#a59cc4'; g.fillRect(x + 3, y + 3, 4, 4); }
  for (let i = 0; i < w / 6; i++) {
    const x = r() * w * DT | 0, len = 10 + r() * 40 | 0;
    if (theme === 'mine') { g.fillStyle = '#5a3a28'; g.fillRect(x, 8, 2, len + 40); g.fillRect(x - 6, 8, 14, 2); }
    else if (r() < 0.5) { g.fillStyle = '#26213a'; for (let y = DT; y < len; y += 3) g.fillRect(x, y, 1, 2); }
  }
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const t = tiles[ty][tx], x = tx * DT, y = ty * DT;
    if (t === '#') {
      if (isGate(tx, ty)) { g.fillStyle = '#0b0a12'; g.fillRect(x, y, DT, DT); g.fillStyle = '#6d6a7c'; for (let k = 1; k < DT; k += 3) g.fillRect(x + k, y, 1, DT); g.fillStyle = '#ffd35a'; g.fillRect(x, y + 3, DT, 1); continue; }
      g.fillStyle = pal.wall; g.fillRect(x, y, DT, DT);
      g.fillStyle = pal.mortar;
      g.fillRect(x, y + 3, DT, 1); g.fillRect(x, y + 7, DT, 1);
      g.fillRect(x + (ty % 2 ? 2 : 6), y, 1, 3); g.fillRect(x + (ty % 2 ? 6 : 2), y + 4, 1, 3);
      if (!solid(tx, ty - 1)) {
        g.fillStyle = pal.top; g.fillRect(x, y, DT, 1);
        for (let i = 0; i < DT; i++) if (r() < 0.35) { g.fillStyle = r() < 0.5 ? pal.moss[0] : pal.moss[1]; g.fillRect(x + i, y, 1, r() < 0.4 ? 2 : 1); }
      }
      if (!solid(tx, ty + 1)) { g.fillStyle = pal.edge[1]; g.fillRect(x, y + DT - 1, DT, 1); }
      if (!solid(tx - 1, ty)) { g.fillStyle = pal.edge[0]; g.fillRect(x, y, 1, DT); }
      if (!solid(tx + 1, ty)) { g.fillStyle = pal.edge[1]; g.fillRect(x + DT - 1, y, 1, DT); }
    } else if (t === '=') {
      g.fillStyle = pal.plank[0]; g.fillRect(x, y, DT, 3);
      g.fillStyle = pal.plank[1]; g.fillRect(x, y, DT, 1);
      g.fillStyle = '#0b0a12'; g.fillRect(x, y + 3, DT, 1); g.fillRect(x + 7, y, 1, 3);
    } else if (t === '^') {
      for (const k of [0, 4]) {
        g.fillStyle = '#6d6a7c'; g.fillRect(x + k, y + 6, 4, 2);
        g.fillStyle = '#b5b2c4'; g.fillRect(x + k + 1, y + 4, 2, 2);
        g.fillStyle = r() < 0.3 ? '#d8354a' : '#f2eee6'; g.fillRect(x + k + 1, y + 3, 1, 1);
      }
    }
  }
  return c;
};

const baseEnterCrypt = enterCrypt;
enterCrypt = function (c, theme = 'crypt', st = null, floor = 1) {
  if (theme === 'crypt' && !st) { baseEnterCrypt(c); return; }
  if (c) G.crypts = G.crypts.filter(x => x !== c);
  setState('fading');
  $('fade').classList.add('on');
  Snd.play('dash');
  setTimeout(() => {
    D = buildCrypt(theme, floor, st);
    DP = { x: D.start.x, y: D.start.y, vx: 0, vy: 0, w: 8, h: 13, face: 1, onGround: false, coyote: 0, jumpBuf: 0, jumps: 1,
      roll: 0, rollCd: 0, atkT: 0, atkCd: 0, step: 0, lastAtk: -9, inv: 0, drop: 0, anim: 0 };
    for (const k in dpress) dpress[k] = false;
    setState('dungeon');
    if (document.activeElement) document.activeElement.blur();
    $('dTitle').textContent = D.name;
    Snd.music(2);
    $('fade').classList.remove('on');
    banner(D.name, D.levers.length ? 'Strike every lever to open the gate' : D.last ? 'Slay every foe to claim the treasure' : 'Clear the floor, then climb', '#e8742c');
  }, 320);
};
/* ---------- Extras: levers, gates, barrels, ore, room chests, arrow traps ---------- */
const baseAttack = cryptAttack;
cryptAttack = function (p) {
  baseAttack(p);
  const big = p.step === 2, range = big ? 28 : 21;
  const x0 = p.face > 0 ? p.x : p.x - range, x1 = x0 + range, y0 = p.y - 18, y1 = p.y + 2;
  const inBox = o => o.x > x0 - 3 && o.x < x1 + 3 && o.y > y0 && o.y - 6 < y1;
  for (const l of D.levers || []) if (!l.on && inBox(l)) {
    l.on = true; Snd.play('reel'); dburst(l.x, l.y - 6, '#ffd35a', 8, 60);
    if (D.levers.every(x => x.on)) openGates();
  }
  for (const b of D.barrels || []) if (!b.dead && inBox(b)) blowBarrel(b);
  for (const o of D.ores || []) if (!o.dead && inBox(o)) {
    o.hp--; dburst(o.x, o.y - 4, '#8ff0ff', 5, 60); Snd.play('hit');
    if (o.hp <= 0) { o.dead = true; const g = Math.round(15 * P.greed); G.gold += g; dtext(o.x, o.y - 10, '+' + g, false, '#ffd35a'); D.oreCount = (D.oreCount || 0) + 1; Snd.play('coin'); }
  }
};
function openGates() {
  for (const [tx, ty] of D.gates) D.tiles[ty][tx] = '.';
  D.canvas = paintCrypt(D.tiles, D.theme, []);
  D.gates = [];
  if (D.cleared === 'gated') D.cleared = false;
  D.shake = 6; Snd.play('bigboom');
  banner('The gate grinds open', '', '#ffd35a');
}
function blowBarrel(b) {
  b.dead = true;
  D.shake = 6; Snd.play('boom');
  dburst(b.x, b.y - 5, '#e8742c', 30, 160); dburst(b.x, b.y - 5, '#ffd35a', 14, 100);
  for (const e of D.ents) if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < 32) cryptHit(e, 60 * P.might, Math.sign(e.x - b.x) || 1, true);
  if (Math.hypot(DP.x - b.x, DP.y - b.y) < 26) hurtCrypt(12);
  for (const o of D.barrels) if (!o.dead && Math.hypot(o.x - b.x, o.y - b.y) < 30) setTimeout(() => D && !o.dead && blowBarrel(o), 120);
}

const baseUpdateCrypt = updateCrypt;
updateCrypt = function (dt) {
  // a gated dungeon only counts as cleared once its levers are pulled (openGates lifts this)
  if (D.gates.length && !D.cleared) D.cleared = 'gated';
  // floors below the top of the tower open a stairway instead of dropping a chest
  if (!D.last && !D.cleared && D.ents.every(e => e.dead)) { D.cleared = true; banner('Floor cleared', 'The stair upward opens', '#ffd35a'); Snd.play('levelup'); }
  baseUpdateCrypt(dt);
  if (!D || D.dead) return;
  if (!D.last && D.cleared && D.doorAt && Math.abs(DP.x - D.doorAt.x) < 10 && Math.abs(DP.y - D.doorAt.y) < 16) {
    const st = D.st, theme = D.theme, floor = D.floor + 1;
    D.dead = true;
    enterCrypt(null, theme, st, floor);
    return;
  }
  for (const t of D.traps) {
    t.t -= dt;
    if (t.t > 0) continue;
    t.t = 2.2;
    const dir = isSolid(t.tx + 1, t.ty) ? -1 : 1;
    if (Math.abs((t.tx * DT) - DP.x) > 260) continue;
    D.arrows.push({ x: t.tx * DT + DT / 2 + dir * 6, y: t.ty * DT + 4, vx: dir * 190, vy: -20, life: 3, foe: true });
    Snd.play('shoot');
  }
  for (const c of D.chests) if (!c.open && Math.abs(DP.x - c.x) < 9 && Math.abs(DP.y - c.y) < 12) {
    c.open = true;
    const g = Math.round(rand(20, 45) * P.greed);
    G.gold += g; dtext(c.x, c.y - 14, '+' + g, false, '#ffd35a'); dburst(c.x, c.y - 6, '#ffd35a', 16, 80);
    if (Math.random() < 0.4) { const b = pick(BASE_BUFFS); G.buffs[b] = Math.max(G.buffs[b] || 0, 20); dtext(c.x, c.y - 22, BUFFS[b].name, false, BUFFS[b].color); }
    if (Math.random() < 0.3) { applyChoice(rollChoices(1)[0]); dtext(c.x, c.y - 30, 'UPGRADE', false, '#8ff0ff'); }
    Snd.play('chest');
  }
  for (const e of D.ents) {
    if (e.dead || !e.shooter) continue;
    e.shot = (e.shot ?? rand(1, 2)) - dt;
    if (e.shot <= 0 && Math.abs(DP.x - e.x) < 200) { e.shot = 2.4; const a = Math.atan2(DP.y - 7 - e.y, DP.x - e.x); D.arrows.push({ x: e.x, y: e.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: 3, foe: true, fire: true }); Snd.play('bullet'); }
  }
};

const baseRender = renderCrypt;
renderCrypt = function () {
  baseRender();
  const now = performance.now() / 1000;
  for (const l of D.levers) {
    const sx = Math.round(l.x - camX), sy = Math.round(l.y - camY);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(sx - 3, sy - 3, 7, 3);
    ctx.fillStyle = '#6d6a7c'; ctx.fillRect(sx - 2, sy - 2, 5, 2);
    pxLine(sx, sy - 2, sx + (l.on ? 5 : -5), sy - 9, '#9a6a42', 1);
    ctx.fillStyle = l.on ? '#a6e05a' : '#d8354a'; ctx.fillRect(sx + (l.on ? 4 : -6), sy - 11, 3, 3);
    if (!l.on && Math.floor(now * 3) % 2) drawText(ctx, '!', sx, sy - 18, '#ffd35a');
  }
  for (const b of D.barrels) if (!b.dead) ctx.drawImage(BUILD.barrel.c, Math.round(b.x - camX - 4), Math.round(b.y - camY - 10));
  for (const o of D.ores) if (!o.dead) { ctx.drawImage(BUILD.ore.c, Math.round(o.x - camX - 4), Math.round(o.y - camY - 7)); if (Math.random() < 0.05) dpart(o.x + rand(-3, 3), o.y - 4, 0, -10, 0.5, '#8ff0ff'); }
  for (const c of D.chests) {
    const s = SPR.chest, sx = Math.round(c.x - camX - s.w / 2), sy = Math.round(c.y - camY - s.h);
    ctx.globalAlpha = c.open ? 0.4 : 1; ctx.drawImage(s.c, sx, sy); ctx.globalAlpha = 1;
  }
  for (const t of D.traps) { ctx.fillStyle = t.t < 0.4 ? '#ffd35a' : '#d8354a'; ctx.fillRect(Math.round(t.tx * DT + 3 - camX), Math.round(t.ty * DT + 3 - camY), 2, 2); }
  for (const a of D.arrows) if (a.fire) { ctx.fillStyle = '#e8742c'; ctx.fillRect(Math.round(a.x - camX) - 1, Math.round(a.y - camY) - 1, 3, 3); }
  if (!D.last && D.cleared && D.doorAt && Math.floor(now * 3) % 2) drawText(ctx, 'UP', D.doorAt.x - camX, D.doorAt.y - camY - 24, '#ffd35a');
};

/* ---------- Theme rewards ---------- */
const baseFinish = finishCrypt;
finishCrypt = function () {
  const theme = D.theme || 'crypt', st = D.st;
  if (theme === 'crypt') { baseFinish(); return; }
  if (st) st.done = true;
  const swift = D.t <= CRYPT_PAR * (D.floor || 1);
  const gold = Math.round((60 + (swift ? 60 : 0)) * P.greed);
  G.gold += gold;
  if (swift) P.hp = P.maxHp;
  const relic = { tower: Math.random() < 0.5 ? 'crown' : pick(['minerLamp', 'templeIdol', 'moonPearl']), mine: 'minerLamp', temple: 'templeIdol', mansion: pick(['thiefRing', 'moonPearl']), cellar: Math.random() < 0.35 ? 'thiefRing' : null, ruins: null }[theme];
  const frag = theme === 'tower' || theme === 'ruins' || theme === 'temple' || (theme === 'mine' && (D.oreCount || 0) >= 3);
  const note = { icon: swift ? 'star' : 'gold', name: `${D.name.split(' · ')[0]} conquered`, lv: `+${gold} gold${swift ? ', a full heal' : ''}${relic ? ', ' + RELICS[relic].name : ''}${frag ? ', a demon fragment' : ''}` };
  D.dead = true;
  Snd.play('chest');
  leaveCrypt(() => {
    if (relic) dropRelic(relic, ME.x + 14, ME.y);
    if (frag) dropFragment(ME.x - 14, ME.y);
    openChest(true, note);
  });
};

/* ---------- Co-op: the partner explores dungeons on their own screen ---------- */
Mods.add({ newRun() { D = null; DP = null; } });
