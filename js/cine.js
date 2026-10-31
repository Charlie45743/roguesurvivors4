'use strict';
/* THE LAST DAWN, part 1: the cinematic engine.
   A campaign is a generator. Cutscenes and gameplay are the same script: the script yields "waiters" (seconds, a condition,
   a movement, a line of dialogue) and the runner advances it every frame, whether the game is in a cutscene or being played.
     function* chapter(c) { yield c.cine(true); yield c.walk(c.who('elara'), 100, 0); yield c.say('elara', 'Day thirty-seven.'); ... }
   Inside a cutscene the camera pans and zooms, people walk, turn and fight, crowds run, buildings fall, the sky cracks, and the
   script can skip ahead (Esc) without losing the consequences of anything it did. */

/* ---------- People ---------- */
const recolorAll = (fr, map) => fr.map(f => recolor(f, map));
CHAR_ART.elara = { ...CHAR_ART.wren, swap: { P: '3', p: '2', c: 'R' } };
NPC_SPR.kael = recolorAll(NPC_SPR.hunter, { '#4fa04a': '#c08a3a', '#1f4d33': '#6a4a22' });
NPC_SPR.mira = recolorAll(NPC_SPR.priest, { '#f2eee6': '#8ff0ff', '#b5b2c4': '#3f8ee0' });
NPC_SPR.bram = recolorAll(NPC_SPR.smith, { '#5a3a28': '#7a1a2a', '#6d6a7c': '#a59cc4' });
NPC_SPR.seren = recolorAll(NPC_SPR.smith, { '#5a3a28': '#2e4266', '#6d6a7c': '#dce6f2' });
NPC_SPR.tomas = recolorAll(NPC_SPR.smith, { '#5a3a28': '#3a2a1c', '#6d6a7c': '#8a87a0' });
NPC_SPR.lyra = recolorAll(NPC_SPR.villager, { '#9a6a42': '#e27bf0', '#5a3a28': '#4a2470' });
NPC_SPR.orin = recolorAll(NPC_SPR.alchemist, { '#4fa04a': '#e8742c', '#1f4d33': '#7a3a1c' });
NPC_SPR.guard = recolorAll(NPC_SPR.smith, { '#5a3a28': '#2e4266', '#6d6a7c': '#b5b2c4' });
NPC_SPR.guardbow = recolorAll(NPC_SPR.hunter, { '#4fa04a': '#d8354a', '#1f4d33': '#7a1a2a' });
NPC_SPR.refugee = NPC_SPR.villager;
NPC_SPR.refugee2 = NPC_SPR.villager2;
NPC_SPR.survivor = recolorAll(NPC_SPR.villager, { '#9a6a42': '#a6e05a', '#5a3a28': '#1f4d33' });

const ASHEN_MAP = { '#b5b2c4': '#3a3544', '#6d6a7c': '#211d2b', '#d8354a': '#e8742c', '#ffd35a': '#ff9a3a' };
SPR.ashen = recolorAll(SPR.knight, ASHEN_MAP);
// Unhelmed: white hair and an old, scarred face
const ASHEN_BARE = KNIGHT.map((r, i) => ({ 2: '.....055', 3: '...05555', 4: '..055555', 5: '..05ssss', 6: '..05s0ss', 7: '..05ssss' })[i] || r);
SPR.ashenBare = [makeSprite(mirror(ASHEN_BARE.concat(['....0w0.', '....000.']))), makeSprite(mirror(ASHEN_BARE.concat(['...0w0..', '...000..'])))].map(f => recolor(f, ASHEN_MAP));
NPC_SPR.ashen = [SPR.ashen[0], SPR.ashen[1], SPR.ashen[0], SPR.ashen[1]];
NPC_SPR.ashenBare = [SPR.ashenBare[0], SPR.ashenBare[1], SPR.ashenBare[0], SPR.ashenBare[1]];
// Shadow soldiers of the dark, so cutscenes can show an army without spending enemy slots
NPC_SPR.shade = recolorAll(NPC_SPR.guard, { '#2e4266': '#1c1a2b', '#b5b2c4': '#4a2470', '#e8b48e': '#8ff0ff' });

Object.assign(SPEAKERS, {
  elara: { name: 'Elara', spr: () => charFrames('elara')[0], color: '#ffd35a' },
  kael: { name: 'Kael', spr: () => NPC_SPR.kael[0], color: '#e0b060' },
  mira: { name: 'Mira', spr: () => NPC_SPR.mira[0], color: '#8ff0ff' },
  bram: { name: 'Bram', spr: () => NPC_SPR.bram[0], color: '#e0707a' },
  ashen: { name: 'Ashen Knight', spr: () => SPR.ashen[0], color: '#e8742c' },
  ashenBare: { name: 'The Ashen Knight', spr: () => SPR.ashenBare[0], color: '#f2eee6' },
  seren: { name: 'Seren', spr: () => NPC_SPR.seren[0], color: '#9fc0ff' },
  tomas: { name: 'Tomas', spr: () => NPC_SPR.tomas[0], color: '#c9a070' },
  lyra: { name: 'Lyra', spr: () => NPC_SPR.lyra[0], color: '#e27bf0' },
  orin: { name: 'Orin', spr: () => NPC_SPR.orin[0], color: '#ff9a4a' },
  eclipse: { name: 'The Eclipse', spr: () => SPR.swarmeye[0], color: '#e27bf0' },
  warden: { name: 'The Warden', spr: () => SPR.golem[0], color: '#8ff0ff' },
  voice: { name: '???', spr: () => SPR.wraith[0], color: '#a59cc4' },
});
const SPEAKER_IDS = { elara: 'elara', kael: 'kael', mira: 'mira', bram: 'bram', seren: 'seren', tomas: 'tomas', lyra: 'lyra', orin: 'orin' };

/* ---------- State ---------- */
const Cine = {
  on: false, free: false, skipping: false, sim: false,
  cam: { x: 0, y: 0, z: 1 }, follow: null, tw: [],
  actors: [], barks: [], dlg: null,
  fade: 0, letter: 0, letterTo: 0, flash: 0, flashC: '#ffffff',
  sky: { on: false, crack: 0, sun: 0, dawn: 0, tint: 0 },
  shake: 0,
};
const Camp = { gen: null, wait: null, objective: '', bars: [], timers: [], tag: '', onDone: null };
const tick = fn => ({ upd: fn });
const ease = { lin: t => t, out: t => 1 - (1 - t) * (1 - t), inout: t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)) };

function norm(v) {
  if (v === undefined || v === null) return tick(() => true);
  if (typeof v === 'number') { let s = v; return tick(dt => (s -= dt) <= 0); }
  if (typeof v === 'function') return tick(() => !!v());
  if (Array.isArray(v)) return C.all(...v);
  return v;
}
function campRun(genFn, onDone) {
  Camp.gen = genFn(C); Camp.wait = null; Camp.onDone = onDone || null;
}
function campTick(dt) {
  if (!Camp.gen) return;
  for (let guard = 0; guard < 80; guard++) {
    if (Camp.wait) {
      const done = Camp.skipping ? (Camp.wait.skip && Camp.wait.skip(), true) : Camp.wait.upd(dt);
      if (!done) return;
      Camp.wait = null; dt = 0;
    }
    const r = Camp.gen.next();
    if (r.done) { Camp.gen = null; const f = Camp.onDone; Camp.onDone = null; if (f) f(); return; }
    Camp.wait = norm(r.value);
  }
}

/* ---------- Moving things ---------- */
function stepGoal(o, dt) {
  const g = o.goal;
  if (!g) { if (o.moving && o.cineMoved) { o.moving = false; o.cineMoved = false; } return; }
  const dx = g.x - o.x, dy = g.y - o.y, d = Math.hypot(dx, dy), s = g.spd * dt;
  o.cineMoved = true;
  if (d <= s || Camp.skipping) { o.x = g.x; o.y = g.y; o.goal = null; o.moving = false; if (g.face) o.face = g.face; return; }
  o.x += dx / d * s; o.y += dy / d * s;
  if (Math.abs(dx) > 0.5) { o.face = dx < 0 ? -1 : 1; if ('dir' in o) o.dir = o.face; }
  o.moving = true; o.anim = (o.anim || 0) + dt * (g.spd > 70 ? 11 : 8);
}
function mkActor(id, key, x, y, o = {}) {
  const frames = Array.isArray(key) ? key : (NPC_SPR[key] || NPC_SPR.villager);
  const a = { isActor: true, id, name: o.name || id, frames, x, y, face: o.face || 1, anim: Math.random() * 4, moving: false, goal: null, sc: o.sc || 1, alpha: 1,
    hp: o.hp, maxHp: o.hp, civ: !!o.civ, color: o.color || '#f2eee6', ph: Math.random() * 6, tag: o.tag || '', glow: o.glow || 0 };
  Cine.actors.push(a);
  return a;
}
function drawActor(a, now) {
  const f = a.frames[a.moving ? Math.floor(a.anim) % a.frames.length : 0], sc = a.sc;
  const step = Math.floor(a.anim) % 4, bob = a.moving ? (step % 2 ? -1 : 0) : (Math.floor(now * 1.25 + a.ph) % 2 ? -1 : 0);
  const w = Math.round(f.w * sc), h = Math.round(f.h * sc);
  shadow(a.x, a.y + 8, 10 * sc);
  const x = Math.round(a.x - camX - w / 2), y = Math.round(a.y - camY - h / 2) + bob - (a.z || 0);
  ctx.globalAlpha = a.alpha;
  if (a.face < 0) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(f.c, 0, 0, w, h); ctx.restore(); }
  else ctx.drawImage(f.c, x, y, w, h);
  if (a.hurt > 0) { ctx.globalAlpha = a.hurt * 3; ctx.drawImage(silhouette(f, '#ffffff'), x, y, w, h); }
  ctx.globalAlpha = 1;
  if (a.glow) { light(a.x, a.y, a.glow, 0.7); glowAt(a.x, a.y - 4, 14, a.color, 0.35); }
  if (a.civ && a.hp !== undefined && a.hp < a.maxHp) {
    const bx = Math.round(a.x - camX - 6), by = Math.round(a.y - camY + 10);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(bx - 1, by - 1, 14, 4);
    ctx.fillStyle = '#a6e05a'; ctx.fillRect(bx, by, Math.round(12 * clamp(a.hp / a.maxHp, 0, 1)), 2);
  }
  if (a.label) drawText(ctx, a.label, a.x - camX, a.y - camY - h / 2 - 4, a.color);
}

/* ---------- Scenery: painted places that the cutscenes and missions share ---------- */
const Scn = { pieces: [], grounds: [], solids: [], blocks: [] };
function scnClear() { Scn.pieces.length = 0; Scn.grounds.length = 0; Scn.solids.length = 0; Scn.blocks.length = 0; }
// A building, wall, gate or prop standing at its base (x, y). `solids` are [dx, dy, r] circles that block walkers.
function scnAdd(spr, x, y, o = {}) {
  const p = { spr, x, y, solid: [], hp: o.hp, maxHp: o.hp, tgt: !!o.tgt, name: o.name || '', big: spr.h > 28, light: o.light !== false, ruinedSpr: o.ruinedSpr || null, shake: 0, tag: o.tag || '' };
  for (const [dx, dy, r] of o.solids || []) { const s = { x: x + dx, y: y + dy, r }; p.solid.push(s); addSolid(s); Scn.solids.push(s); }
  Scn.pieces.push(p);
  return p;
}
function scnHouse(x, y, kind, seed, o = {}) {
  const spr = recipeSprite(kind, seed, false);
  const half = spr.w / 2 - 6, rr = Math.max(5, Math.min(11, spr.h * 0.12)), solids = [];
  for (let dx = -half + rr; dx <= half - rr + 0.1; dx += rr * 1.2) solids.push([dx, -rr + 2, rr]);
  return scnAdd(spr, x, y, { solids, ruinedSpr: recipeSprite(kind, seed, true), ...o });
}
function scnProp(k, x, y, solidR = 0, o = {}) {
  const spr = prop(k);
  return scnAdd(spr, x, y, { solids: solidR ? [[0, -2, solidR]] : [], ...o });
}
function scnWall(x1, y1, x2, y2, o = {}) {
  const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 26)), out = [];
  for (let i = 0; i <= n; i++) out.push(scnProp(o.k || 'palisade', x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, 6, o));
  return out;
}
// Knock a piece down: dust, noise, rubble where it stood, and the way through opens
function scnCollapse(p, o = {}) {
  if (p.fallen) return;
  p.fallen = true;
  for (const s of p.solid) { s.x = 1e9; s.y = 1e9; }
  burst(p.x, p.y - p.spr.h * 0.4, '#8a80a0', 26, 110);
  for (let i = 0; i < 18; i++) addPart(p.x + rand(-p.spr.w / 2, p.spr.w / 2), p.y - rand(0, p.spr.h), rand(-30, 30), rand(-60, -10), rand(0.5, 1.2), pick(['#6b6276', '#4a4258', '#8a80a0', '#2e2a38']), 2, 160);
  G.fx.push({ k: 'shock', x: p.x, y: p.y, t: 0, dur: 0.5, r: p.spr.w * 0.8 });
  G.shake = Math.max(G.shake, o.shake ?? 7); Snd.play('bigboom');
  p.spr = p.ruinedSpr && !o.rubble ? p.ruinedSpr : prop('rubble'); p.big = false; p.light = false;
  p.tgt = false;
}
// Ground painted once, drawn under everything. rects: [x, y, w, h, colour]
function scnGround(x0, y0, w, h, rects, seed = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), r = mulberry32(seed);
  for (const [x, y, rw, rh, col, speck] of rects) {
    g.fillStyle = col; g.fillRect(x - x0, y - y0, rw, rh);
    if (speck) for (let i = 0; i < rw * rh / 60; i++) { g.fillStyle = r() < 0.5 ? speck[0] : speck[1]; g.fillRect(x - x0 + r() * rw, y - y0 + r() * rh, 1 + (r() < 0.3), 1); }
  }
  Scn.grounds.push({ c, x: x0, y: y0 });
}
const scnBlock = (x0, y0, x1, y1) => Scn.blocks.push([x0, y0, x1, y1]);

Mods.add({
  newRun() { scnClear(); Cine.actors.length = 0; Cine.barks.length = 0; Cine.tw.length = 0; Cine.on = Cine.free = Cine.skipping = Cine.sim = false; Cine.fade = Cine.letter = Cine.letterTo = Cine.flash = 0; Cine.follow = null; Cine.cam.z = 1; Cine.sky = { on: false, crack: 0, sun: 0, dawn: 0, tint: 0 }; Camp.gen = null; Camp.wait = null; Camp.timers.length = 0; Camp.bars.length = 0; Camp.objective = ''; },
  blocked(x, y) { for (const b of Scn.blocks) if (x > b[0] && x < b[2] && y > b[1] && y < b[3]) return true; return false; },
  solidsCleared() { for (const s of Scn.solids) if (s.x < 1e8) addSolid(s); },
  drawGround() {
    for (const g of Scn.grounds) {
      const sx = Math.round(g.x - camX), sy = Math.round(g.y - camY);
      if (sx > W || sy > H || sx + g.c.width < 0 || sy + g.c.height < 0) continue;
      ctx.drawImage(g.c, sx, sy);
    }
  },
  ents(list) {
    for (const p of Scn.pieces) if (onScreen(p.x, p.y - p.spr.h / 2, p.spr.w / 2 + 20)) list.push({ sortY: p.y, y: p.y, x: p.x, draw: now => drawPiece2(p, now) });
    for (const a of Cine.actors) if (a.alpha > 0.02 && onScreen(a.x, a.y, 30)) list.push({ sortY: a.y + 8, y: a.y, x: a.x, draw: now => drawActor(a, now) });
  },
});
function drawPiece2(p, now) {
  const sp = p.spr;
  let a = 1;
  if (p.big && ME) { const fx = ME.x, fy = ME.y + 8; if (Math.abs(fx - p.x) < sp.w / 2 - 2 && fy < p.y - 2 && fy > p.y - sp.h + 6) a = 0.45; }
  const jig = p.shake > 0 ? Math.round(Math.sin(now * 60) * 1.5) : 0;
  ctx.globalAlpha = a;
  ctx.drawImage(sp.c, Math.round(p.x - camX - sp.w / 2) + jig, Math.round(p.y - camY - sp.h));
  ctx.globalAlpha = 1;
  if (p.hp !== undefined && p.hp < p.maxHp && !p.fallen) {
    const bx = Math.round(p.x - camX - 12), by = Math.round(p.y - camY + 3);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(bx - 1, by - 1, 26, 4);
    ctx.fillStyle = '#d8354a'; ctx.fillRect(bx, by, Math.round(24 * clamp(p.hp / p.maxHp, 0, 1)), 2);
  }
  if (p.light && sp.meta) for (const [dx, dy, c] of sp.meta.glows) { light(p.x + dx, p.y + dy, c === '#ffd35a' ? 34 : 26, 0.75); glowAt(p.x + dx, p.y + dy, 9, c, 0.35); }
}

/* ---------- Tweens ---------- */
function tween(o, k, to, dur, e = 'inout') {
  Cine.tw = Cine.tw.filter(t => !(t.o === o && t.k === k));
  if (dur <= 0 || Camp.skipping) { o[k] = to; return tick(() => true); }
  const t = { o, k, from: o[k], to, t: 0, dur, e: ease[e] || ease.inout, done: false };
  Cine.tw.push(t);
  return { upd: () => t.done, skip: () => { o[k] = to; t.done = true; } };
}
function tweenTick(dt) {
  for (const t of Cine.tw) {
    t.t += dt;
    const k = Math.min(1, t.t / t.dur);
    t.o[t.k] = t.from + (t.to - t.from) * t.e(k);
    if (k >= 1) t.done = true;
  }
  if (Cine.tw.some(t => t.done)) Cine.tw = Cine.tw.filter(t => !t.done);
}

/* ---------- The script API ---------- */
const WHO = {};   // extra named people the script registers: C.reg('seren', object)
const C = {
  /* time and flow */
  wait: s => norm(s),
  until: fn => tick(() => !!fn()),
  all(...ws) { const list = ws.map(norm); return { upd(dt) { let ok = true; for (const w of list) { if (!w.done) w.done = w.upd(dt); ok = ok && w.done; } return ok; }, skip() { for (const w of list) if (w.skip) w.skip(); } }; },
  later(s, fn) { Camp.timers.push({ t: s, fn }); },
  objective(text) { Camp.objective = text || ''; },
  bar(id, label, fn, color = '#d8354a') { Camp.bars = Camp.bars.filter(b => b.id !== id); if (fn) Camp.bars.push({ id, label, fn, color }); },
  /* cutscene mode */
  cine(on) {
    if (on) {
      Cine.on = true; Cine.free = true; Cine.letterTo = 1;
      Cine.cam.x = Cine.cam.x || ME.x; Cine.cam.y = Cine.cam.y || ME.y;
      if (state === 'play') setState('cine');
      $('barks').innerHTML = ''; Cine.barks.length = 0;
      return tween(Cine, 'letter', 1, 0.6, 'out');
    }
    Cine.letterTo = 0; Cine.follow = null;
    const w = C.all(tween(Cine, 'letter', 0, 0.6, 'out'), tween(Cine.cam, 'z', 1, 0.6));
    return tick(dt => {
      if (!w.upd(dt)) return false;
      Cine.on = false; Cine.free = false; Camp.skipping = false; Cine.sim = false;
      $('cdlg').classList.add('hidden'); Cine.dlg = null;
      if (state === 'cine') setState('play');
      return true;
    });
  },
  sim(on) { Cine.sim = !!on; },
  /* camera */
  cam(x, y, dur = 1.2, e = 'inout') { Cine.follow = null; return C.all(tween(Cine.cam, 'x', x, dur, e), tween(Cine.cam, 'y', y, dur, e)); },
  camTo(o, dur = 1.2) { return C.cam(o.x, o.y - 4, dur); },
  snap(x, y) { Cine.follow = null; Cine.cam.x = x; Cine.cam.y = y; },
  zoom(z, dur = 1) { return tween(Cine.cam, 'z', z, dur); },
  follow(o) { Cine.follow = o; },
  /* effects */
  shake(mag = 6, dur = 0.5) { G.shake = Math.max(G.shake, mag); Cine.shake = Math.max(Cine.shake, dur); },
  flash(color = '#ffffff', dur = 0.5) { Cine.flashC = color; Cine.flash = 1; return tween(Cine, 'flash', 0, dur, 'out'); },
  fade(to = 1, dur = 1) { return tween(Cine, 'fade', to, dur, 'lin'); },
  music(n) { Snd.music(n); },
  sfx(name) { Snd.play(name); },
  sky(o) { Object.assign(Cine.sky, o); },
  title(t, s, cls) { titleCard(t, s, cls); return norm(3.2); },
  explode(x, y, r = 40) {
    burst(x, y, '#e8742c', 40, 150); burst(x, y, '#ffd35a', 22, 100); burst(x, y, '#0b0a12', 16, 80);
    for (let i = 0; i < 3; i++) G.fx.push({ k: 'ring', x, y, t: -i * 0.08, dur: 0.55, r: r + i * 22, c: i ? '#e8742c' : '#fff3b0' });
    G.fx.push({ k: 'shock', x, y, t: 0, dur: 0.5, r: r * 1.4 });
    G.shake = Math.max(G.shake, 9); Cine.flash = Math.max(Cine.flash, 0.6); Cine.flashC = '#ffd9a0'; tween(Cine, 'flash', 0, 0.45, 'out');
    Snd.play('bigboom');
    try { BossFx.addDecal(x, y + 6, { kind: 'crater', r: r * 0.7, env: BossFx.ENVS.dust, life: 30 }); } catch (e) { /* decals are optional */ }
  },
  collapse: scnCollapse,
  /* people */
  who(id) {
    if (id === 'elara') return ME;
    if (WHO[id]) return WHO[id];
    const al = (G.allies || []).find(a => a.key === id && !a.gone); if (al) return al;
    return Cine.actors.find(a => a.id === id) || null;
  },
  reg(id, o) { WHO[id] = o; return o; },
  actor(id, key, x, y, o) { return mkActor(id, key, x, y, o); },
  remove(o) { if (!o) return; if (o.isActor) { Cine.actors = Cine.actors.filter(a => a !== o); } else if (o.isAlly) o.gone = true; },
  crowd(n, x, y, spread, o = {}) {
    const keys = o.keys || ['refugee', 'refugee2', 'survivor', 'villager2'], out = [];
    for (let i = 0; i < n; i++) out.push(mkActor('crowd', pick(keys), x + rand(-spread, spread), y + rand(-spread * 0.6, spread * 0.6), { name: 'crowd', tag: o.tag || 'crowd', civ: !!o.civ, hp: o.civ ? 30 : undefined }));
    return out;
  },
  walk(o, x, y, spd = 46) { if (!o) return norm(0); o.goal = { x, y, spd }; return { upd: () => !o.goal, skip: () => { stepGoalSnap(o); } }; },
  walkAll(list, x, y, spd = 46, spread = 14) { return C.all(...list.map(o => C.walk(o, x + rand(-spread, spread), y + rand(-spread, spread), spd * rand(0.9, 1.1)))); },
  face(o, d) { if (!o) return; o.face = typeof d === 'number' ? d : (d.x < o.x ? -1 : 1); if ('dir' in o) o.dir = o.face; },
  look(o, t) { C.face(o, t); },
  hurt(o) { if (o) o.hurt = 0.3; },
  attack(o, t) {
    if (!o) return;
    if (t) C.face(o, t);
    G.fx.push({ k: 'ring', x: o.x + o.face * 10, y: o.y, t: 0, dur: 0.15, r: 14, c: '#f2eee6' });
    burst(o.x + o.face * 10, o.y, '#f2eee6', 4, 50); Snd.play('slash');
    if (t && t.hp !== undefined && !t.isAlly && !t.isPlayer && !t.boss && t.d) { t.hp = 0; C.kill(t); }
  },
  shoot(o, t, o2 = {}) {
    if (!o || !t) return;
    C.face(o, t);
    G.fx.push({ k: 'bolt', t: 0, dur: 0.12, pts: [[o.x, o.y - 4], [t.x, t.y - 2]] });
    Snd.play('shoot');
    if (o2.kill && t.d) { t.hp = 0; C.kill(t); }
  },
  foe(type, x, y, o = {}) { const e = spawnEnemy(type, x, y, o); e.rise = 0; e.cineFoe = true; return e; },
  kill(e) { if (!e || e.dead) return; e.dead = true; disintegrate(e, e.frames[0], e.scale || 1); burst(e.x, e.y, e.d ? e.d.color : '#a59cc4', 6, 70); Snd.play('kill'); },
  /* talk: in a cutscene the box floats over the moving scene; during play it pauses the game like any story line */
  say(who, text, o = {}) {
    if (!Cine.on) return C.talk([[who, text]]);
    Cine.dlg = { who, text, shown: 0, adv: false, auto: o.auto, hold: 0 };
    const el = $('cdlg');
    el.classList.remove('hidden');
    el.classList.toggle('narr', who === 'narrator');
    if (who !== 'narrator') $('cdPortrait').src = portraitOf(who);
    $('cdName').textContent = who === 'narrator' ? '' : speakerName(who);
    $('cdName').style.color = SPEAKERS[who].color || '#f2eee6';
    $('cdText').textContent = '';
    const d = Cine.dlg;
    return { upd: () => { if (d.adv) { if (Cine.dlg === d) { Cine.dlg = null; el.classList.add('hidden'); } return true; } return false; }, skip: () => { if (Cine.dlg === d) { Cine.dlg = null; el.classList.add('hidden'); } } };
  },
  talk(lines) { let done = false; say(lines, () => { done = true; }); return { upd: () => done, skip: () => {} }; },
  bark(who, text, dur = 3.6) { pushBark(who, text, dur); },
  /* the world */
  spawn(type, x, y, o) { return spawnEnemy(type, x, y, o); },
};
function stepGoalSnap(o) { if (o.goal) { o.x = o.goal.x; o.y = o.goal.y; o.goal = null; o.moving = false; } }

/* ---------- Barks: short lines spoken during play, never pausing the game ---------- */
function pushBark(who, text, dur) {
  const sp = SPEAKERS[who] || SPEAKERS.voice;
  Cine.barks.push({ who, text, t: dur });
  if (Cine.barks.length > 4) Cine.barks.shift();
  renderBarks();
}
function renderBarks() {
  $('barks').innerHTML = Cine.barks.map(b => { const sp = SPEAKERS[b.who] || SPEAKERS.voice; return `<div class="bark"><b style="color:${sp.color || '#f2eee6'}">${sp.name || ''}</b> ${b.text}</div>`; }).join('');
}

/* ---------- Per-frame ---------- */
function cineStep(dt) {
  tweenTick(dt);
  for (const t of Camp.timers) t.t -= dt;
  if (Camp.timers.some(t => t.t <= 0)) { const due = Camp.timers.filter(t => t.t <= 0); Camp.timers = Camp.timers.filter(t => t.t > 0); for (const t of due) t.fn(); }
  for (const a of Cine.actors) { stepGoal(a, dt); if (a.hurt > 0) a.hurt -= dt; }
  stepGoal(ME, dt);
  for (const a of G.allies || []) if (a.cine || a.goal) stepGoal(a, dt);
  for (const e of G.enemies) if (e.goal) stepGoal(e, dt);
  if (Cine.follow) { const f = Cine.follow, k = Math.min(1, dt * 4); Cine.cam.x += (f.x - Cine.cam.x) * k; Cine.cam.y += (f.y - 4 - Cine.cam.y) * k; }
  if (Cine.barks.length) { for (const b of Cine.barks) b.t -= dt; if (Cine.barks.some(b => b.t <= 0)) { Cine.barks = Cine.barks.filter(b => b.t > 0); renderBarks(); } }
  const d = Cine.dlg;
  if (d) {
    const len = d.text.length;
    if (Camp.skipping) { d.adv = true; }
    else {
      if (d.shown < len) { d.shown = Math.min(len, d.shown + dt * 52); $('cdText').textContent = d.text.slice(0, Math.floor(d.shown)); if (Math.floor(d.shown) % 3 === 0) Snd.play('tick'); }
      else { $('cdText').textContent = d.text; d.hold += dt; if (d.auto && d.hold > Math.max(1.4, len * 0.04)) d.adv = true; }
    }
  }
  G.shake = Math.max(0, G.shake - dt * 18);
}
function cineAdvance() {
  const d = Cine.dlg;
  if (!d) return;
  if (d.shown < d.text.length) { d.shown = d.text.length; $('cdText').textContent = d.text; d.hold = 0; } else d.adv = true;
}
// Particles, effects and floating text keep moving during a cutscene; with sim on, the whole battle runs (people fight, foes advance)
function worldStep(dt) {
  if (Cine.sim) {
    buildGrid();
    Camp.inSim = true;
    Mods.call('update', dt);
    Camp.inSim = false;
    updateEnemies(dt); updateProjs(dt); updateBullets(dt); updatePools(dt);
  }
  updateFx(dt); updateParts(dt); updateTexts(dt);
  if (G.enemies.some(e => e.dead)) G.enemies = G.enemies.filter(e => !e.dead);
}

Mods.add({
  frame(st, dt) {
    if (st !== 'cine' || !G) return;
    if (Cine.letter !== Cine.letterTo && !Cine.tw.some(t => t.o === Cine && t.k === 'letter')) Cine.letter = Cine.letterTo;
    campTick(dt);
    cineStep(dt);
    worldStep(dt);
  },
  update(dt) {
    // during play the same runner keeps the story going
    if (Camp.inSim || !G || !G.ld) return;
    campTick(dt);
    cineStep(dt);
    for (const f of Camp.bars) { /* values are read in hud() */ }
  },
  key(e) {
    if (state !== 'cine') return false;
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { e.preventDefault(); cineAdvance(); }
    else if (e.code === 'Escape') { e.preventDefault(); if (Camp.gen) { Camp.skipping = true; banner('Skipping', '', '#a59cc4'); } }
    return true;
  },
  camera() {
    if (!Cine.free) return;
    const sh = G.shake;
    camX = Math.round(Cine.cam.x - W / 2 + (sh ? rand(-sh, sh) : 0));
    camY = Math.round(Cine.cam.y - H / 2 + (sh ? rand(-sh, sh) : 0));
  },
  postRender() {
    if (!G) return;
    const sk = Cine.sky;
    if (sk.on) drawSky(sk);
    if (Cine.cam.z > 1.001 && Cine.free) {
      const z = Cine.cam.z, sw = W / z, sh = H / z;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cv, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, W, H);
    }
    if (sk.tint > 0) { ctx.fillStyle = `rgba(${sk.tintC || '74,36,112'},${sk.tint})`; ctx.fillRect(0, 0, W, H); }
    if (Cine.flash > 0.01) { ctx.globalAlpha = Cine.flash; ctx.fillStyle = Cine.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (Cine.fade > 0.003) { ctx.globalAlpha = Cine.fade; ctx.fillStyle = Cine.fadeC || '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (Cine.letter > 0.003) { const bh = Math.round(H * 0.12 * Cine.letter); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh); }
  },
  hud() {
    const box = $('ldbars');
    const html = Camp.bars.map(b => `<div class="ldbar"><span>${b.label}</span><i style="width:${Math.round(clamp(b.fn(), 0, 1) * 100)}%;background:${b.color}"></i></div>`).join('');
    if (hudLast.ldbars !== html) { hudLast.ldbars = html; box.innerHTML = html; }
  },
  state(s) { if (s === 'menu') { $('barks').innerHTML = ''; $('ldbars').innerHTML = ''; $('cdlg').classList.add('hidden'); $('credits').classList.add('hidden'); } },
});

/* ---------- The sky: cracks, the Black Sun, the dawn ---------- */
const CRACKS = (() => {
  const r = mulberry32(77), segs = [];
  for (let k = 0; k < 7; k++) {
    let x = 0.15 + r() * 0.7, y = 0;
    for (let i = 0; i < 9; i++) {
      const nx = x + (r() - 0.5) * 0.12, ny = y + 0.04 + r() * 0.05;
      segs.push([x, y, nx, ny, k]);
      if (r() < 0.3) segs.push([nx, ny, nx + (r() - 0.5) * 0.2, ny + 0.05 + r() * 0.06, k]);
      x = nx; y = ny;
    }
  }
  return segs;
})();
function drawSky(sk) {
  const top = Math.round(H * 0.46);
  if (sk.crack > 0 || sk.sun > 0 || sk.eye > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, top);
    g.addColorStop(0, `rgba(4,2,10,${0.85})`); g.addColorStop(1, 'rgba(4,2,10,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, top);
  }
  const now = performance.now() / 1000;
  if (sk.sun > 0) {
    const cx = W / 2, cy = Math.round(H * 0.13), R = sk.sun * H * 0.3;
    for (let i = 5; i >= 1; i--) { ctx.globalAlpha = 0.07 * sk.sun; pxDisc(cx, cy, R + i * 7, i % 2 ? '#e8742c' : '#ffd35a', 1); }
    ctx.globalAlpha = 1; pxDisc(cx, cy, R + 2, '#e8742c', 1); pxDisc(cx, cy, R, '#030208', 1);
    ctx.fillStyle = '#ffd35a';
    for (let i = 0; i < 28; i++) { const a = i / 28 * TAU + now * 0.2, rr = R + 4 + (i % 3) * 3 + Math.sin(now * 3 + i) * 2; ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 2); }
  }
  if (sk.crack > 0) {
    for (const [x1, y1, x2, y2, k] of CRACKS) {
      if (y1 / 0.6 > sk.crack) continue;
      ctx.globalAlpha = 0.55 + Math.sin(now * 5 + k) * 0.25;
      pxLine(x1 * W, y1 * H * 1.4, x2 * W, y2 * H * 1.4, '#e27bf0', 1);
      ctx.globalAlpha = 0.9; pxLine(x1 * W, y1 * H * 1.4, x2 * W, y2 * H * 1.4, '#fff3b0', 1);
    }
    ctx.globalAlpha = 1;
  }
  if (sk.eye > 0) {   // something enormous moves behind the cracks
    const cx = W / 2, cy = Math.round(H * 0.17), R = sk.eye * H * 0.2;
    ctx.globalAlpha = 0.85 * sk.eye; pxDisc(cx, cy, R, '#14081f', 0.7); pxDisc(cx, cy, R * 0.55, '#e27bf0', 0.7); pxDisc(cx, cy, R * 0.22, '#030208', 0.9);
    ctx.globalAlpha = 1;
  }
}
