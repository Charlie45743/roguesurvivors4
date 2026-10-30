'use strict';
/* Dimensions: portals tear open on the night map and lead to themed worlds, each harder than the last.
   The night's clock stops while you are away; the guardian's death opens the way home. */

Object.assign(ENEMIES, {
  wolf: { hp: 40, spd: 78, dmg: 12, xp: 3, r: 6, spr: 'wolf', anim: 0.12, color: '#c9f7ff' },
  golem: { hp: 160, spd: 28, dmg: 20, xp: 6, r: 8, spr: 'golem', anim: 0.3, color: '#8ff0ff', kb: 0.3 },
  snowwisp: { hp: 30, spd: 46, dmg: 10, xp: 3, r: 5, spr: 'snowwisp', anim: 0.2, color: '#c9f7ff', shoot: 2.8 },
  imp: { hp: 45, spd: 60, dmg: 12, xp: 4, r: 5, spr: 'imp', anim: 0.12, color: '#d8354a', shoot: 3 },
  magmaslime: { hp: 70, spd: 34, dmg: 14, xp: 4, r: 6, spr: 'magmaslime', anim: 0.28, color: '#e8742c' },
  hound: { hp: 60, spd: 84, dmg: 16, xp: 4, r: 6, spr: 'hound', anim: 0.11, color: '#d8354a' },
  crawler: { hp: 80, spd: 66, dmg: 16, xp: 5, r: 6, spr: 'crawler', anim: 0.12, color: '#9a4fd0' },
  stalker: { hp: 150, spd: 54, dmg: 20, xp: 6, r: 6, spr: 'stalker', anim: 0.2, color: '#e27bf0', kb: 0.6 },
  swarmeye: { hp: 40, spd: 50, dmg: 10, xp: 3, r: 6, spr: 'swarmeye', anim: 0.9, color: '#e27bf0', shoot: 2.6 },
  bandit: { hp: 50, spd: 46, dmg: 12, xp: 3, r: 6, spr: 'bandit', anim: 0.22, color: '#9a6a42' },
  archer: { hp: 35, spd: 36, dmg: 8, xp: 3, r: 6, spr: 'archer', anim: 0.22, color: '#2f6b3a', shoot: 2.4 },
});

/* ---------- Dimension worlds ---------- */
Object.assign(GROUNDS, {
  frozen: makeGround(301, '#b9c6d8', [['#c9d6e8', 10, 8, 16], ['#a5b4c8', 8, 5, 12], ['#dce6f2', 6, 4, 10]], ['#d4e0ee', '#9fb0c6', '#e8f0fa', '#b0bfd2'], ['#8fa2ba', '#f2f6fc']),
  rift: makeGround(302, '#1a1010', [['#241414', 10, 8, 16], ['#120a0a', 8, 5, 12], ['#2a1010', 6, 4, 9]], ['#2a1616', '#100808', '#331a14', '#1a0c0c'], ['#3a1a14', '#2a120e'], (g, r, S) => {
    for (let i = 0; i < 18; i++) { let x = r() * S | 0, y = r() * S | 0; for (let k = 0; k < 14; k++) { g.fillStyle = r() < 0.3 ? '#ffd35a' : '#e8742c'; g.fillRect(x, y, 1, 1); x = (x + 1) % S; y = (y + (r() < 0.5 ? 1 : -1) + S) % S; } }
  }),
  void: makeGround(303, '#120d1e', [['#1a1230', 10, 8, 16], ['#0c0816', 8, 5, 12], ['#22143a', 6, 4, 9]], ['#1c1430', '#0a0612', '#261a40', '#160f24'], ['#2a1c44', '#1e1434'], (g, r, S) => {
    for (let i = 0; i < 60; i++) { g.fillStyle = pick(['#e27bf0', '#8ff0ff', '#f2eee6']); g.fillRect(r() * S | 0, r() * S | 0, 1, 1); }
  }),
  isle: makeGround(304, '#6a5a3a', [['#7a6a46', 10, 8, 16], ['#5a4a30', 8, 5, 12], ['#2f6b3a', 6, 6, 12]], ['#806e4a', '#5a4a30', '#8a7a52', '#6a5a3a'], ['#4fa04a', '#2f6b3a']),
  sea: makeGround(305, '#10283a', [['#14324a', 10, 8, 16], ['#0c2030', 8, 5, 12]], ['#163a52', '#0a1c2a', '#1d4660'], ['#3f8ee0', '#1d3d7a']),
  demon: makeGround(306, '#200a0c', [['#2c0e10', 10, 8, 16], ['#160608', 8, 5, 12], ['#3a1014', 6, 4, 9]], ['#2a0c10', '#120406', '#3a1216', '#1c080a'], ['#4a1418', '#300c10'], (g, r, S) => {
    for (let i = 0; i < 10; i++) { let x = r() * S | 0, y = r() * S | 0; for (let k = 0; k < 10; k++) { g.fillStyle = '#d8354a'; g.fillRect(x, y, 1, 1); x = (x + 1) % S; y = (y + (r() < 0.5 ? 1 : -1) + S) % S; } }
  }),
});
DECOR.icecrystal = makeSprite(mirror(['...0', '..0c', '..05', '.0cc', '.0c5', '0cBc', '0cBc', '0BBc', '.0BB', '..00']));
DECOR.frozentree = recolor(DECOR.tree, { '#1f4d33': '#8fa2ba', '#4fa04a': '#dce6f2', '#a6e05a': '#ffffff' });
DECOR.drift = makeSprite(['..5555..', '.555555.', '55555555']);
DECOR.basalt = recolor(DECOR.pillar, { '#a59cc4': '#3a1a14', '#5e557f': '#241414', '#36304f': '#120a0a' });
DECOR.voidcrystal = recolor(DECOR.icecrystal, { '#8ff0ff': '#e27bf0', '#f2eee6': '#ffffff', '#3f8ee0': '#9a4fd0' });
DECOR.shell = makeSprite(['.555.', '54545', '.555.']);
DECOR.palm = recolor(DECOR.tree, { '#1f4d33': '#2f6b3a', '#4fa04a': '#a6e05a' });
Object.assign(PROP, { icecrystal: 4, frozentree: 5, basalt: 4, voidcrystal: 4, palm: 5 });
Object.assign(BIOME_DECOR, {
  frozen: { drift: 6, icecrystal: 2, frozentree: 2, stone: 2, bones: 1 },
  rift: { vent: 3, basalt: 2, obsidian: 2, bones: 2, pond: 1.2, ashpile: 2 },
  void: { voidcrystal: 2.5, glowmush: 3, stone: 2, obsidian: 1 },
  isle: { tuft: 6, shell: 2, palm: 1.2, rock: 1, flower: 2 },
  sea: { stone: 0.0001 },
  demon: { vent: 3, obsidian: 2, bones: 3, pond: 1, basalt: 1.5 },
});

const DIMS = {
  frozen: { name: 'The Frozen Expanse', mul: 1.6, color: '#8ff0ff', boss: 'wyrm', relic: 'moonPearl', dark: 0.7, enemies: { wolf: 4, golem: 1.5, snowwisp: 2, skel: 1 }, sub: 'Danger x1.6. A wyrm sleeps beneath the ice' },
  rift: { name: 'The Infernal Rift', mul: 2.3, color: '#e8742c', boss: 'titan', relic: 'demonHorn', dark: 1.1, enemies: { imp: 3, magmaslime: 2.5, hound: 3 }, sub: 'Danger x2.3. The ground itself burns' },
  void: { name: 'The Void Garden', mul: 3.2, color: '#e27bf0', boss: 'watcher', relic: 'templeIdol', dark: 1.25, enemies: { crawler: 3, stalker: 2, swarmeye: 3 }, sub: 'Danger x3.2. Something vast is watching' },
  island: { name: 'The Drowned Isle', mul: 4.2, color: '#3f8ee0', boss: 'leviathan', relic: 'crown', dark: 0.9, enemies: {}, sub: 'Danger x4.2. Two titans rule this island' },
  demon: { name: 'The Demon Realm', mul: 3.6, color: '#d8354a', boss: 'archfiend', relic: 'demonHorn', dark: 1.3, enemies: { imp: 3, hound: 3, stalker: 1 }, sub: 'Danger x3.6. Its master waits' },
};
const PORTAL_TIMES = [[200, 'frozen'], [400, 'rift'], [580, 'void'], [760, 'island']];
const isleBiome = (x, y) => (x * x / (ISLAND_R * ISLAND_R) + y * y / (ISLAND_R * ISLAND_R * 0.64) < 1 ? 'isle' : 'sea');

function spawnPortal(dim, x, y) {
  if (x === undefined) { const a = Math.random() * TAU, R = rand(260, 340); x = ME.x + Math.cos(a) * R; y = ME.y + Math.sin(a) * R; }
  const p = { isPortal: true, dim, x, y, t: 0, life: 150, sortY: y, draw(now) { drawPortal(this, now); } };
  G.portals.push(p);
  if (dim !== 'home') { banner('A portal tears open', DIMS[dim].name, DIMS[dim].color); Snd.play('shrine'); }
  return p;
}
function drawPortal(p, now) {
  const col = p.dim === 'home' ? '#ffd35a' : DIMS[p.dim].color, sx = p.x - camX, sy = p.y - camY - 14, grow = Math.min(1, p.t / 0.8);
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(sx - 14), Math.round(sy + 14), 28, 4);
  ctx.fillStyle = '#36304f'; ctx.fillRect(Math.round(sx - 13), Math.round(sy + 14), 26, 2);
  pxDisc(sx, sy, 13 * grow, '#0b0a12', 1.4);
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * TAU + now * 2, r = (6 + (i % 4) * 2) * grow;
    ctx.fillStyle = i % 3 ? col : '#ffffff';
    ctx.fillRect(Math.round(sx + Math.cos(a + i) * r), Math.round(sy + Math.sin(a + i) * r * 1.4), 1, 1);
  }
  ctx.globalAlpha = 0.8; ringOval(sx, sy, 13 * grow, col, 1.4, 2); ctx.globalAlpha = 1;
  if (Math.random() < 0.4) addPart(p.x + rand(-10, 10), p.y - 14 + rand(-14, 14), 0, rand(-20, -5), 0.6, col);
  light(p.x, p.y - 14, 70, 1); glowAt(p.x, p.y - 14, 26, col, 0.5);
  const near = nearPortal(ME);
  if (near === p && Math.floor(now * 3) % 2) drawText(ctx, 'E', sx, sy - 26, '#ffd35a');
}
function nearPortal(pl) {
  if (!G || !pl) return null;
  for (const p of G.portals) if (p.t > 0.8 && Math.hypot(p.x - pl.x, p.y - (pl.y + 6)) < 24) return p;
  return null;
}

// In the Rift and the Demon Realm, the ponds are molten
const waterPond = drawPond;
drawPond = function (d, sx, sy, t) {
  if (!(G && (G.dim === 'rift' || G.dim === 'demon'))) { waterPond(d, sx, sy, t); return; }
  pxDisc(sx, sy, d.r + 1, '#0b0a12', 0.55);
  pxDisc(sx, sy, d.r, '#7a1a2a', 0.55);
  pxDisc(sx - 1, sy - 1, d.r * 0.72, '#e8742c', 0.55);
  pxDisc(sx - 2, sy - 2, d.r * 0.35, '#ffd35a', 0.55);
  if (Math.random() < 0.1) addPart(d.x + rand(-d.r, d.r) * 0.6, d.y + rand(-3, 3), 0, rand(-30, -10), 0.6, pick(['#ffd35a', '#e8742c']));
  light(d.x, d.y, d.r * 2, 0.8); glowAt(d.x, d.y, d.r, '#e8742c', 0.4);
};

/* ---------- Entering and leaving ---------- */
function enterDimension(dim) {
  const def = DIMS[dim];
  $('fade').classList.add('on');
  setState('fading');
  setTimeout(() => {
    G.saved = { enemies: G.enemies, gems: G.gems, items: G.items, pools: G.pools, totems: G.totems, bullets: G.bullets, hazards: G.hazards, portals: G.portals,
      pos: G.players.map(p => [p.x, p.y]), shrines: G.shrines, crypts: G.crypts, darkMul: G.darkMul, spawnMul: G.spawnMul, ev: G.ev };
    G.enemies = []; G.gems = []; G.items = []; G.pools = []; G.totems = []; G.bullets = []; G.hazards = []; G.portals = []; G.shrines = []; G.crypts = []; G.ev = null;
    G.dim = dim; G.dimMul = def.mul; G.darkMul = def.dark; G.spawnMul = 1; G.dimT = 0; G.dimPhase = 'survive'; G.dimAcc = 0; G.dimBossIdx = 0;
    biomeOverride = dim === 'island' ? isleBiome : () => dim;
    resetWorldCache();
    G.players.forEach((p, i) => { p.x = i * 18; p.y = 0; });
    if (G.boss) G.boss = null;
    $('bossbar').classList.add('hidden');
    setState('play');
    Snd.music(2);
    $('fade').classList.remove('on');
    banner(def.name, def.sub, def.color);
    if (dim === 'island') setTimeout(() => G && G.dim === 'island' && dimBoss(), 2500);
    Mods.call('enteredDim', dim);
  }, 350);
}
function exitDimension() {
  $('fade').classList.add('on');
  setState('fading');
  setTimeout(() => {
    const s = G.saved, dim = G.dim;
    Object.assign(G, { enemies: s.enemies, gems: s.gems, items: s.items, pools: s.pools, totems: s.totems, bullets: s.bullets, hazards: s.hazards, portals: s.portals,
      shrines: s.shrines, crypts: s.crypts, darkMul: s.darkMul, spawnMul: s.spawnMul, ev: s.ev });
    G.portals = G.portals.filter(p => p.dim !== dim);
    G.players.forEach((p, i) => { [p.x, p.y] = s.pos[i] || s.pos[0]; p.down = false; p.hp = Math.max(p.hp, 1); });
    G.enemies = G.enemies.filter(e => e.prop || Math.hypot(e.x - ME.x, e.y - ME.y) > 160);
    G.dim = null; G.dimMul = null; G.saved = null;
    biomeOverride = null;
    resetWorldCache();
    G.boss = G.enemies.find(e => e.boss && !e.minor && !e.dead) || null;
    if (G.boss) $('bossbar').classList.remove('hidden');
    setState('play');
    Snd.music(G.boss ? 2 : 1);
    $('fade').classList.remove('on');
    banner('The night again', DIMS[dim].name + ' conquered', '#ffd35a');
    Mods.call('leftDim', dim);
  }, 350);
}
function dimBoss() {
  const def = DIMS[G.dim];
  const ids = G.dim === 'island' ? ['leviathan', 'herald'] : [def.boss];
  const id = ids[G.dimBossIdx];
  const [x, y] = G.dim === 'island' ? [ISLAND_R, 0] : edgePos(30);
  G.dimPhase = 'boss';
  const b = makeBoss(id, id === 'herald' ? 0 : x, id === 'herald' ? -ISLAND_R * 0.5 : y, { hpMul: 0.5 + def.mul * 0.35, dmgMul: 0.2 + def.mul * 0.6, onDeath: e => dimBossDown(e) });
  banner(b.name, G.dim === 'island' && G.dimBossIdx === 1 ? 'The black sun descends' : 'Guardian of ' + def.name, def.color);
  Snd.play('warn');
}
function dimBossDown(e) {
  const def = DIMS[G.dim];
  if (G.dim === 'island' && G.dimBossIdx === 0) {
    G.dimBossIdx = 1;
    dropAt('chest', e.x * 0.6, e.y * 0.6, { boss: true });
    banner('The Leviathan sinks', 'Something answers from the sky', '#ffd35a');
    setTimeout(() => G && G.dim === 'island' && dimBoss(), 4000);
    return;
  }
  G.dimPhase = 'done';
  for (const o of G.enemies) if (!o.dead && !o.prop) o.dawn = rand(0.2, 1.5);
  const x = clamp(e.x, -ISLAND_R * 0.6, ISLAND_R * 0.6), y = clamp(e.y, -ISLAND_R * 0.5, ISLAND_R * 0.5);
  dropAt('chest', x - 16, y, { boss: true });
  dropAt('chest', x + 16, y, { boss: true });
  dropRelic(def.relic, x, y + 18);
  for (let i = 0; i < 4; i++) dropAt('bag', x + rand(-24, 24), y + rand(-16, 16));
  spawnPortal('home', x, y - 40);
  banner(def.name + ' is conquered', 'Take the treasure, then the golden portal home', '#ffd35a');
  Mods.call('dimConquered', G.dim);
}

/* ---------- Dimension rules: spawning, hazards, the island's shore ---------- */
function dimDirector(dt) {
  const def = DIMS[G.dim];
  G.dimT += dt;
  if (G.dimPhase === 'survive' && G.dim !== 'island') {
    G.dimAcc += (4 + G.dimT / 8) * Math.sqrt(def.mul) * dt;
    if (G.dimT > 45) dimBoss();
  } else if (G.dimPhase === 'boss' && G.dim !== 'island') G.dimAcc += 1.6 * dt;
  while (G.dimAcc >= 1) {
    G.dimAcc--;
    if (G.mobs < 260 && Object.keys(def.enemies).length) { const [x, y] = edgePos(); spawnEnemy(weighted(def.enemies), x, y); }
  }
  G.hpMul = 1 + G.t / 60 * 0.22;
  G.hazT = (G.hazT || 3) - dt;
  if (G.hazT <= 0 && G.dimPhase !== 'done') {
    const pl = nearestPlayer(ME.x, ME.y);
    if (G.dim === 'frozen') { G.hazT = 7; for (let i = 0; i < 8; i++) hz({ k: 'circle', x: pl.x + rand(-90, 90), y: pl.y + rand(-60, 60), r: 14, warn: 1, life: 0.2, dmg: 14 * def.mul * 0.6, color: '#8ff0ff', liveColor: '#fff' }); }
    else if (G.dim === 'rift' || G.dim === 'demon') { G.hazT = 4; for (let i = 0; i < 3; i++) hz({ k: 'circle', x: pl.x + rand(-80, 80), y: pl.y + rand(-60, 60), r: 22, warn: 1.1, life: 0.6, dmg: 18 * def.mul * 0.6, color: '#e8742c', liveColor: '#ffd35a', boom: 2 }); }
    else if (G.dim === 'void') { G.hazT = 9; const x = pl.x + rand(-60, 60), y = pl.y + rand(-50, 50); hz({ k: 'circle', x, y, r: 26, warn: 0.8, life: 3, tick: 0.4, dmg: 10, color: '#9a4fd0', liveColor: 'rgba(11,10,18,0.8)' }); G.wells.push({ x, y, t: 3.8 }); }
    else G.hazT = 99;
  }
  return true;
}
Mods.add({
  newRun() { G.portals = []; G.portalIdx = 0; G.wells = []; },
  director(dt) { return G.dim ? dimDirector(dt) : false; },
  update(dt) {
    for (const p of G.portals) { p.t += dt; if (p.dim !== 'home') p.life -= dt; }
    G.portals = G.portals.filter(p => p.life > 0);
    if (!G.dim && !G.story?.noPortals) {
      const next = PORTAL_TIMES[G.portalIdx];
      if (next && G.t >= next[0] && !G.boss) { spawnPortal(next[1]); G.portalIdx++; }
    }
    if (!G.dim) return;
    for (const w of G.wells) {
      w.t -= dt;
      for (const pl of G.players) { if (pl.down) continue; const dx = w.x - pl.x, dy = w.y - pl.y, d = Math.hypot(dx, dy) || 1; if (d < 130) { pl.x += dx / d * 36 * dt; pl.y += dy / d * 36 * dt; } }
    }
    G.wells = G.wells.filter(w => w.t > 0);
    if (G.dim === 'island') for (const pl of G.players) {
      const k = pl.x * pl.x / (ISLAND_R * ISLAND_R) + pl.y * pl.y / (ISLAND_R * ISLAND_R * 0.64);
      if (k > 0.92) { const s = Math.sqrt(0.92 / k); pl.x *= s; pl.y *= s; }
    }
    if (G.dim === 'island') for (const e of G.enemies) if (!e.boss && !e.prop) { const k = e.x * e.x / (ISLAND_R * ISLAND_R) + e.y * e.y / (ISLAND_R * ISLAND_R * 0.64); if (k > 1) { e.x /= Math.sqrt(k); e.y /= Math.sqrt(k); } }
    if (G.dim === 'rift' || G.dim === 'demon') for (const pl of G.players) {
      const f = { x: pl.x, y: pl.y + 6 };
      if (!pl.down && collideSolids(f, 0) && Math.random() < dt * 4) hurtPlayer(6 * G.dimMul * 0.5, pl);
    }
  },
  interact(pl = ME) {
    const p = nearPortal(pl);
    if (!p) return false;
    if (p.dim === 'home') exitDimension();
    else openModal({ title: DIMS[p.dim].name, color: DIMS[p.dim].color, sub: DIMS[p.dim].sub,
      body: '<p class="flavor">The air tears like wet paper. Beyond it, another sky. The night will wait for you.</p>',
      buttons: [{ label: 'Step through', primary: true, act: () => { G.portals = G.portals.filter(x => x !== p); enterDimension(p.dim); } }, { label: 'Not yet' }] }, pl);
    return true;
  },
  promptLabel() {
    const p = nearPortal(ME);
    return p ? (p.dim === 'home' ? 'E · Return to the night' : 'E · ' + DIMS[p.dim].name) : '';
  },
  ents(list) { for (const p of G.portals) if (onScreen(p.x, p.y, 40)) list.push(p); },
  pointers(list) { for (const p of G.portals) if (!onScreen(p.x, p.y - 14, 10)) list.push({ x: p.x, y: p.y, pcolor: p.dim === 'home' ? '#ffd35a' : DIMS[p.dim].color, picon: ICON.nova }); },
  minimap(dot) { for (const p of G.portals) dot(p.x, p.y, p.dim === 'home' ? '#ffd35a' : DIMS[p.dim].color, 3); },
  drawGround(now) {
    if (G.dim === 'island') {
      ctx.fillStyle = '#8fd4e8';
      const n = 260;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, w = 1 + Math.sin(now * 2 + a * 9) * 1.5;
        const x = Math.cos(a) * (ISLAND_R + w), y = Math.sin(a) * (ISLAND_R + w) * 0.8;
        if (onScreen(x, y, 4)) ctx.fillRect(Math.round(x - camX), Math.round(y - camY), 2, 1);
      }
    }
    for (const w of G.wells || []) {
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) ringOval(w.x - camX, w.y - camY, ((now * 30 + i * 20) % 60) + 6, '#9a4fd0', 0.62);
      ctx.globalAlpha = 1;
    }
  },
  drawOverlay(now) {
    if (G.dim === 'frozen') {
      ctx.fillStyle = 'rgba(200,230,255,0.08)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 60; i++) { const x = (i * 97 + now * 30 + Math.sin(now + i) * 10) % W, y = (i * 53 + now * 50) % H; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    } else if (G.dim === 'rift' || G.dim === 'demon') {
      ctx.fillStyle = G.dim === 'demon' ? 'rgba(120,10,20,0.14)' : 'rgba(232,116,44,0.08)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8742c';
      for (let i = 0; i < 30; i++) { const x = (i * 71) % W, y = H - ((now * 25 + i * 37) % H); ctx.fillRect(Math.round(x + Math.sin(now + i) * 6), Math.round(y), 1, 1); }
    } else if (G.dim === 'void') { ctx.fillStyle = 'rgba(80,20,120,0.1)'; ctx.fillRect(0, 0, W, H); }
    if (G.dim) {
      const def = DIMS[G.dim];
      const txt = G.dimPhase === 'survive' && G.dim !== 'island' ? `GUARDIAN IN ${Math.max(0, Math.ceil(45 - G.dimT))}` : G.dimPhase === 'done' ? 'FIND THE GOLDEN PORTAL' : '';
      if (txt) drawText(ctx, txt, W / 2, 46, def.color);
    }
  },
});
