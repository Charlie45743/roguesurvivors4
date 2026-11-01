'use strict';
/* Siege mode: a fortress at the centre of the world and endless waves of the dead, each harder than the last.
   Foes split between the fortress and you. A boss comes every fourth wave. Plugs into the director through Mods. */

const SIEGE_HP = 2200, SIEGE_R = 64;
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
  if (s.wave % 2 === 0) G.items.push({ k: 'chest', x: s.bx, y: s.by + 52, ph: 0, boss: true });
  banner('Wave ' + s.wave + ' cleared', 'The fortress mends', '#ffd35a');
  Snd.play('heal');
}

Mods.add({
  newRun(o) {
    if (!o.siege) return;
    G.siege = { wave: 0, phase: 'prep', t: 45, left: 0, rate: 1, acc: 0, pool: null, bx: 0, by: 0, bhp: SIEGE_HP, bmax: SIEGE_HP, hit: 0 };
    for (const [i, pl] of G.players.entries()) { pl.x = (i - (G.players.length - 1) / 2) * 18; pl.y = 70; }
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
    if (s && onScreen(s.bx, s.by, 130)) list.push({ sortY: s.by + 14, y: s.by, x: s.bx, draw: now => drawFortress(s, now) });
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
  const x = Math.round(s.bx - camX), y = Math.round(s.by - camY), t = now / 1000;
  const hp = s.bhp / s.bmax, r = (cx, cy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + cx, y + cy, w, h); };
  const brick = (cx, cy, w, h, base, hi, lo) => {   // stone with a lit left edge, a dark right edge and brick seams
    r(cx - 1, cy - 1, w + 2, h + 2, '#0b0a12'); r(cx, cy, w, h, base); r(cx, cy, 3, h, hi); r(cx + w - 3, cy, 3, h, lo);
    for (let j = 6; j < h; j += 7) { r(cx + 3, cy + j, w - 6, 1, lo); for (let i = 3 + (j / 7 % 2) * 5; i < w - 3; i += 10) r(cx + i, cy + j - 6, 1, 6, lo); }
  };
  const roof = (cx, top, w, h, c, hi) => {         // pointed roof
    for (let i = 0; i < h; i++) { const inset = Math.floor((h - 1 - i) * (w / 2) / h); r(cx - 1 + inset, top + i, w - 2 * inset + 2, 1, '#0b0a12'); r(cx + inset, top + i, w - 2 * inset, 1, i % 4 === 3 ? hi : c); }
  };
  const flag = (cx, cy, c) => { r(cx, cy, 1, 14, '#0b0a12'); for (let i = 0; i < 10; i++) r(cx + 1 + i, cy + 1 + Math.round(Math.sin(t * 5 + i * 0.5) * 1.4) + (i > 6 ? 1 : 0), 1, 6 - (i > 7 ? 2 : 0), i % 2 ? c : '#ffd35a'); };
  const fire = (cx, cy, k = 1) => { const f = Math.sin(t * 14 + cx) * 1.2; r(cx - 3 * k, cy - 8 * k - f, 6 * k, 8 * k + f, '#e8742c'); r(cx - 2 * k, cy - 7 * k - f, 4 * k, 6 * k, '#ffa84a'); r(cx - k, cy - 5 * k, 2 * k, 4 * k, s.hit > 0 ? '#ffffff' : '#fff3b0'); };
  // courtyard and a pulsing ring of runes
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y + 14, 76, 22, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(232,116,44,${0.35 + 0.25 * Math.sin(t * 2)})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y + 14, 84, 26, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 0.15; r(Math.round(Math.cos(a) * 84), 14 + Math.round(Math.sin(a) * 26), 2, 2, '#ffa84a'); }
  // back wall, inner towers and the keep
  brick(-40, -32, 80, 36, '#4a4466', '#6e668f', '#36304f');
  for (let i = 0; i < 9; i++) brick(-40 + i * 9, -39, 7, 7, '#5e557f', '#8a80b0', '#36304f');
  brick(-24, -66, 48, 42, '#5e557f', '#8a80b0', '#36304f');                                   // keep
  for (let i = 0; i < 5; i++) brick(-24 + i * 10, -73, 8, 7, '#6e668f', '#a59cc4', '#4a4466');
  roof(-14, -100, 28, 26, '#8a2a3a', '#d8354a'); r(-1, -112, 2, 14, '#0b0a12'); flag(1, -124, '#d8354a');
  const glow = 0.7 + 0.3 * Math.sin(t * 3);
  for (const wx of [-16, 11]) { r(wx - 1, -56, 7, 12, '#0b0a12'); r(wx, -55, 5, 10, `rgba(255,${160 + glow * 60 | 0},60,1)`); r(wx + 2, -55, 1, 10, '#0b0a12'); }
  r(-5, -48, 10, 16, '#0b0a12'); r(-4, -47, 8, 15, `rgba(255,${150 + glow * 70 | 0},50,1)`); r(-1, -47, 2, 15, '#0b0a12');   // great window
  // front curtain wall with a gate
  brick(-60, -20, 120, 34, '#5e557f', '#8a80b0', '#36304f');
  for (let i = 0; i < 12; i++) brick(-60 + i * 10, -27, 8, 8, '#6e668f', '#a59cc4', '#4a4466');
  r(-13, -10, 26, 24, '#0b0a12'); r(-11, -8, 22, 22, '#120d1c');                                // gate
  for (let i = -9; i < 10; i += 4) r(i, -8, 2, 22, '#4a4466'); for (let j = -4; j < 14; j += 6) r(-11, j, 22, 2, '#4a4466');
  for (let i = 0; i < 7; i++) r(-13 + i * 4, -13, 3, 4, '#a59cc4');                              // teeth above the arch
  r(-13, -14, 26, 2, '#0b0a12');
  for (const bx of [-24, 24]) { r(bx - 3, -2, 6, 10, '#0b0a12'); r(bx - 2, -1, 4, 8, '#36304f'); fire(bx, -2); }   // gate braziers
  // great corner towers with roofs, banners and fire
  for (const tx of [-86, 56]) {
    brick(tx, -58, 30, 74, '#5e557f', '#8a80b0', '#36304f');
    for (let i = 0; i < 4; i++) brick(tx + i * 8 - 1, -65, 7, 8, '#6e668f', '#a59cc4', '#4a4466');
    r(tx + 11, -42, 8, 14, '#0b0a12'); r(tx + 12, -41, 6, 12, `rgba(255,${150 + glow * 60 | 0},50,1)`); r(tx + 14, -41, 2, 12, '#0b0a12');
    r(tx + 11, -14, 8, 10, '#0b0a12'); r(tx + 12, -13, 6, 8, '#36304f');
    roof(tx + 2, -92, 26, 28, '#8a2a3a', '#d8354a'); flag(tx + 14, -108, tx < 0 ? '#e8742c' : '#d8354a');
    fire(tx + 15, -66);
  }
  // damage: cracks, then smoke and flames
  if (hp < 0.7) { for (const [cx, cy] of [[-52, -10], [38, -14], [-14, -58], [-70, -40]]) { r(cx, cy, 1, 7, '#0b0a12'); r(cx + 1, cy + 7, 1, 5, '#0b0a12'); r(cx - 1, cy + 12, 1, 4, '#0b0a12'); } }
  if (hp < 0.4) { fire(-50, -18); fire(-44, -24); fire(44, -30); fire(38, -36); if (Math.random() < 0.5) addPart(s.bx - 50 + rand(-4, 4), s.by - 28, rand(-6, 6), rand(-24, -12), 1, '#36304f', 2); }
  if (hp < 0.2) { fire(-5, -66); fire(70, -66); fire(-70, -66); if (Math.random() < 0.8) addPart(s.bx + rand(-70, 70), s.by - 40, rand(-8, 8), rand(-30, -14), 1.1, '#2a2538', 2); }
  if (s.hit > 0) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - 86, y - 100, 172, 116); }
  if (Math.random() < 0.35) addPart(s.bx + pick([-71, 71]) + rand(-3, 3), s.by - 74, rand(-5, 5), rand(-26, -12), 0.7, Math.random() < 0.5 ? '#ffd35a' : '#e8742c', 1);
}
