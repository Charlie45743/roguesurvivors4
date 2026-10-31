'use strict';
/* Boss feel: every attack now has a wind-up pose, and the ground and air react to it.
   - poseOf(b) turns a boss's wind-up / strike state into numbers every rig can animate with (arms up, crouch, jaw open, glow).
   - tell() and strike() throw dust, debris, embers and motes around the boss while it gathers and when it lets go.
   - Hazards leave craters, fissures and a spray of debris when they land (see the hazard hooks below). */

const BossFx = (() => {
  const ENVS = {
    bone: { dust: ['#a59cc4', '#5e557f', '#f2eee6'], chunk: ['#f2eee6', '#b5b2c4', '#a59cc4'], glow: '#8ff0ff', crater: '#14121f', rim: '#36304f', crack: '#0b0a12' },
    spore: { dust: ['#2f6b3a', '#4fa04a', '#a6e05a'], chunk: ['#1f4d33', '#4fa04a', '#a6e05a'], glow: '#a6e05a', crater: '#0e1f16', rim: '#1f4d33', crack: '#0b0a12' },
    ember: { dust: ['#5e557f', '#36304f', '#e8742c'], chunk: ['#e8742c', '#ffd35a', '#36304f'], glow: '#ffd35a', crater: '#1a0a0e', rim: '#7a1a2a', crack: '#0b0a12', hot: '#e8742c' },
    lava: { dust: ['#36304f', '#5e557f', '#e8742c'], chunk: ['#2a2538', '#e8742c', '#ffd35a'], glow: '#ffd35a', crater: '#150c10', rim: '#36304f', crack: '#0b0a12', hot: '#ff8a3c' },
    frost: { dust: ['#c9f7ff', '#8ff0ff', '#f2eee6'], chunk: ['#8ff0ff', '#c9f7ff', '#3f8ee0'], glow: '#c9f7ff', crater: '#1d3d7a', rim: '#8ff0ff', crack: '#3f8ee0' },
    void: { dust: ['#4a2470', '#9a4fd0', '#e27bf0'], chunk: ['#9a4fd0', '#e27bf0', '#4a2470'], glow: '#e27bf0', crater: '#0e0818', rim: '#4a2470', crack: '#e27bf0' },
    water: { dust: ['#c9f7ff', '#3f8ee0', '#8ff0ff'], chunk: ['#3f8ee0', '#c9f7ff', '#1d3d7a'], glow: '#c9f7ff', crater: '#10294f', rim: '#3f8ee0', crack: '#8ff0ff' },
    grave: { dust: ['#5a3a28', '#9a6a42', '#36304f'], chunk: ['#5a3a28', '#9a6a42', '#a6e05a'], glow: '#a6e05a', crater: '#1a120c', rim: '#5a3a28', crack: '#0b0a12' },
    dust: { dust: ['#9a6a42', '#5a3a28', '#b5b2c4'], chunk: ['#5a3a28', '#9a6a42', '#6d6a7c'], glow: '#ffd35a', crater: '#1a120c', rim: '#5a3a28', crack: '#0b0a12' },
    light: { dust: ['#ffd35a', '#fff3b0', '#e8742c'], chunk: ['#ffd35a', '#fff3b0', '#0b0a12'], glow: '#fff3b0', crater: '#14101a', rim: '#ffd35a', crack: '#ffd35a', hot: '#ffd35a' },
    blood: { dust: ['#7a1a2a', '#d8354a', '#36304f'], chunk: ['#7a1a2a', '#d8354a', '#ffd35a'], glow: '#ff6a3c', crater: '#14060a', rim: '#7a1a2a', crack: '#0b0a12', hot: '#d8354a' },
  };
  const envOf = b => (b && b.def && ENVS[b.def.env]) || ENVS.dust;

  /* ---------- Poses ---------- */
  // Numbers every rig animates with: up (arms/weapon raised, negative = swung down), sq (crouch, negative = stretched),
  // open (mouth or head thrown back), glow (energy gathering). WIND grows while the boss gathers; STRIKE snaps in and fades.
  const WIND = {
    raise: { up: 1 }, slam: { up: 1, sq: -0.15 }, throw: { up: 0.8, sq: 0.2 }, rear: { up: 0.6, open: 0.7 }, crouch: { sq: 1 },
    inhale: { open: 1, up: 0.3 }, roar: { open: 1, up: 0.5, sq: -0.2 }, charge: { glow: 1, up: 0.5 }, cast: { glow: 0.8, up: 0.7 }, stomp: { up: 0.7, sq: 0.2 },
  };
  const STRIKE = {
    raise: { up: -0.4, glow: 0.6 }, slam: { up: -1, sq: 0.7 }, throw: { up: -0.7, sq: -0.1 }, rear: { up: -0.3, open: 1 }, crouch: { sq: -0.8 },
    inhale: { open: 1, glow: 1 }, roar: { open: 1, up: 0.2, glow: 0.8 }, charge: { glow: 1, up: 0.3 }, cast: { glow: 1, up: -0.2 }, stomp: { up: -0.8, sq: 0.8 },
  };
  function poseOf(b) {
    const goal = { up: 0, sq: 0, open: 0, glow: 0 }, tl = b.tell, st = b.strike;
    let w = 0, s = 0, name = null;
    if (tl) {
      w = clamp(tl.t / tl.dur, 0, 1); name = tl.pose;
      const e = w * w * (3 - 2 * w), v = WIND[tl.pose] || {};
      for (const k in v) goal[k] = v[k] * e;
      w = e;
    } else if (st) {
      s = clamp(1 - st.t / st.dur, 0, 1); name = st.pose;
      const v = STRIKE[st.pose] || {};
      for (const k in v) goal[k] = v[k] * s;
    }
    // Smooth toward the goal so releases swing instead of teleporting
    const now = performance.now(), dt = Math.min(0.1, (now - (b._pt || now)) / 1000), k = 1 - Math.exp(-dt * (st && !tl ? 34 : 14));
    b._pt = now;
    const cur = b._pz || (b._pz = { up: 0, sq: 0, open: 0, glow: 0 });
    for (const key in goal) cur[key] += (goal[key] - cur[key]) * k;
    return { up: cur.up, sq: cur.sq, open: cur.open, glow: cur.glow, w, s, name };
  }

  /* ---------- Particles ---------- */
  const near = (x, y, m = 160) => x > camX - m && x < camX + W + m && y > camY - m && y < camY + H + m;
  const dust = (x, y, env, n, spd = 1, up = 1) => {
    for (let i = 0; i < n; i++) addPart(x, y, rand(-45, 45) * spd, rand(-45, -10) * up, rand(0.4, 0.85), pick(env.dust), Math.random() < 0.3 ? 2 : 1, 40, 3);
  };
  const foot = b => b.y + (b.def.foot ?? b.r * 0.8);

  function tell(b, dt) {
    const tl = b.tell, p = poseOf(b), env = envOf(b), w = p.w, r = b.r, fy = foot(b);
    G.shake = Math.max(G.shake, w * 1.5);
    if (!near(b.x, b.y, 220)) return;
    const mx = b.x + b.dir * r * 0.5, my = b.y - r * 0.5;
    if (['raise', 'slam', 'throw', 'stomp', 'rear'].includes(tl.pose)) {
      if (Math.random() < dt * (14 + 46 * w)) dust(b.x + rand(-1.3, 1.3) * r, fy + rand(-2, 2), env, 1);
      if (Math.random() < dt * 18 * w) addPart(b.x + rand(-1.6, 1.6) * r, fy, rand(-6, 6), rand(-60, -28), rand(0.5, 0.9), pick(env.chunk), 2, 0, 2);
      if (env.hot && Math.random() < dt * 24 * w) addPart(b.x + rand(-1.2, 1.2) * r, fy - 6, rand(-8, 8), rand(-70, -35), rand(0.5, 1), pick(['#ffd35a', '#e8742c']), 1, 0, 1.5);
    } else if (tl.pose === 'crouch') {
      if (Math.random() < dt * (24 + 50 * w)) { const s = Math.random() < 0.5 ? -1 : 1; addPart(b.x + s * r * 0.8, fy, s * rand(30, 90) * (0.4 + w), rand(-26, -4), rand(0.35, 0.7), pick(env.dust), 1 + (Math.random() < 0.3), 30, 3); }
      if (Math.random() < dt * 12 * w) G.fx.push({ k: 'pop', x: b.x + rand(-r, r), y: fy, t: 0, dur: 0.2, r: 6 + 10 * w });
    } else if (tl.pose === 'inhale' || tl.pose === 'charge' || tl.pose === 'cast') {
      if (Math.random() < dt * (30 + 80 * w)) {
        const a = rand(0, TAU), rr = rand(50, 130) * (1.1 - w * 0.3);
        const col = tl.pose === 'inhale' && env.hot ? pick(['#ffd35a', '#e8742c', '#f2eee6']) : pick([env.glow, b.def.color, '#f2eee6']);
        addPart(mx + Math.cos(a) * rr, my + Math.sin(a) * rr * 0.65, -Math.cos(a) * rr * 2.2, -Math.sin(a) * rr * 1.4, 0.45, col, Math.random() < 0.3 ? 2 : 1, 0, 0.3);
      }
      tl.ringT = (tl.ringT || 0) - dt;
      if (tl.ringT <= 0) { tl.ringT = 0.22; G.fx.push({ k: 'ring', x: mx, y: my, t: 0, dur: 0.4, r: 26 + 22 * w, c: env.glow, rev: true }); }
    } else if (tl.pose === 'roar') {
      tl.ringT = (tl.ringT || 0) - dt;
      if (tl.ringT <= 0) { tl.ringT = 0.18; G.fx.push({ k: 'ring', x: b.x, y: b.y - 4, t: 0, dur: 0.5, r: 36 + 70 * w, c: env.glow }); }
      if (Math.random() < dt * 40 * w) dust(b.x + rand(-1.5, 1.5) * r, fy, env, 1, 1.5);
    }
  }
  function strike(b, pose) {
    const env = envOf(b), r = b.r, fy = foot(b);
    if (!near(b.x, b.y, 220)) return;
    if (['slam', 'stomp', 'raise', 'throw'].includes(pose)) {
      G.shake = Math.max(G.shake, pose === 'slam' || pose === 'stomp' ? 5 : 3);
      for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; addPart(b.x + Math.cos(a) * r * 0.8, fy + Math.sin(a) * r * 0.35, Math.cos(a) * rand(50, 110), Math.sin(a) * rand(25, 55) - 8, rand(0.35, 0.65), pick(env.dust), 2, 40, 3); }
      if (pose === 'slam' || pose === 'stomp') addDecal(b.x, fy, { kind: 'crater', r: r * 0.9, env, life: 5 });
    } else if (pose === 'roar') {
      G.shake = Math.max(G.shake, 5);
      for (let i = 0; i < 3; i++) G.fx.push({ k: 'ring', x: b.x, y: b.y - 4, t: -i * 0.08, dur: 0.55, r: 60 + i * 28, c: env.glow });
      dust(b.x, fy, env, 18, 2);
    } else if (pose === 'crouch') {
      dust(b.x - b.dir * r, fy, env, 16, 2.2, 0.6);
      for (let i = 0; i < 6; i++) addPart(b.x - b.dir * r, fy - rand(0, 10), -b.dir * rand(60, 140), rand(-14, 4), 0.4, pick(env.dust), 2, 0, 4);
    } else if (pose === 'inhale') {
      G.shake = Math.max(G.shake, 3);
      for (let i = 0; i < 18; i++) addPart(b.x + b.dir * r, b.y - r * 0.4, b.dir * rand(60, 190), rand(-30, 30), rand(0.3, 0.6), pick(env.hot ? ['#ffd35a', '#e8742c', '#f2eee6'] : [env.glow, '#f2eee6']), 2, 0, 3);
    } else {   // charge, cast, rear
      G.fx.push({ k: 'ring', x: b.x, y: b.y - 6, t: 0, dur: 0.45, r: 54, c: env.glow });
      for (let i = 0; i < 12; i++) { const a = rand(0, TAU); addPart(b.x, b.y - 8, Math.cos(a) * rand(40, 120), Math.sin(a) * rand(30, 80), 0.45, pick([env.glow, b.def.color]), 2, 0, 3); }
    }
  }

  /* ---------- Decals: craters and fissures left in the ground ---------- */
  function addDecal(x, y, o) {
    G.decals = G.decals || [];
    if (G.decals.length > 44) G.decals.shift();
    const d = { x, y, t: 0, life: 6, ...o };
    if (d.kind === 'crater') d.cracks = Array.from({ length: 5 + (d.r > 24 ? 3 : 0) }, (_, i) => [i / 6 * TAU + rand(-0.4, 0.4), d.r * rand(0.5, 1.1)]);
    else if (d.kind === 'fissure') {
      d.pts = []; const n = Math.max(2, Math.ceil(d.len / 9));
      for (let i = 0; i <= n; i++) { const k = i / n; d.pts.push([d.x + Math.cos(d.ang) * d.len * k + (i && i < n ? rand(-2.5, 2.5) : 0), d.y + Math.sin(d.ang) * d.len * k + (i && i < n ? rand(-2.5, 2.5) : 0)]); }
    }
    G.decals.push(d);
  }
  function drawDecals() {
    for (const d of G.decals || []) {
      const a = Math.min(1, (d.life - d.t) / 1.6), env = d.env, heat = env.hot ? Math.max(0, 1 - d.t / 3.2) : 0;
      if (d.kind === 'crater') {
        const sx = d.x - camX, sy = d.y - camY;
        if (sx < -60 || sx > W + 60 || sy < -40 || sy > H + 40) continue;
        ctx.globalAlpha = a * 0.6; pxDisc(sx, sy, d.r, env.crater, 0.55);
        ctx.globalAlpha = a * 0.9; ringOval(sx, sy, d.r, env.rim, 0.55, 1);
        for (const [ang, len] of d.cracks) pxLine(sx + Math.cos(ang) * d.r * 0.3, sy + Math.sin(ang) * d.r * 0.17, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len * 0.55, heat > 0.05 ? env.hot : env.crack, 1);
        if (heat > 0.05) { ctx.globalAlpha = a * heat * 0.5; pxDisc(sx, sy, d.r * 0.5, env.hot, 0.55); glowAt(d.x, d.y, d.r * 0.9, env.hot, 0.25 * heat); }
      } else {
        for (let i = 1; i < d.pts.length; i++) {
          const [ax, ay] = d.pts[i - 1], [bx, by] = d.pts[i];
          ctx.globalAlpha = a * 0.85; pxLine(ax - camX, ay - camY, bx - camX, by - camY, env.crater, 3);
          ctx.globalAlpha = a; pxLine(ax - camX, ay - camY, bx - camX, by - camY, heat > 0.05 ? env.hot : env.crack, 1);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Hooks ---------- */
  Mods.add({
    newRun() { G.decals = []; },
    update(dt) {
      if (!G.decals) return;
      for (const d of G.decals) d.t += dt;
      if (G.decals.some(d => d.t >= d.life)) G.decals = G.decals.filter(d => d.t < d.life);
    },
    drawGround(now) {
      drawDecals();
      // The ground draws in as a boss gathers itself: a closing ring and cracks reaching out from its feet
      for (const e of G.enemies) {
        if (!e.boss || !e.tell || e.dead) continue;
        const w = Math.min(1, e.tell.t / e.tell.dur), env = envOf(e), sx = e.x - camX, sy = foot(e) - camY;
        ctx.globalAlpha = 0.25 + w * 0.5;
        ringOval(sx, sy, (e.r * 3 + 30) * (1 - w * 0.65), env.glow, 0.5, 1);
        ctx.globalAlpha = w * 0.8;
        for (let k = 0; k < 6; k++) { const a = (k / 6 + (e.id % 7) / 40) * TAU, l0 = e.r * 0.6, l1 = e.r * (0.9 + w * 1.7); pxLine(sx + Math.cos(a) * l0, sy + Math.sin(a) * l0 * 0.5, sx + Math.cos(a) * l1, sy + Math.sin(a) * l1 * 0.5, env.hot || env.glow, 1); }
        ctx.globalAlpha = 1;
      }
    },
    hazardWarn(h, dt) {
      if (!near(h.x, h.y, 80)) return;
      const env = h.src ? envOf(h.src) : ENVS.dust;
      if (h.k === 'circle' && Math.random() < dt * Math.min(40, 4 + h.r * 0.4)) {
        const a = rand(0, TAU);
        addPart(h.x + Math.cos(a) * h.r * rand(0.6, 1), h.y + Math.sin(a) * h.r * 0.55 * rand(0.6, 1), rand(-4, 4), rand(-48, -24), rand(0.4, 0.7), pick([env.glow, h.color]), 1, 0, 1.2);
      } else if ((h.k === 'line' || h.k === 'beam') && h.len && Math.random() < dt * 30) {
        const k = Math.random(), x = h.x + Math.cos(h.ang) * h.len * k, y = h.y + Math.sin(h.ang) * h.len * k;
        addPart(x, y, rand(-6, 6), rand(-40, -16), rand(0.3, 0.6), pick([env.glow, h.color]), 1, 0, 1.5);
      }
    },
    hazardTick(h, dt) {
      if (!near(h.x, h.y, 220)) return;
      const env = h.src ? envOf(h.src) : ENVS.dust;
      if (h.k === 'ring') {
        const n = Math.min(4, Math.ceil(dt * h.cur * 0.7));
        for (let i = 0; i < n; i++) {
          const a = rand(0, TAU), x = h.x + Math.cos(a) * h.cur, y = h.y + Math.sin(a) * h.cur * 0.62;
          addPart(x, y, Math.cos(a) * 12, rand(-50, -18), rand(0.3, 0.6), pick(i % 2 ? env.dust : env.chunk), Math.random() < 0.3 ? 2 : 1, 80, 2);
        }
      } else if (h.k === 'cone') {
        if (Math.random() < dt * 60) { const a = h.ang + rand(-h.spread / 2, h.spread / 2), r0 = rand(10, h.len * 0.6); addPart(h.x + Math.cos(a) * r0, h.y + Math.sin(a) * r0 * 0.75, Math.cos(a) * rand(90, 190), Math.sin(a) * rand(60, 140) - 10, rand(0.25, 0.5), pick(env.hot ? ['#ffd35a', '#e8742c', '#f2eee6'] : [env.glow, '#f2eee6', h.color]), 2, 0, 3); }
      } else if (h.k === 'beam' || (h.k === 'line' && h.dmg)) {
        if (Math.random() < dt * 45) { const k = Math.random(), x = h.x + Math.cos(h.ang) * h.len * k, y = h.y + Math.sin(h.ang) * h.len * k; addPart(x, y, rand(-30, 30), rand(-50, -10), rand(0.25, 0.5), pick([h.liveColor || '#fff3b0', env.glow, h.color]), 1 + (Math.random() < 0.3), 60, 3); }
      }
    },
    hazardLive(h) {
      if (!near(h.x, h.y, 220)) return;
      const env = h.src ? envOf(h.src) : ENVS.dust;
      if (h.k === 'circle') {
        const n = clamp(Math.round(h.r * 0.55), 6, 28), power = 40 + h.r * 1.6 + (h.boom || 0) * 6;
        for (let i = 0; i < n; i++) {
          const a = rand(0, TAU), sp = rand(0.4, 1) * power;
          addPart(h.x + Math.cos(a) * h.r * 0.3, h.y + Math.sin(a) * h.r * 0.2, Math.cos(a) * sp, Math.sin(a) * sp * 0.55 - rand(30, 100) * (0.5 + (h.boom || 0) * 0.08), rand(0.35, 0.8), pick(i % 3 ? env.dust : env.chunk), i % 4 ? 1 : 2, 240, 2.2);
        }
        G.fx.push({ k: 'ring', x: h.x, y: h.y, t: 0, dur: 0.35, r: h.r * 1.25, c: env.glow });
        if (h.dmg > 0 && !h.tick && h.r >= 14) addDecal(h.x, h.y, { kind: 'crater', r: h.r * 0.85, env, life: h.r > 24 ? 6 : 4 });
      } else if (h.k === 'line' && h.dmg > 0) {
        addDecal(h.x, h.y, { kind: 'fissure', ang: h.ang, len: h.len, env, life: 5 });
        for (let s = 0; s < h.len; s += 11) {
          const x = h.x + Math.cos(h.ang) * s, y = h.y + Math.sin(h.ang) * s;
          for (let i = 0; i < 2; i++) addPart(x + rand(-3, 3), y + rand(-3, 3), rand(-30, 30), rand(-90, -30), rand(0.3, 0.7), pick(env.chunk), 1 + (Math.random() < 0.3), 220, 2);
        }
      }
    },
  });

  /* ---------- Wiring to the bosses ---------- */
  // [pose, wind-up seconds] for every attack of every boss
  const POSES = {
    colossus: { ring: ['roar', 0.7], slam: ['slam', 0.8], boom: ['throw', 0.6], raise: ['raise', 0.7], wave: ['stomp', 0.7] },
    mother: { spit: ['rear', 0.6], birth: ['roar', 0.7], leap: ['crouch', 0.6], spiral: ['cast', 0.7] },
    maw: { breath: ['inhale', 0.8], meteor: ['roar', 0.8], dash: ['crouch', 0.55], flame: ['inhale', 0.8], burst: ['roar', 0.6], cross: ['charge', 0.9] },
    wyrm: { icicles: ['roar', 0.6], breath: ['inhale', 0.7], burrow: ['crouch', 0.5], shards: ['rear', 0.5] },
    titan: { cracks: ['slam', 0.8], mortar: ['rear', 0.6], wave: ['stomp', 0.7], charge: ['crouch', 0.6], imps: ['roar', 0.7] },
    watcher: { laser: ['charge', 0.9], blink: ['cast', 0.6], gaze: ['cast', 0.7], pull: ['charge', 0.8], eyes: ['roar', 0.7] },
    leviathan: { tentacles: ['raise', 0.7], spit: ['rear', 0.6], whirl: ['roar', 0.7], flood: ['raise', 0.7] },
    herald: { feathers: ['cast', 0.6], swords: ['raise', 0.7], hole: ['charge', 0.8], dash: ['crouch', 0.5], eclipse: ['charge', 0.9] },
    gravekeeper: { dig: ['slam', 0.7], swing: ['throw', 0.55], lantern: ['cast', 0.6] },
    chief: { knives: ['throw', 0.5], dash: ['crouch', 0.5], rally: ['roar', 0.6] },
    brute: { slam: ['slam', 0.75], charge: ['crouch', 0.55], wave: ['stomp', 0.65] },
    champion: { dash: ['crouch', 0.5], arc: ['raise', 0.6], ring: ['cast', 0.6] },
    archfiend: { breath: ['inhale', 0.8], cross: ['charge', 0.9], rain: ['cast', 0.7], imps: ['roar', 0.7] },
  };
  const ENV_OF = { colossus: 'bone', mother: 'spore', maw: 'ember', wyrm: 'frost', titan: 'lava', watcher: 'void', leviathan: 'water', herald: 'light',
    gravekeeper: 'grave', chief: 'dust', brute: 'dust', champion: 'void', archfiend: 'blood' };
  for (const id in POSES) {
    const def = BOSS_DEFS[id];
    def.env = ENV_OF[id];
    for (const a of def.attacks) if (POSES[id][a.id]) [a.pose, a.wind] = POSES[id][a.id];
  }

  return { ENVS, envOf, poseOf, tell, strike, addDecal, dust, near, foot };
})();
