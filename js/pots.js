'use strict';
/* Clay pots: scattered across the world, the same places every run. Stand close, press E, and the pot breaks and spills gold. */

const POT_CELL = 130, POT_RANGE = 22;
function potAt(i, j) {
  G.pots = G.pots || new Map();
  const k = i * 100003 + j;
  if (G.pots.has(k)) return G.pots.get(k);
  const sd = (G.seed | 0) + 77;
  let p = null;
  if (hash2(i, j, sd) < 0.2) {
    const x = (i + 0.15 + 0.7 * hash2(i, j, sd + 1)) * POT_CELL, y = (j + 0.15 + 0.7 * hash2(i, j, sd + 2)) * POT_CELL;
    if (coastK(x, y) < 0.92 && Math.hypot(x, y) > (G.siege ? 130 : 50) && !structsNear(x, y, 1).some(st => Math.hypot(st.x - x, (st.y - y) * 1.2) < st.R + 12)) p = { x, y, broken: false, v: hash2(i, j, sd + 3) };
  }
  G.pots.set(k, p);
  return p;
}
function potsNear(x, y, r) {
  const out = [], i0 = Math.floor((x - r) / POT_CELL), i1 = Math.floor((x + r) / POT_CELL), j0 = Math.floor((y - r) / POT_CELL), j1 = Math.floor((y + r) / POT_CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const p = potAt(i, j); if (p && !p.broken) out.push(p); }
  return out;
}
function breakPot(p) {
  p.broken = true;
  burst(p.x, p.y - 4, '#b87444', 14, 70); burst(p.x, p.y - 4, '#8a5230', 6, 50);
  const n = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) G.items.push({ k: 'coin', x: p.x + rand(-9, 9), y: p.y + rand(-4, 8), ph: 0 });
  if (Math.random() < 0.12) G.items.push({ k: 'bag', x: p.x, y: p.y + 6, ph: 0 });
  else if (Math.random() < 0.1) G.items.push({ k: 'heart', x: p.x, y: p.y + 6, ph: 0 });
  Snd.play('pickup');
}

Mods.add({
  newRun() { G.pots = new Map(); },
  interact(pl = ME) {
    if (G.dim || G.story) return false;
    const p = potsNear(pl.x, pl.y + 6, POT_RANGE).find(q => Math.hypot(q.x - pl.x, q.y - (pl.y + 6)) < POT_RANGE);
    if (!p) return false;
    breakPot(p);
    return true;
  },
  ents(list) {
    if (G.dim || G.story) return;
    for (const p of potsNear(camX + W / 2, camY + H / 2, Math.max(W, H) / 2 + 20)) if (onScreen(p.x, p.y, 16)) list.push({ sortY: p.y, y: p.y, x: p.x, draw: now => drawPot(p, now) });
  },
});

function drawPot(p, now) {
  const x = Math.round(p.x - camX), y = Math.round(p.y - camY), r = (cx, cy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + cx, y + cy, w, h); };
  r(-6, -1, 12, 3, 'rgba(0,0,0,.3)');
  r(-6, -9, 12, 9, '#0b0a12'); r(-5, -13, 10, 3, '#0b0a12'); r(-4, -1, 8, 2, '#0b0a12');
  r(-4, -12, 8, 2, '#a8683a'); r(-3, -10, 6, 2, '#8a5230'); r(-5, -8, 10, 6, '#b87444'); r(-4, -2, 8, 2, '#8a5230');
  r(-4, -7, 2, 4, '#d89a62'); r(1, -7, 3, 1, '#8a5230'); r(-1, -5, 4, 1, '#8a5230');
  if (P && Math.hypot(P.x - p.x, P.y + 6 - p.y) < POT_RANGE) drawText(ctx, 'E', p.x - camX, p.y - camY - 20 + Math.round(Math.sin(now / 200)), '#f2eee6');
}
