'use strict';
/* Monolith: a standing stone that rises at random. Stay inside its circle until it wakes, then pick one of three boons.
   Each boon has a rarity; the rarer it is, the more levels it grants. Options are listed rarest first. */

const MONO_R = 44, MONO_NEED = 8;
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
function monoOffer(pl) {
  const keep = P; P = pl;
  try {
    return rollChoices(3).map(c => {
      const r = weighted(Object.fromEntries(RARITY.map((x, i) => [i, x.w]))) | 0;
      return { c, r, info: choiceInfo(c), gain: monoGain(c, RARITY[r].lv) };
    }).sort((a, b) => b.r - a.r);
  } finally { P = keep; }
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
let BOON = null, boonSel = 0;
function monoOpen(pl) {
  const opts = monoOffer(pl);
  if (!opts.length) { G.gold += 100; banner('The monolith is quiet', '+100 gold', '#8ff0ff'); return; }
  if (pl !== ME && !G.local) { monoGrant(pl, opts[0]); return; }   // an online partner takes the best boon on offer
  BOON = { pl, opts }; boonSel = 0;
  Snd.play('evolve'); G.whiteFlash = 0.6;
  setState('boon');
  $('boonCards').innerHTML = opts.map((o, i) => {
    const r = RARITY[o.r];
    return `<button class="card boon" style="--rc:${r.color}; animation-delay:${i * 0.08}s"><span class="key">${i + 1}</span>
      <div class="rar">${r.name}</div>
      <div class="top"><div class="ic"><img src="${ICON_URL[o.info.icon]}" alt=""></div><div><div class="name">${o.info.name}</div><div class="lv">${o.gain.from}</div></div></div>
      <ul class="gain">${o.gain.lines.map(l => `<li>${l}</li>`).join('')}${r.gold ? `<li>+${r.gold} gold</li>` : ''}${r.heal ? '<li>Full heal</li>' : ''}</ul></button>`;
  }).join('');
  [...$('boonCards').children].forEach((el, i) => { el.onclick = () => boonPick(i); el.onmouseenter = () => { boonSel = i; boonMark(); }; });
  boonMark();
}
const boonMark = () => [...$('boonCards').children].forEach((el, i) => el.classList.toggle('sel', i === boonSel));
function boonPick(i) {
  if (state !== 'boon' || !BOON || !BOON.opts[i]) return;
  Snd.play('select');
  const { pl, opts } = BOON; BOON = null;
  monoGrant(pl, opts[i]);
}
addEventListener('keydown', e => {
  if (state !== 'boon' || !BOON) return;
  const n = parseInt(e.key, 10), len = BOON.opts.length;
  if (n >= 1 && n <= len) boonPick(n - 1);
  else if (/Arrow(Right|Down)|KeyD|KeyS/.test(e.code)) { boonSel = (boonSel + 1) % len; boonMark(); Snd.play('hover'); }
  else if (/Arrow(Left|Up)|KeyA|KeyW/.test(e.code)) { boonSel = (boonSel + len - 1) % len; boonMark(); Snd.play('hover'); }
  else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); boonPick(boonSel); }
});
SCREENS.push('boon'); HUD_STATES.add('boon');

Mods.add({
  newRun() { G.mono = null; G.monoT = 45; },
  update(dt) {
    if (G.dim || G.story || G.over || state !== 'play') return;
    const m = G.mono;
    if (!m) {
      G.monoT -= dt;
      if (G.monoT <= 0) {
        const a = Math.random() * TAU, R = rand(150, 230);
        G.mono = { x: ME.x + Math.cos(a) * R, y: ME.y + Math.sin(a) * R, prog: 0, t: 0 };
        banner('A monolith rises', 'Stand in its circle to wake it', '#8ff0ff');
        Snd.play('warn');
      }
      return;
    }
    m.t += dt;
    const near = G.players.filter(p => !p.down && Math.hypot(p.x - m.x, p.y - m.y) < MONO_R);
    m.prog = near.length ? m.prog + dt : Math.max(0, m.prog - dt * 0.5);
    if (m.prog >= MONO_NEED) {
      G.mono = null; G.monoT = rand(80, 120);
      burst(m.x, m.y - 10, '#8ff0ff', 40, 110);
      monoOpen(near[0]);
    } else if (!G.players.some(p => Math.hypot(p.x - m.x, p.y - m.y) < 1100)) { G.mono = null; G.monoT = 30; }
  },
  ents(list) {
    const m = G.mono;
    if (m && onScreen(m.x, m.y, MONO_R + 20)) list.push({ sortY: m.y + 6, y: m.y, x: m.x, draw: now => drawMono(m, now) });
  },
  pointers(list) {
    const m = G.mono;
    if (m && !onScreen(m.x, m.y - 10, 10)) list.push({ x: m.x, y: m.y, pcolor: '#8ff0ff', picon: ICON.nova });
  },
  minimap(dot) { if (G.mono) dot(G.mono.x, G.mono.y, '#8ff0ff', 4, true); },
});

function drawMono(m, now) {
  const x = Math.round(m.x - camX), y = Math.round(m.y - camY), t = now / 1000, k = m.prog / MONO_NEED;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(143,240,255,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 4, MONO_R, MONO_R * 0.55, 0, 0, TAU); ctx.stroke();
  if (k > 0) { ctx.strokeStyle = '#8ff0ff'; ctx.beginPath(); ctx.ellipse(x, y + 4, MONO_R, MONO_R * 0.55, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 9, y + 3, 18, 4);
  ctx.fillStyle = '#0b0a12'; ctx.fillRect(x - 8, y - 30, 16, 36);
  ctx.fillStyle = '#4a4466'; ctx.fillRect(x - 7, y - 29, 14, 34); ctx.fillStyle = '#6e668f'; ctx.fillRect(x - 7, y - 29, 4, 34);
  ctx.fillStyle = '#4a4466'; ctx.fillRect(x - 5, y - 33, 10, 4);
  const glow = 0.5 + 0.5 * Math.sin(t * 3) + k;
  ctx.fillStyle = `rgba(143,240,255,${Math.min(1, 0.35 + glow * 0.4)})`;
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 1, y - 26 + i * 8, 2, 4);
  ctx.fillRect(x - 4, y - 22, 3, 1); ctx.fillRect(x + 1, y - 14, 3, 1);
  if (Math.random() < 0.15 + k * 0.5) addPart(m.x + rand(-5, 5), m.y - 20, rand(-3, 3), rand(-26, -12), 0.7, '#8ff0ff', 1);
}
