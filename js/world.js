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

/* ---------- Terrain texels: the explored ground, painted in fine detail and cached per dimension ---------- */
const TEX = 32, TN = 384, TORG = -TEX * TN / 2;   // world units per texel, texels per side, world coordinate of the canvas corner
const MAPRGB = {};
for (const [k, h] of Object.entries(MAPCOL)) MAPRGB[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function texelRGB(b, x, y) {
  const base = MAPRGB[b] || [58, 58, 72];
  const n1 = vnoise(x / 150, y / 150, 5), n2 = vnoise(x / 52, y / 52, 6), n3 = hash2(Math.floor(x / TEX), Math.floor(y / TEX), 7);
  const k = 0.7 + n1 * 0.4 + (n2 - 0.5) * 0.32 + (n3 - 0.5) * 0.14;
  let c = base.map(v => v * k);
  if (b === 'moss') {
    if (vnoise(x / 34, y / 34, 9) > 0.58 && n2 > 0.5) c = mixRGB(c, [20, 64, 30], 0.75);          // woods
    else if (n3 > 0.94) c = [150, 120, 190];                                                       // flowers
  } else if (b === 'bog') {
    const w = vnoise(x / 80, y / 80, 8);
    if (w > 0.6) c = mixRGB([26, 78, 112], [60, 130, 160], Math.min(1, (w - 0.6) * 4) * n2);       // pools
    else if (n3 > 0.9) c = mixRGB(c, [150, 220, 120], 0.5);
  } else if (b === 'ash') {
    if (vnoise(x / 64, y / 64, 10) > 0.68 && n2 < 0.45) c = [215, 98, 34];                         // lava seams
    else if (n3 > 0.92) c = mixRGB(c, [30, 24, 24], 0.6);
  } else if (b === 'grave') {
    if (n3 > 0.9) c = [150, 140, 190];                                                             // stones
    else if (n2 > 0.66) c = mixRGB(c, [20, 16, 36], 0.5);
  } else if (b === 'isle') {
    c = mixRGB(c, [226, 206, 140], n2 * 0.5);
  } else if (b === 'sea') {
    c = mixRGB(c.map(v => v * 0.8), [40, 110, 160], vnoise(x / 90, y / 90, 12) * 0.5);
    if (n3 > 0.9) c = [120, 190, 230];
  } else if (b === 'frozen') {
    if (n3 > 0.88) c = [235, 245, 255];
  } else if (b === 'void' || b === 'rift' || b === 'demon') {
    if (n3 > 0.93) c = mixRGB(c, [255, 200, 120], 0.5);
  }
  return c;
}
function terrain() {
  G.terr = G.terr || {};
  const key = G.dim || 'world';
  let t = G.terr[key];
  if (!t) { const c = document.createElement('canvas'); c.width = c.height = TN; t = G.terr[key] = { c, x: c.getContext('2d'), done: new Set() }; }
  const per = EX_C / TEX;
  for (const k of exSet()) {
    if (t.done.has(k)) continue;
    t.done.add(k);
    const [cx, cy] = exCell(k), tx0 = Math.floor((cx * EX_C - TORG) / TEX), ty0 = Math.floor((cy * EX_C - TORG) / TEX);
    if (tx0 < 0 || ty0 < 0 || tx0 + per > TN || ty0 + per > TN) continue;
    for (let i = 0; i < per; i++) for (let j = 0; j < per; j++) {
      const wx = TORG + (tx0 + i) * TEX + TEX / 2, wy = TORG + (ty0 + j) * TEX + TEX / 2;
      const c = texelRGB(biomeAt(wx, wy), wx, wy);
      t.x.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      t.x.fillRect(tx0 + i, ty0 + j, 1, 1);
    }
  }
  return t;
}

/* ---------- Structure icons: a little pixel picture for every kind of place ---------- */
const ICON_BMP = {
  town: ['#.#.#.#.#', '#o#o#o#o#', '#ooooooo#', '#oo###oo#', '#oo#l#oo#', '#oo#l#oo#', '#########'],
  village: ['....#....', '...#o#...', '..#ooo#..', '.#ooooo#.', '#ooooooo#', '.#oo#oo#.', '.#oo#oo#.', '.#######.'],
  ruinvillage: ['....#....', '...#o#...', '..#o.o#..', '.#o...o#.', '#o.#o..o#', '.#.#o#.#.', '.#######.'],
  hut: ['...w.....', '....w....', '..#####..', '.#ooooo#.', '#ooooooo#', '#ooo#ooo#', '#ooo#ooo#', '.#######.'],
  tower: ['..#####..', '..#ooo#..', '...#o#...', '...#l#...', '...#o#...', '..#ooo#..', '..#o#o#..', '.#######.'],
  ruins: ['#o#...#o#', '#o#.#.#o#', '#o#.#o#o#', '#o#.#o#o#', '#o#...#o#', '#########'],
  graveyard: ['...###...', '..#ooo#..', '.#ooloo#.', '.#oolo#o.', '.#ooooo#.', '.#ooooo#.', '#########'],
  bandits: ['.#######.', '#ooooooo#', '#oo#o#oo#', '#oo#o#oo#', '#ooooooo#', '.#ooooo#.', '..#o#o#..', '..#####..'],
  mine: ['..#####..', '.#ooooo#.', '#ooooooo#', '#oo###oo#', '#o#####o#', '#o#####o#', '#########'],
  watchtower: ['#.#####.#', '#ooooooo#', '.#ooooo#.', '..#ooo#..', '..#o#o#..', '..#ooo#..', '.#######.'],
  gate: ['#########', '#ooooooo#', '#o#...#o#', '#o#.r.#o#', '#o#...#o#', '#o#...#o#', '#########'],
  temple: ['....#....', '...#o#...', '..#ooo#..', '.#######.', '.#o#o#o#.', '.#o#o#o#.', '.#o#o#o#.', '#########'],
  mansion: ['.#..#..#.', '.#.#o#.#.', '#########', '#ooooooo#', '#oyoooyo#', '#ooo#ooo#', '#ooo#ooo#', '#########'],
  fieldhospital: ['#########', '#wwwrwww#', '#wwwrwww#', '#rrrrrrr#', '#wwwrwww#', '#wwwrwww#', '#########'],
  standingstones: ['...###...', '#.#ooo#.#', '#o#ooo#o#', '#o#ooo#o#', '#o#ooo#o#', '#########'],
  outpost: ['..#......', '..#yyy...', '..#yyy...', '..#......', '#o#o#o#o#', '#o#o#o#o#', '#########'],
  library: ['.#######.', '#ooo#ooo#', '#ooo#ooo#', '#olo#olo#', '#ooo#ooo#', '#ooo#ooo#', '.#######.'],
  bloodaltar: ['....#....', '...#r#...', '..#rrr#..', '..#rrr#..', '...###...', '#########', '#ooooooo#', '#########'],
  gambler: ['#########', '#ooooooo#', '#o#ooo#o#', '#ooo#ooo#', '#o#ooo#o#', '#ooooooo#', '#########'],
  orchard: ['..#####..', '.#ooooo#.', '#oorooro#', '#ooooooo#', '.#ooooo#.', '...#d#...', '...#d#...', '..#####..'],
  beacon: ['....y....', '...yyy...', '..#yyy#..', '...###...', '...#o#...', '..#ooo#..', '.#ooooo#.', '#########'],
  stockade: ['.#.#.#.#.', '#o#o#o#o#', '#o#o#o#o#', '#ooooooo#', '#o#o#o#o#', '#########'],
  mercs: ['o.......o', '.o.....o.', '..o...o..', '...o.o...', '....l....', '...o.o...', '..o...o..', '.o.....o.', 'o.......o'],
  sewer: ['.#######.', '#ooooooo#', '#o#o#o#o#', '#o#o#o#o#', '#o#o#o#o#', '#o#o#o#o#', '#########'],
  frostcave: ['....o....', '.o..o..o.', '..o.o.o..', '...ooo...', 'oooowoooo', '...ooo...', '..o.o.o..', '.o..o..o.', '....o....'],
  forge: ['.y.....y.', '#ooooooo#', '#ooooooo#', '.##ooo##.', '...#o#...', '...#o#...', '..#ooo#..', '.#ooooo#.', '#########'],
  obelisk: ['....#....', '...#o#...', '..#ooo#..', '..#olo#..', '..#ooo#..', '..#ooo#..', '.#ooooo#.', '#########'],
  campsite: ['....#....', '...#o#...', '..#ooo#..', '.#oo#oo#.', '#ooo#ooo#', '#########', '..y.y.y..'],
};
const iconCache = {};
function structIcon(type, col) {
  col = col || '#ffffff';
  const key = type + col;
  if (iconCache[key]) return iconCache[key];
  const rows = ICON_BMP[type];
  if (!rows) return null;
  const n = parseInt(col.slice(1), 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
  const pal = { '#': '#0b0a12', o: col, l: hex(mixRGB(rgb, [255, 255, 255], 0.55)), d: hex(rgb.map(v => v * 0.55)), w: '#f2eee6', r: '#d8354a', y: '#ffd35a' };
  const c = document.createElement('canvas'); c.width = c.height = 11;
  const x = c.getContext('2d'), oy = 1 + Math.floor((9 - rows.length) / 2);
  const px = fn => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && pal[ch]) fn(i + 1, j + oy, pal[ch]); }));
  x.fillStyle = '#0b0a12';
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) px((i, j) => x.fillRect(i + dx, j + dy, 1, 1));   // dark halo
  px((i, j, c2) => { x.fillStyle = c2; x.fillRect(i, j, 1, 1); });
  return (iconCache[key] = c);
}

let mapLayer = null;
function drawMap(now) {
  const g = mapGeom(), to = (x, y) => [g.mx + (x - g.cx) * g.scale, g.my + (y - g.cy) * g.scale];
  if (!mapLayer) mapLayer = document.createElement('canvas');
  if (mapLayer.width !== W || mapLayer.height !== H) { mapLayer.width = W; mapLayer.height = H; }
  const L = mapLayer.getContext('2d');
  L.clearRect(0, 0, W, H);
  const bounded = worldBounded();
  // the island's silhouette, faint where unexplored
  if (bounded || G.dim === 'island') {
    L.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = i / 120 * TAU, r = bounded ? coastR(a) : ISLAND_R, [x, y] = to(Math.cos(a) * r, Math.sin(a) * r * (bounded ? 1 : 0.8));
      i ? L.lineTo(x, y) : L.moveTo(x, y);
    }
    L.closePath(); L.fillStyle = 'rgba(40,48,76,0.45)'; L.fill();
  }
  // explored ground in fine detail
  const t = terrain(), [ox, oy] = to(TORG, TORG), size = TN * TEX * g.scale;
  L.imageSmoothingEnabled = g.scale * TEX < 1.4;
  L.globalAlpha = 0.9; L.drawImage(t.c, ox, oy, size, size); L.globalAlpha = 1;
  if (bounded || G.dim === 'island') {
    const path = k => {
      L.beginPath();
      for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, r = bounded ? coastR(a) * k : ISLAND_R * k, [x, y] = to(Math.cos(a) * r, Math.sin(a) * r * (bounded ? 1 : 0.8)); i ? L.lineTo(x, y) : L.moveTo(x, y); }
      L.closePath();
    };
    path(1); L.strokeStyle = 'rgba(190,240,255,0.7)'; L.lineWidth = 1; L.stroke();
    path(bounded ? BEACH_K : 0.94); L.strokeStyle = 'rgba(226,206,140,0.3)'; L.stroke();
  }
  // markers, with names on hover
  const marks = [];
  const mark = (x, y, size, col, title, sub, status, alpha = 1, shape = 'sq', icon = null) => {
    const [sx, sy] = to(x, y);
    if (sx < g.px0 - 6 || sx > g.px0 + g.pw + 6 || sy < g.py0 - 6 || sy > g.py0 + g.ph + 6) return;
    marks.push({ sx, sy, size, col, title, sub, status, alpha, shape, icon });
  };
  for (const st of mapStructs()) {
    const big = st.type === 'town' ? 6 : st.type === 'village' || st.type === 'ruinvillage' ? 5 : 4;
    const [title, sub] = STRUCT_TITLE[st.type] ? [structName(st), STRUCT_TITLE[st.type][1]] : [st.type, ''];
    const visited = st.active || st.built, col = st.ruined ? '#8a80b0' : STRUCT_COL[st.type] || '#fff', cleared = st.done && st.type !== 'village';
    mark(st.x, st.y, big, col, title, sub, cleared ? 'Cleared' : visited ? 'Visited' : 'Charted', cleared ? 0.5 : 1, st.door || st.hatch ? 'dia' : 'sq', structIcon(st.type, col));
  }
  for (const s of G.shrines || []) if (seenAt(s.x, s.y) && s.uses > 0) mark(s.x, s.y, 3, '#e27bf0', s.kind && SHRINE_KINDS[s.kind] ? SHRINE_KINDS[s.kind].name : 'Shrine of Fortune', 'Make an offering', '', 1, 'dia');
  for (const c of G.crypts || []) mark(c.x, c.y, 3, '#e8742c', 'Crypt entrance', 'Treasure waits below', '', 1, 'dia');
  for (const p of G.portals || []) mark(p.x, p.y, 4, p.dim === 'home' ? '#ffd35a' : DIMS[p.dim].color, p.dim === 'home' ? 'Golden portal' : 'Portal to ' + DIMS[p.dim].name, 'Step through', '', 1, 'dia');
  if (G.spawner && !G.spawner.on) mark(G.spawner.x, G.spawner.y, 6, DIMS[G.spawner.dim].color, 'Boss portal', 'Find it. Open it. Kill the boss within the time limit', '', 1, 'dia');
  for (const e of G.enemies) if (e.boss && !e.dead) mark(e.x, e.y, 5, '#d8354a', e.name || 'Guardian', 'A boss', '', 1, 'dia');
  for (const a of G.allies || []) if (!a.gone) mark(a.x, a.y, 2, a.down ? '#ffd35a' : '#a6e05a', a.name, a.down ? 'Down. Help them up' : 'Your companion', '');
  for (const pl of G.players) if (pl !== ME) mark(pl.x, pl.y, 3, '#3f8ee0', 'Your partner', '', '');
  let hover = null, hd = 81;
  for (const m of marks) {
    const d = (m.sx - mapMouse.x) ** 2 + (m.sy - mapMouse.y) ** 2;
    if (d < hd && m.title) { hd = d; hover = m; }
  }
  for (const m of marks) {
    const s = m.size + (m === hover ? 2 : 0), x = Math.round(m.sx), y = Math.round(m.sy);
    L.globalAlpha = m.alpha;
    if (m.icon) {
      L.imageSmoothingEnabled = false;
      const z = m === hover ? 13 : 11;
      L.drawImage(m.icon, Math.round(x - z / 2), Math.round(y - z / 2), z, z);
    } else if (m.shape === 'dia') { L.fillStyle = '#0b0a12'; L.beginPath(); L.moveTo(x, y - s - 1); L.lineTo(x + s + 1, y); L.lineTo(x, y + s + 1); L.lineTo(x - s - 1, y); L.closePath(); L.fill(); L.fillStyle = m.col; L.beginPath(); L.moveTo(x, y - s); L.lineTo(x + s, y); L.lineTo(x, y + s); L.lineTo(x - s, y); L.closePath(); L.fill(); }
    else { L.fillStyle = '#0b0a12'; L.fillRect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2); L.fillStyle = m.col; L.fillRect(x - s / 2, y - s / 2, s, s); }
    L.globalAlpha = 1;
  }
  // you
  const [mx, my] = to(ME.x, ME.y);
  L.fillStyle = '#0b0a12'; L.fillRect(Math.round(mx) - 2, Math.round(my) - 4, 5, 9); L.fillRect(Math.round(mx) - 4, Math.round(my) - 2, 9, 5);
  L.fillStyle = Math.floor(now * 3) % 2 ? '#ffffff' : '#ffd35a';
  L.fillRect(Math.round(mx) - 1, Math.round(my) - 3, 3, 7); L.fillRect(Math.round(mx) - 3, Math.round(my) - 1, 7, 3);
  // fade the whole map out toward its edges, so there is no frame
  L.save();
  L.globalCompositeOperation = 'destination-in';
  L.translate(g.mx, g.my); L.scale(g.pw / g.ph, 1);
  const fade = L.createRadialGradient(0, 0, 0, 0, 0, g.ph / 2);
  fade.addColorStop(0, '#000'); fade.addColorStop(0.68, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  L.fillStyle = fade; L.fillRect(-W, -H, W * 2, H * 2);
  L.restore();
  // a soft dark veil behind it so the map reads over the night
  ctx.save();
  ctx.translate(g.mx, g.my); ctx.scale(g.pw / g.ph, 1);
  const veil = ctx.createRadialGradient(0, 0, 0, 0, 0, g.ph / 2);
  veil.addColorStop(0, 'rgba(4,8,18,0.62)'); veil.addColorStop(0.7, 'rgba(4,8,18,0.45)'); veil.addColorStop(1, 'rgba(4,8,18,0)');
  ctx.fillStyle = veil; ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.restore();
  ctx.drawImage(mapLayer, 0, 0);
  const title = G.dim ? DIMS[G.dim].name : bounded ? 'The Island' : 'Map';
  drawText(ctx, title, W / 2, g.py0 + 9, G.dim ? DIMS[G.dim].color : '#8ff0ff', 1);
  drawText(ctx, 'M or Esc: close   Wheel: zoom   Hover: names', W / 2, g.py0 + g.ph - 8, '#a59cc4', 1);
  if (hover) {
    const lines = [[mapText(hover.title), hover.col], ...wrapText(hover.sub, 34).map(l => [l, '#c9c2e0']), ...(hover.status ? [[hover.status, '#a6e05a']] : [])];
    const tw = Math.max(...lines.map(([l]) => l.length)) * 4 + 12, th = lines.length * 9 + 6;
    let tx = hover.sx + 12, ty = hover.sy - th / 2;
    if (tx + tw > W - 6) tx = hover.sx - tw - 12;
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
