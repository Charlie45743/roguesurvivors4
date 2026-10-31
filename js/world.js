'use strict';
/* The island has an edge, and a map. The night map is bounded by a coastline (sea beyond, a beach before it);
   walkers, spawns and structures stay inside it. Press M (or tap the minimap) for a translucent map of what you
   have explored; hold M to peek. Hover a discovered place to see its name. */

const WORLD_R = 3200, WALK_K = 0.985, BEACH_K = 0.94, EX_C = 96;
const worldBounded = () => !!G && !G.dim && !G.story;
function coastR(a) {
  const s = G ? (G.seed % 97) * 0.13 : 0;
  return WORLD_R * (1 + 0.1 * Math.sin(3 * a + s) + 0.06 * Math.sin(5 * a + 2 * s + 1) + 0.03 * Math.sin(9 * a + 3 * s));
}
function coastK(x, y) { const d = Math.hypot(x, y); return d < 1 ? 0 : d / coastR(Math.atan2(y, x)); }

// Sea beyond the coast, a sandy beach just inside it
const baseBiomeAt = biomeAt;
biomeAt = function (x, y) {
  if (biomeOverride || !G || G.dim || G.story) return baseBiomeAt(x, y);
  const k = coastK(x, y);
  return k > 1 ? 'sea' : k > BEACH_K ? 'isle' : baseBiomeAt(x, y);
};
function clampToIsland(o) {
  const k = coastK(o.x, o.y);
  if (k > WALK_K) { const s = WALK_K / k; o.x *= s; o.y *= s; }
}

/* ---------- Exploration ---------- */
const exKey = (cx, cy) => (cx + 2048) * 4096 + (cy + 2048);
const exCell = k => [Math.floor(k / 4096) - 2048, (k % 4096) - 2048];
function exSet() {
  G.explored = G.explored || {};
  const k = G.dim || 'world';
  return G.explored[k] || (G.explored[k] = new Set());
}
function exploreStep() {
  if (!G || !G.players) return;
  const set = exSet(), tag = G.dim || 'w';
  for (const pl of G.players) {
    const cx = Math.floor(pl.x / EX_C), cy = Math.floor(pl.y / EX_C), id = cx * 7919 + cy;
    if (pl._ex === id && pl._exTag === tag) continue;
    pl._ex = id; pl._exTag = tag;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (i * i + j * j <= 10) set.add(exKey(cx + i, cy + j));
  }
}
const seenAt = (x, y) => exSet().has(exKey(Math.floor(x / EX_C), Math.floor(y / EX_C)));

Mods.add({
  update(dt) {
    exploreStep();
    if (!worldBounded()) return;
    for (const pl of G.players) clampToIsland(pl);
    for (const a of G.allies || []) clampToIsland(a);
    for (const e of G.enemies) if (!e.prop && !e.dead) clampToIsland(e);
    for (const s of G.shrines) clampToIsland(s);
    for (const c of G.crypts) clampToIsland(c);
    for (const p of G.portals) clampToIsland(p);
    if (G.ev && G.ev.x !== undefined) clampToIsland(G.ev);
    if (!G.edgeWarned && coastK(ME.x, ME.y) > 0.9) { G.edgeWarned = true; banner('The edge of the island', 'Only sea lies beyond', '#8ff0ff'); }
  },
  remoteUpdate() { exploreStep(); },
  // foam and glitter along the shore, wave sparkle out at sea
  drawGround(now) {
    if (!worldBounded()) return;
    const C = 32, x0 = Math.floor(camX / C), x1 = Math.floor((camX + W) / C), y0 = Math.floor(camY / C), y1 = Math.floor((camY + H) / C);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const b = biomeCell(cx, cy), sx = cx * C - camX, sy = cy * C - camY;
      if (b === 'sea') {
        if (hash2(cx, cy, Math.floor(now * 0.8)) < 0.07) { ctx.fillStyle = 'rgba(200,235,255,0.5)'; ctx.fillRect(Math.round(sx + hash2(cx, cy, 3) * 28), Math.round(sy + hash2(cx, cy, 4) * 28), 2, 1); }
        continue;
      }
      if (b !== 'isle') continue;
      const w = Math.sin(now * 1.6 + cx * 0.7 + cy * 0.5) * 2 + 2;
      ctx.fillStyle = 'rgba(230,248,255,0.8)';
      if (biomeCell(cx + 1, cy) === 'sea') for (let n = 0; n < 6; n++) ctx.fillRect(Math.round(sx + C - 1 - w - (n % 2)), Math.round(sy + n * 5 + hash2(cx, cy + n, 8) * 3), 2 + (n % 2), 1);
      if (biomeCell(cx - 1, cy) === 'sea') for (let n = 0; n < 6; n++) ctx.fillRect(Math.round(sx + w + (n % 2)), Math.round(sy + n * 5 + hash2(cx, cy + n, 9) * 3), 2 + (n % 2), 1);
      if (biomeCell(cx, cy + 1) === 'sea') for (let n = 0; n < 6; n++) ctx.fillRect(Math.round(sx + n * 5 + hash2(cx + n, cy, 10) * 3), Math.round(sy + C - 1 - w - (n % 2)), 3, 1);
      if (biomeCell(cx, cy - 1) === 'sea') for (let n = 0; n < 6; n++) ctx.fillRect(Math.round(sx + n * 5 + hash2(cx + n, cy, 11) * 3), Math.round(sy + w + (n % 2)), 3, 1);
    }
  },
});

/* ---------- The map ---------- */
const MAPCOL = { moss: '#2f5a38', ash: '#5a4640', grave: '#46405e', bog: '#2f5a5a', isle: '#9a8a58', sea: '#143a5c', frozen: '#9fb0c6', rift: '#4a2018', void: '#2a1c46', demon: '#4a1418' };
const mapMouse = { x: -1, y: -1 };
const mapOn = () => !!(G && G.mapOpen && state === 'play');
const openMap = () => { G.mapOpen = true; G.mapT0 = performance.now(); G.mapZoom = G.mapZoom || 1; };
const closeMap = () => { if (G) G.mapOpen = false; };
addEventListener('keyup', e => { if (e.code === 'KeyM' && G && G.mapOpen && performance.now() - G.mapT0 > 350) closeMap(); });
const canvasPos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
cv.addEventListener('pointermove', e => { [mapMouse.x, mapMouse.y] = canvasPos(e); });
cv.addEventListener('pointerleave', () => { mapMouse.x = mapMouse.y = -1; });
cv.addEventListener('wheel', e => {
  if (!mapOn()) return;
  e.preventDefault();
  const Z = [1, 1.7, 2.8, 4.5], i = Math.max(0, Z.findIndex(z => z >= (G.mapZoom || 1) - 0.01));
  G.mapZoom = Z[clamp(i + (e.deltaY < 0 ? 1 : -1), 0, Z.length - 1)];
}, { passive: false });
cv.addEventListener('pointerdown', e => {
  if (!G || (state !== 'play')) return;
  const [x, y] = canvasPos(e);
  if (x >= 4 && x <= 100 && y >= H - 100 && y <= H - 4) { G.mapOpen ? closeMap() : openMap(); }
});
Mods.add({
  key(e) {
    if (!G || state !== 'play') return false;
    if (e.code === 'KeyM') { if (!e.repeat) { G.mapOpen ? closeMap() : openMap(); } return true; }
    if (G.mapOpen && e.code === 'Escape') { closeMap(); return true; }
    return false;
  },
});

function mapGeom() {
  const bounded = worldBounded(), island = G.dim === 'island';
  const R = bounded ? WORLD_R * 1.22 : island ? ISLAND_R * 1.3 : 1300;
  const px0 = 22, py0 = 14, pw = W - 44, ph = H - 28, z = G.mapZoom || 1, scale = Math.min(pw, ph) / (2 * R) * z;
  const follow = (!bounded && !island) || z > 1;
  return { px0, py0, pw, ph, scale, cx: follow ? ME.x : 0, cy: follow ? ME.y : 0, mx: px0 + pw / 2, my: py0 + ph / 2 };
}
let mapStructCache = { t: 0, list: [] };
function mapStructs() {
  const now = performance.now();
  if (now - mapStructCache.t < 700) return mapStructCache.list;
  const list = [], witch = ME.relics?.includes('witchEye'), n = worldBounded() ? Math.ceil(WORLD_R * 1.2 / REGION) : 4;
  const ox = worldBounded() ? 0 : regionOf(ME.x), oy = worldBounded() ? 0 : regionOf(ME.y);
  if (!noStructs()) for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const st = regionStruct(ox + i, oy + j);
    if (st && (st.built || st.active || G.revealed?.has(st.id) || witch || seenAt(st.x, st.y))) list.push(st);
  }
  mapStructCache = { t: now, list };
  return list;
}
const mapText = s => String(s).replace(/[^A-Za-z0-9!+\-.: \/%]/g, '');
function wrapText(s, n) {
  const words = mapText(s).split(' '), lines = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
}

function drawMap(now) {
  const g = mapGeom(), to = (x, y) => [g.mx + (x - g.cx) * g.scale, g.my + (y - g.cy) * g.scale];
  ctx.save();
  ctx.beginPath(); ctx.rect(g.px0, g.py0, g.pw, g.ph); ctx.clip();
  ctx.fillStyle = 'rgba(5,9,20,0.78)'; ctx.fillRect(g.px0, g.py0, g.pw, g.ph);
  const bounded = worldBounded();
  // the coastline: sea outside, a beach just inside
  if (bounded || G.dim === 'island') {
    const path = k => {
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = i / 120 * TAU, r = bounded ? coastR(a) * k : ISLAND_R * k;
        const [x, y] = to(Math.cos(a) * r, Math.sin(a) * r * (bounded ? 1 : 0.8));
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    path(1); ctx.fillStyle = 'rgba(30,34,52,0.9)'; ctx.fill();
  }
  // explored ground, coloured by what lies there
  const set = exSet(), cs = EX_C * g.scale + 0.6;
  G.mapCol = G.mapCol || {};
  for (const key of set) {
    const [cx, cy] = exCell(key), [sx, sy] = to(cx * EX_C, cy * EX_C);
    if (sx + cs < g.px0 || sy + cs < g.py0 || sx > g.px0 + g.pw || sy > g.py0 + g.ph) continue;
    const ck = (G.dim || 'w') + key;
    const col = G.mapCol[ck] || (G.mapCol[ck] = MAPCOL[biomeAt(cx * EX_C + EX_C / 2, cy * EX_C + EX_C / 2)] || '#3a3a48');
    ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(cs), Math.ceil(cs)); ctx.globalAlpha = 1;
  }
  if (bounded || G.dim === 'island') {
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, r = bounded ? coastR(a) : ISLAND_R, [x, y] = to(Math.cos(a) * r, Math.sin(a) * r * (bounded ? 1 : 0.8)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.strokeStyle = 'rgba(190,240,255,0.95)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, r = bounded ? coastR(a) * BEACH_K : ISLAND_R * 0.94, [x, y] = to(Math.cos(a) * r, Math.sin(a) * r * (bounded ? 1 : 0.8)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.strokeStyle = 'rgba(200,180,110,0.45)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // markers, with names on hover
  const marks = [];
  const mark = (x, y, size, col, title, sub, status, alpha = 1, shape = 'sq') => {
    const [sx, sy] = to(x, y);
    if (sx < g.px0 - 6 || sx > g.px0 + g.pw + 6 || sy < g.py0 - 6 || sy > g.py0 + g.ph + 6) return;
    marks.push({ sx, sy, size, col, title, sub, status, alpha, shape });
  };
  for (const st of mapStructs()) {
    const big = st.type === 'town' ? 6 : st.type === 'village' || st.type === 'ruinvillage' ? 5 : 4;
    const [title, sub] = STRUCT_TITLE[st.type] ? [structName(st), STRUCT_TITLE[st.type][1]] : [st.type, ''];
    const visited = st.active || st.built;
    mark(st.x, st.y, big, st.ruined ? '#5e557f' : STRUCT_COL[st.type] || '#fff', title, sub, st.done && st.type !== 'village' ? 'Cleared' : visited ? 'Visited' : 'Charted', st.done && st.type !== 'village' ? 0.45 : 1, st.door || st.hatch ? 'dia' : 'sq');
  }
  for (const s of G.shrines || []) if (seenAt(s.x, s.y) && s.uses > 0) mark(s.x, s.y, 3, '#e27bf0', s.kind && SHRINE_KINDS[s.kind] ? SHRINE_KINDS[s.kind].name : 'Shrine of Fortune', 'Make an offering', '', 1, 'dia');
  for (const c of G.crypts || []) mark(c.x, c.y, 3, '#e8742c', 'Crypt entrance', 'Treasure waits below', '', 1, 'dia');
  for (const p of G.portals || []) mark(p.x, p.y, 4, p.dim === 'home' ? '#ffd35a' : DIMS[p.dim].color, p.dim === 'home' ? 'Golden portal' : 'Portal to ' + DIMS[p.dim].name, 'Step through', '', 1, 'dia');
  if (G.spawner && !G.spawner.on) mark(G.spawner.x, G.spawner.y, 6, DIMS[G.spawner.dim].color, 'Boss portal', 'Find it. Open it. Kill the boss within the time limit', '', 1, 'dia');
  for (const e of G.enemies) if (e.boss && !e.dead) mark(e.x, e.y, 5, '#d8354a', e.name || 'Guardian', 'A boss', '', 1, 'dia');
  for (const a of G.allies || []) if (!a.gone) mark(a.x, a.y, 2, a.down ? '#ffd35a' : '#a6e05a', a.name, a.down ? 'Down. Help them up' : 'Your companion', '');
  for (const pl of G.players) if (pl !== ME) mark(pl.x, pl.y, 3, '#3f8ee0', 'Your partner', '', '');
  let hover = null, hd = 49;
  for (const m of marks) {
    const d = (m.sx - mapMouse.x) ** 2 + (m.sy - mapMouse.y) ** 2;
    if (d < hd && m.title) { hd = d; hover = m; }
  }
  for (const m of marks) {
    const s = m.size + (m === hover ? 2 : 0), x = Math.round(m.sx), y = Math.round(m.sy);
    ctx.globalAlpha = m.alpha;
    if (m.shape === 'dia') { ctx.fillStyle = '#0b0a12'; ctx.beginPath(); ctx.moveTo(x, y - s - 1); ctx.lineTo(x + s + 1, y); ctx.lineTo(x, y + s + 1); ctx.lineTo(x - s - 1, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = m.col; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle = '#0b0a12'; ctx.fillRect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2); ctx.fillStyle = m.col; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    ctx.globalAlpha = 1;
  }
  // you
  const [mx, my] = to(ME.x, ME.y);
  ctx.fillStyle = Math.floor(now * 3) % 2 ? '#ffffff' : '#ffd35a';
  ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 3, 3, 7); ctx.fillRect(Math.round(mx) - 3, Math.round(my) - 1, 7, 3);
  ctx.restore();
  ctx.strokeStyle = 'rgba(143,240,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(g.px0 + 0.5, g.py0 + 0.5, g.pw - 1, g.ph - 1);
  const title = G.dim ? DIMS[G.dim].name : bounded ? 'The Island' : 'Map';
  drawText(ctx, title, W / 2, g.py0 + 9, G.dim ? DIMS[G.dim].color : '#8ff0ff', 1);
  drawText(ctx, 'M or Esc: close   Wheel: zoom   Hover: names', W / 2, g.py0 + g.ph - 8, '#a59cc4', 1);
  if (hover) {
    const lines = [[mapText(hover.title), hover.col], ...wrapText(hover.sub, 34).map(l => [l, '#c9c2e0']), ...(hover.status ? [[hover.status, '#a6e05a']] : [])];
    const tw = Math.max(...lines.map(([l]) => l.length)) * 4 + 12, th = lines.length * 9 + 6;
    let tx = hover.sx + 10, ty = hover.sy - th / 2;
    if (tx + tw > W - 6) tx = hover.sx - tw - 10;
    ty = clamp(ty, 4, H - th - 4);
    ctx.fillStyle = 'rgba(5,6,14,0.92)'; ctx.fillRect(Math.round(tx), Math.round(ty), tw, th);
    ctx.strokeStyle = hover.col; ctx.strokeRect(Math.round(tx) + 0.5, Math.round(ty) + 0.5, tw - 1, th - 1);
    lines.forEach(([l, c], i) => drawText(ctx, l, Math.round(tx) + 6 + l.length * 2, Math.round(ty) + 8 + i * 9, c, 1));
  }
}
Mods.add({
  drawOverlay(now) {
    if (!G) return;
    if (G.mapOpen && state !== 'play') G.mapOpen = false;
    if (G.mapOpen) drawMap(now);
  },
});
