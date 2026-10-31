'use strict';
/* Allies: people you rescue (or hire) who follow you and fight. They have their own health, fall when beaten,
   and can be helped back up by standing beside them. At most three at a time. */

NPC_SPR.medic = NPC_SPR.priest.map(f => recolor(f, { '#ffd35a': '#d8354a', '#fff3b0': '#ffb0b8' }));
NPC_NAMES.medic = 'Field Medic';

const ALLY_TYPES = {
  squire: { name: 'Squire', spr: 'smith', hp: 150, dmg: 15, cd: 0.65, range: 20, spd: 68, kind: 'melee', color: '#b5b2c4', cost: 110, desc: 'A sturdy fighter who holds the line.' },
  ranger: { name: 'Ranger', spr: 'hunter', hp: 80, dmg: 11, cd: 0.8, range: 150, spd: 62, kind: 'bow', color: '#a6e05a', cost: 130, desc: 'Shoots foes from a distance.' },
  hexer: { name: 'Hedge Witch', spr: 'witch', hp: 70, dmg: 17, cd: 1.5, range: 130, spd: 58, kind: 'burst', color: '#e27bf0', cost: 170, desc: 'Hurls bursts that hit whole groups.' },
  cleric: { name: 'Cleric', spr: 'priest', hp: 90, dmg: 6, cd: 1.0, range: 22, spd: 62, kind: 'heal', color: '#ffd35a', cost: 190, desc: 'Mends your wounds while you fight.' },
  medic: { name: 'Field Medic', spr: 'medic', hp: 90, dmg: 6, cd: 1.0, range: 22, spd: 64, kind: 'heal', color: '#d8354a', cost: 150, desc: 'Patches you up, and carries bandages.' },
  runeknight: { name: 'Rune Knight', spr: 'runesmith', hp: 210, dmg: 24, cd: 0.8, range: 22, spd: 64, kind: 'melee', color: '#9a4fd0', cost: 260, desc: 'A runebound champion. Hits very hard.' },
};
const ALLY_RESCUE = ['squire', 'ranger', 'hexer', 'cleric'];
const PARTY_MAX = 3;

const partyOf = () => (G.allies || []).filter(a => !a.gone);
const allyPower = () => 1 + G.level * 0.06 + ((G.dimMul || 1) - 1) * 0.25;

function addAlly(type, x, y) {
  const t = ALLY_TYPES[type];
  G.allies = G.allies || [];
  const a = { id: uid++, isAlly: true, type, t, name: t.name, x, y, hp: t.hp, maxHp: t.hp, face: 1, anim: 0, moving: false, cd: 0.6, inv: 0, hurtT: 0,
    down: false, reviveT: 0, downT: 0, ph: Math.random() * 6, healT: 2, frames: NPC_SPR[t.spr] };
  G.allies.push(a);
  burst(x, y, t.color, 14, 70);
  Snd.play('heal');
  return a;
}
// Offer a rescued person to the player; returns false (and says why) when the party is full
function recruit(type, pl, quiet) {
  if (partyOf().length >= PARTY_MAX) { banner('Your party is full', `${PARTY_MAX} companions at most`, '#a59cc4'); return false; }
  const a = addAlly(type, pl.x + rand(-14, 14), pl.y + rand(8, 16));
  if (!quiet) banner(a.name + ' joins you', a.t.desc, a.t.color);
  return true;
}

function updateAlly(a, dt) {
  a.ph += dt; a.hurtT = Math.max(0, a.hurtT - dt); a.inv -= dt; a.cd -= dt;
  const alive = G.players.filter(p => !p.down);
  if (a.down) {
    a.downT += dt;
    const near = alive.some(p => Math.hypot(p.x - a.x, p.y - a.y) < 24);
    a.reviveT = near ? a.reviveT + dt : Math.max(0, a.reviveT - dt);
    if (a.reviveT >= 3) { a.down = false; a.hp = a.maxHp * 0.5; a.inv = 2; a.reviveT = 0; banner(a.name + ' rises', '', a.t.color); Snd.play('heal'); burst(a.x, a.y, a.t.color, 16, 70); }
    else if (a.downT > 45) { a.gone = true; burst(a.x, a.y, '#a59cc4', 20, 60); banner(a.name + ' is lost', '', '#a59cc4'); }
    return;
  }
  if (!alive.length) return;
  let owner = alive[0], od = Infinity;
  for (const p of alive) { const d = Math.hypot(p.x - a.x, p.y - a.y); if (d < od) { od = d; owner = p; } }
  a.hp = Math.min(a.maxHp, a.hp + 0.8 * dt);
  // pick a target close to both the ally and its owner
  let tg = null, bd = Infinity;
  for (const e of G.enemies) {
    if (e.prop || e.dead || e.harmless || e.dawn !== undefined || e.rise > 0.15) continue;
    const d = Math.hypot(e.x - a.x, e.y - a.y);
    if (d < 170 && d < bd && Math.hypot(e.x - owner.x, e.y - owner.y) < 260) { bd = d; tg = e; }
  }
  const spd = a.t.spd * (od > 140 ? 1.55 : 1);
  let mx = 0, my = 0;
  if (tg) {
    const dx = tg.x - a.x, dy = tg.y - a.y, d = Math.hypot(dx, dy) || 1, want = a.t.kind === 'melee' || a.t.kind === 'heal' ? a.t.range * 0.7 : a.t.range * 0.65;
    a.face = dx < 0 ? -1 : 1;
    if (d > want) { mx = dx / d; my = dy / d; }
    else if (a.t.range > 60 && d < want * 0.5) { mx = -dx / d; my = -dy / d; }
    if (a.cd <= 0 && d < a.t.range + tg.r) allyAttack(a, tg);
  } else if (od > 38) {
    const dx = owner.x - a.x, dy = owner.y - a.y;
    mx = dx / od; my = dy / od;
    a.face = dx < 0 ? -1 : 1;
  }
  if (od > 420) { a.x = owner.x + rand(-20, 20); a.y = owner.y + rand(8, 20); }
  a.moving = !!(mx || my);
  if (a.moving) { a.x += mx * spd * dt; a.y += my * spd * dt; a.anim += dt * 8; }
  collideSolids(a, 4);
  if (a.t.kind === 'heal') {
    a.healT -= dt;
    if (a.healT <= 0) {
      const hurt = alive.filter(p => p.hp < p.maxHp && Math.hypot(p.x - a.x, p.y - a.y) < 100).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
      if (hurt) {
        a.healT = 3.2;
        hurt.hp = Math.min(hurt.maxHp, hurt.hp + 12 + G.level * 0.5);
        addText(hurt.x, hurt.y - 14, '+', false, '#a6e05a'); burst(hurt.x, hurt.y, '#a6e05a', 8, 40); Snd.play('heal');
      } else a.healT = 0.5;
    }
  }
  if (a.inv <= 0) {
    let worst = 0;
    for (const e of query(a.x, a.y, 6)) if (!e.prop && e.dawn === undefined && !e.harmless) worst = Math.max(worst, e.dmg);
    if (worst) {
      const d = Math.max(1, Math.round(worst * 0.55));
      a.hp -= d; a.inv = 0.5; a.hurtT = 0.25;
      addText(a.x, a.y - 12, d, false, '#d8354a');
      if (a.hp <= 0) { a.hp = 0; a.down = true; a.downT = 0; a.reviveT = 0; banner(a.name + ' is down', 'Stand beside them to help them up', '#d8354a'); Snd.play('hurt'); }
    }
  }
}
function allyAttack(a, tg) {
  const dmg = a.t.dmg * allyPower();
  a.cd = a.t.cd * rand(0.9, 1.1);
  switch (a.t.kind) {
    case 'melee': case 'heal': {
      let n = 0;
      for (const e of query(a.x, a.y, a.t.range)) if (!e.prop && n++ < 3) hitEnemy(e, dmg, null, e.x - a.x, e.y - a.y, 80);
      G.fx.push({ k: 'ring', x: a.x + a.face * 10, y: a.y, t: 0, dur: 0.15, r: 14, c: '#f2eee6' });
      break;
    }
    case 'bow':
      hitEnemy(tg, dmg, null, tg.x - a.x, tg.y - a.y, 40);
      G.fx.push({ k: 'bolt', t: 0, dur: 0.1, pts: [[a.x, a.y - 4], [tg.x, tg.y - 2]] });
      Snd.play('shoot');
      break;
    case 'burst':
      for (const e of query(tg.x, tg.y, 28)) hitEnemy(e, dmg, null, e.x - tg.x, e.y - tg.y, 70);
      G.fx.push({ k: 'ring', x: tg.x, y: tg.y, t: 0, dur: 0.3, r: 28, c: '#e27bf0' });
      burst(tg.x, tg.y, '#e27bf0', 8, 60);
      break;
  }
}

function drawAlly(a, now) {
  const f = a.moving ? a.frames[Math.floor(a.anim) % 4] : a.frames[0];
  if (a.down) {
    shadow(a.x, a.y + 6, 14);
    ctx.save();
    ctx.translate(Math.round(a.x - camX), Math.round(a.y - camY + 4));
    ctx.rotate(Math.PI / 2 * a.face);
    ctx.globalAlpha = 0.55 + Math.sin(now * 5) * 0.2;
    ctx.drawImage(f.c, -f.w / 2, -f.h / 2);
    ctx.restore(); ctx.globalAlpha = 1;
    const bx = Math.round(a.x - camX - 7), by = Math.round(a.y - camY + 10);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(bx - 1, by - 1, 16, 4);
    ctx.fillStyle = '#36304f'; ctx.fillRect(bx, by, 14, 2);
    ctx.fillStyle = '#ffd35a'; ctx.fillRect(bx, by, Math.round(14 * a.reviveT / 3), 2);
    if (Math.floor(now * 2) % 2) drawText(ctx, 'HELP', a.x - camX, a.y - camY - 16, '#ffd35a');
    return;
  }
  const step = Math.floor(a.anim) % 4, bob = a.moving ? (step % 2 ? -1 : 0) : (Math.floor(now * 1.25 + a.ph) % 2 ? -1 : 0);
  shadow(a.x, a.y + 8, 10);
  const x = Math.round(a.x - camX - f.w / 2), y = Math.round(a.y - camY - f.h / 2) + bob, flip = a.face < 0;
  const drawF = img => { if (flip) { ctx.save(); ctx.translate(x + f.w, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); } else ctx.drawImage(img, x, y); };
  drawF(f.c);
  if (a.hurtT > 0) { ctx.globalAlpha = a.hurtT * 3; drawF(silhouette(f, '#ffffff')); ctx.globalAlpha = 1; }
  // a small coloured banner marks friends
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(a.x - camX) - 2, y - 5, 5, 4);
  ctx.fillStyle = a.t.color; ctx.fillRect(Math.round(a.x - camX) - 1, y - 4, 3, 2);
  const bx = Math.round(a.x - camX - 7), by = Math.round(a.y - camY + 10);
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(bx - 1, by - 1, 16, 4);
  ctx.fillStyle = '#1d3d7a'; ctx.fillRect(bx, by, 14, 2);
  ctx.fillStyle = '#a6e05a'; ctx.fillRect(bx, by, Math.round(14 * clamp(a.hp / a.maxHp, 0, 1)), 2);
  if (a.t.kind === 'heal') light(a.x, a.y, 20, 0.4);
}

/* ---------- Rescues ---------- */
function rescueModal(who, st, pl, onGold, type) {
  const t = ALLY_TYPES[type];
  openModal({
    title: who, color: '#ffd35a', sub: '"Thank you. I can repay you, one way or another."',
    body: `<p class="flavor">They look at the dark behind you, then at you. "I can fight, if you'll have me."</p>`,
    buttons: [
      { label: `Take ${t.name} with you`, desc: t.desc, primary: true, disabled: partyOf().length >= PARTY_MAX, act: () => { if (recruit(type, pl)) st.rescued = true; } },
      { label: 'Take their savings', desc: '+90 gold', act: () => { G.gold += Math.round(90 * pl.greed); onGold && onGold(); } },
    ],
  }, pl);
}
// The two older rescues now offer a companion as well
freePrisoner = function (st, pl) {
  st.freed = true;
  const type = pick(ALLY_RESCUE);
  openModal({
    title: 'The prisoner', color: '#ffd35a', sub: '"Thank you. I can repay you, one way or another."',
    buttons: [
      { label: 'Take their savings', desc: '+120 gold', act: () => { G.gold += Math.round(120 * pl.greed); } },
      { label: 'Ask what the bandits stole', desc: 'A demon fragment', act: () => { G.fragments = (G.fragments || 0) + 1; banner('Demon fragment', `${G.fragments}/3`, '#d8354a'); } },
      { label: `Let them fight beside you`, desc: ALLY_TYPES[type].name + '. ' + ALLY_TYPES[type].desc, disabled: partyOf().length >= PARTY_MAX, act: () => { recruit(type, pl); } },
    ],
  }, pl);
  st.npcs[0].dead = true;
  st.done = true;
};
helpSurvivor = function (st, pl) {
  st.helped = true;
  const gold = Math.round(rand(40, 90) * pl.greed), type = pick(ALLY_RESCUE);
  openModal({
    title: 'A survivor', color: '#ffd35a', sub: 'Hiding since the night began', body: '<p class="flavor">"They came at dusk and never left. Get out of here before they come back."</p>',
    buttons: [
      { label: 'Take their gift', desc: `+${gold} gold`, primary: true, act: () => { G.gold += gold; } },
      { label: `Offer an escort`, desc: ALLY_TYPES[type].name + '. ' + ALLY_TYPES[type].desc, disabled: partyOf().length >= PARTY_MAX, act: () => { recruit(type, pl); } },
    ],
  }, pl);
  st.npcs[0].dead = true;
};

/* ---------- Module hooks ---------- */
Mods.add({
  newRun() { G.allies = []; },
  update(dt) {
    if (!G.allies || !G.allies.length) return;
    for (const a of G.allies) if (!a.gone) updateAlly(a, dt);
    if (G.allies.some(a => a.gone)) G.allies = G.allies.filter(a => !a.gone);
  },
  ents(list) {
    if (!G.allies) return;
    for (const a of G.allies) if (!a.gone && onScreen(a.x, a.y, 30)) list.push({ sortY: a.y + 8, y: a.y, x: a.x, draw: now => drawAlly(a, now) });
  },
  minimap(dot) { for (const a of G.allies || []) if (!a.gone) dot(a.x, a.y, a.down ? '#ffd35a' : '#a6e05a', 2); },
  // companions come through portals with you
  enteredDim() { gatherAllies(); },
  leftDim() { gatherAllies(); },
});
function gatherAllies() {
  const pl = ME;
  for (const a of G.allies || []) { a.x = pl.x + rand(-20, 20); a.y = pl.y + rand(8, 22); if (a.down) { a.down = false; a.hp = a.maxHp * 0.5; } }
}
