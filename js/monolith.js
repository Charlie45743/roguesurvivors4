'use strict';
/* Monolith: a standing stone that rises at random. Stay inside its circle until it wakes, then pick one of three boons.
   Each boon has a rarity; the rarer it is, the more levels it grants. Options are listed rarest first. */

const MONO_R = 44, MONO_NEED = 4;
const RARITY = [
  { name: 'Common', color: '#a59cc4', w: 55, lv: 1 },
  { name: 'Uncommon', color: '#a6e05a', w: 25, lv: 1, gold: 60 },
  { name: 'Rare', color: '#6aa8ff', w: 13, lv: 2 },
  { name: 'Epic', color: '#e27bf0', w: 5, lv: 3 },
  { name: 'Legendary', color: '#ffd35a', w: 2, lv: 4, heal: true },
];

// One card per boon: what it is, how many levels the rarity grants, and exactly what you gain
function monoGain(c, n) {
  if (c.k === 'w') {
    const d = WEAPONS[c.id], w = G.weapons.find(x => x.id === c.id);
    if (!w) return { n, from: 'New weapon', lines: [d.desc, ...Array.from({ length: n - 1 }, (_, i) => lvDesc(d.lv[i], d.unit))] };
    const k = Math.min(n, WEAPON_MAX(c.id) - w.level);
    return { n: k, from: `Level ${w.level} → ${w.level + k}`, lines: Array.from({ length: k }, (_, i) => lvDesc(d.lv[w.level - 1 + i], d.unit)) };
  }
  if (c.k === 'p') {
    const l = G.passives[c.id] || 0, k = Math.min(n, PASSIVES[c.id].max - l);
    return { n: k, from: l ? `Level ${l} → ${l + k}` : 'New relic', lines: [PASSIVES[c.id].desc.replace(/\d+(\.\d+)?/g, x => +(x * k).toFixed(2))] };
  }
  return { n: 1, from: '', lines: [choiceInfo(c).desc] };
}
function monoGrant(pl, o) {
  const keep = P, r = RARITY[o.r]; P = pl;
  try {
    for (let i = 0; i < o.gain.n; i++) applyChoice(o.c);
    if (r.gold) G.gold += r.gold;
    if (r.heal) pl.hp = pl.maxHp;
  } finally { P = keep; }
  banner(`${r.name}: ${o.info.name}`, o.gain.lines[0] || '', r.color);
  setState('play');
}
const rollRarity = () => weighted(Object.fromEntries(RARITY.map((x, i) => [i, x.w]))) | 0;
// The card body shared by monoliths and level-ups: rarity, picture, name, and exactly what you gain
function boonInner(o, i) {
  const r = RARITY[o.r];
  return `<span class="key">${i + 1}</span>
    <div class="rar">${r.name}</div>
    <div class="top"><div class="ic"><img src="${ICON_URL[o.info.icon]}" alt=""></div><div><div class="name">${o.info.name}</div><div class="lv">${o.gain.from}</div></div></div>
    <ul class="gain">${o.gain.lines.map(l => `<li>${l}</li>`).join('')}${r.gold ? `<li>+${r.gold} gold</li>` : ''}${r.heal ? '<li>Full heal</li>' : ''}</ul>
    ${o.info.hint ? `<div class="hint"><img src="${ICON_URL[o.info.hintIcon]}" alt="">${o.info.hint}</div>` : ''}`;
}
// Give a rolled choice at its rarity (level-ups use this too); a choice with no rarity is Common
function grantChoice(c) {
  const r = RARITY[c.r || 0], n = Math.max(1, monoGain(c, r.lv).n);
  for (let i = 0; i < n; i++) applyChoice(c);
  if (r.gold) G.gold += r.gold;
  if (r.heal) P.hp = P.maxHp;
}
// Roll choices with rarities, rarest first
const rarify = list => { for (const c of list) c.r = rollRarity(); return list.sort((a, b) => b.r - a.r); };

let BOON = null, boonSel = 0;
function renderBoon() {
  const keep = P; P = BOON.pl;
  try {
    BOON.opts = rarify(rollChoices(3)).map(c => ({ c, r: c.r, info: choiceInfo(c), gain: monoGain(c, RARITY[c.r].lv) }));
  } finally { P = keep; }
  drawBoon();
}
function drawBoon() {
  $('boonCards').innerHTML = BOON.opts.map((o, i) => `<button class="card boon" style="--rc:${RARITY[o.r].color}; animation-delay:${i * 0.08}s">${boonInner(o, i)}</button>`).join('');
  [...$('boonCards').children].forEach((el, i) => { el.onclick = () => boonPick(i); el.onmouseenter = () => { boonSel = i; boonMark(); }; });
  $('btnBoonReroll').textContent = `Reroll (${G.rerolls})`; $('btnBoonReroll').disabled = G.rerolls <= 0;
  boonSel = 0; boonMark();
}
function monoOpen(pl) {
  const keep = P; P = pl;
  let opts;
  try { opts = rarify(rollChoices(3)).map(c => ({ c, r: c.r, info: choiceInfo(c), gain: monoGain(c, RARITY[c.r].lv) })); } finally { P = keep; }
  if (!opts.length) { G.gold += 100; banner('The monolith is quiet', '+100 gold', '#8ff0ff'); return; }
  if (pl !== ME && !G.local) { monoGrant(pl, opts[0]); return; }   // an online partner takes the best boon on offer
  BOON = { pl, opts };
  Snd.play('evolve'); G.whiteFlash = 0.6;
  setState('boon');
  drawBoon();
}
const boonMark = () => [...$('boonCards').children].forEach((el, i) => el.classList.toggle('sel', i === boonSel));
function boonPick(i) {
  if (state !== 'boon' || !BOON || !BOON.opts[i]) return;
  Snd.play('select');
  const { pl, opts } = BOON; BOON = null;
  monoGrant(pl, opts[i]);
}
$('btnBoonReroll').onclick = () => { if (state !== 'boon' || !BOON || G.rerolls <= 0) return; G.rerolls--; Snd.play('select'); renderBoon(); };
$('btnBoonSkip').onclick = () => { if (state !== 'boon') return; Snd.play('select'); BOON = null; setState('play'); };
addEventListener('keydown', e => {
  if (state !== 'boon' || !BOON) return;
  const n = parseInt(e.key, 10), len = BOON.opts.length;
  if (n >= 1 && n <= len) boonPick(n - 1);
  else if (e.code === 'KeyR') $('btnBoonReroll').click();
  else if (/Arrow(Right|Down)|KeyD|KeyS/.test(e.code)) { boonSel = (boonSel + 1) % len; boonMark(); Snd.play('hover'); }
  else if (/Arrow(Left|Up)|KeyA|KeyW/.test(e.code)) { boonSel = (boonSel + len - 1) % len; boonMark(); Snd.play('hover'); }
  else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); boonPick(boonSel); }
});
SCREENS.push('boon'); HUD_STATES.add('boon');

// Monoliths are part of the world: a few stand in every region, found at the same places all run, and they recharge after use
const MONO_CELL = 420, MONO_COOLDOWN = 300;
function monoAt(i, j) {
  G.monos = G.monos || new Map();
  const k = i * 100003 + j;
  if (G.monos.has(k)) return G.monos.get(k);
  const sd = G.seed | 0;
  let m = null;
  if (hash2(i, j, sd) < 0.354) {
    const x = (i + 0.15 + 0.7 * hash2(i, j, sd + 1)) * MONO_CELL, y = (j + 0.15 + 0.7 * hash2(i, j, sd + 2)) * MONO_CELL;
    const ok = coastK(x, y) < 0.9 && Math.hypot(x, y) > (G.siege ? 200 : 110) && !structsNear(x, y, 1).some(st => Math.hypot(st.x - x, (st.y - y) * 1.2) < st.R + 50);
    if (ok) m = { x, y, prog: 0, cd: 0 };
  }
  G.monos.set(k, m);
  return m;
}
function monosNear(x, y, r) {
  const out = [], i0 = Math.floor((x - r) / MONO_CELL), i1 = Math.floor((x + r) / MONO_CELL), j0 = Math.floor((y - r) / MONO_CELL), j1 = Math.floor((y + r) / MONO_CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const m = monoAt(i, j); if (m) out.push(m); }
  return out;
}

Mods.add({
  newRun() { G.monos = new Map(); },
  update(dt) {
    if (G.dim || G.story || G.over || state !== 'play') return;
    const seen = new Set();
    for (const m of G.monos.values()) if (m && m.cd > 0) m.cd = Math.max(0, m.cd - dt);
    for (const pl of G.players) for (const m of monosNear(pl.x, pl.y, 300)) seen.add(m);
    for (const m of seen) {
      if (m.cd > 0) continue;
      const near = G.players.filter(p => !p.down && Math.hypot(p.x - m.x, p.y - m.y) < MONO_R);
      m.prog = near.length ? m.prog + dt : Math.max(0, m.prog - dt * 0.5);
      if (m.prog >= MONO_NEED) {
        m.prog = 0; m.cd = MONO_COOLDOWN;
        burst(m.x, m.y - 10, '#8ff0ff', 40, 110);
        monoOpen(near[0]);
        return;
      }
    }
  },
  ents(list) {
    for (const m of monosNear(camX + W / 2, camY + H / 2, Math.max(W, H) / 2 + 80)) if (onScreen(m.x, m.y, MONO_R + 20)) list.push({ sortY: m.y + 6, y: m.y, x: m.x, draw: now => drawMono(m, now) });
  },
  minimap(dot) { for (const m of monosNear(ME.x, ME.y, 1100)) if (m.cd <= 0) dot(m.x, m.y, '#8ff0ff', 3); },
});

function drawMono(m, now) {
  const x = Math.round(m.x - camX), y = Math.round(m.y - camY), t = now / 1000, k = m.prog / MONO_NEED;
  ctx.lineWidth = 1;
  const dead = m.cd > 0;
  ctx.strokeStyle = dead ? 'rgba(165,156,196,.15)' : 'rgba(143,240,255,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 4, MONO_R, MONO_R * 0.55, 0, 0, TAU); ctx.stroke();
  if (k > 0) { ctx.strokeStyle = '#8ff0ff'; ctx.beginPath(); ctx.ellipse(x, y + 4, MONO_R, MONO_R * 0.55, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 9, y + 3, 18, 4);
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(x - 8, y - 30, 16, 36);
  ctx.fillStyle = '#4a4466'; ctx.fillRect(x - 7, y - 29, 14, 34); ctx.fillStyle = '#6e668f'; ctx.fillRect(x - 7, y - 29, 4, 34);
  ctx.fillStyle = '#4a4466'; ctx.fillRect(x - 5, y - 33, 10, 4);
  const glow = dead ? 0 : 0.5 + 0.5 * Math.sin(t * 3) + k;
  ctx.fillStyle = dead ? 'rgba(90,84,120,.8)' : `rgba(143,240,255,${Math.min(1, 0.35 + glow * 0.4)})`;
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 1, y - 26 + i * 8, 2, 4);
  ctx.fillRect(x - 4, y - 22, 3, 1); ctx.fillRect(x + 1, y - 14, 3, 1);
  if (!dead && Math.random() < 0.15 + k * 0.5) addPart(m.x + rand(-5, 5), m.y - 20, rand(-3, 3), rand(-26, -12), 0.7, '#8ff0ff', 1);
}
