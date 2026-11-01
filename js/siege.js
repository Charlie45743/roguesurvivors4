'use strict';
/* Siege mode: a fortress at the centre of the world and endless waves of the dead, each harder than the last.
   Foes split between the fortress and you. A boss comes every fourth wave. Plugs into the director through Mods. */

const SIEGE_HP = 1800, SIEGE_R = 34;
let SIEGE_NEXT = false;   // set by the Siege card, read when a character is picked

function siegeStart(s) {
  s.wave++;
  s.phase = 'wave';
  s.left = 14 + 9 * s.wave;
  s.rate = Math.min(14, 1.5 + s.wave * 0.4);
  s.acc = 0;
  s.pool = WAVES[Math.min(WAVES.length - 1, Math.floor((s.wave - 1) * 0.9))].types;
  const boss = s.wave % 4 === 0;
  banner('Wave ' + s.wave, boss ? 'A great one comes' : s.left + ' foes close in', boss ? '#d8354a' : '#e8742c');
  Snd.play('warn');
  if (boss) spawnBoss((s.wave / 4 - 1) % 3);
}
function siegeEnd(s) {
  s.phase = 'prep'; s.t = 40;
  G.gold += 40 + 15 * s.wave;
  s.bhp = Math.min(s.bmax, s.bhp + s.bmax * 0.3);
  for (const pl of G.players) pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.4);
  if (s.wave % 2 === 0) G.items.push({ k: 'chest', x: s.bx + 44, y: s.by + 16, ph: 0, boss: true });
  banner('Wave ' + s.wave + ' cleared', 'The fortress mends', '#ffd35a');
  Snd.play('heal');
}

Mods.add({
  newRun(o) {
    if (!o.siege) return;
    G.siege = { wave: 0, phase: 'prep', t: 45, left: 0, rate: 1, acc: 0, pool: null, bx: 0, by: 0, bhp: SIEGE_HP, bmax: SIEGE_HP, hit: 0 };
    for (const [i, pl] of G.players.entries()) { pl.x = (i - (G.players.length - 1) / 2) * 18; pl.y = 48; }
    G.shrineT = 1e9; G.cryptT = 1e9;
    banner('Siege', 'Hold the fortress', '#e8742c');
  },
  director(dt) {
    const s = G.siege;
    if (!s || G.dim) return;
    G.hpMul = 1 + s.wave * 0.28 + s.wave * s.wave * 0.02;
    if (s.phase === 'prep') { s.t -= dt; if (s.t <= 0) siegeStart(s); return true; }
    if (s.left > 0) {
      s.acc += s.rate * dt;
      while (s.acc >= 1 && s.left > 0) {
        s.acc--; s.left--;
        if (G.mobs >= 450) continue;
        let x, y;
        if (Math.random() < 0.5) { const a = Math.random() * TAU, R = rand(260, 300); x = s.bx + Math.cos(a) * R; y = s.by + Math.sin(a) * R; }   // around the fortress
        else [x, y] = edgePos(20, pick(G.players));                                                                                            // around you
        const e = spawnEnemy(weighted(s.pool), x, y);
        if (e) e.sg = Math.random() < 0.6 ? 'f' : 'p';   // fortress-hunters and player-hunters
      }
    } else if (G.mobs === 0 && !G.boss) siegeEnd(s);
    return true;
  },
  update(dt) {
    const s = G.siege;
    if (!s || G.over) return;
    s.hit = Math.max(0, s.hit - dt);
    let dmg = 0;
    for (const e of G.enemies) {
      if (e.dead || e.prop || e.dawn !== undefined || e.rise > 0) continue;
      const dx = s.bx - e.x, dy = s.by - e.y, d = Math.hypot(dx, dy) || 1;
      if (e.sg === 'f' && !e.boss && !e.swarm) {
        const np = nearestPlayer(e.x, e.y);
        if (Math.hypot(np.x - e.x, np.y - e.y) > 45 && d > SIEGE_R) { e.x += dx / d * e.spd * 1.6 * dt; e.y += dy / d * e.spd * 1.6 * dt; }
      }
      if (d < SIEGE_R + e.r) dmg += e.dmg * 0.25;
    }
    if (dmg) { s.bhp -= dmg * dt; s.hit = 0.15; }
    if (s.bhp <= 0) {
      s.bhp = 0;
      G.over = true; G.deathT = 2; G.slowT = 2; G.whiteFlash = 1;
      burst(s.bx, s.by - 12, '#e8742c', 60, 110);
      banner('The fortress falls', '', '#d8354a');
      Snd.play('bigboom');
    }
  },
  ents(list) {
    const s = G.siege;
    if (s && onScreen(s.bx, s.by, 60)) list.push({ sortY: s.by + 12, y: s.by, x: s.bx, draw: now => drawFortress(s, now) });
  },
  pointers(list) {
    const s = G.siege;
    if (s && !onScreen(s.bx, s.by - 10, 10)) list.push({ x: s.bx, y: s.by, pcolor: '#e8742c', picon: ICON.nova });
  },
  minimap(dot) {
    const s = G.siege;
    if (s) dot(s.bx, s.by, '#e8742c', 6);
  },
  hud() { const v = G.siege ? 'hidden' : ''; $('timer').style.visibility = v; $('objective').style.visibility = v; },
  drawOverlay() {
    const s = G.siege;
    if (!s || state === 'dungeon') return;
    const w = 90, x = Math.round(W / 2 - w / 2), y = 17;
    drawText(ctx, 'FORTRESS HEALTH', W / 2, 10, '#f2eee6');
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(x - 2, y - 2, w + 4, 7);
    ctx.fillStyle = '#36304f'; ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = s.hit > 0 ? '#ffffff' : s.bhp < s.bmax * 0.3 ? '#d8354a' : '#e8742c';
    ctx.fillRect(x, y, Math.round(w * s.bhp / s.bmax), 3);
    drawText(ctx, s.phase === 'prep' ? `NEXT WAVE IN ${Math.ceil(s.t)}` : `WAVE ${s.wave}   ${s.left + G.mobs} FOES`, W / 2, 30, '#a59cc4');
  },
  gameOver() {
    const s = G.siege;
    if (!s) return;
    setTimeout(() => {
      const done = s.phase === 'prep' ? s.wave : s.wave - 1;
      $('overT').textContent = 'The fortress fell';
      $('overS').textContent = `${G.ch.name} held out for ${done} wave${done === 1 ? '' : 's'}.`;
      $('btnAgain').onclick = () => { Snd.play('select'); newRun(lastChar, { siege: true }); };
    }, 0);
  },
});

function drawFortress(s, now) {
  const x = Math.round(s.bx - camX), y = Math.round(s.by - camY), t = now / 1000, r = (cx, cy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + cx, y + cy, w, h); };
  r(-44, 8, 88, 8, 'rgba(0,0,0,.35)');
  for (const sx of [-42, 26]) {                      // corner towers
    r(sx - 1, -34, 18, 46, '#0b0a12'); r(sx, -33, 16, 44, '#4a4466'); r(sx, -33, 5, 44, '#6e668f');
    for (let i = 0; i < 3; i++) { r(sx + i * 6, -38, 4, 5, '#0b0a12'); r(sx + 1 + i * 6, -37, 3, 4, '#5e557f'); }
    r(sx + 6, -22, 4, 8, '#0b0a12'); r(sx + 7, -21, 2, 6, '#ffd35a');
  }
  r(-27, -17, 54, 29, '#0b0a12'); r(-26, -16, 52, 27, '#5e557f'); r(-26, -16, 52, 3, '#a59cc4');   // curtain wall
  for (let i = 0; i < 6; i++) r(-26 + i * 9, -21, 6, 5, '#5e557f');
  for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) r(-26 + i * 9 + (j % 2) * 4, -10 + j * 8, 8, 1, '#36304f');
  r(-9, -34, 18, 20, '#0b0a12'); r(-8, -33, 16, 19, '#4a4466'); r(-8, -33, 5, 19, '#6e668f');         // keep
  r(-6, -28, 3, 6, '#0b0a12'); r(3, -28, 3, 6, '#0b0a12'); r(-5, -27, 1, 4, '#ffd35a'); r(4, -27, 1, 4, '#ffd35a');
  r(-8, -1, 16, 12, '#0b0a12'); r(-7, 0, 14, 11, '#1a1426'); for (let i = -6; i < 7; i += 3) r(i, 0, 1, 11, '#5e557f');   // gate
  const f = 1 + Math.sin(t * 14) * 0.5, hot = s.hit > 0 ? '#ffffff' : '#ffd35a';
  for (const fx of [-34, 34]) { r(fx - 3, -46 - f, 6, 8 + f, '#e8742c'); r(fx - 2, -45 - f, 4, 6, '#ffa84a'); r(fx - 1, -44, 2, 4, hot); }
  r(-1, -42, 2, 8, '#0b0a12'); r(1, -42, 9, 6, '#d8354a');                                            // banner
  if (s.hit > 0) { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x - 43, y - 36, 86, 48); }
  if (Math.random() < 0.3) addPart(s.bx + (Math.random() < 0.5 ? -34 : 34) + rand(-3, 3), s.by - 44, rand(-4, 4), rand(-22, -10), 0.6, Math.random() < 0.5 ? '#ffd35a' : '#e8742c', 1);
}
