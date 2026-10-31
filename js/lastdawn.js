'use strict';
/* THE LAST DAWN, part 3: the campaign's machinery.
   What the campaign remembers (who you saved, who is hurt, what you chose), the named companions and the armies that fight
   beside you, how a siege behaves, objectives and things to interact with, the Story screen, and the way a chapter starts,
   ends and hands its consequences to the next one. The chapters themselves are in ldchapters.js. */

const LDFAST = new URLSearchParams(location.search).get('ldfast');   // test runs: sieges and bosses resolve at once
const LDMEM = { lastIdx: -1, died: false, replay: false };

/* ---------- What the campaign remembers ---------- */
const LD_NEW = () => ({ done: {}, rescued: [], lost: [], choices: {}, rel: { kael: 0, mira: 0, bram: 0 }, injured: {}, dead: {}, bosses: {}, shards: 0, city: 'unknown',
  evacuated: 0, build: null, lore: [], seen: {}, cinemas: {} });
function LDS() { if (!save.ld) save.ld = LD_NEW(); return save.ld; }
const ldHas = k => !!LDS().choices[k];
function ldProgress() { const d = LDS().done; return STORY.filter(c => d[c.id]).length; }
// Who walks with you in this chapter: the injured sit out, the dead stay dead
function ldCompanions(i) {
  const L = LDS(), out = [];
  for (const k of ['kael', 'mira', 'bram']) if (!L.dead[k] && !(L.injured[k] && L.injured[k] >= i)) out.push(k);
  if (i >= 4 && !L.dead.orin) out.push('orin');
  return out;
}
function ldSaveBuild() {
  const p = ME;
  LDS().build = { weapons: p.weapons.map(w => ({ id: w.id, level: w.level, evo: !!w.evo })), passives: { ...p.passives }, level: G.level };
}
function ldRestoreBuild() {
  const b = LDS().build;
  if (!b) return;
  P = ME;
  ME.weapons.length = 0;
  for (const w of b.weapons) { addWeapon(w.id); const x = ME.weapons[ME.weapons.length - 1]; x.level = w.level; x.evo = w.evo; }
  ME.passives = { ...b.passives };
  G.level = b.level; G.xpNext = xpFor(G.level);
  recalc(); ME.hp = ME.maxHp; refreshSlots();
}

/* ---------- Named people and armies ---------- */
Object.assign(ALLY_TYPES, {
  kael: { name: 'Kael', spr: 'kael', hp: 170, dmg: 17, cd: 0.5, range: 175, spd: 72, kind: 'bow', color: '#e0b060', desc: 'A reckless hunter who never misses.' },
  mira: { name: 'Mira', spr: 'mira', hp: 130, dmg: 5, cd: 1.0, range: 22, spd: 66, kind: 'heal', color: '#8ff0ff', desc: 'The Keeper. Her light mends everyone near her.' },
  bram: { name: 'Bram', spr: 'bram', hp: 380, dmg: 28, cd: 0.85, range: 24, spd: 58, kind: 'melee', color: '#e0707a', desc: 'A huge, loyal blacksmith.' },
  orin: { name: 'Orin', spr: 'orin', hp: 120, dmg: 10, cd: 1.2, range: 120, spd: 62, kind: 'burst', color: '#ff9a4a', desc: 'Engineer of Veyra.' },
  seren: { name: 'Seren', spr: 'seren', hp: 340, dmg: 24, cd: 0.7, range: 24, spd: 66, kind: 'melee', color: '#9fc0ff', desc: 'Captain of Veyra.' },
  tomas: { name: 'Tomas', spr: 'tomas', hp: 320, dmg: 22, cd: 0.75, range: 24, spd: 62, kind: 'melee', color: '#c9a070', desc: 'Commander of the city gate.' },
  guard: { name: 'Veyra Guard', spr: 'guard', hp: 150, dmg: 15, cd: 0.7, range: 22, spd: 60, kind: 'melee', color: '#9fc0ff', desc: '' },
  gbow: { name: 'Veyra Archer', spr: 'guardbow', hp: 80, dmg: 11, cd: 0.85, range: 180, spd: 56, kind: 'bow', color: '#d8354a', desc: '' },
  sfight: { name: 'Survivor', spr: 'survivor', hp: 110, dmg: 13, cd: 0.7, range: 22, spd: 60, kind: 'melee', color: '#a6e05a', desc: '' },
  sbow: { name: 'Survivor', spr: 'survivor', hp: 70, dmg: 10, cd: 0.85, range: 170, spd: 58, kind: 'bow', color: '#a6e05a', desc: '' },
  ashenAlly: { name: 'The Ashen Knight', spr: 'ashen', hp: 1100, dmg: 44, cd: 0.7, range: 32, spd: 72, kind: 'melee', color: '#e8742c', desc: '' },
});
const UNIT_NAMES = ['Hollis', 'Brannoch', 'Dara', 'Voss', 'Edda', 'Marek', 'Ilse', 'Joren', 'Tamsin', 'Cade', 'Neve', 'Osric', 'Wick', 'Perrin', 'Sorrel', 'Ansel', 'Maud', 'Rowan', 'Fenn', 'Greta', 'Ulf', 'Bryn'];
let nameIdx = 0;
const nextName = () => UNIT_NAMES[nameIdx++ % UNIT_NAMES.length];
// A soldier, archer or named companion, placed without the recruit fanfare. `post` makes them hold a spot instead of following you.
function unit(type, x, y, o = {}) {
  const t = ALLY_TYPES[type];
  const a = { id: uid++, isAlly: true, type, t, name: o.name || (o.key ? t.name : nextName()), x, y, hp: o.hp || t.hp, maxHp: o.hp || t.hp, face: o.face || 1, anim: Math.random() * 4, moving: false,
    cd: 0.6, inv: 0, hurtT: 0, down: false, reviveT: 0, downT: 0, ph: Math.random() * 6, healT: 2, frames: NPC_SPR[t.spr], key: o.key || null, noLose: !!o.key };
  if (o.post) a.post = { x: o.post[0], y: o.post[1], leash: o.leash ?? (t.kind === 'bow' ? 20 : 70) };
  (G.allies = G.allies || []).push(a);
  return a;
}
const companion = (key, x, y) => unit(key, x, y, { key });
const allyList = () => (G.allies || []).filter(a => !a.gone);

const baseUpdateAlly = updateAlly;
updateAlly = function (a, dt) {
  if (a.stunT > 0) { a.stunT -= dt; a.moving = false; return; }
  if (a.cine) return;
  if (a.noLose && a.down) {   // the named never die in a fight: they get back up on their own, slowly
    a.downT = 0; a.autoT = (a.autoT || 0) + dt;
    if (a.autoT > 8) { a.autoT = 0; a.down = false; a.hp = a.maxHp * 0.6; a.inv = 2; banner(a.name + ' gets back up', '', a.t.color); burst(a.x, a.y, a.t.color, 12, 60); }
    return;
  }
  if (a.post) { postUnit(a, dt); return; }
  baseUpdateAlly(a, dt);
};
// Holds a post: shoots or fights what comes near it, walks back when pulled away
function postUnit(a, dt) {
  a.ph += dt; a.hurtT = Math.max(0, a.hurtT - dt); a.inv -= dt; a.cd -= dt;
  if (a.down) { a.downT += dt; if (a.downT > 20) { a.gone = true; burst(a.x, a.y, '#a59cc4', 14, 50); } return; }
  const t = a.t, range = t.range + 40, ps = a.post;
  let tg = null, bd = Infinity;
  for (const e of G.enemies) {
    if (e.prop || e.dead || e.harmless || e.dawn !== undefined || e.rise > 0.15) continue;
    const d = Math.hypot(e.x - a.x, e.y - a.y);
    if (d < range && d < bd && (t.kind === 'bow' || Math.hypot(e.x - ps.x, e.y - ps.y) < ps.leash + 60)) { bd = d; tg = e; }
  }
  let mx = 0, my = 0;
  if (tg) {
    const dx = tg.x - a.x, dy = tg.y - a.y, d = Math.hypot(dx, dy) || 1;
    a.face = dx < 0 ? -1 : 1;
    if (t.kind === 'melee' && d > t.range * 0.7) { mx = dx / d; my = dy / d; }
    if (a.cd <= 0 && d < t.range + tg.r + (t.kind === 'bow' ? 40 : 0)) allyAttack(a, tg);
  } else if (Math.hypot(ps.x - a.x, ps.y - a.y) > 4) { const dx = ps.x - a.x, dy = ps.y - a.y, d = Math.hypot(dx, dy); mx = dx / d; my = dy / d; }
  a.moving = !!(mx || my);
  if (a.moving) { a.x += mx * t.spd * dt; a.y += my * t.spd * dt; a.anim += dt * 8; }
  if (a.inv <= 0) {
    let worst = 0;
    for (const e of query(a.x, a.y, 6)) if (!e.prop && e.dawn === undefined && !e.harmless) worst = Math.max(worst, e.dmg);
    if (worst) {
      const d = Math.max(1, Math.round(worst * 0.55));
      a.hp -= d; a.inv = 0.5; a.hurtT = 0.25; addText(a.x, a.y - 12, d, false, '#d8354a');
      if (a.hp <= 0) { a.hp = 0; a.down = true; a.downT = 0; Snd.play('hurt'); }
    }
  }
}
const baseDrawAlly = drawAlly;
drawAlly = function (a, now) {
  baseDrawAlly(a, now);
  if (a.key && !a.down) drawText(ctx, a.name, a.x - camX, a.y - camY - 20, a.t.color);
};
const baseInputVec = inputVec;
inputVec = function () { return ME && ME.stunT > 0 ? [0, 0] : baseInputVec(); };

/* ---------- Sieges: how the dark attacks a place ---------- */
// Foes go for whatever is nearest and defenceless (barricades, gates, civilians, soldiers) and only then for you
function siegeAI(e, dt, tp, dx, dy, d) {
  if (e.freeze > 0) { e.freeze -= dt; return; }
  let spd = e.spd;
  if (e.slow > 0) { e.slow -= dt; spd *= 0.45; }
  let tg = null, bd = 90, hitting = null;
  if (d < 70) { tg = tp; bd = 0; }
  if (!tg) {
    for (const a of G.allies || []) if (!a.gone && !a.down) { const q = Math.hypot(a.x - e.x, a.y - e.y); if (q < bd) { bd = q; tg = a; } }
    for (const a of Cine.actors) if (a.civ && a.hp > 0) { const q = Math.hypot(a.x - e.x, a.y - e.y); if (q < bd) { bd = q; tg = a; hitting = a; } }
  }
  if (!tg) {
    if (!e.goalPiece || e.goalPiece.fallen) { let b2 = 900; e.goalPiece = null; for (const p of Scn.pieces) if (p.tgt && !p.fallen) { const q = Math.hypot(p.x - e.x, p.y - e.y); if (q < b2) { b2 = q; e.goalPiece = p; } } }
    if (e.goalPiece) { tg = e.goalPiece; hitting = tg; }
    else if (G.ld && G.ld.rally) tg = G.ld.rally;
    else tg = tp;
  }
  const ddx = tg.x - e.x, ddy = tg.y - e.y, dd = Math.hypot(ddx, ddy) || 1, reach = hitting && hitting.spr ? 16 : 9;
  e.dir = ddx < 0 ? -1 : 1;
  if (dd > reach) { e.x += ddx / dd * spd * dt; e.y += ddy / dd * spd * dt; }
  else if (hitting) {
    hitting.hp -= e.dmg * 0.7 * dt; if (hitting.spr) hitting.shake = 0.2; else hitting.hurt = 0.2;
    if (hitting.hp <= 0) siegeBroken(hitting);
  }
}
function siegeBroken(o) {
  if (o.spr) {
    if (!o.fallen) { scnCollapse(o, { rubble: true }); if (G.ld) G.ld.broken = (G.ld.broken || 0) + 1; pushBark('voice', (o.name || 'A barricade') + ' has fallen!', 2.5); }
  } else if (o.civ && !o.dead) {
    o.dead = true; o.alpha = 0; burst(o.x, o.y, '#d8354a', 12, 60); Snd.play('hurt');
    if (G.ld) { G.ld.civLost = (G.ld.civLost || 0) + 1; if (o.named) LDS().lost.push(o.name); }
    Cine.actors = Cine.actors.filter(a => a !== o);
  }
}
function foesAlive() { let n = 0; for (const e of G.enemies) if (e.siege && !e.dead) n++; return n; }
// Spawn `n` foes over time from the given points; they march on the objective
function wave(types, n, pts, o = {}) {
  const gap = o.gap ?? 0.5;
  Camp.pend = (Camp.pend || 0) + n;
  for (let i = 0; i < n; i++) C.later(LDFAST ? 0 : i * gap, () => {
    Camp.pend--;
    const [x, y] = pick(pts), type = Array.isArray(types) ? pick(types) : weighted(types);
    const e = spawnEnemy(type, x + rand(-16, 16), y + rand(-16, 16), { hpMul: o.hpMul || 1 });
    e.rise = o.rise ?? 0.35; e.siege = true; e.anchored = true;
    if (o.ai !== false && !(e.d.shoot)) e.ai = siegeAI;
    if (o.elite) { e.elite = true; e.hp = e.maxHp = e.maxHp * 2.2; }
  });
}
const clearFoes = () => { for (const e of G.enemies) if (!e.prop && !e.boss && !e.dead) { e.dead = true; disintegrate(e, e.frames[0], e.scale || 1); } };

/* ---------- Things to walk up to and press E on ---------- */
const Spots = [];
const spotNear = (s, pl) => Math.hypot(pl.x - s.x, pl.y - s.y) < s.r;
Mods.add({
  newRun() { Spots.length = 0; },
  interact(pl) {
    for (const s of Spots) if (!s.off && spotNear(s, pl)) { s.act(pl, s); if (s.once) s.off = true; Snd.play('select'); return true; }
    return false;
  },
  promptLabel() {
    if (!G || !G.ld) return '';
    for (const s of Spots) if (!s.off && spotNear(s, ME)) return 'E · ' + s.label;
    return '';
  },
  drawGround(now) {
    for (const s of Spots) {
      if (s.off || !onScreen(s.x, s.y, 20)) continue;
      const sx = Math.round(s.x - camX), sy = Math.round(s.y - camY);
      light(s.x, s.y - 6, 40, 0.8); glowAt(s.x, s.y - 6, 14, s.color || '#ffd35a', 0.45 + Math.sin(now * 4) * 0.15);
      if (Math.floor(now * 3) % 2) drawText(ctx, 'E', sx, sy - 22, '#ffd35a');
    }
  },
});
const spot = (x, y, label, act, o = {}) => { const s = { x, y, r: o.r || 22, label, act, once: o.once !== false, color: o.color }; Spots.push(s); return s; }

/* ---------- Waiters that only make sense in this game ---------- */
Object.assign(C, {
  reach(x, y, r = 40) { return tick(() => G.players.some(p => !p.down && Math.hypot(p.x - x, p.y - y) < r)); },
  reachX(x, dir = 1) { return tick(() => G.players.some(p => !p.down && (dir > 0 ? p.x > x : p.x < x))); },
  // waits until at most `max` of the besieging foes are left and every wave has been spawned
  clear(max = 0) { return tick(() => { if (LDFAST) { Camp.timers.forEach(t => (t.t = 0)); for (const e of G.enemies) if (e.siege && !e.dead && !e.boss) e.dead = true; } return !(Camp.pend > 0) && foesAlive() <= max; }); },
  wave, clearFoes,
  boss(id, x, y, o = {}) { const b = makeBoss(id, x, y, { hpMul: 0.55 + (G.ld ? G.ld.i : 0) * 0.12, ...o }); b.siegeBoss = true; return b; },
  bossDead(b) { return tick(() => { if (LDFAST && !b.dead) hitEnemy(b, 1e9, null, 0, 0, 0); return b.dead; }); },
  bossBelow(b, f) { return tick(() => { if (LDFAST) b.hp = Math.min(b.hp, b.maxHp * (f - 0.001)); return b.hp / b.maxHp < f || b.dead; }); },
  endBoss(b) { b.dead = true; if (G.boss === b) G.boss = null; $('bossbar').classList.add('hidden'); $('timer').classList.remove('boss'); G.hazards = []; G.bullets = []; },
  // everyone in the party takes up positions, in or out of a cutscene
  party(x, y, o = {}) {
    const list = [ME, ...allyList().filter(a => a.key)];
    list.forEach((p, i) => { const px = x + (i - (list.length - 1) / 2) * (o.gap ?? 16), py = y + (i % 2) * 10; if (o.walk) p.goal = { x: px, y: py, spd: o.spd || 48 }; else { p.x = px; p.y = py; p.goal = null; p.moving = false; } if (o.face) p.face = o.face; });
    for (const pl of G.players) if (pl !== ME) { pl.x = x + rand(-20, 20); pl.y = y + rand(10, 26); }
    return o.walk ? tick(() => list.every(p => !p.goal)) : tick(() => true);
  },
  armyHold(on) { for (const a of allyList()) a.cine = !!on; },
  *convo(lines) { for (const [w, t, o] of lines) yield C.say(w, t, o); },
  spot,
  point(x, y) { Camp.pointer = x === null ? null : { x, y }; },
  teleport(x, y) {
    const dx = x - ME.x, dy = y - ME.y;
    for (const pl of G.players) { pl.x += dx; pl.y += dy; }
    for (const a of allyList()) { a.x += dx + rand(-6, 6); a.y += dy + rand(-6, 6); }
    Cine.cam.x += dx; Cine.cam.y += dy;
    G.enemies = G.enemies.filter(e => e.prop || e.boss);
    G.gems.length = 0; G.items.length = 0;
  },
  shard(n) { LDS().shards = Math.max(LDS().shards, n); banner(`Dawn Shard ${n}/5`, 'A fragment of the sun', '#ffd35a'); Snd.play('chest'); },
  rel(who, n) { LDS().rel[who] = (LDS().rel[who] || 0) + n; },
});

/* ---------- Living battle: companions react, Mira mends, Bram repairs, stuns wear off ---------- */
const CHATTER = {
  kael: { fight: ['Still count thirty-seven for me.', 'Behind you!', 'Too slow!', 'Is that all of them? Because I brought a lot of arrows.', 'Elara, left side!'], hurt: ['Ow! Okay, that one was fair.', 'I am fine! I am so fine!'] },
  mira: { fight: ['Stay close, I can mend you!', 'The light holds. Keep fighting.', 'Do not let them reach the wounded!'], hurt: ['Elara! Fall back and breathe!', 'You are bleeding. Let me work.'] },
  bram: { fight: ['LEFT SIDE!', 'Nobody touches that wall.', 'Come on, then!', 'I can hold this line all night.'], hurt: ['Bruises. Just bruises.', 'Hnh. I have been hit harder by my sister.'] },
  orin: { fight: ['The machines are still running down there! Keep them off me!', 'I need ten more seconds!', 'Please do not let them near the engine.'], hurt: ['I am an engineer, not a soldier!'] },
  seren: { fight: ['Hold the line! For Veyra!', 'Archers, volley!', 'Shields up!'], hurt: ['Steady. We are not done.'] },
};
Mods.add({
  update(dt) {
    if (!G.ld || Camp.inSim) return;
    for (const pl of G.players) if (pl.stunT > 0) pl.stunT -= dt;
    const st = G.ld;
    // Mira's light heals everyone around her, not only you
    const mira = allyList().find(a => a.key === 'mira' && !a.down);
    if (mira) {
      st.miraT = (st.miraT ?? 3) - dt;
      if (st.miraT <= 0) {
        st.miraT = 4;
        const hurt = [...G.players.filter(p => !p.down && p.hp < p.maxHp), ...allyList().filter(a => !a.down && a.hp < a.maxHp), ...Cine.actors.filter(a => a.civ && a.hp < a.maxHp)].filter(o => Math.hypot(o.x - mira.x, o.y - mira.y) < 120);
        if (hurt.length) {
          G.fx.push({ k: 'ring', x: mira.x, y: mira.y, t: 0, dur: 0.5, r: 120, c: '#8ff0ff' }); Snd.play('heal');
          for (const o of hurt) { o.hp = Math.min(o.maxHp, o.hp + (o.isPlayer ? 14 : 28)); burst(o.x, o.y, '#8ff0ff', 6, 40); addText(o.x, o.y - 14, '+', false, '#8ff0ff'); }
        }
      }
    }
    // Bram mends barricades
    // Bram, Orin and anyone you set to repair mend walls and engines they stand beside
    const menders = [...allyList().filter(a => (a.key === 'bram' || a.key === 'orin' || a.repairs) && !a.down), ...Cine.actors.filter(a => a.repair && a.hp > 0)];
    for (const m of menders) for (const p of Scn.pieces) if (p.tgt && !p.fallen && p.hp < p.maxHp && Math.hypot(p.x - m.x, p.y - m.y) < 48) {
      p.hp = Math.min(p.maxHp, p.hp + 14 * dt);
      if (Math.random() < dt * 8) addPart(p.x + rand(-10, 10), p.y - rand(2, 10), rand(-20, 20), rand(-40, -10), 0.4, pick(['#ffd35a', '#e8742c']), 1, 120);
    }
    // an Orin or a Bram near something that needs mending also keeps the engine going (see ldchapters)
    // civilians who reach their goal are safe
    for (const a of Cine.actors) if (a.civ && a.goal === null && a.escapeTo && Math.hypot(a.x - a.escapeTo.x, a.y - a.escapeTo.y) < 14) { a.alpha -= dt * 2; if (a.alpha <= 0) { a.gone = true; st.civSaved = (st.civSaved || 0) + 1; } }
    if (Cine.actors.some(a => a.gone)) Cine.actors = Cine.actors.filter(a => !a.gone);
    // companions call out what is happening
    st.chatT = (st.chatT ?? 8) - dt;
    if (st.chatT <= 0 && state === 'play' && !Cine.on) {
      st.chatT = rand(9, 15);
      const near = G.enemies.filter(e => !e.prop && !e.dead && Math.hypot(e.x - ME.x, e.y - ME.y) < 150).length;
      const who = allyList().filter(a => a.key && CHATTER[a.key] && !a.down);
      if (who.length && near > 3) {
        const a = pick(who), low = ME.hp < ME.maxHp * 0.35, pool = low ? CHATTER[a.key].hurt : CHATTER[a.key].fight;
        pushBark(a.key, pick(pool), 3);
      }
    }
  },
  gameOver() { if (G.ld) LDMEM.died = true; },
});

/* ---------- Gravity, the sun's surface, the closing arena ---------- */
Mods.add({
  update(dt) {
    if (!G.ld || Camp.inSim) return;
    const gr = G.ld.gravity;
    if (gr) {
      gr.t += dt;
      if (gr.t > gr.period) { gr.t = 0; gr.ang += Math.PI * (Math.random() < 0.5 ? 0.5 : -0.5) + Math.PI * 0.25 * Math.random(); G.shake = Math.max(G.shake, 3); Snd.play('rumble'); pushBark('mira', 'The ground is tilting! Hold on!', 2.4); }
      const fx = Math.cos(gr.ang) * gr.force, fy = Math.sin(gr.ang) * gr.force;
      for (const pl of G.players) if (!pl.down) { pl.x += fx * dt; pl.y += fy * dt; }
      for (const e of G.enemies) if (!e.prop && !e.dead && !e.boss) { e.x += fx * 0.7 * dt; e.y += fy * 0.7 * dt; }
      for (const a of allyList()) { a.x += fx * 0.6 * dt; a.y += fy * 0.6 * dt; }
      if (Math.random() < dt * 40) addPart(ME.x + rand(-W / 2, W / 2), ME.y + rand(-H / 2, H / 2), fx * 2, fy * 2, 0.8, pick(['#4a2470', '#9a4fd0', '#e27bf0']), 1);
    }
    const ar = G.ld.arena;
    if (ar) {
      if (ar.shrink && ar.R > ar.min) ar.R = Math.max(ar.min, ar.R - ar.shrink * dt);
      ar.tk = (ar.tk || 0) - dt;
      if (ar.tk <= 0) { ar.tk = 0.5; for (const pl of G.players) if (!pl.down && Math.hypot(pl.x - ar.x, pl.y - ar.y) > ar.R) hurtPlayer(8, pl); }
    }
  },
  drawGround(now) {
    if (!G.ld) return;
    const ar = G.ld.arena;
    if (ar) {
      const cx = ar.x - camX, cy = ar.y - camY;
      ctx.save();
      ctx.fillStyle = ar.sun ? 'rgba(232,116,44,0.18)' : 'rgba(4,2,10,0.6)';
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.ellipse(cx, cy, ar.R, ar.R * 0.72, 0, 0, TAU, true); ctx.fill('evenodd');
      ctx.restore();
      ringOval(cx, cy, ar.R, ar.sun ? '#ffd35a' : '#e27bf0', 0.72, 2);
      if (ar.sun) for (let i = 0; i < 40; i++) { const a = i / 40 * TAU + now * 0.4, r = ar.R * (0.4 + 0.55 * ((i * 37) % 10) / 10); ctx.fillStyle = i % 2 ? '#ffd35a' : '#e8742c'; ctx.globalAlpha = 0.5; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.72), 2, 1); ctx.globalAlpha = 1; }
    }
  },
  director() { return !!G.ld; },   // the campaign decides what attacks and when
  pointers(list) {
    if (G.ld && Camp.pointer && state === 'play' && !onScreen(Camp.pointer.x, Camp.pointer.y, 10)) list.push({ x: Camp.pointer.x, y: Camp.pointer.y, pcolor: '#ffd35a', picon: ICON.star });
  },
});

/* ---------- Dungeon hooks: lore on the walls, the shard room ---------- */
const ldBaseUpdateCrypt = updateCrypt;
updateCrypt = function (dt) {
  ldBaseUpdateCrypt(dt);
  if (!G.ld || !D || D.dead) return;
  if (Cine.barks.length) { for (const b of Cine.barks) b.t -= dt; if (Cine.barks.some(b => b.t <= 0)) { Cine.barks = Cine.barks.filter(b => b.t > 0); renderBarks(); } }
  for (const m of D.murals || []) {
    if (m.read || !D.bodies.some(b => !b.out && Math.abs(b.x - m.x) < 26 && Math.abs(b.y - m.y) < 40)) continue;
    m.read = true; Snd.play('shrine');
    for (const [w, t] of m.lines) pushBark(w, t, 6.5 / m.lines.length * 1.4);
    if (!LDS().lore.includes(m.id)) LDS().lore.push(m.id);
  }
};
const ldBaseRenderCrypt = renderCrypt;
renderCrypt = function () {
  ldBaseRenderCrypt();
  if (!G.ld || !D || !D.murals) return;
  const now = performance.now() / 1000;
  for (const m of D.murals) {
    const sx = Math.round(m.x - camX), sy = Math.round(m.y - camY);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(sx - 9, sy - 30, 19, 22);
    ctx.fillStyle = m.read ? '#4a4258' : '#7a6a3a'; ctx.fillRect(sx - 8, sy - 29, 17, 20);
    ctx.fillStyle = m.read ? '#8a80a0' : '#ffd35a';
    ctx.fillRect(sx - 5, sy - 26, 3, 3); ctx.fillRect(sx + 1, sy - 26, 4, 2); ctx.fillRect(sx - 6, sy - 20, 12, 1); ctx.fillRect(sx - 4, sy - 16, 8, 1);
    if (!m.read) { light(m.x, m.y - 18, 36, 0.7); glowAt(m.x, m.y - 18, 12, '#ffd35a', 0.35 + Math.sin(now * 3) * 0.15); }
  }
};
const ldBaseFinishCrypt = finishCrypt;
finishCrypt = function () {
  if (G.ld && D && D.ld) {
    D.dead = true; Snd.play('chest');
    leaveCrypt(() => { G.ld.cryptDone = true; });
    return;
  }
  ldBaseFinishCrypt();
};
// A crypt entered for the story gets its murals and its story flag as soon as it is built
Mods.add({
  state(s) {
    if (s !== 'dungeon' || !G || !G.ld || !G.ld.cryptPlan || !D || D.ld) return;
    D.ld = true;
    D.murals = (G.ld.cryptPlan.murals || []).map((m, i) => ({ ...m, id: 'mural' + i, x: D.start.x + m.dx, y: D.start.y - 2 }));
    if (G.ld.cryptPlan.onEnter) G.ld.cryptPlan.onEnter();
  },
});

/* ---------- Starting, ending and replaying a chapter ---------- */
function startChapter(i, local, replay) {
  const ch = STORY[i];
  Snd.init();
  const retry = LDMEM.died && LDMEM.lastIdx === i; LDMEM.died = false; LDMEM.lastIdx = i; LDMEM.replay = !!replay;
  if (!replay && i === 0 && !retry) { const keep = LDS().done; save.ld = LD_NEW(); save.ld.done = keep; }
  newRun(local ? local[0].ch : 'wren', { story: { chapter: i, noPortals: true, noStructs: true, ld: true }, local });
  G.evIdx = EVENTS.length; G.eventT = Infinity; G.cryptT = 1e9; G.shrineT = 1e9; G.spawnMul = 0;
  G.storyState = { stage: 0 };
  G.ld = { i, civSaved: 0, civLost: 0, pointer: null };
  G.t = i * 130; G.hpMul = 1 + i * 0.28;
  if (!local) {
    ME.ch = { id: 'elara', name: 'Elara', title: 'the Wanderer', weapon: 'bolt', mods: { speed: 0.06, maxHp: 20 } };
    ME.frames = charFrames('elara');
    P = ME; recalc(); ME.hp = ME.maxHp;
  }
  if (!replay) ldRestoreBuild();
  for (const pl of G.players) { pl.x = 0; pl.y = 0; }
  biomeOverride = null; resetWorldCache();
  scnClear(); Spots.length = 0; nameIdx = 0;
  for (const k of ldCompanions(i)) companion(k, rand(-20, -8), rand(8, 20));
  ch.build();
  const done = () => {
    if (replay) { Cine.fade = 1; setTimeout(openMenu, 300); return; }
  };
  const skip = retry;
  campRun(function* (c) {
    if (skip) Camp.skipping = true;
    yield* ch.opening(c);
    Camp.skipping = false;
    yield* ch.play(c);
  }, done);
}
// A chapter ends with a recap and the way on; the campaign remembers what happened
function* finishChapter(c, i, recap) {
  const ch = STORY[i], L = LDS();
  yield c.fade(1, 1.2);
  if (!LDMEM.replay) {
    L.done[ch.id] = true;
    save.story = save.story || {}; save.story[ch.id] = true;
    ldSaveBuild();
    save.gold += 150;
    persist();
  }
  Snd.play('win');
  let choice = null;
  const next = STORY[i + 1];
  openModal({
    title: i === STORY.length - 1 ? 'The Last Dawn' : 'Chapter complete', color: '#ffd35a', sub: ch.title + ' · +150 gold',
    body: `<p class="flavor">${recap}</p><p>${ldStatusLine()}</p>`,
    buttons: [...(next ? [{ label: 'Next chapter', primary: true, act: () => { choice = 'next'; } }] : []), { label: 'Return to the menu', act: () => { choice = 'menu'; } }],
  }, ME);
  yield c.until(() => choice);
  Cine.fade = 0;
  if (choice === 'next') startChapter(i + 1, G.localDevs || undefined);
  else openMenu();
  yield c.until(() => false);
}
function ldStatusLine() {
  const L = LDS(), bits = [`Dawn Shards ${L.shards}/5`];
  if (L.rescued.length) bits.push(`Survivors rescued: ${L.rescued.length}`);
  const hurt = Object.keys(L.injured).filter(k => L.injured[k] >= (G && G.ld ? G.ld.i : 0));
  if (hurt.length) bits.push(hurt.map(k => ALLY_TYPES[k].name).join(', ') + ' recovering');
  const dead = Object.keys(L.dead);
  if (dead.length) bits.push(dead.map(k => (SPEAKERS[k] || { name: k }).name).join(', ') + ' lost');
  return bits.join(' · ');
}

/* ---------- The Story screen ---------- */
const CAST = { 0: ['elara', 'kael', 'mira', 'bram', 'ashen'], 1: ['elara', 'kael', 'mira', 'bram', 'lyra'], 2: ['elara', 'seren', 'tomas', 'orin', 'bram'], 3: ['elara', 'orin', 'mira', 'kael'],
  4: ['elara', 'kael', 'mira', 'bram', 'orin'], 5: ['elara', 'seren', 'lyra', 'orin', 'tomas'], 6: ['elara', 'ashenBare', 'kael', 'mira'], 7: ['elara', 'kael', 'mira', 'bram', 'orin', 'eclipse'] };
function openStory() {
  setState('story');
  const L = LDS(), box = $('storyList');
  box.innerHTML = '';
  const cur = STORY.findIndex(c => !L.done[c.id]);
  $('storyHead').textContent = `Chapters ${ldProgress()}/${STORY.length}  ·  Dawn Shards ${L.shards}/5  ·  ${ldProgress() === STORY.length ? 'The sun has risen' : cur >= 0 ? 'Next: ' + STORY[cur].title : ''}`;
  STORY.forEach((ch, i) => {
    const open = i === 0 || L.done[STORY[i - 1].id], done = L.done[ch.id];
    const b = document.createElement('button');
    b.className = 'card char' + (open ? '' : ' locked');
    b.style.animationDelay = i * 0.05 + 's';
    b.innerHTML = `<img class="portrait" src="${portraitOf((CAST[i] || ['elara'])[0])}" alt="">
      <div><div class="name">${ch.title}</div><div class="title2">${open ? ch.sub : 'Locked'}</div></div>
      <div class="desc">${open ? ch.blurb : 'Finish the chapter before this one.'}</div>
      <div class="cast">${open ? (CAST[i] || []).map(w => `<img src="${portraitOf(w)}" alt="" title="${speakerName(w)}">`).join('') : ''}</div>
      ${done ? '<div class="price">Completed</div>' : i === cur ? '<div class="cur">CURRENT CHAPTER</div>' : ''}`;
    b.onclick = () => { if (open) { Snd.play('select'); startChapter(i); } else Snd.play('hurt'); };
    b.onmouseenter = () => Snd.play('hover');
    box.appendChild(b);
  });
  $('btnReplay').classList.toggle('hidden', !STORY.some(c => L.done[c.id]));
}
// Replay the opening cinematic of any chapter you have finished
$('btnReplay').onclick = () => {
  Snd.play('select');
  const L = LDS(), seen = STORY.map((c, i) => [c, i]).filter(([c]) => L.done[c.id]);
  openModal({ title: 'Cinematic replay', color: '#ffd35a', sub: 'Choose a chapter', buttons: [...seen.map(([c, i]) => ({ label: c.title, act: () => setTimeout(() => startChapter(i, undefined, true), 50) })), { label: 'Back', act: () => openStory() }] }, ME || null);
};
STORY.length = 0;   // ldchapters.js fills the list

/* ---------- The credits ---------- */
function* rollCredits(c) {
  const el = $('credits'), roll = $('creditsRoll');
  roll.style.animation = 'none'; void roll.offsetWidth; roll.style.animation = '';
  roll.innerHTML = `<h3>ROGUE SURVIVORS 3</h3><h3>THE LAST DAWN</h3>
    <h4>ELARA</h4><p>The Wanderer</p><h4>KAEL</h4><p>The Hunter</p><h4>MIRA</h4><p>The Keeper</p><h4>BRAM</h4><p>The Blacksmith</p><h4>ORIN</h4><p>The Engineer</p>
    <h4>THE ASHEN KNIGHT</h4><p>Who sealed the sun, and kept the watch</p><h4>SEREN · TOMAS · LYRA</h4><p>The people of Veyra</p>
    <h4>IN MEMORY OF</h4><p>Every light that burned through thirty-seven nights</p><h3 style="margin-top:80px">Thank you for playing</h3>`;
  el.classList.remove('hidden');
  let closed = false;
  const skip = () => { closed = true; };
  el.addEventListener('pointerdown', skip, { once: true });
  const t0 = performance.now();
  yield c.until(() => closed || LDFAST || performance.now() - t0 > 47000);
  el.classList.add('hidden');
}
