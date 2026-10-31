'use strict';
/* THE LAST DAWN, part 2: the bosses.
   The Ashen Knight, the City Eater (it eats the scenery), the Warden, the Veilbreaker, the five Guardians of the shards
   and the Eclipse, whose five phases rewrite the arena. Built on the same attack vocabulary as every other boss. */

/* ---------- Art ---------- */
SPR.ceater = bossFrames({ r: 'k', R: 'K', y: 'o', o: 'y', Y: 'Y' });
SPR.veil = bossFrames({ r: 'p', R: 'P', y: 'm', o: 'm', Y: '5', W: 'm' });
SPR.warden = recolorAll(SPR.golem, { '#8ff0ff': '#c9a24a', '#3f8ee0': '#8a6a2a', '#f2eee6': '#ffd35a' });
SPR.gGale = recolorAll(SPR.wraith, { '#a59cc4': '#a6e05a', '#5e557f': '#4fa04a', '#8ff0ff': '#fff3b0' });
SPR.gTide = recolorAll(SPR.slime, { '#4fa04a': '#3f8ee0', '#1f4d33': '#1d3d7a', '#f2eee6': '#c9f7ff' });
SPR.gEmber = recolorAll(SPR.imp, { '#d8354a': '#e8742c', '#7a1a2a': '#7a2a0a', '#ffd35a': '#fff3b0' });
SPR.gStone = recolorAll(SPR.golem, { '#8ff0ff': '#c49a6a', '#3f8ee0': '#5a3a28', '#f2eee6': '#e8d2a8' });
SPR.gDawn = recolorAll(SPR.knight, { '#b5b2c4': '#ffd35a', '#6d6a7c': '#c4912a', '#d8354a': '#fff3b0' });

/* ---------- Helpers ---------- */
const nearPieces = (x, y, r, tgt) => Scn.pieces.filter(p => !p.fallen && (tgt ? p.tgt : p.spr.h > 28) && Math.hypot(p.x - x, p.y - y) < r);
function stunAll(x, y, r, t) {
  for (const pl of G.players) if (!pl.down && Math.hypot(pl.x - x, pl.y - y) < r) pl.stunT = Math.max(pl.stunT || 0, t);
  for (const a of G.allies || []) if (!a.gone && Math.hypot(a.x - x, a.y - y) < r) a.stunT = Math.max(a.stunT || 0, t);
}
// A boss attack that tears down the nearest building: warning circle, then the wall comes down
function smash(b, tp) {
  const list = nearPieces(b.x, b.y, 260).sort((p, q) => Math.hypot(p.x - tp.x, p.y - tp.y) - Math.hypot(q.x - tp.x, q.y - tp.y));
  const p = list[0];
  if (!p) { A.slams(b, tp, 3, 30); return; }
  hz({ k: 'circle', x: p.x, y: p.y - 6, r: Math.max(34, p.spr.w * 0.45), warn: 0.95, life: 0.25, dmg: 26 * b.mul, boom: 8, color: '#e8742c' });
  p.shake = 1;
  sched(b, 0.95, bb => { scnCollapse(p, { shake: 9 }); for (let i = 0; i < 6; i++) hz({ k: 'circle', x: p.x + rand(-40, 40), y: p.y + rand(-20, 20), r: 16, warn: 0.5, life: 0.2, dmg: 14 * bb.mul, color: '#9a6a42' }); });
  lockFor(b, 1.4);
}
function roar(b, r = 160) {
  sched(b, 0, bb => hz({ k: 'ring', x: bb.x, y: bb.y + 6, r0: 12, r, w: 12, warn: 0.6, life: 0.7, dmg: 10 * bb.mul, color: bb.def.color,
    onLive: () => { stunAll(bb.x, bb.y, r, 1.3); G.shake = Math.max(G.shake, 8); Snd.play('roar'); banner(bb.def.name, 'ROARS', bb.def.color); } }));
  lockFor(b, 1.1);
}
// Ground that keeps burning where the Eclipse struck
function scorch(b, tp, n) {
  for (let i = 0; i < n; i++) sched(b, i * 0.18, (bb, t) => {
    const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 160;
    hz({ k: 'circle', x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d * 0.7, r: 26, warn: 0.9, life: 9, tick: 0.5, dmg: 7 * bb.mul, boom: 3, color: '#d8354a', liveColor: 'rgba(120,20,40,0.55)' });
  });
}
const hover = (cx, cy, rad) => (b, dt) => {
  if (b.lock > b.clock || b.air > 0) return;
  const c = G.ld && G.ld.arena ? G.ld.arena : { x: cx, y: cy };
  b.x += (c.x + Math.cos(b.clock * 0.35) * rad - b.x) * dt * 0.7;
  b.y += (c.y - 30 + Math.sin(b.clock * 0.5) * rad * 0.5 - b.y) * dt * 0.7;
};

/* ---------- Definitions ---------- */
Object.assign(BOSS_DEFS, {
  ashen: {
    name: 'The Ashen Knight', hp: 1900, spd: 44, r: 12, color: '#e8742c', scale: 2.2, frames: () => SPR.ashen, phases: [0.75, 0.5], env: 'ember',
    phaseLines: ['He draws a second blade', 'The ground burns where he stands'],
    attacks: [
      { id: 'cut', w: 2, dur: 1.8, pose: 'raise', wind: 0.55, run: (b, t) => A.cone(b, t, 1.2, 96, 2) },
      { id: 'charge', dur: 2.2, pose: 'crouch', wind: 0.5, run: (b, t) => A.dash(b, t, 2, 380) },
      { id: 'ember', phase: 1, dur: 1.5, pose: 'cast', wind: 0.6, run: b => A.ring(b, 14, 85, { c: '#e8742c' }, 2, 0.35) },
      { id: 'cleave', phase: 1, dur: 2, pose: 'slam', wind: 0.7, run: (b, t) => A.slams(b, t, 4, 24, 0.3) },
      { id: 'fan', phase: 2, dur: 1.6, pose: 'throw', wind: 0.5, run: (b, t) => A.fan(b, t, 7, 0.9, 130, { c: '#ff9a3a' }, 2, 0.3) },
    ],
  },
  ceater: {
    name: 'The City Eater', hp: 5600, spd: 36, r: 26, color: '#e8742c', scale: 3, frames: () => SPR.ceater, phases: [0.55], env: 'dust',
    phaseLines: ['It tears toward the central tower'],
    attacks: [
      { id: 'smash', w: 3, dur: 2.4, pose: 'slam', wind: 0.9, run: (b, t) => smash(b, t) },
      { id: 'debris', w: 2, dur: 2, pose: 'throw', wind: 0.6, run: (b, t) => A.rain(b, t, 16, 150, 18, { color: '#9a6a42' }) },
      { id: 'summon', dur: 1.6, pose: 'roar', wind: 0.7, run: b => A.summon(b, ['ghoul', 'skel', 'wraith'], 6, 62) },
      { id: 'roar', dur: 2.2, pose: 'roar', wind: 0.8, run: b => roar(b, 170) },
      { id: 'barricades', dur: 1.8, pose: 'stomp', wind: 0.6, run: b => { sched(b, 0, bb => { for (const p of nearPieces(bb.x, bb.y, 300, true)) { p.hp = 0; } A.wave(bb, 190, 1); }); } },
      { id: 'charge', phase: 1, dur: 2.6, pose: 'crouch', wind: 0.55, run: (b, t) => A.dash(b, t, 2, 340) },
    ],
  },
  warden: {
    name: 'The Warden', hp: 3800, spd: 30, r: 20, color: '#c9a24a', scale: 3, frames: () => SPR.warden, phases: [0.5], env: 'light',
    phaseLines: ['Its core burns open'],
    attacks: [
      { id: 'slam', w: 2, dur: 2, pose: 'slam', wind: 0.8, run: (b, t) => A.slams(b, t, 4, 30, 0.4) },
      { id: 'grid', dur: 2.4, pose: 'cast', wind: 0.7, run: b => A.lines(b, 4, 300, 12) },
      { id: 'build', dur: 1.8, pose: 'roar', wind: 0.7, run: b => A.summon(b, ['golem'], 2, 54) },
      { id: 'pulse', dur: 2, pose: 'stomp', wind: 0.6, run: b => A.wave(b, 150, 2) },
      { id: 'sweep', phase: 1, dur: 3.4, pose: 'charge', wind: 0.9, run: b => A.beam(b, 2, 0.9, 2.6) },
    ],
  },
  veil: {
    name: 'The Veilbreaker', hp: 8200, spd: 28, r: 28, color: '#e27bf0', scale: 3.2, frames: () => SPR.veil, phases: [0.66, 0.33], env: 'void',
    phaseLines: ['The sky tears wider', 'It is no longer holding back'],
    attacks: [
      { id: 'rings', w: 2, dur: 2.4, pose: 'roar', wind: 0.7, run: b => A.ring(b, 18, 90, { c: '#e27bf0' }, 2, 0.4) },
      { id: 'tendrils', dur: 2.6, pose: 'cast', wind: 0.7, run: b => A.lines(b, 5, 330, 12) },
      { id: 'rain', dur: 2.2, pose: 'throw', wind: 0.6, run: (b, t) => A.rain(b, t, 20, 150, 18) },
      { id: 'brood', phase: 1, dur: 1.8, pose: 'roar', wind: 0.7, run: b => A.summon(b, ['wraith', 'stalker'], 6, 70) },
      { id: 'beam', phase: 1, dur: 3.4, pose: 'charge', wind: 0.9, run: b => A.beam(b, 3, 0.8, 2.4) },
      { id: 'spiral', phase: 2, dur: 2.6, pose: 'cast', wind: 0.6, run: b => A.spiral(b, 3, 1.8, 95, { c: '#e27bf0' }) },
    ],
  },
  gGale: {
    name: 'Guardian of Gale', hp: 1900, spd: 70, r: 14, color: '#a6e05a', scale: 3, frames: () => SPR.gGale, env: 'light',
    attacks: [
      { id: 'dash', w: 2, dur: 3.4, pose: 'crouch', wind: 0.45, run: (b, t) => A.dash(b, t, 3, 400) },
      { id: 'feathers', dur: 1.8, pose: 'cast', wind: 0.5, run: (b, t) => A.fan(b, t, 9, 1.2, 150, { c: '#a6e05a', style: 'feather' }, 2, 0.3) },
      { id: 'cyclone', dur: 2.2, pose: 'raise', wind: 0.6, run: b => A.ring(b, 20, 110, { c: '#fff3b0' }, 2, 0.35) },
    ],
  },
  gTide: {
    name: 'Guardian of Tide', hp: 2100, spd: 36, r: 20, color: '#3f8ee0', scale: 4, frames: () => SPR.gTide, env: 'water',
    attacks: [
      { id: 'waves', w: 2, dur: 2.6, pose: 'stomp', wind: 0.6, run: b => A.wave(b, 190, 3) },
      { id: 'pools', dur: 2.2, pose: 'throw', wind: 0.6, run: (b, t) => A.lob(b, t, 6, 26, { c: '#3f8ee0', live: 'rgba(63,142,224,0.55)' }) },
      { id: 'brood', dur: 1.6, pose: 'roar', wind: 0.6, run: b => A.summon(b, ['slime', 'snowwisp'], 5, 60) },
    ],
  },
  gEmber: {
    name: 'Guardian of Ember', hp: 2000, spd: 52, r: 16, color: '#e8742c', scale: 4, frames: () => SPR.gEmber, env: 'ember',
    attacks: [
      { id: 'flame', w: 2, dur: 2.8, pose: 'inhale', wind: 0.7, run: (b, t) => A.cone(b, t, 1.3, 150, 3) },
      { id: 'meteors', dur: 2.4, pose: 'cast', wind: 0.6, run: (b, t) => A.rain(b, t, 18, 160, 20, { color: '#e8742c' }) },
      { id: 'ring', dur: 1.8, pose: 'roar', wind: 0.6, run: b => A.spiral(b, 3, 1.6, 90, { c: '#ffd35a' }) },
    ],
  },
  gStone: {
    name: 'Guardian of Stone', hp: 2600, spd: 28, r: 20, color: '#c49a6a', scale: 3.4, frames: () => SPR.gStone, env: 'dust',
    attacks: [
      { id: 'slam', w: 2, dur: 2.6, pose: 'slam', wind: 0.9, run: (b, t) => A.slams(b, t, 5, 30, 0.35) },
      { id: 'fall', dur: 2.2, pose: 'throw', wind: 0.6, run: (b, t) => A.rain(b, t, 14, 150, 24, { color: '#9a6a42' }) },
      { id: 'golems', dur: 1.8, pose: 'roar', wind: 0.7, run: b => A.summon(b, ['golem'], 2, 54) },
      { id: 'charge', dur: 2.6, pose: 'crouch', wind: 0.6, run: (b, t) => A.dash(b, t, 2, 300) },
    ],
  },
  gDawn: {
    name: 'Guardian of Dawn', hp: 2300, spd: 44, r: 16, color: '#ffd35a', scale: 3.4, frames: () => SPR.gDawn, env: 'light',
    attacks: [
      { id: 'rays', w: 2, dur: 3.4, pose: 'charge', wind: 0.9, run: b => A.beam(b, 4, 0.8, 2.6) },
      { id: 'spiral', dur: 2.4, pose: 'cast', wind: 0.6, run: b => A.spiral(b, 3, 1.7, 100, { c: '#fff3b0' }) },
      { id: 'halo', dur: 2, pose: 'raise', wind: 0.6, run: b => A.ring(b, 22, 100, { c: '#ffd35a' }, 2, 0.4) },
      { id: 'leap', dur: 2.4, pose: 'crouch', wind: 0.5, run: (b, t) => A.leap(b, t, 46) },
    ],
  },
  eclipse: {
    name: 'The Eclipse', hp: 15000, spd: 30, r: 34, hh: 26, color: '#e8742c', scale: 1, frames: () => SPR.swarmeye, draw: (b, now) => drawEclipse(b, now), move: hover(0, 0, 90),
    phases: [0.8, 0.6, 0.4, 0.2], env: 'void',
    phaseLines: ['THE GROUND IS NOT YOURS', 'IT BURNS WHAT IT CANNOT HOLD', 'COME INTO THE LIGHT', 'FOR THE LAST TIME'],
    attacks: [
      { id: 'rings', w: 2, dur: 2.4, pose: 'roar', wind: 0.7, run: b => A.ring(b, 16, 90, { c: '#e8742c' }, 2, 0.4) },
      { id: 'fan', dur: 1.8, pose: 'cast', wind: 0.5, run: (b, t) => A.fan(b, t, 9, 1.1, 130, { c: '#ffd35a' }, 2, 0.3) },
      { id: 'slams', dur: 2.2, pose: 'slam', wind: 0.7, run: (b, t) => A.slams(b, t, 4, 28, 0.35) },
      { id: 'rain', dur: 2.4, pose: 'throw', wind: 0.6, run: (b, t) => A.rain(b, t, 16, 160, 20, { color: '#e8742c' }) },
      { id: 'voidbeams', phase: 1, dur: 2.8, pose: 'cast', wind: 0.7, run: b => A.lines(b, 6, 330, 12) },
      { id: 'shades', phase: 1, dur: 1.8, pose: 'roar', wind: 0.7, run: b => A.summon(b, ['wraith', 'stalker'], 6, 80) },
      { id: 'obliterate', phase: 2, w: 2, dur: 3, pose: 'charge', wind: 0.8, run: (b, t) => scorch(b, t, 7) },
      { id: 'beam', phase: 2, dur: 3.4, pose: 'charge', wind: 0.9, run: b => A.beam(b, 3, 0.7, 2.8) },
      { id: 'corona', phase: 3, dur: 2.4, pose: 'stomp', wind: 0.6, run: b => A.wave(b, 250, 3) },
      { id: 'flares', phase: 3, dur: 2.6, pose: 'cast', wind: 0.6, run: b => A.spiral(b, 4, 1.8, 95, { c: '#ffd35a' }) },
      { id: 'nova', phase: 4, w: 2, dur: 2.8, pose: 'roar', wind: 0.9, run: b => { A.ring(b, 30, 120, { c: '#fff3b0' }, 3, 0.35); A.wave(b, 280, 2); } },
    ],
  },
});
Object.assign(BOSS_TITLES, {
  'The Ashen Knight': 'Black armour. Dead eyes. He lets you live', 'The City Eater': 'It was hungry long before it reached Veyra',
  'The Warden': 'It was built to keep something out', 'The Veilbreaker': 'What waited behind the sky',
  'Guardian of Gale': 'First shard, first storm', 'Guardian of Tide': 'The sea remembers', 'Guardian of Ember': 'It burns without fuel',
  'Guardian of Stone': 'Unmoved for a thousand years', 'Guardian of Dawn': 'The last light, hardened', 'The Eclipse': 'The sun, devoured',
});
for (const id of ['ashen', 'ceater', 'warden', 'veil', 'gGale', 'gTide', 'gEmber', 'gStone', 'gDawn', 'eclipse']) {
  const def = BOSS_DEFS[id];
  if (!def.hh) def.hh = def.frames()[0].h * (def.scale || 1) / 2 * (id === 'eclipse' ? 1 : 1);
}

/* ---------- The Eclipse itself: a black sun with a corona and an eye ---------- */
function drawEclipse(b, now) {
  const sx = Math.round(b.x - camX), sy = Math.round(b.y - camY - (b.z || 0)), R = 38 + b.phase * 3;
  shadow(b.x, b.y + R * 0.8, R * 1.7);
  for (let i = 5; i >= 1; i--) { ctx.globalAlpha = 0.07 + b.phase * 0.01; pxDisc(sx, sy, R + i * 5 + Math.sin(now * 3 + i) * 1.5, i % 2 ? '#e8742c' : '#ffd35a', 0.9); }
  ctx.globalAlpha = 1;
  pxDisc(sx, sy, R + 2, '#e8742c', 0.9); pxDisc(sx, sy, R, '#04030a', 0.9);
  ctx.fillStyle = '#ffd35a';
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU + now * 0.3, rr = R + 4 + ((i * 7) % 5) + Math.sin(now * 4 + i) * 3; ctx.fillRect(Math.round(sx + Math.cos(a) * rr), Math.round(sy + Math.sin(a) * rr * 0.9), 1 + (i % 3 === 0), 2); }
  const open = b.lock > b.clock ? 1 : 0.55 + Math.sin(now * 2) * 0.15;
  pxDisc(sx, sy, R * 0.46 * open, '#e27bf0', 0.8); pxDisc(sx, sy, R * 0.2, '#04030a', 0.9);
  if (b.flash > 0.05) { ctx.globalAlpha = 0.4; pxDisc(sx, sy, R, '#ffffff', 0.9); ctx.globalAlpha = 1; }
  light(b.x, b.y, 120, 0.8); glowAt(b.x, b.y, 54, '#e8742c', 0.35);
}
