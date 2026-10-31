'use strict';
/* Bosses: every attack is a script of timed actions; danger is telegraphed by hazards
   (circles, lines, cones, expanding rings, sweeping beams) before it lands. */

/* ---------- Hazards ---------- */
// k: circle | line | cone | ring | beam. Warns for `warn` seconds, then is live for `life` seconds.
function hz(o) {
  const h = { t: 0, warn: 0.8, life: 0.25, dmg: 20, color: '#d8354a', hit: new Set(), ...o };
  G.hazards.push(h);
  return h;
}
function inHazard(h, x, y) {
  const dx = x - h.x, dy = y - h.y;
  if (h.k === 'circle') return dx * dx + dy * dy < h.r * h.r;
  if (h.k === 'ring') { const d = Math.hypot(dx, dy); return Math.abs(d - h.cur) < (h.w || 8) / 2; }
  if (h.k === 'cone') {
    const d = Math.hypot(dx, dy);
    if (d > h.len) return false;
    const da = Math.atan2(dy, dx) - h.ang;
    return Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) < h.spread / 2;
  }
  // line / beam: distance to segment
  const ex = Math.cos(h.ang) * h.len, ey = Math.sin(h.ang) * h.len;
  const t = clamp((dx * ex + dy * ey) / (h.len * h.len), 0, 1);
  return Math.hypot(dx - ex * t, dy - ey * t) < (h.w || 8) / 2;
}
function updateHazards(dt) {
  for (const h of G.hazards) {
    h.t += dt;
    if (h.follow) { h.x = h.follow.x; h.y = h.follow.y; }
    if (h.spin) h.ang += h.spin * dt;
    const live = h.t >= h.warn;
    if (h.k === 'ring') h.cur = live ? h.r0 + (h.r - h.r0) * Math.min(1, (h.t - h.warn) / h.life) : h.r0;
    if (!live) continue;
    if (!h.boomed) {
      h.boomed = true;
      if (h.onLive) h.onLive(h);
      if (h.boom) { G.shake = Math.max(G.shake, h.boom); Snd.play('boom'); burst(h.x, h.y, h.color, 10, 90); }
    }
    h.tk = h.tk || {};
    for (const pl of G.players) {
      if (pl.down || (!h.tick && h.hit.has(pl.id))) continue;
      h.tk[pl.id] = (h.tk[pl.id] || 0) - dt;
      if (h.tick && h.tk[pl.id] > 0) continue;
      if (h.dmg && inHazard(h, pl.x, pl.y + 4)) {
        h.hit.add(pl.id);
        h.tk[pl.id] = h.tick || 0;
        hurtPlayer(h.dmg, pl);
      }
    }
  }
  G.hazards = G.hazards.filter(h => h.t < h.warn + h.life);
}
function drawHazards(now) {
  for (const h of G.hazards) {
    const live = h.t >= h.warn, k = Math.min(1, h.t / h.warn);
    const sx = h.x - camX, sy = h.y - camY;
    const pulse = 0.35 + Math.sin(now * 18) * 0.15;
    if (h.k === 'circle') {
      if (!live) {
        ctx.globalAlpha = 0.18 + k * 0.25; pxDisc(sx, sy, h.r * (0.4 + 0.6 * k), h.color, h.squash || 0.62);
        ctx.globalAlpha = pulse + 0.3; ringOval(sx, sy, h.r, h.color, h.squash || 0.62);
      } else { ctx.globalAlpha = 0.6 * (1 - (h.t - h.warn) / h.life); pxDisc(sx, sy, h.r, h.liveColor || '#fff3b0', h.squash || 0.62); }
    } else if (h.k === 'ring') {
      ctx.globalAlpha = live ? 0.9 : pulse;
      ringOval(sx, sy, h.cur, live ? (h.liveColor || '#fff3b0') : h.color, 0.62, live ? 3 : 1);
    } else if (h.k === 'cone') {
      ctx.globalAlpha = live ? 0.55 : 0.12 + k * 0.2;
      ctx.fillStyle = live ? (h.liveColor || '#ffd35a') : h.color;
      for (let r = 6; r < h.len; r += 3) for (let a = -h.spread / 2; a < h.spread / 2; a += 2.4 / r)
        ctx.fillRect(Math.round(sx + Math.cos(h.ang + a) * r), Math.round(sy + Math.sin(h.ang + a) * r * 0.75), 2, 2);
    } else {
      const ex = sx + Math.cos(h.ang) * h.len, ey = sy + Math.sin(h.ang) * h.len;
      if (!live) { ctx.globalAlpha = pulse + 0.2; pxLine(sx, sy, ex, ey, h.color, 1); }
      else {
        ctx.globalAlpha = 0.85; pxLine(sx, sy, ex, ey, h.color, Math.max(3, h.w | 0));
        ctx.globalAlpha = 1; pxLine(sx, sy, ex, ey, h.liveColor || '#fff3b0', Math.max(1, (h.w | 0) - 4));
        for (let i = 0; i < 6; i++) light(h.x + Math.cos(h.ang) * h.len * i / 6, h.y + Math.sin(h.ang) * h.len * i / 6, 28, 0.6);
      }
    }
    ctx.globalAlpha = 1;
  }
}
function ringOval(cx, cy, r, color, squash = 0.62, thick = 1) {
  ctx.fillStyle = color;
  const n = Math.max(16, Math.ceil(TAU * r));
  for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * squash), thick, thick); }
}

/* ---------- Bullets with style ---------- */
function shoot(x, y, ang, spd, o = {}) {
  const b = { x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 3, life: 7, dmg: 12, c: '#e27bf0', ...o };
  if (o.style) b.draw = drawStyledBullet;
  G.bullets.push(b);
  return b;
}
function drawStyledBullet(b) {
  const sx = Math.round(b.x - camX), sy = Math.round(b.y - camY), a = Math.atan2(b.vy, b.vx);
  if (b.style === 'bone' || b.style === 'feather' || b.style === 'shard' || b.style === 'knife') {
    const len = b.style === 'feather' ? 7 : 6, col = { bone: '#f2eee6', feather: '#0b0a12', shard: '#8ff0ff', knife: '#b5b2c4' }[b.style];
    pxLine(sx, sy, sx - Math.cos(a) * len, sy - Math.sin(a) * len, b.style === 'feather' ? '#4a2470' : '#0b0a12', 3);
    pxLine(sx, sy, sx - Math.cos(a) * len, sy - Math.sin(a) * len, col, 1);
    if (b.style === 'feather') { ctx.fillStyle = '#e27bf0'; ctx.fillRect(sx, sy, 1, 1); }
  } else if (b.style === 'boomerang') {
    const s = SPR.glaive; ctx.save(); ctx.translate(sx, sy); ctx.rotate(performance.now() / 60); ctx.drawImage(s.c, -6, -6, 12, 12); ctx.restore();
  } else if (b.style === 'glob') {
    const z = b.z || 0;
    pxDisc(sx, sy + z * 0, 2, 'rgba(0,0,0,0.3)', 0.5);
    ctx.fillStyle = '#4fa04a'; ctx.fillRect(sx - 2, sy - 2 - z, 5, 5); ctx.fillStyle = '#a6e05a'; ctx.fillRect(sx - 1, sy - 2 - z, 2, 2);
  } else {
    const r = b.r;
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(sx - r - 1, sy - r, r * 2 + 3, r * 2 + 1); ctx.fillRect(sx - r, sy - r - 1, r * 2 + 1, r * 2 + 3);
    ctx.fillStyle = b.c; ctx.fillRect(sx - r, sy - r, r * 2 + 1, r * 2 + 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 1, 1);
  }
  light(b.x, b.y, 14, 0.5); glowAt(b.x, b.y, 9, b.c, 0.45);
}

/* ---------- Boss framework ---------- */
const sched = (b, delay, fn) => b.queue.push({ at: b.clock + delay, fn });
function makeBoss(id, x, y, o = {}) {
  const def = BOSS_DEFS[id];
  // Bosses that spawn naturally in the world (minor) hit softer and have less health than the story and timed ones
  const mul = (o.hpMul || 1) * (o.minor ? 0.6 : 1), dm = (o.dmgMul || 1) * (o.minor ? 0.75 : 1);
  const e = {
    id: uid++, type: id, boss: true, def, name: def.name, x, y, r: def.r || 16, hp: def.hp * mul, maxHp: def.hp * mul,
    spd: def.spd || 40, dmg: (def.dmg || 28) * dm, xp: 0, kx: 0, ky: 0, flash: 0, slow: 0, freeze: 0, anim: 0, cd: {},
    frames: def.frames ? def.frames() : SPR.colossus, scale: def.scale || 2, d: { color: def.color, kb: 0.03, anim: 0.35 },
    dead: false, dir: 1, hh: 12, clock: 0, queue: [], nextAt: 1.6, lock: 0, phase: 0, air: 0, mul: dm,
    ai: bossBrain, drawFn: def.draw || drawSpriteBoss, onDeath: o.onDeath, minor: o.minor,
  };
  e.hh = e.frames[0].h / 2;
  G.enemies.push(e);
  if (!o.minor) {
    G.boss = e;
    $('bossname').textContent = def.name;
    $('bossbar').classList.remove('hidden');
    $('timer').classList.add('boss');
    Snd.music(2);
  }
  if (def.init) def.init(e);
  return e;
}
function bossBrain(b, dt, tp, dx, dy, d) {
  const def = b.def;
  b.clock += dt;
  b.dir = dx < 0 ? -1 : 1;
  for (let i = 0; i < b.queue.length; i++) {
    if (b.clock >= b.queue[i].at) { const q = b.queue.splice(i--, 1)[0]; q.fn(b, nearestPlayer(b.x, b.y)); }
  }
  const ph = (def.phases || []).filter(t => b.hp / b.maxHp < t).length;
  if (ph > b.phase) {
    b.phase = ph;
    G.shake = 8; G.whiteFlash = 0.4;
    banner(def.name, def.phaseLines?.[ph - 1] || 'It grows furious', def.color);
    Snd.play('warn');
    for (let i = 0; i < 3; i++) G.fx.push({ k: 'ring', x: b.x, y: b.y, t: -i * 0.1, dur: 0.5, r: 50 + i * 25, c: def.color });
  }
  const enr = 1 + b.phase * 0.25;
  if (def.move) def.move(b, dt, tp, dx, dy, d, enr);
  else if (b.lock <= b.clock && b.air <= 0) {
    b.x += dx / d * b.spd * enr * dt; b.y += dy / d * b.spd * enr * dt;
    if (d > Math.max(W, H) * 0.9) { b.x += dx / d * 220 * dt; b.y += dy / d * 220 * dt; }
  }
  if (!b.queue.length && b.clock >= b.nextAt) {
    const pool = def.attacks.filter(a => (a.phase || 0) <= b.phase && a.id !== b.last);
    const a = pick(pool.flatMap(x => Array(x.w || 1).fill(x)));
    b.last = a.id;
    a.run(b, tp, enr);
    b.nextAt = b.clock + (a.dur || 2) / enr + rand(0.4, 0.9);
  }
}
const lockFor = (b, s) => { b.lock = Math.max(b.lock, b.clock + s); };

/* ---------- Attack vocabulary ---------- */
const A = {
  ring(b, n, spd, o = {}, layers = 1, gap = 0.3) {
    for (let l = 0; l < layers; l++) sched(b, l * gap, bb => {
      const off = Math.random() * TAU;
      for (let i = 0; i < n; i++) shoot(bb.x, bb.y, off + i * TAU / n, spd, { dmg: 12 * bb.mul, ...o });
      Snd.play('bullet');
    });
  },
  fan(b, tp, n, spread, spd, o = {}, volleys = 1, gap = 0.25) {
    for (let v = 0; v < volleys; v++) sched(b, v * gap, (bb, t) => {
      const base = Math.atan2(t.y - bb.y, t.x - bb.x);
      for (let i = 0; i < n; i++) shoot(bb.x, bb.y, base + (i - (n - 1) / 2) * spread / Math.max(1, n - 1), spd, { dmg: 12 * bb.mul, ...o });
      Snd.play('bullet');
    });
  },
  spiral(b, arms, dur, spd, o = {}) {
    const steps = Math.floor(dur / 0.08);
    for (let s = 0; s < steps; s++) sched(b, s * 0.08, bb => {
      for (let k = 0; k < arms; k++) shoot(bb.x, bb.y, s * 0.31 + k * TAU / arms, spd, { dmg: 10 * bb.mul, ...o });
      if (s % 3 === 0) Snd.play('bullet');
    });
  },
  slams(b, tp, count, r, gap = 0.35, o = {}) {
    for (let i = 0; i < count; i++) sched(b, i * gap, (bb, t) => {
      hz({ k: 'circle', x: t.x + rand(-10, 10), y: t.y + 4 + rand(-8, 8), r, warn: 0.75, life: 0.2, dmg: 22 * bb.mul, boom: 3, color: bb.def.color, ...o });
    });
  },
  rain(b, tp, n, spread, r, o = {}) {
    for (let i = 0; i < n; i++) sched(b, i * 0.07, (bb, t) => {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * spread;
      hz({ k: 'circle', x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d * 0.7, r, warn: 0.9, life: 0.2, dmg: 18 * bb.mul, boom: 1, color: bb.def.color, ...o });
    });
  },
  lines(b, n, len, w, o = {}, rot = 0) {
    sched(b, 0, bb => {
      const off = rot || Math.random() * TAU;
      for (let i = 0; i < n; i++) hz({ k: 'line', x: bb.x, y: bb.y, ang: off + i * TAU / n, len, w, warn: 0.85, life: 0.3, dmg: 24 * bb.mul, color: bb.def.color, ...o });
      Snd.play('warn');
    });
    lockFor(b, 1.2);
  },
  wave(b, maxR, count = 1, o = {}) {
    for (let i = 0; i < count; i++) sched(b, i * 0.55, bb => {
      hz({ k: 'ring', x: bb.x, y: bb.y + 6, r0: 10, r: maxR, w: 10, warn: 0.5, life: 1.1, dmg: 20 * bb.mul, color: bb.def.color, ...o });
      Snd.play('nova');
    });
    lockFor(b, 0.6);
  },
  cone(b, tp, spread, len, sweeps = 1, o = {}) {
    for (let s = 0; s < sweeps; s++) sched(b, s * 0.6, (bb, t) => {
      const ang = Math.atan2(t.y - bb.y, t.x - bb.x);
      hz({ k: 'cone', x: bb.x, y: bb.y, ang, spread, len, warn: 0.6, life: 0.45, dmg: 22 * bb.mul, color: bb.def.color, tick: 0.2, ...o });
      sched(bb, 0.6, () => { for (let i = 0; i < 24; i++) { const a = ang + rand(-spread / 2, spread / 2), sp = rand(80, 200); addPart(bb.x, bb.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5, pick(['#ffd35a', '#e8742c', '#d8354a']), 2); } Snd.play('dash'); });
    });
    lockFor(b, 0.8 + sweeps * 0.6);
  },
  dash(b, tp, times = 1, speed = 320) {
    for (let i = 0; i < times; i++) sched(b, i * 1.1, (bb, t) => {
      const ang = Math.atan2(t.y - bb.y, t.x - bb.x), len = Math.min(320, Math.hypot(t.x - bb.x, t.y - bb.y) + 60);
      hz({ k: 'line', x: bb.x, y: bb.y, ang, len, w: bb.r * 1.6, warn: 0.7, life: 0.01, dmg: 0, color: bb.def.color });
      lockFor(bb, 1.0);
      sched(bb, 0.7, b3 => {
        b3.dashV = { vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: len / speed };
        Snd.play('dash'); G.shake = Math.max(G.shake, 4);
      });
    });
  },
  beam(b, beams, spin, dur, o = {}) {
    sched(b, 0, bb => {
      const off = Math.random() * TAU;
      for (let i = 0; i < beams; i++) hz({ k: 'beam', follow: bb, x: bb.x, y: bb.y, ang: off + i * TAU / beams, len: 340, w: 10, warn: 1.0, life: dur, dmg: 14 * bb.mul, tick: 0.25, spin, color: bb.def.color, ...o });
      Snd.play('warn');
    });
    lockFor(b, 1 + dur);
  },
  summon(b, types, n, r = 46) {
    sched(b, 0, bb => {
      for (let i = 0; i < n; i++) { const a = i / n * TAU; const e = spawnEnemy(pick(types), bb.x + Math.cos(a) * r, bb.y + Math.sin(a) * r); e.rise = 0.5; }
      G.fx.push({ k: 'ring', x: bb.x, y: bb.y, t: 0, dur: 0.5, r: r + 6, c: bb.def.color });
      Snd.play('nova');
    });
    lockFor(b, 0.8);
  },
  lob(b, tp, n, poolR, o = {}) {
    for (let i = 0; i < n; i++) sched(b, i * 0.12, (bb, t) => {
      const tx = t.x + rand(-60, 60), ty = t.y + rand(-45, 45), x0 = bb.x, y0 = bb.y, dur = 0.8;
      const g = shoot(x0, y0, 0, 0, { style: 'glob', c: o.c || '#a6e05a', dmg: 0, life: dur, r: 0 });
      g.upd = (q, dt) => { q.tt = (q.tt || 0) + dt; const k = q.tt / dur; q.x = x0 + (tx - x0) * k; q.y = y0 + (ty - y0) * k; q.z = Math.sin(k * Math.PI) * 40; q.vx = q.vy = 0; };
      hz({ k: 'circle', x: tx, y: ty, r: poolR, warn: dur, life: 3, tick: 0.4, dmg: 8 * bb.mul, color: o.c || '#4fa04a', liveColor: o.live || 'rgba(79,160,74,0.6)' });
    });
  },
  leap(b, tp, r) {
    sched(b, 0, (bb, t) => {
      const tx = t.x, ty = t.y;
      hz({ k: 'circle', x: tx, y: ty + 4, r, warn: 1.1, life: 0.2, dmg: 30 * bb.mul, boom: 8, color: bb.def.color });
      bb.air = 1.1; bb.leapFrom = [bb.x, bb.y]; bb.leapTo = [tx, ty]; bb.leapT = 0;
      Snd.play('dash');
    });
    lockFor(b, 1.5);
  },
  boomerangs(b, tp, n) {
    sched(b, 0, (bb, t) => {
      const base = Math.atan2(t.y - bb.y, t.x - bb.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.5, owner = bb;
        const q = shoot(bb.x, bb.y, a, 220, { style: 'boomerang', r: 5, dmg: 16 * bb.mul, life: 3.2, c: '#f2eee6' });
        q.upd = (z, dt) => { z.tt = (z.tt || 0) + dt; if (z.tt > 0.8) { const dx = owner.x - z.x, dy = owner.y - z.y, d = Math.hypot(dx, dy) || 1; z.vx += dx / d * 600 * dt; z.vy += dy / d * 600 * dt; if (d < 14 && z.tt > 1.2) z.life = 0; } };
      }
      Snd.play('slash');
    });
  },
};

// Every boss moves the same way between attacks unless it overrides `move`; this handles dashes and leaps
function bossMotion(b, dt) {
  if (b.dashV) {
    b.x += b.dashV.vx * dt; b.y += b.dashV.vy * dt; b.dashV.t -= dt;
    addPart(b.x + rand(-12, 12), b.y + rand(-12, 12), 0, 0, 0.4, b.def.color, 2);
    if (b.dashV.t <= 0) b.dashV = null;
  }
  if (b.air > 0) {
    b.air -= dt; b.leapT += dt;
    const k = Math.min(1, b.leapT / 1.1);
    b.x = b.leapFrom[0] + (b.leapTo[0] - b.leapFrom[0]) * k;
    b.y = b.leapFrom[1] + (b.leapTo[1] - b.leapFrom[1]) * k;
    b.z = Math.sin(k * Math.PI) * 70;
    if (b.air <= 0) b.z = 0;
  }
}
Mods.add({
  newRun() { G.hazards = []; },
  update(dt) {
    for (const e of G.enemies) if (e.def && !e.dead) bossMotion(e, dt);
    updateHazards(dt);
  },
  drawGround(now) { drawHazards(now); },
});

/* ---------- Drawing bosses ---------- */
function bossOutline(b, fr, x, y, w, h, now) {
  ctx.globalAlpha = 0.5 + Math.sin(now * 8) * 0.3;
  const sil = silhouette(fr, b.def.color);
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(sil, x + ox, y + oy, w, h);
  ctx.globalAlpha = 1;
}
function drawSpriteBoss(b, now) {
  const fr = b.frames[Math.floor(b.anim / 0.35) % b.frames.length], sc = b.scale;
  const breathe = 1 + Math.sin(now * 2.2) * 0.03, w = Math.round(fr.w * sc), h = Math.round(fr.h * sc * breathe);
  const z = b.z || 0;
  shadow(b.x, b.y + fr.h * sc / 2, Math.round(w * (0.7 - z / 300)));
  const x = Math.round(b.x - camX - w / 2), y = Math.round(b.y - camY - h / 2 - z) + Math.round(fr.h * sc - h);
  const flip = b.dir < 0;
  ctx.save();
  if (flip) { ctx.translate(x * 2 + w, 0); ctx.scale(-1, 1); }
  bossOutline(b, fr, x, y, w, h, now);
  ctx.drawImage(fr.c, x, y, w, h);
  if (b.flash > 0.05) { ctx.globalAlpha = 0.45; ctx.drawImage(silhouette(fr, '#ffffff'), x, y, w, h); ctx.globalAlpha = 1; }
  if (b.lock > b.clock) { ctx.globalAlpha = 0.25 + Math.sin(now * 25) * 0.15; ctx.drawImage(silhouette(fr, '#fff3b0'), x, y, w, h); ctx.globalAlpha = 1; }
  ctx.restore();
  light(b.x, b.y - z, 80, 0.8);
  glowAt(b.x, b.y - z, 30, b.def.color, 0.3);
  if (b.def.extraDraw) b.def.extraDraw(b, now);
}

// The Rotting Mother: a breathing mound of flesh covered in eyes
function drawMother(b, now) {
  const z = b.z || 0, sx = b.x - camX, sy = b.y - camY - z;
  const wob = Math.sin(now * 3) * 2, R = 30 + wob;
  shadow(b.x, b.y + 18, 60 - z / 3);
  pxDisc(sx, sy + 4, R + 2, '#0b0a12', 0.7);
  pxDisc(sx, sy + 4, R, b.flash > 0.05 ? '#f2eee6' : '#1f4d33', 0.7);
  pxDisc(sx - 4, sy, R * 0.8, '#2f6b3a', 0.65);
  pxDisc(sx - 8, sy - 4, R * 0.45, '#4fa04a', 0.6);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39 + 0.5, rr = (i % 3) * 7 + 8;
    const ex = sx + Math.cos(a) * rr * 1.2, ey = sy + Math.sin(a) * rr * 0.55;
    const tp = nearestPlayer(b.x, b.y), la = Math.atan2(tp.y - b.y, tp.x - b.x);
    const blink = Math.floor(now * 2 + i * 1.7) % 7 === 0;
    pxDisc(ex, ey, 3, '#0b0a12', 0.8);
    if (blink) { ctx.fillStyle = '#1f4d33'; ctx.fillRect(Math.round(ex - 2), Math.round(ey), 5, 1); continue; }
    pxDisc(ex, ey, 2, '#f2eee6', 0.8);
    ctx.fillStyle = b.phase ? '#d8354a' : '#ffd35a';
    ctx.fillRect(Math.round(ex + Math.cos(la)), Math.round(ey + Math.sin(la) * 0.6), 2, 2);
  }
  const mo = Math.abs(Math.sin(now * 1.5)) * 4;
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(sx - 9), Math.round(sy + 12), 18, Math.round(3 + mo));
  ctx.fillStyle = '#a6e05a';
  for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(sx - 7 + i * 5), Math.round(sy + 15 + mo + (now * 20 + i * 7) % 6), 1, 2);
  if (b.lock > b.clock) ringOval(sx, sy + 4, R + 4 + Math.sin(now * 20) * 2, '#a6e05a', 0.7);
  light(b.x, b.y - z, 90, 0.7);
  glowAt(b.x, b.y - z, 34, '#4fa04a', 0.3);
}

// Frost Wyrm: a head that swims through the snow and a long armoured body that follows its path
function wyrmInit(b) { b.trail = []; b.segs = 14; b.r = 12; b.burrow = 0; }
function wyrmMove(b, dt, tp, dx, dy, d, enr) {
  if (b.burrow > 0) {
    b.burrow -= dt;
    if (b.burrow <= 0) { b.x = b.emergeAt[0]; b.y = b.emergeAt[1]; b.harmless = false; b.trail = []; }
    return;
  }
  if (b.lock > b.clock) return;
  b.wig = (b.wig || 0) + dt * 3;
  const a = Math.atan2(dy, dx) + Math.sin(b.wig) * 0.7;
  b.x += Math.cos(a) * b.spd * 1.6 * enr * dt; b.y += Math.sin(a) * b.spd * 1.6 * enr * dt;
  b.trail.unshift([b.x, b.y]);
  if (b.trail.length > b.segs * 6) b.trail.pop();
  for (let i = 6; i < b.trail.length; i += 6) {
    const [x, y] = b.trail[i];
    for (const pl of G.players) if (!pl.down && Math.hypot(pl.x - x, pl.y - y) < 9) hurtPlayer(14 * b.mul, pl);
  }
}
function drawWyrm(b, now) {
  if (b.burrow > 0) {
    const [ex, ey] = b.emergeAt;
    for (let i = 0; i < 3; i++) addPart(ex + rand(-10, 10), ey + rand(-6, 6), rand(-20, 20), rand(-40, -10), 0.4, '#c9f7ff');
    return;
  }
  for (let i = b.trail.length - 1; i >= 6; i -= 6) {
    const [x, y] = b.trail[i], k = 1 - i / (b.segs * 6 + 6), r = Math.round(4 + k * 6);
    pxDisc(x - camX, y - camY, r + 1, '#0b0a12', 0.85);
    pxDisc(x - camX, y - camY, r, b.flash > 0.05 ? '#fff' : '#3f8ee0', 0.85);
    pxDisc(x - camX - 1, y - camY - 2, r * 0.55, '#8ff0ff', 0.7);
    ctx.fillStyle = '#c9f7ff'; ctx.fillRect(Math.round(x - camX), Math.round(y - camY - r - 2), 1, 3);
  }
  const a = b.trail.length > 6 ? Math.atan2(b.y - b.trail[6][1], b.x - b.trail[6][0]) : 0;
  const hx = b.x - camX, hy = b.y - camY;
  pxDisc(hx, hy, 12, '#0b0a12', 0.8); pxDisc(hx, hy, 11, b.flash > 0.05 ? '#fff' : '#1d3d7a', 0.8); pxDisc(hx - 2, hy - 2, 7, '#3f8ee0', 0.8);
  for (const s of [-1, 1]) {
    const ex = hx + Math.cos(a + s * 0.5) * 6, ey = hy + Math.sin(a + s * 0.5) * 4 - 2;
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(ex), Math.round(ey), 2, 2);
    pxLine(hx - Math.cos(a + s * 0.9) * 6, hy - 4, hx - Math.cos(a + s * 0.9) * 13, hy - 12, '#c9f7ff', 1);
  }
  const jaw = Math.abs(Math.sin(now * 4)) * 3 + (b.lock > b.clock ? 4 : 0);
  pxLine(hx + Math.cos(a) * 9, hy + Math.sin(a) * 6, hx + Math.cos(a) * (14 + jaw), hy + Math.sin(a) * 6 + jaw, '#0b0a12', 3);
  light(b.x, b.y, 70, 0.8); glowAt(b.x, b.y, 24, '#8ff0ff', 0.4);
}

// Cinder Titan: a hulk of basalt plates held together by magma
function drawTitan(b, now) {
  const sx = b.x - camX, sy = b.y - camY, swing = Math.sin(now * 2) * 3, lockGlow = b.lock > b.clock;
  shadow(b.x, b.y + 24, 54);
  const plate = (x, y, w, h, c) => { ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(sx + x - 1), Math.round(sy + y - 1), w + 2, h + 2); ctx.fillStyle = b.flash > 0.05 ? '#f2eee6' : c; ctx.fillRect(Math.round(sx + x), Math.round(sy + y), w, h); };
  plate(-30 - swing, -12, 12, 26, '#2a2538'); plate(18 + swing, -12, 12, 26, '#2a2538');
  plate(-34 - swing, 12, 14, 10, '#36304f'); plate(20 + swing, 12, 14, 10, '#36304f');
  plate(-18, -22, 36, 36, '#36304f'); plate(-12, -34, 24, 14, '#2a2538'); plate(-14, 14, 11, 12, '#2a2538'); plate(3, 14, 11, 12, '#2a2538');
  const heat = lockGlow ? '#fff3b0' : b.phase ? '#ffd35a' : '#e8742c';
  ctx.fillStyle = heat;
  for (const [x, y, w, h] of [[-2, -20, 2, 30], [-14, -6, 28, 2], [-8, 4, 2, 9], [8, -14, 2, 8]]) ctx.fillRect(Math.round(sx + x), Math.round(sy + y), w, h);
  ctx.fillRect(Math.round(sx - 7), Math.round(sy - 29), 4, 3); ctx.fillRect(Math.round(sx + 3), Math.round(sy - 29), 4, 3);
  if (Math.random() < 0.4) addPart(b.x + rand(-16, 16), b.y - 20, rand(-6, 6), rand(-40, -15), 0.7, pick(['#ffd35a', '#e8742c']));
  light(b.x, b.y - 10, 100, 1); glowAt(b.x, b.y - 8, 40, '#e8742c', 0.4);
}

// The Watcher: one enormous eye, ringed by writhing tentacles
function drawWatcher(b, now) {
  const sx = b.x - camX, sy = b.y - camY - 10, fade = b.blinkT > 0 ? Math.abs(Math.cos(b.blinkT * 6)) : 1;
  ctx.globalAlpha = fade;
  for (let i = 0; i < 8; i++) {
    const base = i / 8 * TAU + now * 0.4;
    let px0 = sx + Math.cos(base) * 20, py0 = sy + Math.sin(base) * 14;
    for (let s = 1; s < 9; s++) {
      const a = base + Math.sin(now * 2 + i + s * 0.6) * 0.5;
      const px1 = px0 + Math.cos(a) * 5, py1 = py0 + Math.sin(a) * 4;
      pxLine(px0, py0, px1, py1, s % 2 ? '#4a2470' : '#9a4fd0', Math.max(1, 4 - (s >> 1)));
      px0 = px1; py0 = py1;
    }
  }
  pxDisc(sx, sy, 22, '#0b0a12', 0.95); pxDisc(sx, sy, 20, b.flash > 0.05 ? '#fff' : '#f2eee6', 0.95);
  for (let i = 0; i < 7; i++) { const a = i * 0.9; pxLine(sx + Math.cos(a) * 19, sy + Math.sin(a) * 18, sx + Math.cos(a) * 12, sy + Math.sin(a) * 11, '#d8354a', 1); }
  const tp = nearestPlayer(b.x, b.y), la = Math.atan2(tp.y - b.y, tp.x - b.x);
  const ix = sx + Math.cos(la) * 7, iy = sy + Math.sin(la) * 6;
  pxDisc(ix, iy, 9, '#9a4fd0', 1); pxDisc(ix, iy, 6, '#e27bf0', 1);
  pxDisc(ix, iy, b.lock > b.clock ? 2 : 4, '#0b0a12', 1);
  ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(ix - 3), Math.round(iy - 3), 2, 2);
  ctx.globalAlpha = 1;
  light(b.x, b.y - 10, 110, 0.9); glowAt(b.x, b.y - 10, 40, '#e27bf0', 0.35);
}

// Eclipse Herald: a winged silhouette crowned by a black sun
function drawHerald(b, now) {
  const sx = b.x - camX, sy = b.y - camY - 14 + Math.sin(now * 2) * 3, flap = Math.sin(now * 5) * 0.35;
  for (const s of [-1, 1]) for (let f = 0; f < 7; f++) {
    const a = -Math.PI / 2 + s * (0.5 + f * 0.22 + flap * (f / 7)), len = 26 + f * 3;
    pxLine(sx + s * 3, sy, sx + s * 3 + Math.cos(a) * len * s * s, sy + Math.sin(a) * len * 0.8 + f * 3, f % 2 ? '#1c1a2b' : '#36304f', 2);
    if (f === 6) { ctx.fillStyle = '#e27bf0'; ctx.fillRect(Math.round(sx + s * 3 + Math.cos(a) * len), Math.round(sy + Math.sin(a) * len * 0.8 + f * 3), 1, 1); }
  }
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(sx - 5), Math.round(sy - 6), 10, 24);
  ctx.fillStyle = b.flash > 0.05 ? '#fff' : '#2a2538'; ctx.fillRect(Math.round(sx - 4), Math.round(sy - 5), 8, 22);
  ctx.fillStyle = '#f2eee6'; ctx.fillRect(Math.round(sx - 3), Math.round(sy - 12), 6, 7);
  ctx.fillStyle = '#e27bf0'; ctx.fillRect(Math.round(sx - 2), Math.round(sy - 10), 1, 1); ctx.fillRect(Math.round(sx + 1), Math.round(sy - 10), 1, 1);
  pxDisc(sx, sy - 24, 9, '#ffd35a', 1); pxDisc(sx, sy - 24, 8, '#0b0a12', 1);
  ringOval(sx, sy - 24, 11 + Math.sin(now * 6), '#fff3b0', 1);
  light(b.x, b.y - 30, 100, 1); glowAt(b.x, b.y - 38, 30, '#ffd35a', 0.5);
}

// Leviathan: a head in the surf and tentacles that crash across the island
function drawLeviathan(b, now) {
  const sx = b.x - camX, sy = b.y - camY, up = b.surf ?? 1;
  for (let i = 0; i < 3; i++) ringOval(sx, sy + 8, 26 + i * 6 + Math.sin(now * 3 + i) * 2, '#4a7c86', 0.5);
  const h = Math.round(26 * up);
  ctx.save(); ctx.beginPath(); ctx.rect(sx - 40, sy - 60, 80, 66); ctx.clip();
  pxDisc(sx, sy + 6 - h, 22, '#0b0a12', 0.9); pxDisc(sx, sy + 6 - h, 20, b.flash > 0.05 ? '#fff' : '#1d3d7a', 0.9);
  pxDisc(sx - 4, sy + 2 - h, 12, '#3f8ee0', 0.8);
  for (const s of [-1, 1]) { pxDisc(sx + s * 9, sy - h, 3, '#ffd35a', 1); ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(sx + s * 9), Math.round(sy - h - 2), 1, 4); }
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(sx - 10), Math.round(sy + 12 - h), 20, 4);
  ctx.fillStyle = '#f2eee6'; for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(sx - 9 + i * 4), Math.round(sy + 12 - h), 1, 2);
  ctx.restore();
  for (const t of b.tentacles || []) {
    const tx = t.x - camX, ty = t.y - camY, rise = Math.min(1, t.t / 0.5);
    for (let s = 0; s < 10; s++) {
      const k = s / 10, a = t.ang + Math.sin(now * 3 + s * 0.6) * 0.25 * (1 - rise * 0.5);
      const px = tx + Math.cos(a) * s * 6 * rise, py = ty + Math.sin(a) * s * 4 * rise - Math.sin(k * Math.PI) * 18 * rise;
      pxDisc(px, py, Math.max(2, 7 - s * 0.5), s % 2 ? '#1d3d7a' : '#3f8ee0', 1);
    }
  }
  light(b.x, b.y - 10, 90, 0.8); glowAt(b.x, b.y, 30, '#3f8ee0', 0.3);
}

/* ---------- The bosses ---------- */
const BOSS_DEFS = {
  colossus: {
    name: 'Bone Colossus', hp: 3200, spd: 34, r: 18, color: '#c9c2e0', scale: 2, frames: () => SPR.colossus, phases: [0.5],
    phaseLines: ['Its ribs blaze with grave-light'],
    attacks: [
      { id: 'ring', dur: 1.4, run: (b) => A.ring(b, 14 + b.phase * 6, 70, { style: 'bone', c: '#f2eee6' }, 2 + b.phase, 0.35) },
      { id: 'slam', dur: 2.2, run: (b, t) => A.slams(b, t, 3 + b.phase * 2, 30, 0.35) },
      { id: 'boom', dur: 2.6, run: (b, t) => A.boomerangs(b, t, 3 + b.phase) },
      { id: 'raise', dur: 1.2, run: (b) => A.summon(b, ['skel'], 8 + b.phase * 4, 70) },
      { id: 'wave', dur: 2, phase: 1, run: (b) => A.wave(b, 160, 2) },
    ],
    extraDraw(b, now) { if (b.phase) glowAt(b.x, b.y - 4, 18, '#8ff0ff', 0.4 + Math.sin(now * 6) * 0.2); },
  },
  mother: {
    name: 'The Rotting Mother', hp: 11000, spd: 30, r: 26, color: '#4fa04a', draw: drawMother, phases: [0.6, 0.25],
    phaseLines: ['She splits her own skin', 'Every eye opens'],
    frames: () => SPR.slime,
    attacks: [
      { id: 'spit', dur: 2, run: (b, t) => A.lob(b, t, 5 + b.phase * 2, 18) },
      { id: 'birth', dur: 1.2, run: (b) => A.summon(b, ['slime', 'slime', 'ghoul'], 8 + b.phase * 4, 40) },
      { id: 'leap', w: 2, dur: 2, run: (b, t) => { A.leap(b, t, 46); sched(b, 1.15, bb => { A.wave(bb, 140, 1); A.ring(bb, 16, 80, { c: '#a6e05a' }); }); } },
      { id: 'spiral', dur: 3, phase: 1, run: (b) => A.spiral(b, 3 + b.phase, 2.6, 75, { c: '#a6e05a' }) },
    ],
  },
  maw: {
    name: 'The Ashen Maw', hp: 32000, spd: 46, r: 18, color: '#d8354a', scale: 2, frames: () => bossFrames(null), phases: [0.66, 0.33],
    phaseLines: ['The sky burns with it', 'It swallows the last light'],
    attacks: [
      { id: 'breath', w: 2, dur: 2.4, run: (b, t) => A.cone(b, t, 0.9, 150, 2 + b.phase) },
      { id: 'meteor', dur: 2.2, run: (b, t) => A.rain(b, t, 10 + b.phase * 6, 120, 22, { color: '#e8742c' }) },
      { id: 'dash', dur: 2.4, run: (b, t) => A.dash(b, t, 1 + b.phase, 340) },
      { id: 'flame', dur: 2.4, run: (b) => A.wave(b, 190, 2 + b.phase, { liveColor: '#ffd35a' }) },
      { id: 'burst', dur: 1.6, run: (b) => A.ring(b, 22 + b.phase * 6, 72, { c: '#e8742c' }, 3, 0.4) },
      { id: 'cross', dur: 3, phase: 2, run: (b) => A.beam(b, 4, 0.7, 2.4, { color: '#e8742c', liveColor: '#ffd35a' }) },
    ],
  },
  wyrm: {
    name: 'The Frost Wyrm', hp: 9000, spd: 42, r: 12, color: '#8ff0ff', draw: drawWyrm, init: wyrmInit, move: wyrmMove, phases: [0.5],
    phaseLines: ['The blizzard answers its call'], frames: () => SPR.snowwisp,
    attacks: [
      { id: 'icicles', dur: 2, run: (b, t) => A.rain(b, t, 12 + b.phase * 6, 110, 16, { color: '#8ff0ff', liveColor: '#fff' }) },
      { id: 'breath', dur: 2.2, run: (b, t) => sched(b, 0, (bb, tt) => { const ang = Math.atan2(tt.y - bb.y, tt.x - bb.x); hz({ k: 'beam', x: bb.x, y: bb.y, follow: bb, ang, len: 260, w: 14, warn: 0.8, life: 1.2, tick: 0.25, dmg: 12 * bb.mul, spin: 0.6 * (Math.random() < 0.5 ? -1 : 1), color: '#8ff0ff', liveColor: '#fff' }); lockFor(bb, 2.1); }) },
      { id: 'burrow', dur: 2.6, run: (b, t) => sched(b, 0, (bb, tt) => {
        bb.burrow = 1.4; bb.harmless = true; bb.emergeAt = [tt.x, tt.y];
        hz({ k: 'circle', x: tt.x, y: tt.y + 4, r: 34, warn: 1.4, life: 0.25, dmg: 30 * bb.mul, boom: 8, color: '#8ff0ff', onLive: h => { for (let i = 0; i < 16; i++) shoot(h.x, h.y, i / 16 * TAU, 90, { style: 'shard', c: '#8ff0ff', dmg: 10 * bb.mul }); } });
      }) },
      { id: 'shards', dur: 1.6, run: (b, t) => A.fan(b, t, 7 + b.phase * 4, 1.2, 110, { style: 'shard', c: '#8ff0ff' }, 3, 0.3) },
    ],
  },
  titan: {
    name: 'The Cinder Titan', hp: 12000, spd: 26, r: 24, color: '#e8742c', draw: drawTitan, frames: () => SPR.golem, phases: [0.5],
    phaseLines: ['Its core cracks open'],
    attacks: [
      { id: 'cracks', w: 2, dur: 2, run: (b) => A.lines(b, 6 + b.phase * 2, 220, 14, { liveColor: '#ffd35a' }) },
      { id: 'mortar', dur: 2.2, run: (b, t) => A.lob(b, t, 6 + b.phase * 2, 20, { c: '#e8742c', live: 'rgba(232,116,44,0.6)' }) },
      { id: 'wave', dur: 2.4, run: (b) => A.wave(b, 200, 2 + b.phase, { liveColor: '#ffd35a' }) },
      { id: 'charge', dur: 2.6, run: (b, t) => A.dash(b, t, 2, 300) },
      { id: 'imps', dur: 1.2, run: (b) => A.summon(b, ['imp', 'magmaslime'], 6, 50) },
    ],
  },
  watcher: {
    name: 'The Watcher', hp: 14000, spd: 20, r: 22, color: '#e27bf0', draw: drawWatcher, frames: () => SPR.swarmeye, phases: [0.66, 0.33],
    phaseLines: ['It sees through you', 'Reality unravels'],
    move(b, dt, tp, dx, dy, d) { if (b.blinkT > 0) { b.blinkT -= dt; if (b.blinkT <= 0.6 && b.blinkTo) { b.x = b.blinkTo[0]; b.y = b.blinkTo[1]; b.blinkTo = null; } return; } if (d > 120 && b.lock <= b.clock) { b.x += dx / d * 30 * dt; b.y += dy / d * 30 * dt; } },
    attacks: [
      { id: 'laser', w: 2, dur: 3.6, run: (b) => A.beam(b, 2 + b.phase, 0.55 * (Math.random() < 0.5 ? -1 : 1), 2.6, { color: '#e27bf0', liveColor: '#fff' }) },
      { id: 'blink', dur: 1.4, run: (b, t) => sched(b, 0, (bb, tt) => { const a = Math.random() * TAU; bb.blinkT = 1.2; bb.blinkTo = [tt.x + Math.cos(a) * 130, tt.y + Math.sin(a) * 90]; Snd.play('shrine'); sched(bb, 1.3, b3 => A.ring(b3, 18, 80, { c: '#e27bf0' })); }) },
      { id: 'gaze', dur: 2, run: (b, t) => sched(b, 0, (bb) => { for (let i = 0; i < 6 + bb.phase * 2; i++) { const q = shoot(bb.x, bb.y, i / 6 * TAU, 60, { c: '#e27bf0', r: 3, life: 5, dmg: 12 * bb.mul }); q.upd = (z, dt) => { const tp = nearestPlayer(z.x, z.y), a = Math.atan2(tp.y - z.y, tp.x - z.x); z.vx += Math.cos(a) * 90 * dt; z.vy += Math.sin(a) * 90 * dt; const sp = Math.hypot(z.vx, z.vy); if (sp > 90) { z.vx *= 90 / sp; z.vy *= 90 / sp; } }; } Snd.play('bullet'); }) },
      { id: 'pull', dur: 3, run: (b) => { sched(b, 0, bb => { bb.pulling = 2.4; Snd.play('warn'); }); A.spiral(b, 4, 2.4, 70, { c: '#9a4fd0' }); } },
      { id: 'eyes', dur: 1.2, run: (b) => A.summon(b, ['swarmeye'], 8, 60) },
    ],
  },
  leviathan: {
    name: 'The Leviathan', hp: 16000, spd: 0, r: 22, color: '#3f8ee0', draw: drawLeviathan, frames: () => SPR.swarmeye, phases: [0.5],
    phaseLines: ['The sea itself rises'],
    init(b) { b.tentacles = []; b.surf = 1; b.anchored = true; },
    move(b, dt) {
      for (const t of b.tentacles) t.t += dt;
      b.tentacles = b.tentacles.filter(t => t.t < 1.6);
      b.surf += ((b.lock > b.clock ? 1 : 0.55) - b.surf) * dt * 3;
      const a = (b.orbit = (b.orbit || 0) + dt * 0.12);
      b.x = Math.cos(a) * ISLAND_R * 1.08; b.y = Math.sin(a) * ISLAND_R * 0.9;
    },
    attacks: [
      { id: 'tentacles', w: 2, dur: 2.6, run: (b) => { for (let i = 0; i < 3 + b.phase * 2; i++) sched(b, i * 0.45, bb => { const a = Math.random() * TAU, x = Math.cos(a) * ISLAND_R, y = Math.sin(a) * ISLAND_R * 0.8, ang = a + Math.PI + rand(-0.4, 0.4); hz({ k: 'line', x, y, ang, len: ISLAND_R * 1.8, w: 20, warn: 1.0, life: 0.35, dmg: 26 * bb.mul, boom: 6, color: '#3f8ee0', liveColor: '#c9f7ff', onLive: () => bb.tentacles.push({ x, y, ang, t: 0 }) }); }); } },
      { id: 'spit', dur: 2, run: (b, t) => { lockFor(b, 1.8); A.fan(b, t, 9 + b.phase * 4, 1.3, 95, { c: '#8ff0ff' }, 3, 0.4); } },
      { id: 'whirl', dur: 3, run: (b) => sched(b, 0, () => { for (let i = 0; i < 3; i++) hz({ k: 'ring', x: 0, y: 0, r0: ISLAND_R, r: 10, w: 12, warn: 0.6 + i * 0.6, life: 1.4, dmg: 18, color: '#3f8ee0', liveColor: '#c9f7ff' }); Snd.play('nova'); }) },
      { id: 'flood', dur: 2.4, phase: 1, run: (b, t) => A.rain(b, t, 14, 130, 24, { color: '#3f8ee0', liveColor: '#c9f7ff' }) },
    ],
  },
  herald: {
    name: 'The Eclipse Herald', hp: 24000, spd: 54, r: 14, color: '#ffd35a', draw: drawHerald, frames: () => SPR.wraith, phases: [0.66, 0.33],
    phaseLines: ['Its black sun widens', 'The last light goes out'],
    attacks: [
      { id: 'feathers', dur: 1.8, run: (b, t) => A.fan(b, t, 11 + b.phase * 4, 1.6, 120, { style: 'feather', c: '#e27bf0' }, 3, 0.35) },
      { id: 'swords', w: 2, dur: 2.4, run: (b, t) => sched(b, 0, (bb, tt) => { const n = 6 + bb.phase * 2; for (let i = 0; i < n; i++) { const a = i / n * TAU, x = tt.x + Math.cos(a) * 90, y = tt.y + Math.sin(a) * 70; hz({ k: 'line', x, y, ang: Math.atan2(tt.y - y, tt.x - x), len: 180, w: 8, warn: 0.9 + i * 0.05, life: 0.2, dmg: 20 * bb.mul, color: '#ffd35a', liveColor: '#fff' }); } Snd.play('warn'); }) },
      { id: 'hole', dur: 3, run: (b, t) => sched(b, 0, (bb, tt) => { hz({ k: 'circle', x: tt.x, y: tt.y, r: 40, warn: 0.6, life: 2.4, tick: 0.3, dmg: 10 * bb.mul, color: '#4a2470', liveColor: 'rgba(11,10,18,0.85)' }); bb.pulling = 2.4; bb.pullAt = [tt.x, tt.y]; }) },
      { id: 'dash', dur: 2.6, run: (b, t) => A.dash(b, t, 2 + b.phase, 380) },
      { id: 'eclipse', dur: 3.4, phase: 1, run: (b) => A.beam(b, 4 + b.phase * 2, 0.45, 2.8, { color: '#ffd35a', liveColor: '#fff' }) },
    ],
  },
  gravekeeper: {
    name: 'The Gravekeeper', hp: 1800, spd: 36, r: 14, color: '#a6e05a', scale: 2, frames: () => SPR.gravekeeper, phases: [0.5],
    attacks: [
      { id: 'dig', w: 2, dur: 2.2, run: (b, t) => { A.slams(b, t, 4, 22, 0.3, { color: '#a6e05a' }); sched(b, 1.4, bb => A.summon(bb, ['skel'], 4, 40)); } },
      { id: 'swing', dur: 1.6, run: (b, t) => A.cone(b, t, 1.6, 70, 2, { color: '#a6e05a', liveColor: '#f2eee6' }) },
      { id: 'lantern', dur: 1.8, run: (b) => A.ring(b, 12, 70, { c: '#ffd35a' }, 2, 0.4) },
    ],
  },
  chief: {
    name: 'Bandit Chief', hp: 1800, spd: 52, r: 12, color: '#ffd35a', scale: 2, frames: () => SPR.chief,
    attacks: [
      { id: 'knives', dur: 1.6, run: (b, t) => A.fan(b, t, 5, 0.7, 150, { style: 'knife', c: '#b5b2c4' }, 3, 0.3) },
      { id: 'dash', dur: 2.2, run: (b, t) => A.dash(b, t, 2, 360) },
      { id: 'rally', dur: 1.2, run: (b) => A.summon(b, ['bandit', 'archer'], 4, 40) },
    ],
  },
  stag: {
    name: 'The Dread Stag', hp: 5000, spd: 58, r: 16, color: '#8ff0ff', scale: 2, frames: () => SPR.stag, phases: [0.5],
    attacks: [
      { id: 'charge', w: 2, dur: 3.4, run: (b, t) => A.dash(b, t, 3, 380) },
      { id: 'antlers', dur: 1.6, run: (b) => A.ring(b, 18, 85, { c: '#8ff0ff', style: 'shard' }, 2, 0.4) },
      { id: 'stomp', dur: 2, run: (b) => A.wave(b, 150, 2, { color: '#8ff0ff' }) },
    ],
  },
  brute: {
    name: 'Village Brute', hp: 2000, spd: 40, r: 12, color: '#b5b2c4', scale: 2, frames: () => SPR.brute,
    attacks: [
      { id: 'slam', dur: 2, run: (b, t) => A.slams(b, t, 3, 28) },
      { id: 'charge', dur: 2.2, run: (b, t) => A.dash(b, t, 1, 320) },
      { id: 'wave', dur: 1.8, run: (b) => A.wave(b, 120, 1) },
    ],
  },
  champion: {
    name: 'The Fallen Champion', hp: 3000, spd: 44, r: 12, color: '#e27bf0', scale: 2, frames: () => SPR.armor,
    attacks: [
      { id: 'dash', dur: 2.4, run: (b, t) => A.dash(b, t, 2, 360) },
      { id: 'arc', dur: 1.8, run: (b, t) => A.cone(b, t, 1.4, 90, 2, { color: '#e27bf0' }) },
      { id: 'ring', dur: 1.4, run: (b) => A.ring(b, 16, 80, { c: '#e27bf0' }, 2) },
    ],
  },
  archfiend: {
    name: 'The Archfiend', hp: 20000, spd: 50, r: 20, color: '#d8354a', scale: 2.5, frames: () => bossFrames({ r: '1', R: 'p', y: 'm', o: 'R', Y: 'Y' }), phases: [0.5],
    attacks: [
      { id: 'breath', dur: 2.4, run: (b, t) => A.cone(b, t, 1.1, 170, 3) },
      { id: 'cross', dur: 3, run: (b) => A.beam(b, 3 + b.phase, 0.8, 2.4) },
      { id: 'rain', dur: 2, run: (b, t) => A.rain(b, t, 18, 130, 22, { color: '#d8354a' }) },
      { id: 'imps', dur: 1.2, run: (b) => A.summon(b, ['imp', 'hound'], 8, 60) },
    ],
  },
};
const ISLAND_R = 230;

// Pulls (black hole / gaze) drag players toward the boss or a point
Mods.add({
  update(dt) {
    for (const b of G.enemies) {
      if (!b.pulling || b.dead) continue;
      b.pulling -= dt;
      const [px, py] = b.pullAt || [b.x, b.y];
      for (const pl of G.players) { if (pl.down) continue; const dx = px - pl.x, dy = py - pl.y, d = Math.hypot(dx, dy) || 1; pl.x += dx / d * 42 * dt; pl.y += dy / d * 42 * dt; }
      if (Math.random() < 0.5) { const a = Math.random() * TAU; addPart(px + Math.cos(a) * 80, py + Math.sin(a) * 60, -Math.cos(a) * 80, -Math.sin(a) * 60, 0.8, '#9a4fd0'); }
      if (b.pulling <= 0) b.pullAt = null;
    }
  },
});
