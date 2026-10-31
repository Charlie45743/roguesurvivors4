'use strict';
/* Towns and big structures. Every building is painted pixel by pixel at a believable size next to
   the hero; villages and towns are laid out along streets around a plaza; every site gets a painted
   ground layer (roads, cobbles, gardens, shadows) so it sits in the world instead of on top of it.
   Also: wandering townsfolk, and the Runesmith, who fuses two weapons into one super weapon. */

const OUTL = '#0b0a12';
const ROOFS = {
  red: { b: '#7a2a2a', d: '#4e1a1e', l: '#a04238' },
  blue: { b: '#2e4266', d: '#1b2842', l: '#4a6490' },
  green: { b: '#2f5238', d: '#1b3322', l: '#4a7a50' },
  thatch: { b: '#6a5232', d: '#45351f', l: '#8f7448', thatch: true },
  plum: { b: '#4a3058', d: '#2b1a36', l: '#6a4a7a' },
  slate: { b: '#3e3850', d: '#262236', l: '#5e557f' },
  moss: { b: '#3c4a2a', d: '#232c18', l: '#5a6a3a', thatch: true },
};
const MATS = {
  stone: { b: ['#6b6276', '#5f5769', '#746b80'], m: '#2e2a38', hl: '#8a80a0' },
  pale: { b: ['#8a8496', '#7d778a', '#958fa2'], m: '#3a3646', hl: '#aaa4ba' },
  dark: { b: ['#3e3850', '#36304a', '#46405a'], m: '#1c1a2b', hl: '#5a5272' },
  timber: { b: ['#8f8270', '#857868'], beam: '#3a2618' },
  plaster: { b: ['#7d7488', '#736a7e'], beam: '#2e2a38' },
  log: { b: ['#5a3a28', '#523424', '#634030'], m: '#24160e', hl: '#7a5236' },
};
const nz = (i, j, s = 0) => { let h = (i * 374761393 + j * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/* ---------- Painting kit ---------- */
function canvasSprite(w, h, seed, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), r = mulberry32(seed | 0);
  const px = (x, y, col, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), ww, hh); };
  const meta = { glows: [], smoke: [], top: 0 };
  fn(px, r, g, meta);
  // meta is painted in sprite pixels; store it relative to the anchor (bottom centre)
  const rel = ([x, y, c]) => [x - w / 2, y - h, c];
  return { c, w, h, sil: {}, meta: { glows: meta.glows.map(rel), smoke: meta.smoke.map(rel), top: meta.top - h, perch: meta.perch !== undefined ? meta.perch - h : undefined, beacon: meta.beacon && rel(meta.beacon) } };
}
const SPRITE_CACHE = new Map();
const cached = (key, make) => { if (!SPRITE_CACHE.has(key)) SPRITE_CACHE.set(key, make()); return SPRITE_CACHE.get(key); };

function paintWall(px, x0, y0, w, h, mat, s, ruined) {
  const M = MATS[mat], brick = mat === 'stone' || mat === 'pale' || mat === 'dark';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let c;
    if (brick) {
      const row = j >> 2, off = (row % 2) * 4, mort = j % 4 === 3 || (i + off) % 8 === 7;
      c = mort ? M.m : (j % 4 === 0 && (i + off) % 8 < 5) ? M.hl : M.b[Math.floor(nz((i + off) >> 3, row, s) * M.b.length)];
    } else if (mat === 'log') {
      const jj = j % 5; c = jj === 4 ? M.m : jj === 0 ? M.hl : M.b[Math.floor(nz(i >> 3, (j / 5) | 0, s) * 3)];
    } else c = nz(i, j, s) < 0.14 ? M.b[1] : M.b[0];
    if (ruined && nz(i >> 1, j >> 1, s + 9) < (j < h * 0.45 ? 0.16 : 0.05)) c = '#16141f';
    px(x0 + i, y0 + j, c);
  }
  if (M.beam) {
    const B = M.beam;
    px(x0, y0, B, 2, h); px(x0 + w - 2, y0, B, 2, h); px(x0, y0, B, w, 2);
    for (let i = 16; i < w - 8; i += 16) px(x0 + i, y0, B, 2, h);
    for (let i = 0; i + 16 <= w; i += 16) if (nz(i, 1, s) < 0.5) for (let k = 0; k < 14; k++) px(x0 + i + 2 + k, y0 + 2 + Math.floor(k * (h - 4) / 14), B, 1, 1);
  }
  if (mat === 'log') for (const ex of [x0, x0 + w - 2]) for (let j = 0; j < h; j += 5) { px(ex - 1, y0 + j, M.m, 4, 4); px(ex, y0 + j + 1, M.hl, 2, 2); }
  px(x0, y0, OUTL, 1, h); px(x0 + w - 1, y0, OUTL, 1, h);
  px(x0 + w - 4, y0, 'rgba(11,10,18,0.3)', 3, h);
  px(x0 + 1, y0 + h - 3, 'rgba(11,10,18,0.35)', w - 2, 3);
}
function paintRoof(px, x0, y0, w, h, R, s, o = {}) {
  const hip = o.hip ?? Math.min(10, h >> 1);
  for (let j = 0; j < h; j++) {
    const inset = Math.round((1 - j / h) * hip);
    for (let i = inset; i < w - inset; i++) {
      const row = (j / 3) | 0;
      let c = R.b;
      if (R.thatch) {
        const n = nz(i, j, s);
        c = n < 0.28 ? R.d : n > 0.9 ? R.l : R.b;
        if ((j + (i >> 2)) % 5 === 4 && nz(i >> 1, j, s + 1) < 0.6) c = R.d;
      } else {
        if (j % 3 === 2 || (i + (row % 2) * 3) % 6 === 0) c = R.d;
        else if (j % 3 === 0 && nz(i >> 1, row, s) < 0.45) c = R.l;
      }
      if (j < 2) c = R.l;
      if (j >= h - 2) c = R.d;
      if (i === inset || i === w - inset - 1) c = OUTL;
      if (o.ruined && nz(i >> 2, j >> 2, s + 3) < 0.26 && j > 1) c = i % 7 === 0 ? '#3a2618' : '#121019';
      px(x0 + i, y0 + j, c);
    }
  }
  px(x0 + hip, y0 - 1, OUTL, w - hip * 2, 1);
  px(x0, y0 + h, OUTL, w, 1);
}
function paintWindow(px, x, y, w, h, lit, meta, o = {}) {
  px(x - 1, y - 1, OUTL, w + 2, h + 2);
  const gl = lit ? (o.glass || ['#ffd35a', '#fff3b0', '#e8742c']) : ['#1c1a2b', '#3e3850', '#121019'];
  px(x, y, gl[0], w, h); px(x, y, gl[1], w - 1, 1); px(x + w - 1, y + 1, gl[2], 1, h - 1);
  if (o.arch) { px(x, y, OUTL); px(x + w - 1, y, OUTL); }
  px(x + (w >> 1), y, OUTL, 1, h); if (h > 6) px(x, y + (h >> 1), OUTL, w, 1);
  px(x - 2, y + h + 1, '#8a80a0', w + 4, 1); px(x - 2, y + h + 2, 'rgba(11,10,18,0.4)', w + 4, 1);
  if (o.shutter) { px(x - 4, y - 1, o.shutter, 3, h + 2); px(x + w + 1, y - 1, o.shutter, 3, h + 2); px(x - 4, y + (h >> 1), OUTL, 3, 1); px(x + w + 1, y + (h >> 1), OUTL, 3, 1); }
  if (o.flowers) for (let i = 0; i < w + 2; i++) { px(x - 1 + i, y + h + 3, '#3a2618'); px(x - 1 + i, y + h + 2, i % 2 ? '#d8354a' : '#4fa04a'); }
  if (lit && meta) meta.glows.push([x + w / 2, y + h / 2, o.glowCol || gl[0]]);
}
function paintDoor(px, x, y, w, h, o = {}) {
  if (o.stone) { px(x - 3, y - 3, OUTL, w + 6, h + 3); px(x - 2, y - 2, '#8a80a0', w + 4, h + 2); }
  px(x - 1, y - 1, OUTL, w + 2, h + 1);
  for (let i = 0; i < w; i++) px(x + i, y, i % 3 === 2 ? '#3a2618' : (o.col || '#5a3a28'), 1, h);
  if (o.open) { px(x, y, '#141220', w, h); px(x, y + h - 3, '#e8742c', w, 1); px(x, y + h - 2, '#ffd35a', w, 2); }
  else { px(x, y + 2, '#36304f', w, 1); px(x, y + h - 4, '#36304f', w, 1); px(x + w - 3, y + (h >> 1), '#ffd35a'); }
  px(x, y, OUTL); px(x + w - 1, y, OUTL);
  px(x - 3, y + h, '#8a80a0', w + 6, 1); px(x - 3, y + h + 1, '#5f5769', w + 6, 1);
}
function paintChimney(px, x, y, h, meta) {
  px(x - 1, y, OUTL, 9, h + 1); px(x, y + 2, '#5f5769', 7, h - 2);
  for (let j = 4; j < h; j += 3) px(x, y + j, '#2e2a38', 7, 1);
  px(x - 2, y, OUTL, 11, 3); px(x - 1, y + 1, '#8a80a0', 9, 1);
  meta.smoke.push([x + 3, y]);
}
function paintIvy(px, x, y, h, s) {
  for (let j = 0; j < h; j++) {
    const xx = x + Math.round(Math.sin(j * 0.5 + s) * 2);
    px(xx, y - j, '#2f6b3a'); if (nz(j, 0, s) < 0.5) px(xx + 1, y - j, '#4fa04a'); if (nz(j, 1, s) < 0.3) px(xx - 1, y - j, '#1f4d33');
  }
}
const SIGN_ICONS = {
  anvil: ['.......', 'aaaaaa.', '.aaaaa.', '..aaa..', '.aaaaa.'],
  bottle: ['..b..', '..w..', '.wgw.', 'wgggw', '.www.'],
  scroll: ['wwwww', 'wbbbw', 'wwwww', 'wbbbw', 'wwwww'],
  antler: ['w.w.w', 'ww.ww', '.www.', '..b..', '..b..'],
  coin: ['.yyy.', 'yyYyy', 'yYyYy', 'yyYyy', '.yyy.'],
  mug: ['wwww.', 'yyyyb', 'yyyyb', 'yyyy.', 'bbbb.'],
  rune: ['.ppp.', 'p.p.p', '.ppp.', 'p.p.p', '.ppp.'],
  eye: ['.ggg.', 'g.w.g', 'gwbwg', 'g.w.g', '.ggg.'],
  cross: ['..y..', 'yyyyy', '..y..', '..y..', '..y..'],
};
const SIGN_COL = { a: '#a59cc4', b: '#3a2618', w: '#f2eee6', g: '#a6e05a', y: '#ffd35a', Y: '#e8742c', p: '#e27bf0' };
function paintSign(px, x, y, icon) {
  px(x, y, OUTL, 11, 1); px(x + 1, y + 1, '#36304f', 1, 2); px(x + 9, y + 1, '#36304f', 1, 2);
  px(x - 1, y + 3, OUTL, 13, 9); px(x, y + 4, '#7a5236', 11, 7); px(x, y + 4, '#9a6a42', 11, 1);
  const ic = SIGN_ICONS[icon] || SIGN_ICONS.coin;
  ic.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') px(x + 3 + i - (row.length > 5 ? 1 : 0), y + 5 + j, SIGN_COL[ch]); }));
}

/* ---------- Buildings ---------- */
// A house: front wall with storeys, a hipped or thatched roof, optional cross gable, chimney and sign
function makeHouse(o) {
  const w = o.w, wallH = o.wallH, roofH = o.roofH, pad = 14, W = w + 10, H = pad + roofH + wallH + 3;
  return canvasSprite(W, H, o.seed, (px, r, g, meta) => {
    const R = ROOFS[o.roof], x0 = 5, wy = pad + roofH, by = wy + wallH;
    meta.top = pad;
    paintWall(px, x0, wy, w, wallH, o.mat, o.seed, o.ruined);
    const storeys = o.storeys || 1, sh = wallH / storeys, beam = MATS[o.mat].beam || MATS[o.mat].m;
    for (let k = 1; k < storeys; k++) px(x0, wy + Math.round(sh * k), beam, w, 2);
    const doorW = o.doorW || 9, doorH = Math.min(15, Math.round(sh) - 3), dx = Math.round(x0 + w * (o.doorX ?? 0.5) - doorW / 2);
    const lit = () => !o.ruined && r() < (o.lit ?? 0.75);
    const shutter = o.shutter ? ROOFS[o.roof].d : null;
    // ground floor windows on each side of the door
    for (const fx of [0.2, 0.8]) {
      const cx = x0 + w * fx;
      if (Math.abs(cx - (dx + doorW / 2)) < doorW + 6) continue;
      paintWindow(px, Math.round(cx - 3), Math.round(by - sh + Math.max(4, sh * 0.25)), 7, 7, lit(), meta, { shutter, flowers: o.flowers && r() < 0.6, glass: o.glass });
    }
    for (let k = 1; k < storeys; k++) {
      const n = Math.max(2, Math.floor(w / 24)), y = Math.round(by - sh * (k + 1) + Math.max(4, sh * 0.25));
      for (let i = 0; i < n; i++) paintWindow(px, Math.round(x0 + w * (i + 0.5) / n - 3), y, 7, 8, lit(), meta, { shutter, glass: o.glass });
    }
    paintDoor(px, dx, by - doorH, doorW, doorH, { stone: o.mat === 'stone' || o.mat === 'pale', open: o.openDoor && !o.ruined, col: o.doorCol });
    paintRoof(px, 0, pad, W, roofH, R, o.seed, { ruined: o.ruined, hip: o.hip });
    px(x0 + 1, wy + 1, 'rgba(11,10,18,0.5)', w - 2, 2);
    if (o.gable && !o.ruined) {
      const gw = Math.min(30, Math.round(w * 0.42)) | 1, gh = Math.round(roofH * 0.85), gx = Math.round(x0 + w * (o.gableX ?? 0.5));
      for (let j = 0; j < gh; j++) {
        const half = Math.round((j / gh) * gw / 2);
        for (let i = -half; i <= half; i++) {
          const edge = Math.abs(i) >= half - 1;
          px(gx + i, wy - gh + j, edge ? R.d : (MATS[o.mat].b[0]));
        }
        px(gx - half - 1, wy - gh + j, OUTL); px(gx + half + 1, wy - gh + j, OUTL);
      }
      px(gx - 1, wy - gh - 1, OUTL, 3, 1);
      paintWindow(px, gx - 2, wy - Math.round(gh * 0.55), 5, 5, lit(), meta, { glass: o.glass });
    }
    if (o.chimney && !(o.ruined && r() < 0.5)) paintChimney(px, Math.round(x0 + w * (o.chimneyX ?? 0.72)), pad - 8, 14, meta);
    if (o.sign) paintSign(px, Math.min(W - 13, dx + doorW + 3), by - doorH - 2, o.sign);
    if (o.antlers) { const ax = dx + (doorW >> 1); for (const [ix, iy] of [[-5, -4], [-4, -5], [-3, -3], [-2, -2], [2, -2], [3, -3], [4, -5], [5, -4], [-1, -1], [0, -1], [1, -1]]) px(ax + ix, by - doorH - 3 + iy, '#f2eee6'); }
    if (o.ivy || o.ruined) { paintIvy(px, x0 + 2, by - 1, Math.round(wallH * 0.8), o.seed); if (r() < 0.6) paintIvy(px, x0 + w - 3, by - 1, Math.round(wallH * 0.6), o.seed + 5); }
    if (o.ruined) for (let i = 0; i < 14; i++) px(x0 + r() * w, by - 1 - r() * 3, r() < 0.5 ? '#4a4258' : '#2e2a38', 2, 2);
    px(x0, by - 2, '#2e2a38', w, 2); px(x0 - 1, by, OUTL, w + 2, 1);
    if (o.extra) o.extra(px, r, meta, { x0, w, wy, by, pad, W, H });
  });
}

function makeChapel(seed, ruined) {
  const nw = 58, W = nw + 12, wallH = 40, roofH = 24, tw = 22, spire = 30, belfry = 26, pad = spire + belfry + 6;
  const H = pad + roofH + wallH + 3;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    const x0 = 6, wy = pad + roofH, by = wy + wallH, tx = Math.round(W / 2 - tw / 2), ty = pad - belfry;
    meta.top = pad - belfry - spire;
    paintWall(px, x0, wy, nw, wallH, 'pale', seed, ruined);
    paintRoof(px, 0, pad, W, roofH, ROOFS.slate, seed, { ruined });
    px(x0 + 1, wy + 1, 'rgba(11,10,18,0.5)', nw - 2, 2);
    for (const fx of [0.16, 0.84]) paintWindow(px, Math.round(x0 + nw * fx - 3), wy + 9, 7, 18, !ruined, meta, { arch: true, glass: ['#3f8ee0', '#e27bf0', '#d8354a'], glowCol: '#e27bf0' });
    // steeple
    paintWall(px, tx, ty, tw, by - ty, 'pale', seed + 1, ruined);
    px(tx, ty - 1, OUTL, tw, 1);
    px(tx + 6, ty + 5, OUTL, 10, 13); px(tx + 7, ty + 6, '#141220', 8, 12);
    if (!ruined) { px(tx + 9, ty + 10, '#ffd35a', 4, 4); px(tx + 10, ty + 14, '#e8742c', 2, 1); px(tx + 10, ty + 6, '#3a2618', 2, 4); }
    for (let j = 0; j < spire; j++) {
      const half = Math.round(j / spire * (tw / 2 + 3));
      for (let i = -half; i <= half; i++) px(W / 2 + i, ty - spire + j, Math.abs(i) >= half ? OUTL : (i < 0 ? ROOFS.slate.l : ROOFS.slate.b));
    }
    if (!ruined) { px(W / 2 - 1, ty - spire - 6, '#ffd35a', 2, 6); px(W / 2 - 3, ty - spire - 4, '#ffd35a', 6, 2); meta.beacon = [W / 2, ty - spire - 4]; }
    paintWindow(px, Math.round(W / 2 - 4), wy + 3, 8, 8, !ruined, meta, { glass: ['#d8354a', '#ffd35a', '#e27bf0'], glowCol: '#ffd35a' });
    paintDoor(px, Math.round(W / 2 - 6), by - 16, 12, 16, { stone: true, col: '#4a2e1e' });
    px(x0, by - 2, '#3a3646', nw, 2); px(x0 - 1, by, OUTL, nw + 2, 1);
    if (ruined) paintIvy(px, tx + 2, by - 1, 40, seed);
  });
}
function makeSmithy(seed, ruined) {
  const hw = 44, sw = 30, W = hw + sw + 10, wallH = 30, roofH = 22, pad = 16, H = pad + roofH + wallH + 3;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    const x0 = 5, wy = pad + roofH, by = wy + wallH, sx = x0 + hw;
    paintWall(px, x0, wy, hw, wallH, 'stone', seed, ruined);
    paintWindow(px, x0 + 8, wy + 10, 7, 7, !ruined, meta);
    paintDoor(px, x0 + hw - 18, by - 15, 9, 15, { stone: true });
    paintRoof(px, 0, pad, hw + 10, roofH, ROOFS.red, seed, { ruined });
    // open shed: posts, a lower roof, the forge and anvil inside
    px(sx, wy + 4, '#141220', sw, wallH - 4);
    for (const p of [sx + 1, sx + sw - 3]) { px(p - 1, wy + 2, OUTL, 4, wallH - 2); px(p, wy + 2, '#5a3a28', 2, wallH - 2); }
    for (let j = 0; j < 12; j++) for (let i = 0; i < sw + 4; i++) px(sx - 2 + i, wy - 8 + j + Math.floor(i / 8), j === 0 ? OUTL : (j % 3 === 2 ? ROOFS.red.d : ROOFS.red.b));
    px(sx + 4, by - 12, OUTL, 14, 12); px(sx + 5, by - 11, '#5f5769', 12, 11);
    if (!ruined) { px(sx + 6, by - 12, '#e8742c', 10, 2); px(sx + 8, by - 13, '#ffd35a', 6, 2); meta.glows.push([sx + 11, by - 13, '#e8742c']); }
    px(sx + 19, by - 7, OUTL, 9, 3); px(sx + 21, by - 4, OUTL, 5, 4); px(sx + 20, by - 6, '#8a80a0', 7, 1);
    paintChimney(px, sx + 8, pad - 4, 22, meta);
    px(x0, by - 2, '#2e2a38', hw + sw, 2); px(x0 - 1, by, OUTL, hw + sw + 2, 1);
  });
}
function makeRuneforge(seed, ruined) {
  const W = 56, wallH = 40, pad = 34, H = pad + wallH + 3;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    const x0 = 6, w = 44, wy = pad, by = wy + wallH;
    meta.top = 4;
    paintWall(px, x0, wy, w, wallH, 'dark', seed, ruined);
    for (let k = 0; k < 10; k++) { const rx = x0 + 4 + (r() * (w - 8) | 0), ry = wy + 4 + (r() * (wallH - 22) | 0); px(rx, ry, '#e27bf0'); px(rx + 1, ry + 1, '#9a4fd0'); px(rx - 1, ry + 2, '#e27bf0'); }
    for (let j = 0; j < 26; j++) {
      const half = Math.round(j / 26 * (W / 2));
      for (let i = -half; i <= half; i++) px(W / 2 + i, wy - 26 + j, Math.abs(i) >= half ? OUTL : (j % 4 === 3 ? ROOFS.plum.d : i < -half / 3 ? ROOFS.plum.l : ROOFS.plum.b));
    }
    px(W / 2 - 3, 2, OUTL, 6, 8); px(W / 2 - 2, 3, '#8ff0ff', 4, 6); px(W / 2 - 1, 3, '#f2eee6', 1, 3);
    meta.glows.push([W / 2, 6, '#8ff0ff']);
    paintWindow(px, x0 + 6, wy + 10, 6, 9, !ruined, meta, { arch: true, glass: ['#e27bf0', '#f2eee6', '#9a4fd0'], glowCol: '#e27bf0' });
    paintWindow(px, x0 + w - 12, wy + 10, 6, 9, !ruined, meta, { arch: true, glass: ['#e27bf0', '#f2eee6', '#9a4fd0'], glowCol: '#e27bf0' });
    paintDoor(px, W / 2 - 5, by - 15, 10, 15, { stone: true, open: !ruined });
    paintSign(px, W / 2 + 7, by - 22, 'rune');
    px(x0, by - 2, '#1c1a2b', w, 2); px(x0 - 1, by, OUTL, w + 2, 1);
  });
}
function makeStall(seed, colA, colB) {
  return canvasSprite(40, 34, seed, (px, r) => {
    for (const p of [3, 35]) { px(p - 1, 8, OUTL, 4, 26); px(p, 8, '#5a3a28', 2, 26); }
    for (let j = 0; j < 11; j++) for (let i = 0; i < 40; i++) px(i, j, j === 0 ? OUTL : ((i >> 2) % 2 ? colA : colB));
    for (let i = 0; i < 40; i += 4) { px(i, 11, (i >> 2) % 2 ? colA : colB, 4, 1); px(i + 1, 12, (i >> 2) % 2 ? colA : colB, 2, 1); }
    px(0, 1, 'rgba(255,255,255,0.15)', 40, 2);
    px(1, 22, OUTL, 38, 12); px(2, 23, '#7a5236', 36, 10); px(2, 23, '#9a6a42', 36, 1);
    const goods = ['#d8354a', '#a6e05a', '#ffd35a', '#8ff0ff', '#e8742c', '#e27bf0'];
    for (let i = 0; i < 9; i++) { const gx = 4 + i * 4; px(gx, 19, OUTL, 3, 4); px(gx, 19, goods[(r() * goods.length) | 0], 2, 3); }
    px(0, 33, OUTL, 40, 1);
  });
}

/* Big landmarks */
function makeTower(seed) {
  const W = 58, H = 164;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    const x0 = 7, w = 44, top = 18;
    const ramp = ['#2a2538', '#3e3850', '#4a4264', '#5e557f', '#6b6290', '#5e557f'];
    for (let j = top; j < H - 2; j++) for (let i = 0; i < w; i++) {
      const lightK = 1 - Math.abs(i - w * 0.36) / (w * 0.64), row = j >> 2, off = (row % 2) * 4;
      let c = ramp[Math.max(0, Math.min(5, Math.round(lightK * 4.4)))];
      if (j % 4 === 3 || (i + off) % 9 === 8) c = '#1c1a2b';
      if (j > H - 16) c = j % 4 === 3 ? '#1c1a2b' : '#4a4264';
      px(x0 + i, j, c);
    }
    px(x0 - 3, H - 16, OUTL, w + 6, 1); for (let j = H - 15; j < H - 1; j++) { px(x0 - 3, j, OUTL); px(x0 + w + 2, j, OUTL); px(x0 - 2, j, '#4a4264', 2, 1); px(x0 + w, j, '#36304f', 2, 1); }
    px(x0 - 1, top, OUTL, 1, H - top); px(x0 + w, top, OUTL, 1, H - top);
    for (let i = -3; i < w + 3; i += 7) { const broken = nz(i, 0, seed) < 0.25; px(x0 + i, top - (broken ? 3 : 9), OUTL, 6, broken ? 4 : 10); px(x0 + i + 1, top - (broken ? 2 : 8), i < w * 0.4 ? '#6b6290' : '#4a4264', 4, broken ? 2 : 8); }
    px(x0 - 4, top - 1, OUTL, w + 8, 3); px(x0 - 3, top, '#8a80a0', w + 6, 1);
    meta.top = top - 12; meta.beacon = [W / 2, top - 4];
    for (const wy of [34, 70, 106]) { paintWindow(px, W / 2 - 3, wy, 6, 12, true, meta, { arch: true }); }
    for (const [wx, wy] of [[x0 + 8, 52], [x0 + w - 12, 88]]) paintWindow(px, wx, wy, 4, 8, r() < 0.6, meta, { arch: true });
    px(W / 2 - 14, 26, '#7a1a2a', 5, 26); px(W / 2 - 14, 52, '#7a1a2a', 2, 3); px(W / 2 - 11, 52, '#7a1a2a', 2, 2); px(W / 2 - 13, 30, '#ffd35a', 3, 3);
    paintDoor(px, W / 2 - 7, H - 22, 14, 20, { stone: true, col: '#3a2618' });
    paintIvy(px, x0 + 3, H - 3, 90, seed); paintIvy(px, x0 + w - 6, H - 3, 50, seed + 3);
    px(x0 - 4, H - 1, OUTL, w + 8, 1);
  });
}
function makeWatchtower(seed) {
  const W = 50, H = 104;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    for (const lx of [8, 40]) { px(lx - 1, 34, OUTL, 5, H - 34); px(lx, 34, '#5a3a28', 3, H - 34); px(lx, 34, '#7a5236', 1, H - 34); }
    for (let y = 44; y < H - 6; y += 22) for (let k = 0; k < 30; k++) { px(10 + k, y + Math.round(k * 0.66), '#3a2618', 2, 2); px(10 + k, y + 20 - Math.round(k * 0.66), '#3a2618', 2, 2); }
    for (let y = 40; y < H - 2; y += 6) px(20, y, '#7a5236', 10, 2);
    px(19, 38, '#3a2618', 2, H - 38); px(29, 38, '#3a2618', 2, H - 38);
    px(2, 30, OUTL, 46, 8); px(3, 31, '#7a5236', 44, 6); px(3, 31, '#9a6a42', 44, 1);
    for (let i = 4; i < 46; i += 4) px(i, 18, '#5a3a28', 2, 12);
    px(2, 17, OUTL, 46, 2); px(3, 22, '#3a2618', 44, 1);
    for (const p of [4, 44]) px(p - 1, 2, '#3a2618', 3, 16);
    for (let j = 0; j < 12; j++) { const inset = Math.round((1 - j / 12) * 8); for (let i = inset; i < 50 - inset; i++) px(i, j - 2 + 0, i === inset || i === 49 - inset ? OUTL : (j % 3 === 2 ? ROOFS.thatch.d : ROOFS.thatch.b)); }
    meta.perch = 30; meta.top = 0; meta.beacon = [45, 14];
    px(1, H - 1, OUTL, 48, 1);
  });
}
function makeWitchHut(seed) {
  const W = 72, H = 78;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    for (const lx of [12, 30, 52]) { px(lx - 1, 60, OUTL, 4, 18); px(lx, 60, '#3a2618', 2, 18); }
    px(6, 56, OUTL, 58, 5); px(7, 57, '#5a3a28', 56, 3); px(7, 57, '#7a5236', 56, 1);
    for (let k = 0; k < 6; k++) px(26 + k * 3, 61 + k * 3, '#5a3a28', 8, 2);
    paintWall(px, 10, 32, 50, 24, 'log', seed, false);
    paintWindow(px, 16, 39, 7, 7, true, meta, { glass: ['#a6e05a', '#f2eee6', '#4fa04a'], glowCol: '#a6e05a' });
    paintDoor(px, 38, 40, 10, 16, { col: '#1f4d33' });
    for (let j = 0; j < 30; j++) {
      const lean = Math.round(j * 0.25), inset = Math.round((1 - j / 30) * 22);
      for (let i = inset; i < W - inset; i++) { const n = nz(i, j, seed); px(i - lean + 6, j + 4, i === inset || i === W - inset - 1 ? OUTL : (n < 0.3 ? ROOFS.moss.d : n > 0.88 ? '#a6e05a' : ROOFS.moss.b)); }
    }
    px(44, 0, OUTL, 7, 14); px(45, 1, '#5f5769', 5, 12); meta.smoke.push([47, 0]);
    for (const [sx, sy] of [[8, 34], [62, 36]]) { px(sx, sy, '#f2eee6', 4, 3); px(sx + 1, sy + 1, OUTL); px(sx + 3, sy + 1, OUTL); px(sx + 1, sy + 3, '#f2eee6', 2, 1); }
    meta.top = 0;
    px(4, H - 1, OUTL, 64, 1);
  });
}
function makeMine(seed) {
  const W = 104, H = 66;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    for (let j = 0; j < H - 2; j++) for (let i = 0; i < W; i++) {
      const d = Math.abs(i - W / 2) / (W / 2), ht = H - 4 - (1 - d * d) * (H - 8) + Math.sin(i * 0.3 + seed) * 2;
      if (j < ht) continue;
      const n = nz(i >> 2, j >> 2, seed), edge = j < ht + 2;
      px(i, j, edge ? OUTL : j < ht + 5 && n < 0.6 ? '#2f5238' : n < 0.3 ? '#2e2a38' : n < 0.75 ? '#4a4258' : '#5f5769');
    }
    for (let k = 0; k < 16; k++) { const bx = (r() * W) | 0, by = 20 + ((r() * 40) | 0); px(bx, by, OUTL, 6, 4); px(bx + 1, by + 1, '#6b6276', 4, 2); }
    const ex = W / 2 - 13;
    px(ex, H - 34, '#07060c', 26, 32);
    for (const p of [ex - 1, ex + 24]) { px(p - 1, H - 36, OUTL, 5, 34); px(p, H - 36, '#5a3a28', 3, 34); }
    px(ex - 5, H - 40, OUTL, 36, 6); px(ex - 4, H - 39, '#7a5236', 34, 4); px(ex - 4, H - 39, '#9a6a42', 34, 1);
    for (let k = 0; k < 4; k++) px(ex + 4 + k * 5, H - 14 + k, '#36304f', 1, 1);
    px(ex + 2, H - 4, '#6d6a7c', 22, 1); px(ex + 2, H - 7, '#6d6a7c', 22, 1);
    for (const lx of [ex - 9, ex + 33]) { px(lx, H - 30, OUTL, 3, 28); px(lx - 2, H - 34, OUTL, 7, 6); px(lx - 1, H - 33, '#ffd35a', 5, 4); meta.glows.push([lx + 1, H - 31, '#ffd35a']); }
    meta.top = 6;
    px(0, H - 1, OUTL, W, 1);
  });
}
function makeTemple(seed) {
  const W = 132, H = 96;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    for (let t = 0; t < 3; t++) { const y = H - 6 - t * 5, inset = t * 6; px(inset, y, OUTL, W - inset * 2, 6); px(inset + 1, y + 1, '#8a8496', W - inset * 2 - 2, 4); px(inset + 1, y + 1, '#aaa4ba', W - inset * 2 - 2, 1); }
    const colTop = 30, colBot = H - 20;
    px(16, colTop, '#121019', W - 32, colBot - colTop);
    for (let c = 0; c < 6; c++) {
      const cx = 20 + c * 18, broken = c === 4 && nz(c, 0, seed) < 0.7;
      const top = broken ? colTop + 22 : colTop;
      px(cx - 1, top, OUTL, 12, colBot - top);
      for (let i = 0; i < 10; i++) px(cx + i, top, i < 3 ? '#d8d5e8' : i < 7 ? '#b5b2c4' : '#8a87a0', 1, colBot - top);
      for (let i = 1; i < 10; i += 3) px(cx + i, top + 2, 'rgba(11,10,18,0.25)', 1, colBot - top - 4);
      px(cx - 2, colBot - 3, OUTL, 14, 4); px(cx - 1, colBot - 2, '#aaa4ba', 12, 2);
      if (!broken) { px(cx - 2, top, OUTL, 14, 3); px(cx - 1, top + 1, '#d8d5e8', 12, 1); }
      else for (let k = 0; k < 5; k++) px(cx + (r() * 10 | 0), top - 1 - (r() * 3 | 0), '#b5b2c4', 2, 2);
    }
    px(8, colTop - 8, OUTL, W - 16, 8); px(9, colTop - 7, '#8a8496', W - 18, 6); px(9, colTop - 7, '#aaa4ba', W - 18, 1);
    for (let j = 0; j < 20; j++) { const half = Math.round(j / 20 * (W / 2 - 10)); px(W / 2 - half, colTop - 28 + j, OUTL, half * 2, 1); if (half > 1) px(W / 2 - half + 1, colTop - 28 + j, j > 17 ? '#8a8496' : '#9e98ae', half * 2 - 2, 1); }
    for (let a = 0; a < 8; a++) { const x = W / 2 + Math.round(Math.cos(a * TAU / 8) * 6), y = colTop - 14 + Math.round(Math.sin(a * TAU / 8) * 4); px(x, y, '#ffd35a'); }
    px(W / 2 - 2, colTop - 16, '#ffd35a', 4, 4); meta.glows.push([W / 2, colTop - 14, '#ffd35a']);
    px(W / 2 - 9, colBot - 26, OUTL, 18, 26); px(W / 2 - 8, colBot - 25, '#07060c', 16, 25);
    for (let k = 0; k < 60; k++) { const x = (r() * W) | 0, y = 10 + ((r() * (H - 12)) | 0); px(x, y, r() < 0.5 ? '#2f6b3a' : '#4fa04a'); }
    meta.top = colTop - 30;
  });
}
function makeMansion(seed) {
  const W = 160, H = 118;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    const lit = () => r() < 0.35, glass = ['#e27bf0', '#f2eee6', '#9a4fd0'];
    // wings
    for (const [x0, w] of [[6, 46], [W - 52, 46]]) {
      paintWall(px, x0, 56, w, 56, 'dark', seed + x0, false);
      paintRoof(px, x0 - 4, 30, w + 8, 26, ROOFS.slate, seed + x0, { hip: 8 });
      for (const wy of [64, 86]) for (const fx of [0.28, 0.72]) paintWindow(px, Math.round(x0 + w * fx - 3), wy, 7, 11, lit(), meta, { arch: true, glass, glowCol: '#e27bf0' });
    }
    // centre block
    const cx0 = 46, cw = 68;
    paintWall(px, cx0, 40, cw, 72, 'dark', seed, false);
    paintRoof(px, cx0 - 4, 10, cw + 8, 30, ROOFS.slate, seed, { hip: 12 });
    for (const dx of [14, 54]) { px(cx0 + dx - 1, 14, OUTL, 12, 14); px(cx0 + dx, 15, '#46405a', 10, 13); paintWindow(px, cx0 + dx + 2, 18, 6, 7, lit(), meta, { glass, glowCol: '#e27bf0' }); for (let j = 0; j < 6; j++) px(cx0 + dx - 1 + j, 13 - j, OUTL, 12 - j * 2, 1); }
    for (const wy of [48, 70]) for (const fx of [0.18, 0.5, 0.82]) paintWindow(px, Math.round(cx0 + cw * fx - 4), wy, 8, 12, lit(), meta, { arch: true, glass, glowCol: '#e27bf0' });
    paintChimney(px, cx0 + 6, 2, 14, meta); paintChimney(px, cx0 + cw - 12, 2, 14, meta);
    // turret
    px(W - 20, 22, OUTL, 18, 34); px(W - 19, 23, '#46405a', 16, 33);
    for (let j = 0; j < 22; j++) { const half = Math.round(j / 22 * 11); for (let i = -half; i <= half; i++) px(W - 11 + i, j, Math.abs(i) >= half ? OUTL : ROOFS.plum.b); }
    paintWindow(px, W - 13, 32, 5, 9, true, meta, { arch: true, glass, glowCol: '#e27bf0' });
    paintDoor(px, W / 2 - 8, H - 26, 16, 22, { stone: true, col: '#3a1c2a' });
    for (let t = 0; t < 3; t++) { px(W / 2 - 14 + t * 2, H - 4 + t - 2, '#5f5769', 28 - t * 4, 1); }
    paintIvy(px, 10, H - 6, 40, seed); paintIvy(px, W - 12, H - 6, 50, seed + 2);
    px(4, H - 1, OUTL, W - 8, 1);
    meta.top = 0;
  });
}
function makeGate(seed) {
  const W = 92, H = 110;
  return canvasSprite(W, H, seed, (px, r, g, meta) => {
    for (const [x0, flip] of [[2, 1], [W - 26, -1]]) {
      for (let j = 20; j < H - 2; j++) for (let i = 0; i < 24; i++) { const n = nz(i >> 2, j >> 2, seed + x0); px(x0 + i, j, (j % 6 === 5 || (i + (j / 6 | 0) * 3) % 8 === 7) ? '#121019' : n < 0.12 ? '#7a1a2a' : n < 0.6 ? '#2a2538' : '#36304f'); }
      px(x0 - 1, 20, OUTL, 1, H - 22); px(x0 + 24, 20, OUTL, 1, H - 22);
      for (let k = 0; k < 18; k++) { const hx = x0 + 12 + flip * Math.round(k * 0.7) - (flip < 0 ? 0 : 0), hy = 20 - k; px(hx - 2 + Math.round(k / 6), hy, OUTL, 5 - Math.round(k / 5), 1); px(hx - 1 + Math.round(k / 6), hy, '#c9c2e0', Math.max(1, 3 - Math.round(k / 6)), 1); }
      for (let k = 0; k < 5; k++) px(x0 + 10, 34 + k * 14, '#d8354a', 4, 6);
    }
    for (let i = 26; i < W - 26; i++) {
      const t = (i - W / 2) / (W / 2 - 26), y = 26 + Math.round(t * t * 16);
      px(i, y - 10, OUTL, 1, 12); px(i, y - 9, (i % 5 === 0) ? '#121019' : '#2a2538', 1, 10);
      if (i % 9 === 0) px(i, y - 6, '#d8354a', 2, 2);
    }
    meta.glows.push([W / 2, 60, '#d8354a']);
    meta.top = 0;
    px(0, H - 1, OUTL, W, 1);
  });
}
function makeMausoleum(seed) {
  return makeHouse({ w: 50, wallH: 34, roofH: 18, mat: 'pale', roof: 'slate', seed, lit: 0, hip: 2, ivy: true, extra(px, r, meta, b) {
    px(b.x0 + b.w / 2 - 7, b.by - 20, OUTL, 14, 20); px(b.x0 + b.w / 2 - 6, b.by - 19, '#2e2a38', 12, 19); px(b.x0 + b.w / 2 - 1, b.by - 19, OUTL, 1, 19);
    for (const fx of [4, b.w - 7]) { px(b.x0 + fx, b.wy + 2, '#aaa4ba', 3, b.wallH - 4); px(b.x0 + fx + 2, b.wy + 2, '#5f5769', 1, b.wallH - 4); }
    px(b.x0 + b.w / 2 - 2, b.pad - 2, '#c9c2e0', 4, 8); px(b.x0 + b.w / 2 - 4, b.pad, '#c9c2e0', 8, 2);
  } });
}

/* Props */
const PROPS = {
  lamp: () => canvasSprite(11, 34, 1, (px, r, g, meta) => { px(4, 8, OUTL, 3, 26); px(5, 8, '#36304f', 1, 26); px(1, 0, OUTL, 9, 9); px(2, 1, '#ffd35a', 7, 7); px(3, 2, '#fff3b0', 3, 3); px(0, 0, OUTL, 11, 2); px(2, 32, OUTL, 7, 2); meta.glows.push([5.5, 4, '#ffd35a']); }),
  fence: () => canvasSprite(26, 12, 2, px => { for (let i = 0; i < 26; i += 6) { px(i, 0, OUTL, 4, 12); px(i + 1, 1, '#7a5236', 2, 11); } px(0, 3, OUTL, 26, 3); px(0, 4, '#9a6a42', 26, 1); px(0, 7, OUTL, 26, 3); px(0, 8, '#7a5236', 26, 1); }),
  ironfence: () => canvasSprite(26, 18, 3, px => { px(0, 4, OUTL, 26, 2); px(0, 13, OUTL, 26, 2); for (let i = 1; i < 26; i += 4) { px(i, 1, OUTL, 2, 17); px(i, 0, '#5e557f', 2, 2); } px(0, 17, OUTL, 26, 1); }),
  ironfenceV: () => canvasSprite(6, 28, 3, px => { px(1, 0, OUTL, 4, 28); px(2, 0, '#5e557f', 2, 2); px(2, 2, '#36304f', 1, 26); px(0, 27, OUTL, 6, 1); }),
  palisade: () => canvasSprite(30, 30, 4, (px, r) => { for (let i = 0; i < 30; i += 5) { const h = 24 + ((r() * 4) | 0); px(i, 30 - h, OUTL, 5, h); px(i + 1, 30 - h + 3, '#5a3a28', 3, h - 3); px(i + 1, 30 - h + 3, '#7a5236', 1, h - 3); px(i + 2, 30 - h, '#7a5236', 1, 3); } px(0, 14, '#3a2618', 30, 2); }),
  crate: () => canvasSprite(12, 12, 5, px => { px(0, 0, OUTL, 12, 12); px(1, 1, '#9a6a42', 10, 10); px(1, 1, '#c49a6a', 10, 1); px(1, 5, '#5a3a28', 10, 1); for (let k = 1; k < 11; k++) px(k, k, '#5a3a28'); }),
  barrel: () => canvasSprite(10, 13, 6, px => { px(1, 0, OUTL, 8, 13); px(0, 1, OUTL, 10, 11); px(1, 1, '#7a5236', 8, 11); px(1, 1, '#9a6a42', 3, 11); px(1, 3, '#36304f', 8, 1); px(1, 9, '#36304f', 8, 1); px(1, 1, '#c49a6a', 8, 1); }),
  hay: () => canvasSprite(22, 15, 7, (px, r) => { for (let j = 0; j < 15; j++) { const half = Math.round(Math.sqrt(Math.max(0, 1 - ((j - 14) / 15) ** 2)) * 11); for (let i = 11 - half; i < 11 + half; i++) px(i, j, i === 11 - half || i === 10 + half || j === 0 ? OUTL : r() < 0.3 ? '#a08a3a' : r() < 0.2 ? '#e8d27a' : '#c9ac4a'); } px(0, 14, OUTL, 22, 1); }),
  cart: () => canvasSprite(30, 20, 8, px => { px(2, 2, OUTL, 24, 10); px(3, 3, '#7a5236', 22, 8); px(3, 3, '#9a6a42', 22, 1); for (let i = 3; i < 25; i += 5) px(i, 3, '#5a3a28', 1, 8); px(5, 1, '#c9ac4a', 18, 3); px(24, 8, '#3a2618', 6, 2); for (const wx of [8, 20]) { px(wx - 4, 11, OUTL, 9, 9); px(wx - 3, 12, '#5a3a28', 7, 7); px(wx, 15, OUTL); } }),
  bench: () => canvasSprite(18, 9, 9, px => { px(0, 2, OUTL, 18, 4); px(1, 3, '#9a6a42', 16, 2); for (const lx of [2, 14]) px(lx, 6, OUTL, 2, 3); }),
  signpost: () => canvasSprite(16, 24, 10, px => { px(7, 2, OUTL, 3, 22); px(8, 2, '#7a5236', 1, 22); px(0, 4, OUTL, 15, 6); px(1, 5, '#9a6a42', 13, 4); px(14, 5, OUTL, 2, 4); px(3, 6, '#3a2618', 8, 1); px(2, 12, OUTL, 13, 5); px(3, 13, '#9a6a42', 11, 3); px(0, 13, OUTL, 2, 3); }),
  well: () => canvasSprite(28, 30, 11, (px, r, g, meta) => { for (const p of [3, 23]) { px(p - 1, 0, OUTL, 4, 18); px(p, 2, '#5a3a28', 2, 16); } for (let j = 0; j < 7; j++) { const inset = Math.round((1 - j / 7) * 4); px(inset, j, OUTL, 28 - inset * 2, 1); if (j) px(inset + 1, j, ROOFS.red.b, 26 - inset * 2, 1); } px(12, 7, '#3a2618', 4, 6); px(13, 8, '#9a6a42', 2, 4); px(1, 16, OUTL, 26, 14); px(2, 17, '#6b6276', 24, 12); for (let j = 19; j < 29; j += 3) for (let i = 2 + (j % 2) * 3; i < 26; i += 6) px(i, j, '#2e2a38', 1, 3); px(2, 17, '#8a80a0', 24, 1); px(4, 18, '#142a33', 20, 3); }),
  fountain: () => canvasSprite(52, 40, 12, (px, r, g, meta) => {
    for (let j = 0; j < 20; j++) for (let i = 0; i < 52; i++) { const d = ((i - 26) / 26) ** 2 + ((j - 10) / 10) ** 2; if (d <= 1) px(i, j + 18, d > 0.78 ? (j < 10 ? '#8a80a0' : '#6b6276') : d > 0.68 ? OUTL : (nz(i, j, 1) < 0.2 ? '#4a8ec0' : '#2a5a80')); }
    px(0, 28, OUTL, 52, 1);
    px(22, 6, OUTL, 8, 26); px(23, 7, '#8a80a0', 6, 25); px(23, 7, '#aaa4ba', 2, 25);
    px(16, 4, OUTL, 20, 4); px(17, 5, '#8a80a0', 18, 2); px(24, 0, '#8ff0ff', 4, 5); px(25, 0, '#f2eee6', 2, 2);
    for (const sx of [18, 33]) px(sx, 8, '#8ff0ff', 1, 10);
    meta.glows.push([26, 26, '#8ff0ff']);
  }),
  cauldron: () => canvasSprite(16, 13, 13, (px, r, g, meta) => { px(1, 3, OUTL, 14, 10); px(0, 4, OUTL, 16, 7); px(2, 4, '#2e2a38', 12, 8); px(2, 3, '#a6e05a', 12, 2); px(4, 2, '#4fa04a', 3, 1); px(9, 2, '#a6e05a', 2, 1); meta.glows.push([8, 3, '#a6e05a']); meta.smoke.push([8, 1]); }),
  brazier: () => canvasSprite(12, 20, 14, (px, r, g, meta) => { px(5, 8, OUTL, 3, 12); px(1, 5, OUTL, 10, 4); px(2, 6, '#5f5769', 8, 2); px(3, 2, '#e8742c', 6, 4); px(4, 0, '#ffd35a', 4, 3); px(3, 18, OUTL, 7, 2); meta.glows.push([6, 3, '#e8742c']); }),
  skullpost: () => canvasSprite(8, 26, 15, px => { px(3, 6, OUTL, 2, 20); px(1, 0, OUTL, 6, 6); px(2, 1, '#f2eee6', 4, 4); px(2, 2, OUTL); px(5, 2, OUTL); px(3, 5, '#f2eee6', 2, 1); }),
  rack: () => canvasSprite(20, 18, 16, px => { for (const p of [1, 17]) px(p, 2, OUTL, 2, 16); px(0, 4, '#5a3a28', 20, 2); for (let i = 4; i < 17; i += 4) { px(i, 0, '#c9c2e0', 1, 14); px(i - 1, 0, '#8a80a0', 3, 2); } }),
  banner: () => canvasSprite(12, 36, 17, px => { px(1, 0, OUTL, 2, 36); px(3, 2, '#7a1a2a', 8, 18); px(3, 2, '#d8354a', 8, 2); px(5, 8, '#f2eee6', 4, 4); px(3, 20, '#7a1a2a', 3, 3); px(8, 20, '#7a1a2a', 3, 3); }),
  statue: () => canvasSprite(18, 40, 18, px => { px(1, 30, OUTL, 16, 10); px(2, 31, '#6b6276', 14, 8); px(2, 31, '#8a80a0', 14, 1); px(5, 6, OUTL, 8, 25); px(6, 7, '#8a87a0', 6, 23); px(6, 1, OUTL, 6, 6); px(7, 2, '#8a87a0', 4, 4); px(3, 12, OUTL, 3, 10); px(12, 12, OUTL, 3, 10); px(6, 7, '#aaa4ba', 2, 23); }),
  rubble: () => canvasSprite(18, 8, 19, (px, r) => { for (let k = 0; k < 7; k++) { const x = (r() * 14) | 0, y = 2 + ((r() * 4) | 0); px(x, y, OUTL, 5, 4); px(x + 1, y + 1, r() < 0.5 ? '#6b6276' : '#4a4258', 3, 2); } }),
  column: () => canvasSprite(18, 48, 20, (px, r) => { const top = 6 + ((r() * 14) | 0); px(2, top, OUTL, 14, 44 - top); for (let i = 0; i < 12; i++) px(3 + i, top + 1, i < 4 ? '#d8d5e8' : i < 9 ? '#b5b2c4' : '#8a87a0', 1, 42 - top); for (let k = 0; k < 4; k++) px(3 + ((r() * 11) | 0), top - 1, '#b5b2c4', 2, 2); px(0, 43, OUTL, 18, 5); px(1, 44, '#aaa4ba', 16, 3); paintIvy(px, 5, 44, 20, 3); }),
  arch: () => canvasSprite(64, 52, 21, (px, r) => { for (const x0 of [2, 48]) { px(x0, 10, OUTL, 14, 42); px(x0 + 1, 11, '#8a87a0', 12, 40); px(x0 + 1, 11, '#b5b2c4', 4, 40); } for (let i = 2; i < 40; i++) { if (i > 24 && i < 32) continue; const y = 4 + Math.round(Math.abs(i - 32) * 0.12); px(i, y, OUTL, 1, 9); px(i, y + 1, '#9e98ae', 1, 7); } for (let k = 0; k < 6; k++) px(30 + k * 2, 50, OUTL, 6, 2); paintIvy(px, 6, 51, 34, 9); }),
  tent: () => canvasSprite(48, 36, 22, (px, r) => {
    for (let j = 0; j < 32; j++) { const half = Math.round(j * 0.75) + 1; for (let i = 24 - half; i < 24 + half; i++) { const c = (i < 24 ? '#7a5a3a' : '#5a3a28'); px(i, j + 2, i === 24 - half || i === 23 + half ? OUTL : (nz(i >> 2, j >> 2, 22) < 0.1 ? '#9a7a4a' : c)); } }
    for (let j = 10; j < 34; j += 6) px(24 - Math.round(j * 0.75), j, '#3a2618', Math.round(j * 1.5), 1);
    for (let j = 14; j < 34; j++) { const half = Math.round((j - 14) * 0.35) + 1; px(24 - half, j, '#141220', half * 2, 1); }
    px(23, 0, '#3a2618', 2, 4); px(0, 35, OUTL, 48, 1);
  }),
  deadtree: () => DECOR.deadtree, tree: () => DECOR.tree,
};
const prop = k => cached('prop:' + k, PROPS[k]);

/* ---------- Layout ---------- */
const ROW_GAP = 112, ROAD_W = 16;
function placeBuilding(st, spr, x, base, o = {}) {
  const p = { spr, x, y: base, big: spr.h > 28, meta: spr.meta, depth: o.depth ?? Math.min(36, Math.round(spr.h * 0.3)) };
  // collision: a row of circles along the footprint behind the front wall
  const half = spr.w / 2 - 5, rr = Math.max(5, Math.min(12, p.depth / 2));
  p.solids = [];
  if (!o.noSolid) for (let dx = -half + rr; dx <= half - rr + 0.1; dx += rr * 1.2) p.solids.push([dx, -rr + 2, rr]);
  if (o.ruinable) p.ruinable = o.ruinable;
  st.pieces.push(p);
  return p;
}
function placeProp(st, k, x, y, solid = 0) { const p = { spr: prop(k), x, y, meta: prop(k).meta, solid }; st.pieces.push(p); return p; }

// Each building kind is a recipe, so a ruined town can repaint itself
const RECIPES = {
  cottage: (s, ru) => makeHouse({ w: 50 + (s % 3) * 4, wallH: 26, roofH: 24, mat: pick2(s, ['stone', 'timber', 'plaster']), roof: pick2(s >> 2, ['red', 'blue', 'green', 'thatch']), seed: s, chimney: true, flowers: true, shutter: s % 2, ruined: ru, gable: s % 3 === 0 }),
  house2: (s, ru) => makeHouse({ w: 58 + (s % 2) * 8, wallH: 42, roofH: 26, storeys: 2, mat: pick2(s, ['timber', 'stone', 'plaster']), roof: pick2(s >> 3, ['red', 'blue', 'slate', 'green']), seed: s, chimney: true, gable: s % 2 === 0, shutter: true, ruined: ru }),
  longhouse: (s, ru) => makeHouse({ w: 80, wallH: 26, roofH: 24, mat: 'log', roof: 'thatch', seed: s, chimney: true, chimneyX: 0.3, doorX: 0.35, ruined: ru }),
  inn: (s, ru) => makeHouse({ w: 86, wallH: 44, roofH: 28, storeys: 2, mat: 'timber', roof: 'red', seed: s, chimney: true, gable: true, gableX: 0.3, sign: 'mug', openDoor: true, lit: 0.95, ruined: ru }),
  smithy: (s, ru) => makeSmithy(s, ru),
  chapel: (s, ru) => makeChapel(s, ru),
  runeforge: (s, ru) => makeRuneforge(s, ru),
  alchemist: (s, ru) => makeHouse({ w: 52, wallH: 30, roofH: 24, mat: 'plaster', roof: 'green', seed: s, chimney: true, sign: 'bottle', glass: ['#a6e05a', '#f2eee6', '#4fa04a'], lit: 0.9, ruined: ru }),
  cartographer: (s, ru) => makeHouse({ w: 56, wallH: 40, roofH: 24, storeys: 2, mat: 'stone', roof: 'blue', seed: s, sign: 'scroll', gable: true, ruined: ru }),
  hunter: (s, ru) => makeHouse({ w: 60, wallH: 26, roofH: 22, mat: 'log', roof: 'thatch', seed: s, chimney: true, antlers: true, ruined: ru }),
  witchhouse: (s, ru) => makeHouse({ w: 48, wallH: 28, roofH: 26, mat: 'dark', roof: 'plum', seed: s, chimney: true, sign: 'eye', glass: ['#a6e05a', '#f2eee6', '#4fa04a'], lit: 1, ivy: true, ruined: ru }),
  merchant: (s, ru) => makeHouse({ w: 62, wallH: 30, roofH: 24, mat: 'timber', roof: 'blue', seed: s, sign: 'coin', openDoor: true, lit: 0.9, chimney: true, ruined: ru }),
};
const pick2 = (n, arr) => arr[Math.abs(n) % arr.length];
const NPC_HOME = { smith: 'smithy', priest: 'chapel', alchemist: 'alchemist', cartographer: 'cartographer', hunter: 'hunter', witch: 'witchhouse', merchant: 'merchant', runesmith: 'runeforge' };
function recipeSprite(kind, seed, ruined) { return cached(`${kind}:${seed}:${ruined ? 1 : 0}`, () => RECIPES[kind](seed, ruined)); }

// Streets and rows for a village or town. Pure: the same seed always gives the same plan
function townPlan(st) {
  if (st.plan) return st.plan;
  const big = st.type === 'town', R = st.R, r = mulberry32(st.seed ^ 0x51ed);
  const streets = big ? [-2, -1, 0, 1, 2].map(k => k * ROW_GAP + 10) : [-1, 0, 1].map(k => k * ROW_GAP + 10);
  const lanes = big ? [0, -150 - ((r() * 30) | 0), 150 + ((r() * 30) | 0)] : [((r() - 0.5) * 60) | 0];
  const reach = R + 170;
  const roads = [];
  streets.forEach((y, i) => { const main = i === (streets.length >> 1); roads.push({ x1: main ? -reach : -R * 0.92, x2: main ? reach : R * 0.92, y1: y, y2: y, w: main ? ROAD_W + 2 : ROAD_W }); });
  lanes.forEach((x, i) => roads.push({ x1: x, x2: x, y1: i === 0 ? -reach : streets[0] - 40, y2: i === 0 ? reach : streets[streets.length - 1], w: i === 0 ? ROAD_W + 2 : ROAD_W - 2 }));
  const plaza = { x: lanes[0], y: streets[streets.length >> 1], r: big ? 88 : 42 };
  st.plan = { streets, lanes, roads, plaza, big };
  return st.plan;
}
function onRoad(plan, x, y, pad = 0) {
  for (const rd of plan.roads) {
    const h = rd.w / 2 + pad;
    if (rd.y1 === rd.y2) { if (x >= rd.x1 - h && x <= rd.x2 + h && Math.abs(y - rd.y1) < h) return true; }
    else if (y >= rd.y1 - h && y <= rd.y2 + h && Math.abs(x - rd.x1) < h) return true;
  }
  return Math.hypot(x - plan.plaza.x, (y - plan.plaza.y) * 1.3) < plan.plaza.r + pad;
}
function buildTown(st) {
  const plan = townPlan(st), r = mulberry32(st.seed), R = st.R, ruined = st.type === 'ruinvillage';
  const ox = st.x, oy = st.y, rects = [];
  const free = (x0, y0, x1, y1) => !rects.some(q => x0 < q[2] && x1 > q[0] && y0 < q[3] && y1 > q[1]);
  st.folkPaths = [];
  // who lives here
  let kinds = [];
  if (!ruined) {
    const all = Object.keys(NPC_HOME).filter(k => k !== 'runesmith' && k !== 'merchant');
    kinds = plan.big ? [...all, 'merchant', 'runesmith'] : ['runesmith', ...all.sort(() => r() - 0.5).slice(0, 3 + (r() < 0.4 ? 1 : 0)), ...(r() < 0.5 ? ['merchant'] : [])];
  }
  const queue = kinds.map(k => ({ kind: NPC_HOME[k], npc: k }));
  if (plan.big) queue.splice(1, 0, { kind: 'inn' });
  else if (r() < 0.5) queue.push({ kind: 'inn' });
  if (ruined) queue.push({ kind: 'chapel' }, { kind: 'smithy' });
  const filler = () => ({ kind: pick2((r() * 1000) | 0, ['cottage', 'house2', 'cottage', 'longhouse', 'house2']) });
  // fill each street's north side with buildings, doors facing the street
  const rowsOrder = plan.streets.map((y, i) => i).sort(() => r() - 0.5);
  for (const ri of rowsOrder) {
    const sy = plan.streets[ri], base = sy - ROAD_W / 2 - 4;
    let x = -R * 0.88 + r() * 20;
    while (x < R * 0.88) {
      const job = queue.length && r() < 0.75 ? queue[0] : filler();
      const seed = (st.seed + Math.round(x) * 31 + ri * 977) | 0;
      const spr = recipeSprite(job.kind, seed, ruined);
      const x0 = x, x1 = x + spr.w, cx = x + spr.w / 2;
      const hitsLane = plan.lanes.some(lx => x1 > lx - ROAD_W / 2 - 6 && x0 < lx + ROAD_W / 2 + 6);
      const hitsPlaza = Math.hypot(cx - plan.plaza.x, base - plan.plaza.y) < plan.plaza.r + spr.w / 2 + 4;
      const tooFar = Math.hypot(cx, base - spr.h / 2) > R + 20;
      if (hitsLane || hitsPlaza || tooFar || !free(x0, base - spr.h, x1, base)) { x += 12; continue; }
      if (job === queue[0]) queue.shift();
      const p = placeBuilding(st, spr, ox + cx, oy + base, { ruinable: { kind: job.kind, seed } });
      rects.push([x0 - 4, base - spr.h, x1 + 4, base + 2]);
      if (job.npc) st.npcs.push(makeNpc(job.npc, ox + cx + (job.kind === 'smithy' ? 18 : -14), oy + base + 12));
      // something between buildings: barrels, a garden, a tree, a lamp
      x = x1 + 6 + r() * 14;
      const gapRoll = r();
      if (gapRoll < 0.3 && free(x, base - 14, x + 14, base)) { placeProp(st, r() < 0.5 ? 'barrel' : 'crate', ox + x + 6, oy + base - 2, 5); if (r() < 0.6) placeProp(st, 'crate', ox + x + 9, oy + base - 10, 0); x += 18; }
      else if (gapRoll < 0.36 && !ruined && free(x, base - 30, x + 12, base)) { placeProp(st, 'lamp', ox + x + 5, oy + base + 1, 3); x += 14; }
      else if (gapRoll < 0.55 && free(x, base - 26, x + 22, base)) { placeProp(st, 'hay', ox + x + 11, oy + base - 2, 7); x += 26; }
    }
  }
  // lamps along the street edges and at the plaza
  if (!ruined) {
    for (const sy of plan.streets) for (let x = -R * 0.8 + 40; x < R * 0.8; x += 170) if (!onRoad(plan, x, sy + ROAD_W / 2 + 6, 2) && free(x - 6, sy + 4, x + 6, sy + 16)) placeProp(st, 'lamp', ox + x, oy + sy + ROAD_W / 2 + 8, 3);
  }
  const pz = plan.plaza;
  placeProp(st, plan.big && !ruined ? 'fountain' : 'well', ox + pz.x, oy + pz.y + 8, plan.big ? 18 : 10);
  if (!ruined) {
    for (const dx of [-1, 1]) placeProp(st, 'lamp', ox + pz.x + dx * (pz.r - 4), oy + pz.y + (pz.r - 10) * 0.6, 3);
    if (plan.big) {
      [[-62, -18], [62, -18], [-62, 44], [62, 44]].forEach(([dx, dy], i) => placeBuilding(st, cached('stall:' + i, () => makeStall(st.seed + i, ['#d8354a', '#3f8ee0', '#a6e05a', '#e27bf0'][i], '#e8e4f0')), ox + pz.x + dx, oy + pz.y + dy, { depth: 14 }));
      placeProp(st, 'statue', ox + pz.x, oy + pz.y + 56, 6);
    }
    placeProp(st, 'bench', ox + pz.x - pz.r + 4, oy + pz.y + 2, 0);
  } else {
    for (let i = 0; i < 8; i++) placeProp(st, 'rubble', ox + rand2(r, -R * 0.7, R * 0.7), oy + rand2(r, -R * 0.6, R * 0.6), 0);
  }
  // gardens and fields south of the last street, trees around the edge
  const lastY = plan.streets[plan.streets.length - 1] + ROAD_W / 2 + 22;
  st.gardens = [];
  for (let x = -R * 0.75; x < R * 0.6; x += 70 + r() * 30) {
    if (plan.lanes.some(lx => Math.abs(x + 26 - lx) < 40)) continue;
    const g = { x: x, y: lastY, w: 52, h: 26 }; st.gardens.push(g);
    for (let k = 0; k < 2; k++) placeProp(st, 'fence', ox + x + 13 + k * 26, oy + lastY + g.h + 6, 0);
    if (r() < 0.5 && !ruined) placeProp(st, r() < 0.5 ? 'cart' : 'hay', ox + x + 60, oy + lastY + 18, 7);
  }
  for (let i = 0; i < (plan.big ? 26 : 16); i++) {
    const a = r() * TAU, d = R * (0.92 + r() * 0.35), x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85;
    if (onRoad(plan, x, y, 10) || !free(x - 10, y - 30, x + 10, y)) continue;
    placeProp(st, ruined ? 'deadtree' : (r() < 0.85 ? 'tree' : 'deadtree'), ox + x, oy + y, 5);
  }
  for (const rd of plan.roads) if (rd.y1 !== rd.y2 && rd.y1 < -R) placeProp(st, 'signpost', ox + rd.x1 + ROAD_W / 2 + 10, oy - R + 10, 3);
  // folk walk the streets
  st.folk = [];
  if (!ruined) for (let i = 0; i < (plan.big ? 9 : 5); i++) {
    const sy = pick2((r() * 99) | 0, plan.streets);
    const f = makeNpc(r() < 0.5 ? 'villager' : 'villager2', ox + rand2(r, -R * 0.6, R * 0.6), oy + sy + rand2(r, -4, 4));
    f.walk = { y: oy + sy + rand2(r, -4, 4), x1: ox - R * 0.8, x2: ox + R * 0.8, dir: r() < 0.5 ? -1 : 1, spd: 14 + r() * 10, pause: 0 };
    f.folk = true; st.folk.push(f);
  }
  st.labelH = 96;
}
const rand2 = (r, a, b) => a + r() * (b - a);

/* ---------- Every other site ---------- */
function buildSite(st) {
  const r = mulberry32(st.seed), ox = st.x, oy = st.y;
  const put = (spr, dx, dy, o) => placeBuilding(st, spr, ox + dx, oy + dy, o);
  const pp = (k, dx, dy, solid = 0) => placeProp(st, k, ox + dx, oy + dy, solid);
  switch (st.type) {
    case 'hut': {
      put(cached('hut:' + (st.seed % 4), () => makeWitchHut(st.seed % 4)), 0, 0, { depth: 24 });
      st.door = { x: st.x + 10, y: st.y + 6 }; st.relic = r() < 0.2;
      pp('cauldron', -30, 10, 7); pp('skullpost', 34, 4, 3); pp('skullpost', -38, -8, 3);
      for (let i = 0; i < 5; i++) pp('deadtree', rand2(r, -80, 80), rand2(r, -60, -30) + (i % 2) * 90, 5);
      st.labelH = 90; break;
    }
    case 'tower': {
      const t = put(cached('tower', () => makeTower(7)), 0, 0, { depth: 40 });
      st.door = { x: st.x, y: st.y + 6 };
      for (let i = 0; i < 6; i++) pp(i % 2 ? 'rubble' : 'column', rand2(r, -70, 70), rand2(r, -10, 40) * (i % 2 ? 1 : -1), i % 2 ? 0 : 6);
      pp('brazier', -22, 10, 4); pp('brazier', 22, 10, 4);
      st.labelH = t.spr.h + 8; break;
    }
    case 'ruins': {
      st.hatch = { x: st.x, y: st.y };
      put(cached('arch', PROPS.arch), 0, -28, { depth: 10, noSolid: true }).solids = [[-23, -5, 7], [23, -5, 7]];
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.6; pp('column', Math.cos(a) * 62, Math.sin(a) * 40 + 6, 6); }
      for (let i = 0; i < 6; i++) pp('rubble', rand2(r, -70, 70), rand2(r, -40, 50));
      st.labelH = 70; break;
    }
    case 'graveyard': {
      put(cached('maus:' + (st.seed % 3), () => makeMausoleum(st.seed % 3)), 0, -88, { depth: 20 });
      for (let i = -5; i <= 5; i++) { if (Math.abs(i) <= 0) continue; pp('ironfence', i * 26, 104, 0); pp('ironfence', i * 26, -118, 0); }
      for (let j = -4; j <= 4; j++) { pp('ironfenceV', -143, j * 26 + 10, 0); pp('ironfenceV', 143, j * 26 + 10, 0); }
      pp('lamp', -16, 106, 3); pp('lamp', 16, 106, 3);
      for (let gy = -50; gy <= 80; gy += 26) for (let gx = -112; gx <= 112; gx += 22) {
        if (Math.abs(gx) < 18 || r() < 0.35) continue;
        st.pieces.push({ grave: true, x: st.x + gx + rand2(r, -3, 3), y: st.y + gy + rand2(r, -3, 3), cracked: r() < 0.5 });
      }
      for (let i = 0; i < 4; i++) pp('deadtree', (i % 2 ? 1 : -1) * rand2(r, 60, 130), rand2(r, -100, -60) + (i > 1 ? 150 : 0), 5);
      st.labelH = 60; break;
    }
    case 'bandits': {
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.4; put(cached('tent', PROPS.tent), Math.cos(a) * 64, Math.sin(a) * 46, { depth: 16 }); }
      put(BUILD.cage, 40, 8, { depth: 8 });
      st.npcs.push(makeNpc('prisoner', st.x + 40, st.y + 4)); st.npcs[0].caged = true;
      for (let k = 0; k < 14; k++) { const a = 1.9 + k / 14 * (TAU - 1.0), x = Math.cos(a) * 118, y = Math.sin(a) * 92; pp('palisade', x, y + 10, 9); }
      pp('rack', -30, -18, 5); pp('banner', 26, -34, 2); pp('banner', -58, 18, 2); pp('crate', 74, -10, 5); pp('barrel', 80, -2, 5);
      st.labelH = 50; break;
    }
    case 'mine': {
      put(cached('mine', () => makeMine(3)), 0, 0, { depth: 40 });
      st.door = { x: st.x, y: st.y + 6 };
      pp('cart', 30, 22, 7); pp('crate', -40, 12, 5); pp('barrel', -48, 6, 5);
      st.labelH = 72; break;
    }
    case 'watchtower': {
      const t = put(cached('watch', () => makeWatchtower(5)), 0, 0, { depth: 12, noSolid: true });
      t.solids = [[-16, -4, 5], [16, -4, 5]];
      st.perchY = -t.meta.perch; pp('crate', 30, 6, 5); pp('barrel', -30, 4, 5);
      st.labelH = 112; break;
    }
    case 'gate': {
      const p = put(cached('gate', () => makeGate(9)), 0, 0, { depth: 14, noSolid: true });
      p.solids = [[-34, -6, 12], [34, -6, 12]];
      st.door = { x: st.x, y: st.y + 2 };
      pp('brazier', -60, 8, 4); pp('brazier', 60, 8, 4); pp('skullpost', -76, -4, 3); pp('skullpost', 76, -4, 3);
      st.labelH = 118; break;
    }
    case 'temple': {
      put(cached('temple', () => makeTemple(11)), 0, 0, { depth: 46 });
      st.door = { x: st.x, y: st.y + 8 };
      pp('brazier', -40, 22, 4); pp('brazier', 40, 22, 4); pp('statue', -80, 6, 6); pp('statue', 80, 6, 6);
      for (let i = 0; i < 4; i++) pp('column', (i % 2 ? 1 : -1) * rand2(r, 90, 110), rand2(r, -60, 50), 6);
      st.labelH = 104; break;
    }
    case 'mansion': {
      put(cached('mansion', () => makeMansion(13)), 0, 0, { depth: 50 });
      st.door = { x: st.x, y: st.y + 8 };
      for (let i = -4; i <= 4; i++) if (Math.abs(i) > 0) pp('ironfence', i * 26, 54, 0);
      pp('lamp', -16, 56, 3); pp('lamp', 16, 56, 3);
      for (let i = 0; i < 4; i++) pp('deadtree', (i % 2 ? 1 : -1) * rand2(r, 100, 140), rand2(r, -40, 40), 5);
      pp('statue', -60, 34, 6); pp('statue', 60, 34, 6);
      const a = r() * TAU; st.keyAt = { x: st.x + Math.cos(a) * 230, y: st.y + Math.sin(a) * 170 };
      st.labelH = 128; break;
    }
  }
}

/* Replace the old builder */
buildStruct = function (st) {
  st.built = true;
  if (st.type === 'village' || st.type === 'ruinvillage' || st.type === 'town') {
    buildTown(st);
    if (st.type === 'ruinvillage') {
      st.overrun = Math.random() < 0.55; st.brute = Math.random() < 0.25;
      const r = mulberry32(st.seed + 5);
      st.survivor = r() < 0.35; st.cellar = r() < 0.55;
      if (st.survivor) st.npcs.push(makeNpc('prisoner', st.x + 22, st.y + 26));
      if (st.cellar) st.hatch = { x: st.x - 40, y: st.y + 36 };
    }
  } else buildSite(st);
  st.ground = paintGround(st);
  registerStruct(st);
};

/* ---------- Ground layer ---------- */
const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function paintGround(st) {
  const isTown = st.type === 'village' || st.type === 'ruinvillage' || st.type === 'town';
  const ext = isTown ? st.R + 170 : st.R + 50;
  const S = Math.ceil(ext * 2), c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const set = (x, y, col, a = 255) => { if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a; };
  const ruined = !!st.ruined || st.type === 'ruinvillage';
  const DIRT = (ruined ? ['#33302e', '#2c2927', '#3a3633'] : ['#3d3226', '#352b21', '#45392b']).map(hexRGB), RUT = hexRGB(ruined ? '#24211f' : '#2a2119');
  const COB = ['#4e4858', '#58526a', '#433e50'].map(hexRGB), MORT = hexRGB('#2a2632');
  const SOIL = ['#3a2a1e', '#2a1e14'].map(hexRGB), SPROUT = hexRGB('#4fa04a'), SPROUT2 = hexRGB('#2f6b3a');
  const GRAV = ['#3e3a48', '#36323f', '#48444f'].map(hexRGB);
  const o = ext; // world (st.x - ext) maps to pixel 0
  const roadPx = (x, y, rd) => {
    const horiz = rd.y1 === rd.y2, along = horiz ? x : y, across = horiz ? y - rd.y1 : x - rd.x1;
    const end = horiz ? Math.max(rd.x1 - along, along - rd.x2) : Math.max(rd.y1 - along, along - rd.y2);
    const half = rd.w / 2 + (nz(Math.round(along / 3), horiz ? 1 : 2, st.seed) - 0.5) * 3;
    if (Math.abs(across) > half + 1) return false;
    const fadeOut = Math.max(Math.abs(horiz ? x : 0), Math.abs(horiz ? 0 : y)) - st.R;
    if (end > 0) return false;
    if (fadeOut > 0 && nz(x, y, st.seed + 7) < fadeOut / 170) return false;
    if (Math.abs(across) > half - 1 && nz(x, y, st.seed) < 0.5) return false;
    return Math.abs(Math.abs(across) - rd.w / 4) < 1 ? 'rut' : 'dirt';
  };
  if (isTown) {
    const plan = townPlan(st);
    for (let py = 0; py < S; py++) for (let pxx = 0; pxx < S; pxx++) {
      const x = pxx - o, y = py - o;
      const pz = plan.plaza, pd = Math.hypot(x - pz.x, (y - pz.y) * 1.3);
      if (pd < pz.r + (nz(pxx >> 2, py >> 2, st.seed) - 0.5) * 4) {
        const row = Math.floor(y / 4), off = (row % 2) * 3, mort = ((y % 4) + 4) % 4 === 3 || (((x + off) % 6) + 6) % 6 === 5;
        set(pxx, py, mort ? MORT : COB[Math.floor(nz((x + off) / 6 | 0, row, st.seed) * 3)]);
        continue;
      }
      let hit = false;
      for (const rd of plan.roads) { const k = roadPx(x, y, rd); if (k) { set(pxx, py, k === 'rut' ? RUT : DIRT[Math.floor(nz(pxx, py, 1) * 3)]); hit = true; break; } }
      if (hit) continue;
      const gd = (st.gardens || []).find(gn => x >= gn.x && x < gn.x + gn.w && y >= gn.y && y < gn.y + gn.h);
      if (gd) { const rowk = (y - gd.y) % 5; set(pxx, py, rowk < 3 ? SOIL[0] : SOIL[1]); if (rowk === 1 && !ruined && nz(pxx, py, 3) < 0.35) set(pxx, py, nz(pxx, py, 4) < 0.5 ? SPROUT : SPROUT2); continue; }
      // trampled earth fading out around the town
      const td = Math.hypot(x, y * 1.1) / st.R;
      if (td < 1.05 && nz(pxx >> 1, py >> 1, st.seed + 2) < (1.05 - td) * 0.45) set(pxx, py, DIRT[1], 120);
    }
  } else {
    const R = st.R;
    for (let py = 0; py < S; py++) for (let pxx = 0; pxx < S; pxx++) {
      const x = pxx - o, y = py - o, n = nz(pxx >> 1, py >> 1, st.seed);
      switch (st.type) {
        case 'graveyard': {
          if (Math.abs(x) < 142 && y > -118 && y < 104) set(pxx, py, n < 0.3 ? hexRGB('#1a1722') : hexRGB('#221d2a'), 200);
          if (Math.abs(x) < 9 + (n - 0.5) * 2 && y > -80 && y < 130) set(pxx, py, GRAV[Math.floor(nz(pxx, py, 2) * 3)]);
          break;
        }
        case 'bandits': { const dd = Math.hypot(x, y * 1.25) / (R * 0.95); if (dd < 1 && n > dd * 0.6) set(pxx, py, DIRT[Math.floor(nz(pxx, py) * 3)], 210); break; }
        case 'mine': {
          if (Math.hypot(x, (y - 14) * 1.4) < 50 && n > 0.2) set(pxx, py, GRAV[Math.floor(nz(pxx, py) * 3)]);
          if (y > -2 && y < 80 && Math.abs(x) < 12) { if (y % 5 === 0 && Math.abs(x) < 11) set(pxx, py, hexRGB('#5a3a28')); if (Math.abs(Math.abs(x) - 6) < 1) set(pxx, py, hexRGB('#8a87a0')); }
          break;
        }
        case 'temple': case 'mansion': {
          const W2 = st.type === 'temple' ? 80 : 90;
          if ((Math.abs(x) < W2 && y > -20 && y < 40) || (Math.abs(x) < 16 && y >= 40 && y < 130)) {
            if (st.type === 'temple') { const mort = ((y + 200) % 8 === 7) || (((x + 200 + (((y + 200) >> 3) % 2) * 5) % 10) === 9); set(pxx, py, mort ? MORT : n < 0.15 ? hexRGB('#2f5238') : COB[Math.floor(nz(x >> 3, y >> 3, 5) * 3)]); }
            else set(pxx, py, GRAV[Math.floor(nz(pxx, py) * 3)], n < 0.2 ? 140 : 255);
          }
          break;
        }
        case 'tower': case 'ruins': { const dd = Math.hypot(x, y * 1.4) / (st.type === 'tower' ? 56 : 80); if (dd < 1 && n > dd * 0.7) { const mort = ((y + 200) % 6 === 5) || (((x + 200) % 7) === 6); set(pxx, py, mort ? MORT : COB[Math.floor(nz(x / 7 | 0, y / 6 | 0, 5) * 3)]); } break; }
        case 'gate': { const dd = Math.hypot(x, y * 1.3) / 90; if (dd < 1 && n > dd * 0.5) set(pxx, py, n > 0.93 ? hexRGB('#7a1a2a') : hexRGB('#1a1012'), 230); break; }
        case 'hut': { const dd = Math.hypot(x + Math.sin(y * 0.05) * 10, y * 1.2) / 80; if (dd < 1 && n > dd * 0.7) set(pxx, py, n > 0.8 ? hexRGB('#1a3a34') : hexRGB('#16241f'), 220); break; }
        case 'watchtower': { const dd = Math.hypot(x, y * 1.4) / 44; if (dd < 1 && n > dd * 0.6) set(pxx, py, DIRT[Math.floor(nz(pxx, py) * 3)]); break; }
      }
    }
  }
  // contact shadows under every building and prop
  g.putImageData(img, 0, 0);
  for (const p of st.pieces) {
    if (p.grave || !p.spr) continue;
    const bx = p.x - st.x + o, by = p.y - st.y + o, w = p.spr.w;
    g.fillStyle = 'rgba(11,10,18,0.45)';
    if (p.big) { g.fillRect(Math.round(bx - w / 2 + 2), Math.round(by - 1), w, 3); g.fillStyle = 'rgba(11,10,18,0.25)'; g.fillRect(Math.round(bx - w / 2 + 4), Math.round(by + 2), w - 2, 2); }
    else g.fillRect(Math.round(bx - w * 0.4), Math.round(by - 1), Math.round(w * 0.8), 2);
  }
  return { c, ox: st.x - o, oy: st.y - o };
}
function drawStructGround(st) {
  const gr = st.ground;
  if (!gr) return;
  const sx = Math.round(gr.ox - camX), sy = Math.round(gr.oy - camY);
  if (sx > W || sy > H || sx + gr.c.width < 0 || sy + gr.c.height < 0) return;
  ctx.drawImage(gr.c, sx, sy);
}

/* ---------- Drawing pieces (fade a building when the hero walks behind it) ---------- */
function drawPiece(st, p, fade) {
  let sp = p.spr;
  if (p.ruinable && st.ruined && !p.ruinedSpr) p.ruinedSpr = recipeSprite(p.ruinable.kind, p.ruinable.seed, true);
  if (st.ruined && p.ruinedSpr) sp = p.ruinedSpr;
  let a = fade;
  if (p.big && ME) {
    const fx = ME.x, fy = ME.y + 8;
    if (Math.abs(fx - p.x) < sp.w / 2 - 2 && fy < p.y - 2 && fy > p.y - sp.h + 6) a *= 0.45;
  }
  ctx.globalAlpha = a;
  ctx.drawImage(sp.c, Math.round(p.x - camX - sp.w / 2), Math.round(p.y - camY - sp.h));
  ctx.globalAlpha = 1;
  if (sp.meta && !st.ruined) for (const [dx, dy, c] of sp.meta.glows) { light(p.x + dx, p.y + dy, c === '#ffd35a' ? 34 : 26, 0.75); glowAt(p.x + dx, p.y + dy, 9, c, 0.35); }
}

/* ---------- Townsfolk ---------- */
function updateFolk(st, dt) {
  for (const f of st.folk || []) {
    const w = f.walk;
    if (w.pause > 0) { w.pause -= dt; f.moving = false; continue; }
    f.x += w.dir * w.spd * dt; f.y = w.y + Math.sin(f.ph * 0.8) * 1.5; f.ph += dt;
    f.face = w.dir; f.moving = true; f.anim += dt * 6;
    if (f.x < w.x1 || f.x > w.x2) { w.dir = -w.dir; f.x = Math.max(w.x1, Math.min(w.x2, f.x)); }
    if (Math.random() < dt * 0.15) w.pause = 1 + Math.random() * 3;
    const tp = nearestPlayer(f.x, f.y);
    if (Math.hypot(tp.x - f.x, tp.y - f.y) < 26) { w.pause = 0.6; f.face = tp.x < f.x ? -1 : 1; }
  }
}

/* ---------- The Runesmith: weapon fusion ---------- */
NPC_NAMES.runesmith = 'Runesmith';
SHOP_LINES.runesmith = 'Runes crawl across the Runesmith\'s arms like lit fuses. "Two weapons go in. One comes out. Usually."';
NPC_SPR.runesmith = NPC_SPR.priest.map(f => {
  const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
  const g = c.getContext('2d'); g.drawImage(f.c, 0, 0);
  const id = g.getImageData(0, 0, f.w, f.h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (d[i + 3] && mx > 120 && mx - mn < 50) { const k = mx / 255; d[i] = 154 * k + 40; d[i + 1] = 79 * k; d[i + 2] = 208 * k + 30; }
  }
  g.putImageData(id, 0, 0);
  return { c, w: f.w, h: f.h, sil: {} };
});
const SUPER_A = { bolt: 'Phoenix', scythe: 'Reaper', wisps: 'Spirit', nova: 'Cataclysm', chain: 'Thunder', frost: 'Glacial', glaive: 'Eclipse', cinder: 'Hellfire', starfall: 'Starfall', lance: 'Impaling', aura: 'Bramble', totem: 'Siege' };
const SUPER_B = { bolt: 'Barrage', scythe: 'Crescent', wisps: 'Halo', nova: 'Shockwave', chain: 'Storm', frost: 'Shard', glaive: 'Glaive', cinder: 'Inferno', starfall: 'Comet', lance: 'Lance', aura: 'Crown', totem: 'Pylon' };
const superName = w => `${SUPER_A[w.id]} ${SUPER_B[w.superWith]}`;
const fuseCost = (a, b) => 90 + 12 * (a.level + b.level) + (a.evo ? 40 : 0) + (b.evo ? 40 : 0);
function fuseOdds(a, b, pl) {
  return Math.max(0.3, Math.min(0.85, 0.32 + 0.025 * (a.level + b.level) + (a.evo ? 0.08 : 0) + (b.evo ? 0.08 : 0) + 0.03 * (pl.luck || 0)));
}
const fusable = pl => pl.weapons.filter(w => !w.fusedInto && !w.superWith);
const wName = w => w.superWith ? superName(w) : w.evo ? WEAPONS[w.id].evoName : WEAPONS[w.id].name;
function runesmith(st, pl) {
  const ws = fusable(pl);
  if (ws.length < 2) return openModal({ title: 'Runesmith', color: '#e27bf0', sub: goldLine(), body: `<p class="flavor">${SHOP_LINES.runesmith}</p><p class="flavor">"You need two weapons I haven't already bound. Come back with more steel."</p>`, buttons: [{ label: 'Leave' }] }, pl);
  openModal({
    title: 'Runesmith · Weapon fusion', color: '#e27bf0', sub: 'Choose the first weapon. It becomes the heart of the fusion.',
    body: `<p class="flavor">${SHOP_LINES.runesmith}</p>`,
    buttons: [...ws.map(a => ({ label: wName(a), desc: a.evo ? 'Evolved' : `Level ${a.level}`, act: () => runesmithPick(st, pl, a) })), { label: 'Leave' }],
  }, pl);
}
function runesmithPick(st, pl, a) {
  const ws = fusable(pl).filter(w => w !== a);
  openModal({
    title: 'Fuse with...', color: '#e27bf0', sub: `${goldLine()}. If it fails, a weapon shatters.`,
    buttons: [...ws.map(b => {
      const cost = fuseCost(a, b), odds = fuseOdds(a, b, pl);
      return { label: `${WEAPONS[a.id].name} + ${WEAPONS[b.id].name} · ${cost} gold`, desc: `${Math.round(odds * 100)}% to forge the ${SUPER_A[a.id]} ${SUPER_B[b.id]}`, disabled: G.gold < cost, act: () => { G.gold -= cost; fuseWeapons(pl, a, b, Math.random() < odds); } };
    }), { label: 'Back', act: () => runesmith(st, pl) }],
  }, pl);
}
function fuseWeapons(pl, a, b, ok) {
  const keep = P; P = pl;
  if (ok) {
    a.superWith = b.id; a.level = WEAPON_MAX(a.id); a.evo = true;
    b.fusedInto = a.uid; b.level = WEAPON_MAX(b.id); b.evo = true;
    recalc(); refreshSlots();
    G.whiteFlash = 1; G.shake = 10; Snd.play('evolve');
    burst(pl.x, pl.y, '#e27bf0', 40, 140); burst(pl.x, pl.y, '#8ff0ff', 30, 110);
    openModal({ title: superName(a), color: '#e27bf0', sub: 'Super weapon forged', body: `<p class="flavor">${WEAPONS[a.id].name} and ${WEAPONS[b.id].name} are one weapon now. Both fire, both evolved, both hit 75% harder with more reach and more projectiles, from a single slot.</p>`, buttons: [{ label: 'Take it', primary: true }] }, pl);
  } else {
    const both = Math.random() < 0.35 && pl.weapons.length > 2;
    pl.weapons.splice(pl.weapons.indexOf(b), 1);
    if (both) pl.weapons.splice(pl.weapons.indexOf(a), 1);
    else if (!a.evo) a.level = Math.max(1, a.level - 2);
    recalc(); refreshSlots();
    G.shake = 8; Snd.play('hurt'); burst(pl.x, pl.y, '#5e557f', 30, 120);
    openModal({ title: 'The runes split', color: '#d8354a', sub: both ? 'Both weapons shattered' : `${WEAPONS[b.id].name} shattered`, body: `<p class="flavor">${both ? 'Nothing is left but warm slag.' : `The ${WEAPONS[a.id].name} survived, ${a.evo ? 'scarred but whole' : 'two levels weaker'}.`} "That happens," the Runesmith says, not sounding sorry.</p>`, buttons: [{ label: 'Leave' }] }, pl);
  }
  P = keep;
}
// The Runesmith runs her own dialog instead of the shop list
const baseOpenShop = openShop;
openShop = function (kind, st, pl = P) { if (kind === 'runesmith') return runesmith(st, pl); return baseOpenShop(kind, st, pl); };

/* ---------- Hooks ---------- */
Mods.add({
  update(dt) {
    if (!G || noStructs()) return;
    for (const st of structsNear(ME.x, ME.y)) if (st.built && !st.ruined) updateFolk(st, dt);
  },
  // keep trees and rocks off the roads that run out of town
  blocked(x, y) {
    if (!G || noStructs()) return false;
    for (const st of structsNear(x, y)) {
      if (st.type !== 'village' && st.type !== 'town' && st.type !== 'ruinvillage') continue;
      if (onRoad(townPlan(st), x - st.x, y - st.y, 8)) return true;
    }
    return false;
  },
  ents(list) {
    if (!G || noStructs()) return;
    for (const st of structsNear(ME.x, ME.y)) if (st.built && !st.ruined && st.folk) for (const f of st.folk) if (onScreen(f.x, f.y, 20)) list.push(f);
  },
});
