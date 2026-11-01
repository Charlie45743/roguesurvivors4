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

function monoOffer(pl) {
  const keep = P; P = pl;
  try {
    const picks = rollChoices(3);
    return picks.map(c => ({ c, r: weighted(Object.fromEntries(RARITY.map((r, i) => [i, r.w]))) | 0, info: choiceInfo(c) })).sort((a, b) => b.r - a.r);
  } finally { P = keep; }
}
function monoGrant(pl, o) {
  const keep = P, r = RARITY[o.r]; P = pl;
  try {
    for (let i = 0; i < r.lv; i++) {
      if (o.c.k === 'w') { const w = G.weapons.find(x => x.id === o.c.id); if (w && (w.evo || w.level >= WEAPON_MAX(w.id))) break; }
      else if (o.c.k === 'p' && (G.passives[o.c.id] || 0) >= PASSIVES[o.c.id].max) break;
      applyChoice(o.c);
    }
    if (r.gold) G.gold += r.gold;
    if (r.heal) pl.hp = pl.maxHp;
  } finally { P = keep; }
}
function monoOpen(pl) {
  const opts = monoOffer(pl);
  if (!opts.length) { G.gold += 100; banner('The monolith is quiet', '+100 gold', '#8ff0ff'); return; }
  Snd.play('evolve'); G.whiteFlash = 0.6;
  openModal({
    title: 'The Monolith Wakes', color: '#8ff0ff', sub: 'Choose one boon',
    body: '<p class="flavor">The runes burn. Rarer gifts come with more power.</p>',
    buttons: opts.map(o => {
      const r = RARITY[o.r];
      return { label: `<b style="color:${r.color}">${r.name}</b> · ${o.info.name}`, desc: `${o.info.lv ? o.info.lv + ' · ' : ''}${o.info.desc} (+${r.lv} level${r.lv > 1 ? 's' : ''}${r.gold ? ', +' + r.gold + ' gold' : ''}${r.heal ? ', full heal' : ''})`, primary: o.r >= 3, act: () => monoGrant(pl, o) };
    }),
  }, pl);
}

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
