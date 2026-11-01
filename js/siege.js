'use strict';
/* Siege mode: a beacon at the centre of the world, twelve waves of the dead, a boss every fourth wave.
   Enemies nearer the beacon than to you go for it. If it falls, the run ends. Plugs into the director through Mods. */

const SIEGE_WAVES = 12, SIEGE_BEACON_HP = 900;
let SIEGE_NEXT = false;   // set by the Siege card, read when a character is picked

function siegeStart(s) {
  s.wave++;
  s.phase = 'wave';
  s.left = 10 + 7 * s.wave;
  s.rate = 1.3 + s.wave * 0.35;
  s.acc = 0;
  s.pool = WAVES[Math.min(WAVES.length - 1, Math.floor((s.wave - 1) * 0.9))].types;
  banner('Wave ' + s.wave, s.wave % 4 === 0 ? 'A great one comes' : s.left + ' foes close in', s.wave % 4 === 0 ? '#d8354a' : '#e8742c');
  Snd.play('warn');
  if (s.wave % 4 === 0) spawnBoss(s.wave / 4 - 1);
}
function siegeEnd(s) {
  if (s.wave >= SIEGE_WAVES) {
    G.won = true; G.winT = 4;
    for (const pl of G.players) pl.inv = 99;
    banner('Dawn breaks', 'The beacon held', '#ffd35a');
    return;
  }
  s.phase = 'prep'; s.t = 14;
  G.gold += 25 + 10 * s.wave;
  s.bhp = Math.min(s.bmax, s.bhp + s.bmax * 0.25);
  for (const pl of G.players) pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.3);
  if (s.wave % 2 === 0) G.items.push({ k: 'chest', x: s.bx + 24, y: s.by + 6, ph: 0, boss: true });
  banner('Wave ' + s.wave + ' cleared', 'The beacon mends', '#ffd35a');
  Snd.play('heal');
}

Mods.add({
  newRun(o) {
    if (!o.siege) return;
    G.siege = { wave: 0, phase: 'prep', t: 20, left: 0, rate: 1, acc: 0, pool: null, bx: 0, by: 0, bhp: SIEGE_BEACON_HP, bmax: SIEGE_BEACON_HP, hit: 0 };
    for (const [i, pl] of G.players.entries()) { pl.x = (i - (G.players.length - 1) / 2) * 18; pl.y = 38; }
    G.shrineT = 1e9; G.cryptT = 1e9;
    banner('Siege', 'Hold the beacon', '#e8742c');
  },
  director(dt) {
    const s = G.siege;
    if (!s || G.dim) return;
    if (G.won) return true;
    G.hpMul = 1 + s.wave * 0.2 + s.wave * s.wave * 0.012;
    if (s.phase === 'prep') { s.t -= dt; if (s.t <= 0) siegeStart(s); return true; }
    if (s.left > 0) {
      s.acc += s.rate * dt;
      while (s.acc >= 1 && s.left > 0) {
        s.acc--; s.left--;
        if (G.mobs >= 400) continue;
        const a = Math.random() * TAU, R = rand(250, 290);
        spawnEnemy(weighted(s.pool), s.bx + Math.cos(a) * R, s.by + Math.sin(a) * R);
      }
    } else if (G.mobs === 0 && !G.boss) siegeEnd(s);
    return true;
  },
  update(dt) {
    const s = G.siege;
    if (!s || G.over || G.won) return;
    s.hit = Math.max(0, s.hit - dt);
    let dmg = 0;
    for (const e of G.enemies) {
      if (e.dead || e.prop || e.dawn !== undefined || e.rise > 0) continue;
      const dx = s.bx - e.x, dy = s.by - e.y, d = Math.hypot(dx, dy) || 1;
      if (!e.boss && !e.swarm && d < 260) {
        const np = nearestPlayer(e.x, e.y);
        if (d < Math.hypot(np.x - e.x, np.y - e.y)) { e.x += dx / d * e.spd * 1.5 * dt; e.y += dy / d * e.spd * 1.5 * dt; }
      }
      if (d < 16 + e.r) dmg += e.dmg * 0.25;
    }
    if (dmg) { s.bhp -= dmg * dt; s.hit = 0.15; }
    if (s.bhp <= 0) {
      s.bhp = 0;
      G.over = true; G.deathT = 2; G.slowT = 2; G.whiteFlash = 1;
      burst(s.bx, s.by - 8, '#e8742c', 50, 100);
      banner('The beacon falls', '', '#d8354a');
      Snd.play('bigboom');
    }
  },
  ents(list) {
    const s = G.siege;
    if (s && onScreen(s.bx, s.by, 40)) list.push({ sortY: s.by + 8, y: s.by, x: s.bx, draw: now => drawBeacon(s, now) });
  },
  pointers(list) {
    const s = G.siege;
    if (s && !onScreen(s.bx, s.by - 10, 10)) list.push({ x: s.bx, y: s.by, pcolor: '#e8742c', picon: ICON.nova });
  },
  minimap(dot) {
    const s = G.siege;
    if (s) dot(s.bx, s.by, '#e8742c', 5);
  },
  hud() { const v = G.siege ? 'hidden' : ''; $('timer').style.visibility = v; $('objective').style.visibility = v; },
  drawOverlay() {
    const s = G.siege;
    if (!s || state === 'dungeon') return;
    const w = 120, x = Math.round(W / 2 - w / 2), y = H - 12;
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(x - 2, y - 2, w + 4, 8);
    ctx.fillStyle = '#36304f'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = s.hit > 0 ? '#ffffff' : s.bhp < s.bmax * 0.3 ? '#d8354a' : '#e8742c';
    ctx.fillRect(x, y, Math.round(w * s.bhp / s.bmax), 4);
    const left = s.phase === 'prep' ? 'NEXT WAVE IN ' + Math.ceil(s.t) : s.left + G.mobs + ' FOES LEFT';
    drawText(ctx, `WAVE ${Math.max(1, s.wave)}/${SIEGE_WAVES}  ·  ${left}`, W / 2, y - 8, '#f2eee6');
  },
  gameOver(won) {
    if (!G.siege) return;
    const s = G.siege;
    setTimeout(() => {
      $('overT').textContent = won ? 'The beacon held' : 'The beacon fell';
      $('overS').textContent = won ? `${G.ch.name} held the line through ${SIEGE_WAVES} waves.` : `Overrun on wave ${s.wave} of ${SIEGE_WAVES}.`;
      $('btnAgain').onclick = () => { Snd.play('select'); newRun(lastChar, { siege: true }); };
    }, 0);
  },
});

function drawBeacon(s, now) {
  const x = Math.round(s.bx - camX), y = Math.round(s.by - camY), t = now / 1000;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 11, y + 5, 22, 4);
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(x - 10, y - 2, 20, 9);
  ctx.fillStyle = '#5e557f'; ctx.fillRect(x - 9, y - 1, 18, 7);
  ctx.fillStyle = '#a59cc4'; ctx.fillRect(x - 9, y - 1, 18, 2);
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(x - 5, y - 20, 10, 19);
  ctx.fillStyle = '#36304f'; ctx.fillRect(x - 4, y - 19, 8, 17);
  ctx.fillStyle = '#5e557f'; ctx.fillRect(x - 4, y - 19, 3, 17);
  const f = 1 + Math.sin(t * 14) * 0.5, hot = s.hit > 0 ? '#ffffff' : '#ffd35a';
  ctx.fillStyle = '#e8742c'; ctx.fillRect(x - 4, y - 28 - f, 8, 8 + f);
  ctx.fillStyle = '#ffa84a'; ctx.fillRect(x - 3, y - 27 - f, 6, 7);
  ctx.fillStyle = hot; ctx.fillRect(x - 1, y - 25, 2, 5);
  if (Math.random() < 0.3) addPart(s.bx + rand(-3, 3), s.by - 26, rand(-4, 4), rand(-22, -10), 0.6, Math.random() < 0.5 ? '#ffd35a' : '#e8742c', 1);
}
