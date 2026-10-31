'use strict';
/* The living world: structures, villages and their folk, shrine kinds, world events, relics,
   demon fragments, the minimap, and the generic dialog box every interaction uses. */

/* ---------- Dialog box (works for the remote co-op player too, via net.js) ---------- */
let MODAL = null, MODAL_FROM = 'play', MODAL_ACTOR = null;
SCREENS.push('modal');
HUD_STATES.add('modal');
function openModal(def, actor) {
  actor = actor || P || ME;
  if (actor && actor !== ME && !G.local) { Mods.call('remoteModal', actor, def); return; }
  if (state !== 'modal') MODAL_FROM = state;
  MODAL = def; MODAL_ACTOR = ME;
  setState('modal');
  drawModal();
}
function drawModal() {
  $('mTitle').textContent = MODAL.title;
  $('mTitle').style.color = MODAL.color || '';
  $('mSub').textContent = MODAL.sub || '';
  $('mBody').innerHTML = MODAL.body || '';
  const box = $('mBtns');
  box.innerHTML = '';
  MODAL.buttons.forEach((b, i) => {
    const el = document.createElement('button');
    el.className = 'btn opt ' + (b.primary ? '' : 'ghost');
    el.innerHTML = `<span>${b.label}</span>${b.desc ? `<small>${b.desc}</small>` : ''}`;
    el.disabled = !!b.disabled;
    el.onclick = () => modalPick(i);
    el.onmouseenter = () => Snd.play('hover');
    box.appendChild(el);
  });
}
function modalPick(i) {
  const b = MODAL && MODAL.buttons[i];
  if (!b || b.disabled) return;
  Snd.play('select');
  const keep = MODAL;
  if (b.act) b.act();
  if (MODAL === keep) closeModal();
}
function closeModal() { MODAL = null; setState(MODAL_FROM === 'modal' ? 'play' : MODAL_FROM || 'play'); }
const goldLine = () => `You carry ${G.gold} gold`;

/* ---------- Unique relics and run-long blessings ---------- */
const RELICS = {
  witchEye: { name: "Witch's Eye", desc: '+2 luck. Hidden places show on your map', icon: 'luck', apply: p => { p.luck += 2; } },
  stagHeart: { name: 'Heart of the Stag', desc: '+40 max HP and +1 HP every second', icon: 'vitality', apply: p => { p.maxHp += 40; p.regen += 1; } },
  demonHorn: { name: 'Demon Horn', desc: '+25% damage, +10% move speed', icon: 'might', apply: p => { p.might += 0.25; p.speed *= 1.1; } },
  templeIdol: { name: 'Temple Idol', desc: '+20% area and +20% duration', icon: 'area', apply: p => { p.area += 0.2; p.duration += 0.2; } },
  moonPearl: { name: 'Moon Pearl', desc: '+1 projectile on every weapon', icon: 'amount', apply: p => { p.amount += 1; } },
  minerLamp: { name: "Miner's Lamp", desc: '+50% pickup range, +20% experience', icon: 'magnet', apply: p => { p.magnet *= 1.5; p.growth += 0.2; } },
  thiefRing: { name: "Thief's Ring", desc: '+50% gold from everything', icon: 'midas', apply: p => { p.greed += 0.5; } },
  crown: { name: 'Crown of Dawn', desc: '+25% damage, area and speed; -15% cooldowns', icon: 'growth', apply: p => { p.might += 0.25; p.area += 0.25; p.speed *= 1.25; p.cooldown *= 0.85; } },
};
Mods.add({
  recalc(p) {
    for (const id of p.relics || []) RELICS[id].apply(p);
    const b = p.bonus || {};
    p.luck += b.luck || 0; p.might += b.might || 0;
  },
});
function giveRelic(id, pl = P) {
  pl.relics = pl.relics || [];
  if (pl.relics.includes(id)) { G.gold += 100; banner(RELICS[id].name, 'Already owned: +100 gold instead', '#ffd35a'); return; }
  pl.relics.push(id);
  const keep = P; P = pl; recalc(); P = keep;
  if (pl === ME) refreshSlots();
  banner(RELICS[id].name, RELICS[id].desc, '#ffd35a');
  Snd.play('evolve');
}
const dropAt = (k, x, y, extra = {}) => G.items.push({ k, x, y, ph: 0, ...extra });
const dropRelic = (id, x, y) => dropAt('relic', x, y, { relic: id, spr: ICON[RELICS[id].icon] });
const dropFragment = (x, y) => dropAt('fragment', x, y, { spr: BUILD.fragment });

Object.assign(BUFFS, {
  bloodpact: { name: 'Blood Pact', desc: '60% more damage', icon: 'blood', color: '#d8354a', dur: 60 },
  greed: { name: 'Greed', desc: 'tougher foes, triple gold', icon: 'midas', color: '#ffd35a', dur: 90 },
  haste: { name: 'Haste', desc: 'everything is faster', icon: 'speed', color: '#a6e05a', dur: 60 },
  echo: { name: 'Echoes', desc: 'weapons strike twice', icon: 'amount', color: '#8ff0ff', dur: 30 },
  bloodmoon: { name: 'Blood Moon', desc: 'the horde swells', icon: 'skull', color: '#d8354a', dur: 40 },
});

/* ---------- Structures ---------- */
const REGION = 680;
const STRUCT_W = { town: 0.45, village: 1.2, ruinvillage: 0.9, hut: 1, tower: 0.55, ruins: 0.8, graveyard: 0.9, bandits: 1, mine: 0.8, watchtower: 1.1, gate: 0.4, temple: 0.5, mansion: 0.5 };
const STRUCT_R = { town: 290, village: 200, ruinvillage: 190, hut: 60, tower: 50, ruins: 80, graveyard: 150, bandits: 125, mine: 64, watchtower: 40, gate: 60, temple: 90, mansion: 110 };
const STRUCT_COL = { town: '#ffd35a', village: '#ffd35a', ruinvillage: '#a59cc4', hut: '#a6e05a', tower: '#f2eee6', ruins: '#e8742c', graveyard: '#a6e05a', bandits: '#d8354a', mine: '#9a6a42', watchtower: '#9a6a42', gate: '#d8354a', temple: '#c9c2e0', mansion: '#e27bf0' };
const NPC_NAMES = { witch: 'Witch', smith: 'Blacksmith', alchemist: 'Alchemist', cartographer: 'Cartographer', hunter: 'Hunter', merchant: 'Merchant', priest: 'Priest' };
const regionCache = new Map();
const noStructs = () => !!G.dim && !G.dimStructs;
function regionStruct(rx, ry) {
  if (!G || (G.dim && !G.dimStructs) || G.story?.noStructs) return null;
  if (!G.dim && !G.story && typeof coastK === 'function' && coastK(rx * REGION, ry * REGION) > 0.8) return null;
  const key = rx + ',' + ry;
  if (regionCache.has(key)) return regionCache.get(key);
  let st = null;
  if (Math.abs(rx) + Math.abs(ry) > 0) {
    const r = mulberry32((rx * 92837111) ^ (ry * 689287499) ^ (G.seed * 7) ^ (G.dim ? G.dim.length * 7919 + G.dim.charCodeAt(0) * 104729 : 0));
    if (r() < (G.dim ? 0.5 : 0.88)) {
      const type = pickWeighted(G.dim ? DIM_STRUCT_W : STRUCT_W, r);
      const jit = Math.max(0.08, 0.45 - STRUCT_R[type] / REGION * 1.1);
      st = { id: key, type, x: rx * REGION + (r() - 0.5) * REGION * jit, y: ry * REGION + (r() - 0.5) * REGION * jit, R: STRUCT_R[type], seed: (r() * 1e9) | 0, pieces: [], npcs: [], built: false };
    }
  }
  regionCache.set(key, st);
  return st;
}
const regionOf = v => Math.floor((v + REGION / 2) / REGION);
function structsNear(x, y, rad = 1) {
  const out = [], rx = regionOf(x), ry = regionOf(y);
  for (let i = -rad; i <= rad; i++) for (let j = -rad; j <= rad; j++) { const s = regionStruct(rx + i, ry + j); if (s) out.push(s); }
  return out;
}
function buildStruct(st) {
  st.built = true;
  const r = mulberry32(st.seed), put = (spr, dx, dy, solid = 0, flat = false) => st.pieces.push({ spr, x: st.x + dx, y: st.y + dy, solid, flat });
  switch (st.type) {
    case 'village': case 'ruinvillage': {
      const ruined = st.type === 'ruinvillage';
      const n = 4 + (r() * 2 | 0);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + r() * 0.4, d = 72 + r() * 18;
        put(ruined ? BUILD.ruin[i % 2] : BUILD.house[i % 3], Math.cos(a) * d, Math.sin(a) * d * 0.75, 13);
      }
      put(BUILD.well, 0, 0, 7);
      if (!ruined) {
        for (const [dx, dy] of [[-40, -30], [40, -30], [-40, 34], [40, 34]]) put(BUILD.lamp, dx, dy, 2);
        const kinds = Object.keys(NPC_NAMES).sort(() => r() - 0.5).slice(0, 3 + (r() < 0.4 ? 1 : 0));
        kinds.forEach((k, i) => { const a = i / kinds.length * TAU + 0.6; st.npcs.push(makeNpc(k, st.x + Math.cos(a) * 42, st.y + Math.sin(a) * 30)); });
      } else {
        st.overrun = r() < 0.55; st.brute = r() < 0.25; st.survivor = r() < 0.35; st.cellar = r() < 0.55;
        if (st.survivor) st.npcs.push(makeNpc('prisoner', st.x + 22, st.y + 16));
        if (st.cellar) st.hatch = { x: st.x - 26, y: st.y + 20 };
      }
      break;
    }
    case 'hut': put(BUILD.hut, 0, 0, 12); st.door = { x: st.x, y: st.y + 6 }; st.relic = r() < 0.2; break;
    case 'tower': put(BUILD.tower, 0, 0, 13); st.door = { x: st.x, y: st.y + 6 }; break;
    case 'ruins': st.hatch = { x: st.x, y: st.y }; for (let i = 0; i < 3; i++) put(DECOR.pillar, Math.cos(i * 2.1) * 34, Math.sin(i * 2.1) * 24, 4); break;
    case 'graveyard': for (let i = 0; i < 16; i++) { const a = r() * TAU, d = 20 + r() * 80; st.pieces.push({ grave: true, x: st.x + Math.cos(a) * d, y: st.y + Math.sin(a) * d * 0.7, cracked: r() < 0.5 }); } break;
    case 'bandits':
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.4; put(BUILD.tent, Math.cos(a) * 55, Math.sin(a) * 40, 10); }
      put(BUILD.cage, 34, 6, 7); st.npcs.push(makeNpc('prisoner', st.x + 34, st.y + 2)); st.npcs[0].caged = true;
      break;
    case 'mine': put(BUILD.mine, 0, 0, 12); st.door = { x: st.x, y: st.y + 6 }; break;
    case 'watchtower': put(BUILD.watchtower, 0, 0, 8); break;
    case 'gate': put(BUILD.gate, 0, 0, 0); st.pieces[0].solids = [[-16, 0, 8], [16, 0, 8]]; st.door = { x: st.x, y: st.y + 2 }; break;
    case 'temple': put(BUILD.temple, 0, 0, 22); st.door = { x: st.x, y: st.y + 8 }; break;
    case 'mansion': {
      put(BUILD.mansion, 0, 0, 26); st.door = { x: st.x, y: st.y + 8 };
      const a = r() * TAU; st.keyAt = { x: st.x + Math.cos(a) * 190, y: st.y + Math.sin(a) * 150 };
      break;
    }
  }
  registerStruct(st);
}
function registerStruct(st) {
  for (const p of st.pieces) {
    if (p.solid) addSolid({ x: p.x, y: p.y - 3, r: p.solid });
    if (p.solids) for (const [dx, dy, rr] of p.solids) addSolid({ x: p.x + dx, y: p.y + dy - 3, r: rr });
  }
}
function makeNpc(kind, x, y) {
  return { isNPC: true, kind, x, y, hx: x, hy: y, frames: NPC_SPR[kind] || NPC_SPR.villager, ph: Math.random() * 6, face: 1, anim: 0, hp: 40, maxHp: 40,
    draw(now) { drawNpc(this, now); }, get sortY() { return this.y + 8; } };
}
function drawNpc(n, now) {
  if (n.dead) return;
  const moving = n.moving, f = moving ? n.frames[Math.floor(n.anim) % n.frames.length] : n.frames[0];
  const bob = moving ? 0 : Math.round(Math.sin(now * 2 + n.ph) * 0.6);
  shadow(n.x, n.y + 8, 10);
  const x = Math.round(n.x - camX - f.w / 2), y = Math.round(n.y - camY - f.h / 2) + bob;
  band(f.c, f.w, 0, 6, x + (Math.sin(now * 0.7 + n.ph) > 0.8 ? 1 : 0), y, n.face < 0);
  band(f.c, f.w, 6, f.h - 6, x, y, n.face < 0);
  if (n.caged) { const c = BUILD.cage; ctx.drawImage(c.c, Math.round(n.x - camX - c.w / 2), Math.round(n.y - camY - c.h / 2 + 1)); }
  if (n.hp < n.maxHp && n.villager) { ctx.fillStyle = '#0b0a12'; ctx.fillRect(x + 1, y - 3, 18, 3); ctx.fillStyle = '#a6e05a'; ctx.fillRect(x + 2, y - 2, Math.round(16 * n.hp / n.maxHp), 1); }
  const near = nearInteract(ME);
  if (near && near.npc === n && Math.floor(now * 3) % 2) drawText(ctx, 'E', n.x - camX, n.y - camY - 16, '#ffd35a');
  if (n.kind === 'witch' || n.kind === 'priest') light(n.x, n.y, 26, 0.5);
}

/* activation: spawn guards, loot and keys the first time someone comes close */
function activateStruct(st) {
  st.active = true;
  const r = mulberry32(st.seed + 99), around = (n, rad, types, o = {}) => { for (let i = 0; i < n; i++) { const a = r() * TAU, e = spawnEnemy(pick(types), st.x + Math.cos(a) * rad * r(), st.y + Math.sin(a) * rad * r() * 0.7, o); e.rise = 0.5; } };
  switch (st.type) {
    case 'ruinvillage':
      for (let i = 0; i < 2; i++) dropAt('chest', st.x + (i ? 50 : -50), st.y + 8);
      if (st.overrun) around(14, st.R, ['ghoul', 'skel', 'wraith']);
      if (st.brute) makeBoss('brute', st.x, st.y - 20, { minor: true, hpMul: G.hpMul, onDeath: e => { dropAt('chest', e.x, e.y, { boss: true }); dropAt('bag', e.x + 10, e.y); } });
      break;
    case 'bandits':
      around(7, st.R, ['bandit', 'archer']);
      break;
    case 'watchtower':
      st.archers = [];
      for (const dx of [-5, 5]) {
        const e = spawnEnemy('archer', st.x + dx, st.y - (st.perchY || 24) + 4, { hpMul: 2 });
        e.anchored = true; e.sortY = st.y + 2; e.xp = 8; e.ai = perchedAI; e.rise = 0;
        st.archers.push(e);
      }
      break;
    case 'mansion':
      dropAt('key', st.keyAt.x, st.keyAt.y, { spr: BUILD.key, st });
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const e = spawnEnemy(pick(['wraith', 'ghoul']), st.keyAt.x + Math.cos(a) * 30, st.keyAt.y + Math.sin(a) * 22); e.rise = 0.5; }
      break;
    case 'graveyard':
      st.graves = st.pieces.filter(p => p.grave).map(p => {
        const e = { id: uid++, prop: true, x: p.x, y: p.y, r: 5, hp: 1, maxHp: 1, d: { color: '#5e557f', kb: 0 }, cd: {}, frames: [DECOR.grave], flash: 0, anim: 0, kx: 0, ky: 0, dead: false, hh: 4, scale: 1,
          cracked: p.cracked, graveOf: st, draw(now) { blit(DECOR.grave.c, this.x, this.y - 4, 8, 9); if (this.cracked) { ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(this.x - camX) - 1, Math.round(this.y - camY) - 7, 1, 4); } }, sortY: p.y,
          onBreak: graveBroken };
        G.enemies.push(e);
        return e;
      });
      break;
  }
}
function perchedAI(e, dt, tp, dx, dy, d) {
  e.dir = dx < 0 ? -1 : 1;
  e.shootT = (e.shootT ?? rand(0.5, 1.5)) - dt;
  if (e.shootT <= 0 && d < 240) { e.shootT = 1.4; shoot(e.x, e.y - 4, Math.atan2(dy, dx), 150, { style: 'knife', c: '#b5b2c4', dmg: 10, r: 2 }); Snd.play('shoot'); }
}
function graveBroken(e) {
  const st = e.graveOf;
  st.broken = (st.broken || 0) + 1;
  burst(e.x, e.y - 3, '#5e557f', 12, 60);
  Snd.play('glass');
  dropAt('coin', e.x, e.y);
  if (e.cracked && Math.random() < 0.55) dropAt(pick(['bag', 'heart', 'coin']), e.x, e.y);
  if (Math.random() < 0.08) dropFragment(e.x, e.y);
  if (!st.keeper && !st.cleansed && st.broken >= 6) {
    st.keeper = makeBoss('gravekeeper', e.x, e.y - 20, { minor: true, hpMul: G.hpMul, onDeath: k => { st.cleansed = true; dropAt('chest', k.x, k.y, { boss: true }); dropFragment(k.x + 12, k.y); banner('The graveyard falls silent', '', '#a6e05a'); } });
    banner('The Gravekeeper awakens', 'You disturbed too many graves', '#a6e05a');
    Snd.play('warn');
  }
}
const origBreakProp = breakProp;
breakProp = function (e) { if (e.onBreak) { e.dead = true; e.onBreak(e); return; } origBreakProp(e); };

/* ---------- Interactions ---------- */
function interactablesOf(st) {
  const list = [];
  for (const n of st.npcs) {
    if (n.dead) continue;
    if (n.kind === 'prisoner') {
      if (st.type === 'bandits' && !st.freed) list.push({ x: n.x, y: n.y, npc: n, label: st.chiefDead ? 'Free the prisoner' : st.chief ? 'The chief still guards the prisoner' : 'Free the prisoner (wakes the chief)', act: pl => { if (st.chiefDead) freePrisoner(st, pl); else if (!st.chief) wakeChief(st, n.x, n.y); } });
      else if (st.type === 'ruinvillage' && !st.helped) list.push({ x: n.x, y: n.y, npc: n, label: 'Help the survivor', act: pl => helpSurvivor(st, pl) });
    } else if (!st.ruined) list.push({ x: n.x, y: n.y, npc: n, label: 'Talk to the ' + NPC_NAMES[n.kind], act: pl => openShop(n.kind, st, pl) });
  }
  if (st.hatch && !st.done && (st.type !== 'ruins' || nearAny(st.hatch, 70))) list.push({ ...st.hatch, label: st.type === 'ruins' ? 'Open the buried hatch' : 'Descend into the cellar', act: pl => goDungeon(pl, st.type === 'ruins' ? 'ruins' : 'cellar', st) });
  if (st.door && !st.done) {
    const t = st.type;
    if (t === 'hut' && !st.used) list.push({ ...st.door, label: "Enter the witch's hut", act: pl => witchHut(st, pl) });
    if (t === 'tower') list.push({ ...st.door, label: 'Climb the Ancient Tower', act: pl => goDungeon(pl, 'tower', st) });
    if (t === 'mine') list.push({ ...st.door, label: 'Enter the abandoned mine', act: pl => goDungeon(pl, 'mine', st) });
    if (t === 'temple') list.push({ ...st.door, label: 'Enter the Forgotten Temple', act: pl => goDungeon(pl, 'temple', st) });
    if (t === 'mansion') list.push({ ...st.door, label: G.keys?.[st.id] ? 'Unlock the mansion' : 'Locked. The key is somewhere nearby', act: pl => G.keys?.[st.id] && goDungeon(pl, 'mansion', st) });
    if (t === 'gate') list.push({ ...st.door, label: `Demon Gate (${G.fragments || 0}/3 fragments)`, act: pl => demonGate(st, pl) });
  }
  return list;
}
const nearAny = (p, r) => G.players.some(pl => Math.hypot(pl.x - p.x, pl.y - p.y) < r);
function nearInteract(pl) {
  if (!G || !pl) return null;
  let best = null, bd = 22;
  for (const st of structsNear(pl.x, pl.y)) {
    if (!st.built) continue;
    for (const it of interactablesOf(st)) { const d = Math.hypot(it.x - pl.x, it.y - (pl.y + 6)); if (d < bd) { bd = d; best = it; } }
  }
  if (G.ev && G.ev.kind === 'caravan' && G.ev.alive && Math.hypot(G.ev.x - pl.x, G.ev.y - pl.y) < 30) best = { label: 'Trade with the caravan', act: p => openShop('caravan', null, p) };
  return best;
}
function worldInteract(pl) {
  const it = nearInteract(pl);
  if (!it) return false;
  const keep = P; P = pl;
  it.act(pl);
  P = keep;
  return true;
}
function goDungeon(pl, theme, st) {
  if (!G.local && pl !== ME) { Mods.call('remoteCrypt', pl, theme, st); return; }   // online: the partner goes below on their own screen
  enterCrypt(null, theme, st);
}

/* ---------- Shops ---------- */
function shopItems(kind, st) {
  const pl = P, owned = id => (pl.relics || []).includes(id);
  const buff = (id, cost) => ({ name: BUFFS[id].name + ' draught', desc: `${BUFFS[id].desc} for 30 seconds`, cost, buy: () => { G.buffs[id] = Math.max(G.buffs[id] || 0, 30); } });
  const potion = { name: 'Healing draught', desc: 'Restore 60 HP', cost: 25, buy: () => { pl.hp = Math.min(pl.maxHp, pl.hp + 60); } };
  switch (kind) {
    case 'witch': return [
      { name: 'Murky draught', desc: 'Something will happen. Probably good', cost: 30, buy: () => openModal(outcomeModal(rollFate(), 'The draught takes hold')) },
      { name: 'Elixir of luck', desc: '+1 luck for the rest of the night', cost: 70, buy: () => { pl.bonus = pl.bonus || {}; pl.bonus.luck = (pl.bonus.luck || 0) + 1; recalc(); } },
      { name: "Witch's Eye", desc: RELICS.witchEye.desc, cost: 220, sold: owned('witchEye'), buy: () => giveRelic('witchEye', pl) },
    ];
    case 'smith': return [
      ...pl.weapons.filter(w => !w.evo && w.level < WEAPON_MAX(w.id)).map(w => ({ name: 'Hone ' + WEAPONS[w.id].name, desc: `Level ${w.level} to ${w.level + 1}`, cost: 30 + w.level * 15, buy: () => { w.level++; recalc(); refreshSlots(); } })),
      { name: 'Reforge a weapon', desc: 'Your weakest weapon becomes a different one, same level', cost: 50, buy: () => reforge(pl) },
    ];
    case 'alchemist': return [buff('rage', 45), buff('frenzy', 45), buff('aegis', 60), buff('timestop', 70), potion];
    case 'cartographer': return [{ name: 'Chart the land', desc: 'Reveal every structure within a long walk', cost: 50, buy: () => revealMap(2600) }];
    case 'hunter': return G.bounty ? [{ name: 'Bounty in progress', desc: `${G.bounty.left} foes left to slay`, cost: 0, sold: true, buy: () => 0 }]
      : [{ name: 'Take a bounty', desc: 'Slay 80 foes for 150 gold and a chest', cost: 0, buy: () => { G.bounty = { left: 80, start: G.kills }; banner('Bounty accepted', 'Slay 80 foes', '#ffd35a'); } }];
    case 'merchant': case 'caravan': return [
      potion,
      { name: 'Lodestone charm', desc: 'Pull in every gem on the field', cost: 20, buy: () => { for (const g of G.gems) { g.fly = true; g.sp = -40; } } },
      { name: 'Ash bomb', desc: 'Wipe out everything on screen', cost: 40, buy: () => dropAt('bomb', pl.x, pl.y) },
      { name: 'Mystery relic level', desc: 'One of your relics grows stronger', cost: 90, buy: () => { const c = rollChoices(1, true).find(x => x.k === 'p') || rollChoices(1)[0]; applyChoice(c); } },
      { name: 'Ember Catalyst', desc: 'Evolve a max-level weapon, no relic needed', cost: kind === 'caravan' ? 200 : 260, buy: () => catalyst(pl) },
      ...(kind === 'caravan' ? [{ name: pick(['Moon Pearl', 'Demon Horn']), desc: 'A rare relic from distant lands', cost: 300, buy: () => giveRelic(Math.random() < 0.5 ? 'moonPearl' : 'demonHorn', pl) }] : []),
    ];
    case 'priest': return [
      { name: 'Blessing', desc: '+1 luck for the rest of the night', cost: 60, buy: () => { pl.bonus = pl.bonus || {}; pl.bonus.luck = (pl.bonus.luck || 0) + 1; recalc(); } },
      { name: 'Consecrate the shrines', desc: 'Shrine offerings cost 40% less', cost: 40, buy: () => { G.shrineCost = Math.round(G.shrineCost * 0.6); } },
      { name: 'Vow of the Second Dawn', desc: 'Rise once more if you fall', cost: 300, sold: G.vowed, buy: () => { G.revivals++; G.vowed = true; } },
    ];
  }
  return [];
}
const SHOP_LINES = {
  witch: 'The witch stirs something that stirs back. "Coin first, questions never."',
  smith: 'The blacksmith wipes soot from his brow. "Steel remembers the sun. Let me remind it."',
  alchemist: 'Bottles clink in the alchemist\'s coat. "Courage, bottled. Fear, sold separately."',
  cartographer: '"Every road out there ends in teeth. I can tell you which ones."',
  hunter: 'The hunter spits. "The night has too many mouths. Thin them, and I\'ll pay."',
  merchant: '"Prices are fair. The night is not."',
  caravan: 'A merchant leans from the wagon. "Quick now, before they smell us."',
  priest: '"The dawn still listens, wanderer. Speak to it through me."',
};
function openShop(kind, st, pl = P) {
  const items = shopItems(kind, st);
  openModal({
    title: kind === 'caravan' ? 'Merchant Caravan' : NPC_NAMES[kind], sub: goldLine(), body: `<p class="flavor">${SHOP_LINES[kind]}</p>`, color: '#ffd35a',
    buttons: [
      ...items.map(it => ({ label: `${it.name}${it.cost ? ` · ${it.cost} gold` : ''}`, desc: it.desc, disabled: it.sold || G.gold < it.cost,
        act: () => { G.gold -= it.cost; Snd.play('coin'); it.buy(); if (!MODAL || MODAL.title === (kind === 'caravan' ? 'Merchant Caravan' : NPC_NAMES[kind])) openShop(kind, st, pl); } })),
      { label: 'Leave' },
    ],
  }, pl);
}
function reforge(pl) {
  const w = [...pl.weapons].filter(x => !x.evo).sort((a, b) => a.level - b.level)[0];
  if (!w) return;
  const pool = Object.keys(WEAPONS).filter(id => !pl.weapons.some(x => x.id === id));
  if (!pool.length) return;
  w.id = pick(pool); w.level = Math.min(w.level, WEAPON_MAX(w.id));
  recalc(); refreshSlots();
  banner('Reforged', 'It is now ' + WEAPONS[w.id].name, '#ffd35a');
}
function catalyst(pl) {
  const w = pl.weapons.find(x => !x.evo && x.level >= WEAPON_MAX(x.id));
  if (!w) { G.gold += 200; banner('Nothing to evolve', 'Max out a weapon first. Gold returned', '#a59cc4'); return; }
  w.evo = true; recalc(); refreshSlots();
  banner(WEAPONS[w.id].evoName, WEAPONS[w.id].evoDesc, '#ffd35a'); Snd.play('evolve');
}
function revealMap(rad) {
  G.revealed = G.revealed || new Set();
  for (let i = -Math.ceil(rad / REGION); i <= Math.ceil(rad / REGION); i++) for (let j = -Math.ceil(rad / REGION); j <= Math.ceil(rad / REGION); j++) {
    const st = regionStruct(regionOf(ME.x) + i, regionOf(ME.y) + j);
    if (st) G.revealed.add(st.id);
  }
  banner('The land is charted', 'Structures now show on your map', '#ffd35a');
}

/* ---------- Outcomes shared by the witch, Fate and the survivor ---------- */
function rollFate() {
  const pool = {};
  for (const o of SHRINE_OUTCOMES) pool[o.id] = o.id === 'nothing' ? o.w * 0.5 : o.w * (o.id === 'jackpot' ? 1 + 0.25 * P.luck : 1);
  return SHRINE_OUTCOMES.find(o => o.id === weighted(pool));
}
function applyOutcome(out) {
  const pl = P;
  switch (out.id) {
    case 'nothing': return 'Nothing happens. Something, somewhere, laughs.';
    case 'gold': G.gold += 80; return '80 gold spills out.';
    case 'heal': pl.hp = pl.maxHp; return 'Your wounds close completely.';
    case 'buff': { const b = pick(BASE_BUFFS); G.buffs[b] = Math.max(G.buffs[b] || 0, 25); return `${BUFFS[b].name} for 25 seconds.`; }
    case 'upgrade': { const c = rollChoices(1)[0], info = choiceInfo(c); applyChoice(c); return `${info.name}: ${info.desc}`; }
    case 'curse':
      pl.hp = Math.max(1, pl.hp - Math.round(pl.maxHp * 0.2));
      for (let i = 0; i < 2; i++) { const [x, y] = edgePos(20, pl); spawnEnemy('knight', x, y); }
      return 'A curse. Hollow Knights come for you.';
    case 'jackpot': {
      const w = pl.weapons.find(canEvolve);
      if (w) { w.evo = true; w.level = WEAPON_MAX(w.id); }
      for (let i = 0; i < 3; i++) applyChoice(rollChoices(1)[0]);
      pl.hp = pl.maxHp; G.gold += 150; recalc(); refreshSlots();
      return (w ? WEAPONS[w.id].evoName + ' awakens. ' : '') + 'Three gifts, a full heal and 150 gold.';
    }
  }
  return '';
}
function outcomeModal(out, title) {
  const text = applyOutcome(out);
  Snd.play(out.id === 'curse' ? 'curse' : out.id === 'nothing' ? 'fizzle' : out.id === 'jackpot' ? 'jackpot' : 'buff');
  return { title, sub: out.title, color: out.color, body: `<p class="flavor">${text}</p>`, buttons: [{ label: 'Continue', primary: true }] };
}

/* ---------- Witch hut, survivors, prisoners, the demon gate ---------- */
function witchHut(st, pl) {
  openModal({
    title: "The Witch's Hut", color: '#a6e05a', sub: 'A cauldron bubbles. No one is home.',
    body: '<p class="flavor">The brew smells of iron and violets. Something in it blinks.</p>',
    buttons: [
      { label: 'Drink from the cauldron', desc: 'A curse or a gift', primary: true, act: () => { st.used = true; openModal(outcomeModal(rollFate(), 'The brew takes hold'), pl); } },
      ...(st.relic ? [{ label: 'Take the relic on the shelf', desc: 'The witch will notice', act: () => { st.used = true; giveRelic('witchEye', pl); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; spawnEnemy('wraith', st.x + Math.cos(a) * 60, st.y + Math.sin(a) * 40); } } }] : []),
      { label: 'Leave it be' },
    ],
  }, pl);
}
function helpSurvivor(st, pl) {
  st.helped = true;
  const gold = Math.round(rand(40, 90) * pl.greed);
  G.gold += gold;
  openModal({ title: 'A survivor', color: '#ffd35a', sub: `+${gold} gold`, body: '<p class="flavor">"They came at dusk and never left. Take this. Get out of here before they come back."</p>', buttons: [{ label: 'Continue', primary: true }] }, pl);
  st.npcs[0].dead = true;
}
/* The chief sleeps by the prison until someone tries to free the prisoner */
function wakeChief(st, x, y) {
  st.chief = makeBoss('chief', x - 10, y - 10, { minor: true, hpMul: G.hpMul, onDeath: e => { st.chiefDead = true; banner('The chief is dead', 'Free the prisoner', '#ffd35a'); dropAt('bag', e.x, e.y); } });
  banner('The chief wakes', 'He will not let the prisoner go', '#d8354a');
  Snd.play('warn');
}
function freePrisoner(st, pl) {
  st.freed = true;
  openModal({
    title: 'The prisoner', color: '#ffd35a', sub: '"Thank you. I can repay you, one way or another."',
    buttons: [
      { label: 'Take their savings', desc: '+120 gold', act: () => { G.gold += Math.round(120 * pl.greed); } },
      { label: 'Ask what the bandits stole', desc: 'A demon fragment', act: () => { G.fragments = (G.fragments || 0) + 1; banner('Demon fragment', `${G.fragments}/3`, '#d8354a'); } },
    ],
  }, pl);
  st.npcs[0].dead = true;
  st.done = true;
}
function demonGate(st, pl) {
  const n = G.fragments || 0;
  if (n < 3) {
    openModal({ title: 'The Demon Gate', color: '#d8354a', sub: `${n}/3 fragments`, body: '<p class="flavor">Three hollows in the arch are shaped like jagged red stones. Without them, the gate stays dead.</p><p>Fragments drop from bandit prisoners, the Gravekeeper, meteor craters, temples and towers.</p>', buttons: [{ label: 'Leave' }] }, pl);
    return;
  }
  openModal({
    title: 'The Demon Gate', color: '#d8354a', sub: 'The fragments burn in your hand',
    body: '<p class="flavor">The arch drinks the fragments. Behind it, a red world opens, hungry.</p>',
    buttons: [{ label: 'Step through', primary: true, act: () => { G.fragments -= 3; st.done = true; enterDimension('demon'); } }, { label: 'Not yet' }],
  }, pl);
}

/* ---------- Shrine kinds ---------- */
const SHRINE_KINDS = {
  blood: { name: 'Shrine of Blood', color: '#d8354a', text: 'Bleed for power: lose 30% of your current life, and deal 60% more damage for 60 seconds.', act: () => { P.hp = Math.max(1, P.hp * 0.7); G.buffs.bloodpact = 60; } },
  greed: { name: 'Shrine of Greed', color: '#ffd35a', text: 'For 90 seconds, enemies are 50% tougher but drop three times the gold.', act: () => { G.buffs.greed = 90; } },
  chaos: { name: 'Shrine of Chaos', color: '#e27bf0', text: 'Your weapons and relics are torn apart and remade at random, at the same strength.', act: () => chaos(P) },
  haste: { name: 'Shrine of Haste', color: '#a6e05a', text: 'For 60 seconds you move 40% faster. So does everything else.', act: () => { G.buffs.haste = 60; } },
  fallen: { name: 'Shrine of the Fallen', color: '#9a4fd0', text: 'Call a fallen champion back from death. Slay it and take its treasure.', act: () => { const [x, y] = edgePos(10, P); makeBoss('champion', x, y, { minor: true, hpMul: G.hpMul, onDeath: e => { dropAt('chest', e.x, e.y, { boss: true }); dropAt('bag', e.x + 12, e.y); } }); banner('The Fallen Champion rises', '', '#9a4fd0'); } },
  echoes: { name: 'Shrine of Echoes', color: '#8ff0ff', text: 'For 30 seconds, every weapon strikes twice.', act: () => { G.buffs.echo = 30; } },
  fate: { name: 'Shrine of Fate', color: '#f2eee6', text: 'Three cards lie face down. Choose one.', act: null },
  sacrifice: { name: 'Shrine of Sacrifice', color: '#7a1a2a', text: 'Destroy one of your relics forever. In return every weapon grows one level stronger.', act: null },
};
function chaos(pl) {
  for (const w of pl.weapons) {
    if (w.evo) continue;
    const pool = Object.keys(WEAPONS).filter(id => !pl.weapons.some(x => x.id === id));
    if (pool.length) { w.id = pick(pool); w.level = Math.min(w.level, WEAPON_MAX(w.id)); }
  }
  const ids = Object.keys(pl.passives), free = Object.keys(PASSIVES).filter(id => !pl.passives[id]);
  for (const id of ids.slice(0, 2)) { if (!free.length) break; const n = free.splice(Math.random() * free.length | 0, 1)[0]; pl.passives[n] = Math.min(pl.passives[id], PASSIVES[n].max); delete pl.passives[id]; }
  recalc(); refreshSlots();
}
const origSpawnShrine = spawnShrine;
spawnShrine = function () {
  origSpawnShrine();
  const s = G.shrines[G.shrines.length - 1];
  s.kind = Math.random() < 0.35 ? 'fortune' : pick(Object.keys(SHRINE_KINDS));
  if (s.kind !== 'fortune') { s.uses = 1; banner(SHRINE_KINDS[s.kind].name, 'Follow the violet arrow', SHRINE_KINDS[s.kind].color); }
};
const crystalCache = {};
const origDrawShrine = drawShrine;
drawShrine = function (s, now) {
  if (!s.kind || s.kind === 'fortune' || s.uses <= 0) { origDrawShrine(s, now); return; }
  const k = SHRINE_KINDS[s.kind], base = SPR.shrine;
  const cr = crystalCache[s.kind] || (crystalCache[s.kind] = recolor(SPR.crystal, { '#e27bf0': k.color, '#9a4fd0': k.color, '#4a2470': '#0b0a12' }));
  shadow(s.x, s.y + 6, 16);
  blit(base.c, s.x, s.y, base.w, base.h);
  const bob = Math.round(Math.sin(s.ph * 2) * 2);
  blit(cr.c, s.x, s.y - 15 + bob, cr.w, cr.h);
  light(s.x, s.y - 10, 64, 1); glowAt(s.x, s.y - 14 + bob, 18, k.color, 0.55);
  if (G.nearShrine === s && Math.floor(now * 3) % 2) drawText(ctx, 'E', s.x - camX, s.y - camY - 30, '#ffd35a');
};
function shrineKind(s, pl) {
  const k = SHRINE_KINDS[s.kind];
  if (s.kind === 'fate') {
    const cards = [rollFate(), rollFate(), rollFate()];
    openModal({ title: k.name, color: k.color, sub: k.text, body: '<div class="fate"><i></i><i></i><i></i></div>',
      buttons: cards.map((c, i) => ({ label: ['The first card', 'The second card', 'The third card'][i], act: () => { s.uses = 0; openModal(outcomeModal(c, k.name), pl); } })) }, pl);
    return;
  }
  if (s.kind === 'sacrifice') {
    const relics = Object.keys(pl.passives);
    openModal({ title: k.name, color: k.color, sub: k.text,
      buttons: [...relics.map(id => ({ label: `Destroy ${PASSIVES[id].name}`, desc: `Level ${pl.passives[id]}`, act: () => {
        delete pl.passives[id]; s.uses = 0;
        for (const w of pl.weapons) if (!w.evo && w.level < WEAPON_MAX(w.id)) w.level++;
        recalc(); refreshSlots(); Snd.play('evolve'); banner('The sacrifice is accepted', 'Every weapon grows stronger', k.color);
      } })), { label: relics.length ? 'Keep everything' : 'You have nothing to give' }] }, pl);
    return;
  }
  openModal({ title: k.name, color: k.color, sub: k.text,
    buttons: [{ label: 'Accept', primary: true, act: () => { s.uses = 0; k.act(); Snd.play('buff'); } }, { label: 'Walk away' }] }, pl);
}

// The Shrine of Fortune as a plain dialog (used when the co-op partner makes the offering)
function fortuneModal(s, pl) {
  const cost = G.shrineCost;
  openModal({ title: 'Shrine of Fortune', color: '#e27bf0', sub: goldLine(), body: '<p class="flavor">Offer gold. The shrine decides whether you deserve it.</p>',
    buttons: [{ label: `Offer ${cost} gold`, primary: true, disabled: G.gold < cost || s.uses <= 0, act: () => { G.gold -= cost; s.uses--; G.shrineCost = Math.round(cost * 1.6); openModal(outcomeModal(rollShrine(), 'Shrine of Fortune'), pl); } }, { label: 'Leave' }] }, pl);
}

/* ---------- World events ---------- */
const EVENT_KINDS = ['meteor', 'bloodmoon', 'caravan', 'star', 'siege'];
function startEvent() {
  const opts = EVENT_KINDS.filter(k => k !== G.lastEv && (k !== 'siege' || findVillage()));
  const kind = pick(opts);
  G.lastEv = kind;
  const a = Math.random() * TAU, at = (r0, r1) => { const R = rand(r0, r1); return { x: ME.x + Math.cos(a) * R, y: ME.y + Math.sin(a) * R }; };
  const ev = G.ev = { kind, t: 0 };
  switch (kind) {
    case 'meteor': Object.assign(ev, at(250, 340), { fall: 1.6, dur: 50, mine: 0, name: 'Meteor' }); banner('A meteor falls', 'Mine the crater before the horde claims it', '#ffd35a'); break;
    case 'bloodmoon': Object.assign(ev, { dur: 40, name: 'Blood Moon' }); G.buffs.bloodmoon = 40; G.spawnMul = 2.5; G.darkMul = 1.3; banner('Blood Moon', 'The horde swells. Every kill is worth double', '#d8354a'); Snd.play('warn'); break;
    case 'caravan': Object.assign(ev, at(180, 240), { dur: 60, hp: 300, maxHp: 300, alive: true, name: 'Caravan', raidT: 3 }); ev.npc = makeNpc('merchant', ev.x + 18, ev.y + 6); banner('A merchant caravan', 'Trade, and keep it alive for 60 seconds', '#ffd35a'); break;
    case 'star': Object.assign(ev, at(350, 470), { fall: 1.2, dur: 30, name: 'Falling Star' }); banner('A falling star', 'Reach it within 30 seconds', '#fff3b0'); break;
    case 'siege': {
      const v = findVillage();
      Object.assign(ev, { v, x: v.x, y: v.y, dur: 45, name: 'Village Siege', spawnT: 0 });
      ev.folk = [];
      for (let i = 0; i < 5; i++) { const n = makeNpc(i % 2 ? 'villager2' : 'villager', v.x + rand(-30, 30), v.y + rand(-20, 20)); n.villager = true; ev.folk.push(n); }
      banner('A village is under attack', 'Save at least 3 villagers', '#e8742c'); Snd.play('warn');
      break;
    }
  }
}
function findVillage() {
  for (const st of structsNear(ME.x, ME.y, 1)) if ((st.type === 'village' || st.type === 'town') && !st.ruined && Math.hypot(st.x - ME.x, st.y - ME.y) < 1100) return st;
  return null;
}
function endEvent(msg, col = '#a59cc4') {
  const ev = G.ev;
  if (!ev) return;
  if (ev.kind === 'bloodmoon') { G.spawnMul = 1; G.darkMul = null; }
  if (msg) banner(msg, '', col);
  G.ev = null;
  G.eventT = rand(80, 120);
}
function raiderAI(target) {
  return (e, dt) => {
    const tg = target();
    if (!tg) { e.ai = null; return; }
    const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.dir = dx < 0 ? -1 : 1;
    if (d > 10) { e.x += dx / d * e.spd * dt; e.y += dy / d * e.spd * dt; }
    else if (tg.hp !== undefined) tg.hp -= 10 * dt;
  };
}
function updateEvent(dt) {
  const ev = G.ev;
  if (!ev) { G.eventT = (G.eventT ?? 70) - dt; if (G.eventT <= 0 && !G.boss && !G.won) startEvent(); return; }
  ev.t += dt;
  const pastFall = ev.fall === undefined || ev.t > ev.fall;
  if (ev.fall !== undefined && !ev.landed && ev.t > ev.fall) { ev.landed = true; G.shake = 8; Snd.play('bigboom'); burst(ev.x, ev.y, '#ffd35a', 40, 140); hz({ k: 'ring', x: ev.x, y: ev.y, r0: 8, r: 90, w: 10, warn: 0, life: 0.6, dmg: 0, color: '#ffd35a' }); }
  switch (ev.kind) {
    case 'meteor':
      if (!pastFall) break;
      if (!ev.swarmed) { ev.swarmed = true; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; spawnEnemy(pick(['ghoul', 'skel']), ev.x + Math.cos(a) * 140, ev.y + Math.sin(a) * 110); } }
      if (G.players.some(pl => !pl.down && Math.hypot(pl.x - ev.x, pl.y - ev.y) < 28)) { ev.mine += dt; if (Math.random() < dt * 12) addPart(ev.x + rand(-10, 10), ev.y + rand(-6, 6), rand(-40, 40), rand(-60, -20), 0.5, pick(['#ffd35a', '#8ff0ff', '#e27bf0'])); }
      if (ev.mine >= 6) { for (let i = 0; i < 3; i++) dropAt('bag', ev.x + rand(-14, 14), ev.y + rand(-10, 10)); if (Math.random() < 0.6) dropFragment(ev.x, ev.y - 12); dropBuff(ev.x + 16, ev.y); endEvent('The meteor is yours', '#ffd35a'); return; }
      break;
    case 'caravan':
      if (!ev.alive) break;
      ev.raidT -= dt;
      if (ev.raidT <= 0) {
        ev.raidT = 2.6;
        const a = Math.random() * TAU, e = spawnEnemy(pick(['bandit', 'ghoul', 'bandit']), ev.x + Math.cos(a) * 200, ev.y + Math.sin(a) * 150);
        e.ai = raiderAI(() => (ev.alive ? ev : null));
      }
      if (ev.hp <= 0) { ev.alive = false; burst(ev.x, ev.y, '#e8742c', 40, 100); endEvent('The caravan is lost', '#d8354a'); return; }
      break;
    case 'star':
      if (pastFall && G.players.some(pl => !pl.down && Math.hypot(pl.x - ev.x, pl.y - ev.y) < 18)) {
        const pl = nearestPlayer(ev.x, ev.y), keep = P; P = pl;
        applyChoice(rollChoices(1)[0]); pl.hp = pl.maxHp; G.gold += 50;
        P = keep;
        G.whiteFlash = 0.6; Snd.play('jackpot'); endEvent('You caught the falling star', '#fff3b0'); return;
      }
      break;
    case 'siege': {
      ev.spawnT -= dt;
      if (ev.spawnT <= 0 && ev.t < ev.dur - 5) {
        ev.spawnT = 2.2;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * TAU, e = spawnEnemy(pick(['ghoul', 'skel', 'wraith']), ev.x + Math.cos(a) * 170, ev.y + Math.sin(a) * 130);
          e.ai = raiderAI(() => { let best = null, bd = Infinity; for (const f of ev.folk) { if (f.dead) continue; const dd = Math.hypot(f.x - e.x, f.y - e.y); if (dd < bd) { bd = dd; best = f; } } return best; });
        }
      }
      for (const f of ev.folk) {
        if (f.dead) continue;
        f.ph += dt;
        f.x = f.hx + Math.sin(f.ph * 0.7) * 12; f.y = f.hy + Math.cos(f.ph * 0.5) * 6; f.moving = true; f.anim += dt * 6;
        if (f.hp <= 0) { f.dead = true; burst(f.x, f.y, '#d8354a', 14, 70); Snd.play('hurt'); }
      }
      break;
    }
  }
  if (ev.t > ev.dur) {
    if (ev.kind === 'caravan') { G.gold += ev.hp > ev.maxHp / 2 ? 80 : 20; endEvent('The caravan moves on, grateful', '#ffd35a'); }
    else if (ev.kind === 'siege') {
      const alive = ev.folk.filter(f => !f.dead).length;
      if (alive >= 3) { dropAt('chest', ev.x, ev.y + 20, { boss: true }); G.gold += 80; endEvent(`The village is saved (${alive}/5)`, '#ffd35a'); }
      else { ev.v.ruined = true; endEvent('The village has fallen', '#d8354a'); }
    } else if (ev.kind === 'bloodmoon') endEvent('The blood moon sets', '#a59cc4');
    else endEvent(ev.kind === 'star' ? 'The star burns out' : 'The crater cools');
  }
}
function drawEventGround(now) {
  const ev = G.ev;
  if (!ev || ev.x === undefined) return;
  const sx = ev.x - camX, sy = ev.y - camY;
  if (ev.kind === 'meteor' || ev.kind === 'star') {
    if (ev.t < ev.fall) {
      const k = ev.t / ev.fall, mx = sx + 120 * (1 - k), my = sy - 200 * (1 - k);
      pxLine(mx, my, mx + 22, my - 36, ev.kind === 'star' ? '#fff3b0' : '#e8742c', 3);
      pxLine(mx, my, mx + 10, my - 16, '#fff', 2);
      light(ev.x + 120 * (1 - k), ev.y - 200 * (1 - k), 50, 1);
      ctx.globalAlpha = 0.3 + k * 0.4; ringOval(sx, sy, 20 * k + 4, '#d8354a', 0.62); ctx.globalAlpha = 1;
      return;
    }
    if (ev.kind === 'meteor') {
      pxDisc(sx, sy, 30, '#0b0a12', 0.6); pxDisc(sx, sy, 26, '#2a2224', 0.6); pxDisc(sx, sy - 2, 12, '#3a2a22', 0.7);
      for (let i = 0; i < 6; i++) { const a = i * 1.1 + now, r = 8 + (i % 3) * 4; ctx.fillStyle = pick(['#8ff0ff', '#ffd35a', '#e27bf0']); ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r * 0.6), 2, 2); }
      const k = ev.mine / 6, n = Math.round(80 * k);
      ctx.fillStyle = '#ffd35a';
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / 80 * TAU; ctx.fillRect(Math.round(sx + Math.cos(a) * 34), Math.round(sy + Math.sin(a) * 22), 2, 1); }
      light(ev.x, ev.y, 70, 1); glowAt(ev.x, ev.y, 28, '#e8742c', 0.4);
    } else {
      const s = 4 + Math.sin(now * 8) * 1.5;
      ctx.fillStyle = '#fff3b0';
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + now; pxLine(sx, sy - 6, sx + Math.cos(a) * s * 3, sy - 6 + Math.sin(a) * s * 3, '#fff3b0', 1); }
      pxDisc(sx, sy - 6, 3, '#fff', 1);
      drawText(ctx, String(Math.max(0, Math.ceil(ev.dur - ev.t))), sx, sy - 20, '#fff3b0');
      light(ev.x, ev.y - 6, 60, 1); glowAt(ev.x, ev.y - 6, 26, '#fff3b0', 0.6);
    }
  }
}

/* ---------- Minimap ---------- */
function drawMinimap(now) {
  const S = 60, x0 = 6, y0 = H - S - 6, scale = 1 / 22, cx = x0 + S / 2, cy = y0 + S / 2;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(x0 - 2, y0 - 2, S + 4, S + 4);
  ctx.fillStyle = '#15131f'; ctx.fillRect(x0, y0, S, S);
  ctx.globalAlpha = 1;
  const dot = (wx, wy, c, sz = 2) => {
    const mx = cx + (wx - ME.x) * scale, my = cy + (wy - ME.y) * scale;
    if (mx < x0 || mx > x0 + S - sz || my < y0 || my > y0 + S - sz) return;
    ctx.fillStyle = c; ctx.fillRect(Math.round(mx - sz / 2), Math.round(my - sz / 2), sz, sz);
  };
  if (!noStructs()) {
    const witch = ME.relics?.includes('witchEye');
    for (const st of structsNear(ME.x, ME.y, 2)) {
      const seen = st.built || G.revealed?.has(st.id) || witch;
      if (seen && !(st.done && st.type !== 'village')) dot(st.x, st.y, st.ruined ? '#5e557f' : STRUCT_COL[st.type], st.type === 'town' ? 5 : 3);
    }
    for (const s of G.shrines) if (s.uses > 0) dot(s.x, s.y, '#e27bf0');
    for (const c of G.crypts) dot(c.x, c.y, '#e8742c');
  }
  Mods.call('minimap', dot);
  if (G.ev && G.ev.x !== undefined) dot(G.ev.x, G.ev.y, Math.floor(now * 4) % 2 ? '#fff3b0' : '#d8354a', 3);
  for (const e of G.enemies) if (e.boss && !e.dead) dot(e.x, e.y, '#d8354a', 3);
  for (const pl of G.players) if (pl !== ME) dot(pl.x, pl.y, '#3f8ee0', 3);
  ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1, cy - 1, 3, 3);
}

/* ---------- Module wiring ---------- */
const structPieces = [];
Mods.add({
  newRun() { regionCache.clear(); G.fragments = 0; G.keys = {}; G.ev = null; G.eventT = 70; G.bounty = null; for (const pl of G.players) { pl.relics = []; pl.bonus = {}; } },
  solidsCleared() { if (!G) return; for (const st of regionCache.values()) if (st && st.built) registerStruct(st); },
  blocked(x, y) {
    if (!G || noStructs()) return false;
    for (const st of structsNear(x, y)) if (Math.hypot(st.x - x, (st.y - y) * 1.2) < st.R + 16) return true;
    return false;
  },
  update(dt) {
    if (noStructs()) return;
    for (const pl of G.players) for (const st of structsNear(pl.x, pl.y)) {
      if (!st.built) buildStruct(st);
      if (!st.active && Math.hypot(st.x - pl.x, st.y - pl.y) < st.R + 220) activateStruct(st);
    }
    for (const st of regionCache.values()) {
      if (!st || !st.built) continue;
      if ((st.type === 'village' || st.type === 'town') && !st.ruined) {
        for (const e of G.enemies) {
          if (e.dead || e.prop || e.boss || e.ai) continue;
          const dx = e.x - st.x, dy = e.y - st.y, d = Math.hypot(dx, dy);
          if (d < st.R) { e.x = st.x + dx / (d || 1) * st.R; e.y = st.y + dy / (d || 1) * st.R; }
        }
        for (const n of st.npcs) { n.ph += dt; const tp = nearestPlayer(n.x, n.y); n.face = tp.x < n.x ? -1 : 1; }
      }
      if (st.type === 'graveyard' && st.active && !st.cleansed && nearAny(st, st.R)) {
        st.spawnT = (st.spawnT ?? 1) - dt;
        if (st.spawnT <= 0 && G.mobs < 400) {
          st.spawnT = 1.1;
          const g = pick(st.graves.filter(x => !x.dead) || []) || st;
          const e = spawnEnemy(pick(['skel', 'ghoul', 'skel']), g.x + rand(-6, 6), g.y + 6); e.rise = 0.6;
        }
      }
      if (st.type === 'watchtower' && st.archers && !st.looted && st.archers.every(a => a.dead)) { st.looted = true; dropAt('chest', st.x, st.y + 14); dropAt('bag', st.x + 12, st.y + 16); banner('The watchtower is taken', '', '#ffd35a'); }
      if (st.type === 'bandits' && st.freed) st.fade = (st.fade || 0) + dt;
    }
    if (G.bounty) {
      G.bounty.left = Math.max(0, 80 - (G.kills - G.bounty.start));
      if (!G.bounty.left) { G.gold += 150; dropAt('chest', ME.x + 20, ME.y); banner('Bounty complete', '+150 gold and a chest', '#ffd35a'); G.bounty = null; }
    }
    updateEvent(dt);
  },
  pickup(it) {
    if (it.k === 'relic') giveRelic(it.relic, P);
    else if (it.k === 'fragment') { G.fragments = (G.fragments || 0) + 1; banner('Demon fragment', `${G.fragments}/3. A Demon Gate will open with three`, '#d8354a'); Snd.play('evolve'); }
    else if (it.k === 'key') { G.keys[it.st.id] = true; banner('Mansion key', 'Now find the locked mansion', '#ffd35a'); Snd.play('chest'); }
  },
  interact(pl = ME) {
    if (noStructs()) return false;
    const s = G.shrines.find(x => x.uses > 0 && Math.hypot(x.x - pl.x, x.y - pl.y) < 22);
    if (s && s.kind && s.kind !== 'fortune') { shrineKind(s, pl); return true; }
    if (s && pl !== ME) { fortuneModal(s, pl); return true; }
    return worldInteract(pl);
  },
  promptLabel() {
    if (!G || noStructs()) return '';
    if (G.nearShrine && G.nearShrine.kind && G.nearShrine.kind !== 'fortune') return 'E · ' + SHRINE_KINDS[G.nearShrine.kind].name;
    const it = nearInteract(ME);
    return it ? 'E · ' + it.label : '';
  },
  drawGround(now) {
    if (noStructs()) return;
    for (const st of structsNear(ME.x, ME.y)) {
      if (!st.built || !onScreen(st.x, st.y, st.R + 200)) continue;
      const sx = st.x - camX, sy = st.y - camY;
      drawStructGround(st);
      if (st.type === 'bandits') { const c = BUILD.campfire; ctx.drawImage(c.c, Math.round(sx - 6), Math.round(sy - 3)); const fl = Math.floor(now * 12) % 3; ctx.fillStyle = '#e8742c'; ctx.fillRect(Math.round(sx - 2), Math.round(sy - 4 - fl), 4, 3); ctx.fillStyle = '#ffd35a'; ctx.fillRect(Math.round(sx - 1), Math.round(sy - 6 - fl), 2, 2); light(st.x, st.y, 70, 1); glowAt(st.x, st.y, 20, '#e8742c', 0.5); }
      if (st.hatch && !st.done && (st.type !== 'ruins' || nearAny(st.hatch, 90))) {
        const h = BUILD.hatch; ctx.drawImage(h.c, Math.round(st.hatch.x - camX - 7), Math.round(st.hatch.y - camY - 5));
        if (Math.random() < 0.2) addPart(st.hatch.x + rand(-6, 6), st.hatch.y, 0, -20, 0.6, '#ffd35a');
        light(st.hatch.x, st.hatch.y, 26, 0.6);
      } else if (st.hatch && st.type === 'ruins' && !st.done && Math.random() < 0.05) addPart(st.hatch.x + rand(-4, 4), st.hatch.y, 0, -12, 0.8, '#ffd35a');
      if (st.type === 'gate') { const lit = (G.fragments || 0) >= 3; glowAt(st.x, st.y - 16, 22, lit ? '#d8354a' : '#36304f', lit ? 0.6 : 0.3); light(st.x, st.y - 16, lit ? 60 : 30, 0.8); }
      if (st.door && (st.type === 'tower' || st.type === 'temple' || st.type === 'mansion')) light(st.x, st.y, 40, 0.6);
    }
    drawEventGround(now);
  },
  ents(list) {
    if (noStructs()) return;
    for (const st of structsNear(ME.x, ME.y)) {
      if (!st.built || !onScreen(st.x, st.y, st.R + 200)) continue;
      const fade = st.type === 'bandits' && st.fade ? Math.max(0, 1 - st.fade / 4) : 1;
      for (const p of st.pieces) {
        if (p.grave) continue;
        if (fade <= 0) continue;
        if (!onScreen(p.x, p.y - p.spr.h / 2, p.spr.w / 2 + p.spr.h / 2 + 10)) continue;
        list.push({ sortY: p.y, y: p.y, x: p.x, draw() { drawPiece(st, p, fade); } });
      }
      if (!st.ruined) for (const n of st.npcs) if (!n.dead && fade > 0) list.push(n);
    }
    const ev = G.ev;
    if (ev && ev.kind === 'caravan' && ev.alive) {
      list.push({ sortY: ev.y + 8, y: ev.y, x: ev.x, draw(now) {
        const s = BUILD.wagon; shadow(ev.x, ev.y + 9, 26); ctx.drawImage(s.c, Math.round(ev.x - camX - 15), Math.round(ev.y - camY - 10));
        ctx.fillStyle = '#0b0a12'; ctx.fillRect(Math.round(ev.x - camX - 13), Math.round(ev.y - camY - 15), 26, 3);
        ctx.fillStyle = '#ffd35a'; ctx.fillRect(Math.round(ev.x - camX - 12), Math.round(ev.y - camY - 14), Math.round(24 * ev.hp / ev.maxHp), 1);
        light(ev.x, ev.y, 50, 0.9);
      } });
      list.push(ev.npc);
    }
    if (ev && ev.kind === 'siege') for (const f of ev.folk) if (!f.dead) list.push(f);
  },
  pointers(list) {
    const ev = G.ev;
    if (ev && ev.x !== undefined && !onScreen(ev.x, ev.y, 10)) list.push({ x: ev.x, y: ev.y, pcolor: '#fff3b0', picon: ev.kind === 'caravan' ? BUILD.barrel : ICON.star });
    if (!noStructs()) for (const st of structsNear(ME.x, ME.y)) {
      if (st.type === 'mansion' && st.active && !G.keys?.[st.id] && st.keyAt && Math.hypot(ME.x - st.x, ME.y - st.y) < 260 && !onScreen(st.keyAt.x, st.keyAt.y, 10)) list.push({ x: st.keyAt.x, y: st.keyAt.y, pcolor: '#ffd35a', picon: BUILD.key });
    }
  },
  drawOverlay(now) {
    if (G.buffs.bloodmoon > 0) {
      ctx.fillStyle = 'rgba(122,26,42,0.16)'; ctx.fillRect(0, 0, W, H);
      pxDisc(W - 34, 30, 12, '#7a1a2a', 1); pxDisc(W - 35, 29, 10, '#d8354a', 1);
    }
    if (state === 'play' || state === 'pause') drawMinimap(now);
  },
  hud() {
    const chips = [];
    if (G.fragments) chips.push(`<div class="chip" style="--bc:#d8354a"><img src="${spriteURL(BUILD.fragment)}" alt="">${G.fragments}/3</div>`);
    if (G.ev && G.ev.name) chips.push(`<div class="chip" style="--bc:#fff3b0">${G.ev.name} ${Math.max(0, Math.ceil((G.ev.dur || 0) - G.ev.t))}</div>`);
    if (G.bounty) chips.push(`<div class="chip" style="--bc:#ffd35a">Bounty ${G.bounty.left}</div>`);
    const html = chips.join('');
    if (hudLast.chips !== html) { hudLast.chips = html; $('chips').innerHTML = html; }
  },
  kill(e) { if (G.ev && G.ev.kind === 'siege') for (const f of G.ev.folk || []) if (!f.dead && Math.hypot(f.x - e.x, f.y - e.y) < 30) f.hp = Math.min(f.maxHp, f.hp + 4); },
});

/* ---------- Every structure has a name, an arrival, and an atmosphere ---------- */
const NAME_A = ['Ash', 'Hollow', 'Grey', 'Raven', 'Thorn', 'Ember', 'Mourn', 'Cinder', 'Wyrm', 'Black', 'Candle', 'Dusk', 'Gallow', 'Wither'];
const NAME_B = ['mere', 'ford', 'vale', 'wick', 'moor', 'holt', 'fen', 'stead', 'brook', 'reach', 'haven', 'crag'];
const STRUCT_TITLE = {
  town: [n => n + ' Town', 'Streets, a market, and a Runesmith'],
  village: [n => n, 'A village that still keeps its candles lit'],
  ruinvillage: [n => 'The Ruins of ' + n, 'Its people left in a hurry'],
  hut: [n => n + ' Fen', 'Something is brewing in the hut'],
  tower: [n => 'The Tower of ' + n, 'It was old before the night began'],
  ruins: [n => 'Buried ' + n, 'The stones hum underfoot'],
  graveyard: [n => 'The ' + n + ' Barrows', 'The dead here do not rest'],
  bandits: [n => n + ' Raiders', 'Steel, smoke and stolen goods'],
  mine: [n => 'The ' + n + ' Deeps', 'The miners never came back up'],
  watchtower: [n => n + ' Watch', 'Someone is still on guard'],
  gate: [n => 'The ' + n + ' Gate', 'It waits for three red stones'],
  temple: [n => 'Temple of ' + n, 'Forgotten gods, unforgotten traps'],
  mansion: [n => n + ' Manor', 'The doors are locked from the inside'],
};
const structName = st => st.name || (st.name = STRUCT_TITLE[st.type][0](NAME_A[(st.seed >>> 0) % NAME_A.length] + NAME_B[(st.seed >>> 5) % NAME_B.length]));
const baseActivate = activateStruct;
activateStruct = function (st) {
  baseActivate(st);
  G.discovered = (G.discovered || 0) + 1; // places are no longer announced; names show on the map and as you walk up
};
function fog(x, y, r, now, seed, col = 'rgba(165,156,196,0.07)') {
  for (let i = 0; i < 5; i++) {
    const a = seed + i * 1.7 + now * 0.08 * (i % 2 ? 1 : -1);
    pxDisc(x - camX + Math.cos(a) * r * 0.6, y - camY + Math.sin(a * 1.3) * r * 0.35, r * (0.35 + (i % 3) * 0.1), col, 0.45);
  }
}
const chance = (dt, rate) => Math.random() < rate * dt;
function ambience(st, now, dt) {
  const glowSpot = (x, y, r, c, a) => { light(x, y, r, a); glowAt(x, y, r * 0.35, c, a * 0.5); };
  const flame = (x, y, big = 1) => {
    const fl = Math.floor(now * 12 + x) % 3, sx = Math.round(x - camX), sy = Math.round(y - camY);
    ctx.fillStyle = '#e8742c'; ctx.fillRect(sx - 2 * big, sy - 3 - fl % 2, 4 * big, 4);
    ctx.fillStyle = '#ffd35a'; ctx.fillRect(sx - big, sy - 5 - fl, 2 * big, 3);
    if (chance(dt, 6)) addPart(x + rand(-2, 2), y - 4, rand(-3, 3), rand(-26, -14), 0.7, pick(['#ffd35a', '#e8742c']), 1, 0, 0.5);
    glowSpot(x, y - 2, 46 * big, '#e8742c', 0.85);
  };
  const town = st.type === 'village' || st.type === 'town' || st.type === 'ruinvillage';
  const dead = st.ruined || st.type === 'ruinvillage';
  // chimney smoke and fires from what each building painted
  for (const p of st.pieces) {
    const m = p.meta, sp = st.ruined && p.ruinedSpr ? p.ruinedSpr : p.spr;
    if (!m || !sp) continue;
    if (!onScreen(p.x, p.y - sp.h / 2, sp.w / 2 + sp.h / 2)) continue;
    for (const [dx, dy] of (sp.meta || m).smoke) if (chance(dt, dead ? 1 : 2.5)) addPart(p.x + dx, p.y + dy, rand(-3, 3), rand(-16, -9), 2.4, dead ? '#2a2538' : st.type === 'hut' ? pick(['#a6e05a', '#4fa04a']) : pick(['#5e557f', '#36304f', '#a59cc4']), 2, 0, 0.3);
    if (sp === prop('brazier')) flame(p.x, p.y - 17);
  }
  switch (st.type) {
    case 'village': case 'town':
      if (st.ruined) { fog(st.x, st.y, st.R * 0.7, now, st.seed % 7); break; }
      for (let i = 0; i < 14; i++) {
        const a = st.seed + i * 2.4 + now * 0.3, fx = st.x + Math.cos(a) * (40 + i * 13), fy = st.y + Math.sin(a * 1.4) * (28 + i * 9);
        if (Math.sin(now * 4 + i) > 0) { ctx.fillStyle = '#fff3b0'; ctx.fillRect(Math.round(fx - camX), Math.round(fy - camY), 1, 1); light(fx, fy, 8, 0.4); }
      }
      break;
    case 'ruinvillage':
      fog(st.x, st.y, st.R * 0.8, now, st.seed % 7);
      if (chance(dt, 8)) addPart(st.x + rand(-st.R, st.R), st.y + rand(-st.R, st.R) * 0.6, rand(-4, 4), rand(-20, -8), 1.6, pick(['#e8742c', '#d8354a']), 1, 0, 0.5);
      break;
    case 'hut':
      glowSpot(st.x - 20, st.y - 34, 40, '#a6e05a', 0.6 + Math.sin(now * 6) * 0.15);
      fog(st.x, st.y + 10, 70, now, 3, 'rgba(79,160,74,0.06)');
      break;
    case 'tower': {
      const t = st.pieces[0], bc = t.spr.meta.beacon;
      flame(t.x + bc[0], t.y + bc[1], 2);
      for (let i = 0; i < 5; i++) {
        const a = now * (0.9 + i * 0.15) + i * 1.3, bx = t.x + Math.cos(a) * (30 + i * 5), by = t.y + bc[1] - 10 + Math.sin(a * 2) * 8;
        const f = SPR.bat[Math.floor(now * 8 + i) % 2];
        ctx.drawImage(f.c, Math.round(bx - camX - 6), Math.round(by - camY - 3));
      }
      break;
    }
    case 'ruins':
      if (chance(dt, 6)) addPart(st.x + rand(-60, 60), st.y + rand(-30, 30), 0, rand(-18, -6), 1.4, pick(['#ffd35a', '#fff3b0']), 1, 0, 0.4);
      ctx.globalAlpha = 0.35; ringOval(st.x - camX, st.y - camY, 30 + (now * 20) % 40, '#ffd35a', 0.6); ctx.globalAlpha = 1;
      break;
    case 'graveyard':
      fog(st.x, st.y, st.R, now, 5, st.cleansed ? 'rgba(165,156,196,0.04)' : 'rgba(143,240,255,0.06)');
      if (!st.cleansed) for (let i = 0; i < 7; i++) {
        const a = st.seed + i * 1.3 + now * 0.4, wx = st.x + Math.cos(a) * (30 + i * 14), wy = st.y + Math.sin(a * 0.8) * (20 + i * 9) - 8 + Math.sin(now * 3 + i) * 3;
        pxDisc(wx - camX, wy - camY, 2, '#8ff0ff', 1); light(wx, wy, 22, 0.7); glowAt(wx, wy, 8, '#8ff0ff', 0.5);
      }
      break;
    case 'bandits':
      if (chance(dt, 4)) addPart(st.x + rand(-2, 2), st.y - 6, rand(-3, 3), rand(-18, -10), 2, pick(['#5e557f', '#36304f']), 2, 0, 0.3);
      for (const p of st.pieces) if (p.spr === prop('tent')) {
        const fx = Math.round(p.x - camX), fy = Math.round(p.y - camY - 36), wave = Math.round(Math.sin(now * 5 + p.x));
        ctx.fillStyle = '#3a2618'; ctx.fillRect(fx, fy - 7, 1, 9);
        ctx.fillStyle = '#d8354a'; ctx.fillRect(fx + 1, fy - 7 + wave, 6, 3); ctx.fillRect(fx + 7, fy - 6 + wave * 2, 2, 2);
      }
      break;
    case 'mine':
      if (chance(dt, 3)) addPart(st.x + rand(-10, 10), st.y - 10, rand(-6, 6), rand(-6, -2), 1.2, '#6a5a4a', 1, 0, 0.5);
      break;
    case 'watchtower': {
      const t = st.pieces[0], bc = t.spr.meta.beacon;
      flame(t.x + bc[0], t.y + bc[1]);
      break;
    }
    case 'gate': {
      const lit = (G.fragments || 0) >= 3, cy = st.y - 50;
      if (chance(dt, lit ? 30 : 10)) { const a = Math.random() * TAU; addPart(st.x + Math.cos(a) * 22, cy + Math.sin(a) * 28, -Math.cos(a) * 12, -Math.sin(a) * 12 - 6, 1, pick(['#d8354a', '#7a1a2a', '#e27bf0']), 1, 0, 0.3); }
      ctx.globalAlpha = lit ? 0.9 : 0.4;
      for (let k = 0; k < 3; k++) ringOval(st.x - camX, cy - camY, 8 + k * 7 + Math.sin(now * 3 + k) * 2, k % 2 ? '#7a1a2a' : '#d8354a', 1.4, lit ? 2 : 1);
      ctx.globalAlpha = 1;
      glowSpot(st.x, cy, lit ? 80 : 40, '#d8354a', lit ? 0.9 : 0.5);
      break;
    }
    case 'temple':
      ctx.globalAlpha = 0.07 + Math.sin(now * 0.8) * 0.03;
      ctx.fillStyle = '#fff3b0';
      for (let i = -3; i <= 3; i++) ctx.fillRect(Math.round(st.x - camX + i * 14 - 3), Math.round(st.y - camY - 180), 6, 170);
      ctx.globalAlpha = 1;
      if (chance(dt, 5)) addPart(st.x + rand(-50, 50), st.y - 10, 0, rand(-14, -4), 1.6, '#ffd35a', 1, 0, 0.3);
      break;
    case 'mansion': {
      const t = (now * 0.2 + st.seed % 10) % 5;
      if (t < 1) {
        const f = SPR.wraith[0];
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.45;
        ctx.drawImage(f.c, Math.round(st.x - 60 + t * 120 - camX - 6), Math.round(st.y - 60 - camY));
        ctx.globalAlpha = 1;
      }
      fog(st.x, st.y + 10, 110, now, 9, 'rgba(226,123,240,0.04)');
      break;
    }
  }
}
let ambienceT = performance.now();
Mods.add({
  drawTop(now) {
    if (!G || noStructs()) return;
    const dt = Math.min(0.05, (performance.now() - ambienceT) / 1000);
    ambienceT = performance.now();
    for (const st of structsNear(ME.x, ME.y)) if (st.built && onScreen(st.x, st.y, st.R + 120)) ambience(st, now, state === 'play' ? dt : 0);
  },
  drawOverlay() {
    if (!G || noStructs() || state !== 'play') return;
    for (const st of structsNear(ME.x, ME.y)) {
      if (!st.built || !onScreen(st.x, st.y, 10)) continue;
      const d = Math.hypot(st.x - ME.x, st.y - ME.y);
      if (d < st.R + 70 && d > 26 && (st.type !== 'village' && st.type !== 'town' && st.type !== 'ruinvillage' || d < st.R * 0.6)) drawText(ctx, structName(st), st.x - camX, st.y - camY - (st.labelH || 40), st.ruined ? '#a59cc4' : STRUCT_COL[st.type]);
    }
  },
});
