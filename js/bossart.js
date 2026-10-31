'use strict';
/* Boss sprites. Every boss is a hand-built rig of outlined shapes, drawn each frame from its pose (see bossfx.js):
   arms rise, bodies crouch, jaws open and eyes charge as an attack winds up, then snap as it lands.
   Coordinates are in screen pixels relative to the boss's centre; feet sit at +foot. */

(() => {
  const OUT = '#0b0a12', WHITE = '#f2eee6';
  let g = ctx, OX = 0, OY = 0, flashing = false, snapping = false;
  const ri = Math.round, lerp = (a, b, k) => a + (b - a) * k;
  const T = c => (flashing && c !== OUT ? WHITE : c);

  /* ---------- Drawing kit ---------- */
  function R(x, y, w, h, c) { g.fillStyle = T(c); g.fillRect(ri(OX + x), ri(OY + y), Math.max(1, ri(w)), Math.max(1, ri(h))); }
  function B(x, y, w, h, c, hi) { R(x - 1, y - 1, w + 2, h + 2, OUT); R(x, y, w, h, c); if (hi) R(x, y, w, 1, hi); }
  function disc(x, y, r, c, sq = 1) {
    g.fillStyle = T(c);
    const ry = Math.max(1, ri(r * sq));
    for (let j = -ry; j <= ry; j++) { const w = ri(r * Math.sqrt(1 - (j / ry) ** 2)); g.fillRect(ri(OX + x - w), ri(OY + y + j), w * 2 + 1, 1); }
  }
  function D(x, y, r, c, sq = 1, hi) { disc(x, y, r + 1, OUT, sq); disc(x, y, r, c, sq); if (hi) disc(x - r * 0.3, y - r * 0.3 * sq, r * 0.55, hi, sq); }
  function line(x0, y0, x1, y1, w, c) {
    g.fillStyle = T(c);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), o = w / 2;
    for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(ri(OX + x0 + (x1 - x0) * t - o), ri(OY + y0 + (y1 - y0) * t - o), w, w); }
  }
  function L(x0, y0, x1, y1, w, c, hi) { line(x0, y0, x1, y1, w + 2, OUT); line(x0, y0, x1, y1, w, c); if (hi && w > 3) line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, w - 3, hi); }
  const alpha = a => { g.globalAlpha = a; };
  function tri(x0, y0, x1, y1, x2, y2, c) {
    g.fillStyle = T(c);
    const pts = [[x0, y0], [x1, y1], [x2, y2]];
    for (let y = ri(Math.min(y0, y1, y2)); y <= ri(Math.max(y0, y1, y2)); y++) {
      const xs = [];
      for (let i = 0; i < 3; i++) { const [xa, ya] = pts[i], [xb, yb] = pts[(i + 1) % 3]; if ((ya <= y && yb > y) || (yb <= y && ya > y)) xs.push(xa + (y - ya) / (yb - ya) * (xb - xa)); }
      if (xs.length > 1) { const a = Math.min(...xs), b = Math.max(...xs); g.fillRect(ri(OX + a), ri(OY + y), Math.max(1, ri(b - a)), 1); }
    }
  }

  // Arm from a shoulder: up 1 = fist overhead, 0 = hanging, negative = swung down and forward. Returns elbow and hand.
  function armPos(sx, sy, s, l1, l2, up) {
    const rest = Math.PI / 2 - 0.35, raised = -Math.PI / 2 + 0.3;
    const a = up >= 0 ? lerp(rest, raised, Math.min(up, 1.15)) : rest - up * 0.5;
    const ex = sx + s * Math.cos(a) * l1, ey = sy + Math.sin(a) * l1;
    const a2 = a + (up >= 0 ? -0.5 * (0.4 + up) : 0.35);
    return [ex, ey, ex + s * Math.cos(a2) * l2, ey + Math.sin(a2) * l2];
  }

  // Shared shell: position, shadow, facing, shudder while winding up, light
  function rig(b, now, o, fn) {
    const p = BossFx.poseOf(b), z = b.z || 0;
    flashing = b.flash > 0.05;
    OX = ri(b.x - camX); OY = ri(b.y - camY - z);
    if (!snapping) shadow(b.x, b.y + o.foot, o.sh * (1 - z / 220));
    g.save();
    if (b.dir < 0 && !o.sym) { g.translate(OX, 0); g.scale(-1, 1); g.translate(-OX, 0); }
    if (p.w > 0) OX += ri(rand(-1, 1) * p.w * (o.jit ?? 1));
    fn(p, now, b);
    g.restore();
    g.globalAlpha = 1;
    flashing = false;
    if (!snapping) {
      const ly = b.y - z + (o.ly ?? -10);
      light(b.x, ly, o.lr || 90, 0.8);
      glowAt(b.x, ly, o.gr || 34, b.def.color, 0.28 + p.glow * 0.4);
    }
  }

  /* ---------- Bone Colossus ---------- */
  function colossus(b, now) {
    rig(b, now, { foot: 26, sh: 58, ly: -16 }, p => {
      const bob = ri(Math.sin(now * 1.6)), sq = ri(p.sq * 6), hot = b.phase > 0;
      const bn = ['#5e557f', '#a59cc4', WHITE], gl = hot ? '#8ff0ff' : '#e8742c', pulse = 0.5 + Math.sin(now * 5) * 0.15 + p.glow * 0.4;
      for (const s of [-1, 1]) {
        B(s * 9 - 3, 9 + sq, 6, 12 - sq, bn[1], bn[2]); D(s * 9, 14 + sq, 3, bn[2]);
        B(s * 9 - 5, 21, 10, 5, bn[0], bn[1]);
      }
      B(-13, 3 + sq, 26, 8, bn[1], bn[2]); R(-2, 4 + sq, 4, 6, bn[0]);
      const top = -27 + bob + sq;
      B(-11, top, 22, 31, '#14121f');
      alpha(Math.min(1, pulse)); R(-9, top + 2, 18, 26, gl); alpha(1);
      B(-2, top, 4, 31, bn[0]);
      for (let i = 0; i < 5; i++) { const w = 12 - i, y = top + 2 + i * 5; B(-w - 1, y, w - 1, 3, bn[1], bn[2]); B(2, y, w - 1, 3, bn[1], bn[2]); }
      for (const s of [-1, 1]) {
        const shx = s * 16, shy = top + 3;
        const [ex, ey, hx, hy] = armPos(shx, shy, s, 13, 13, p.up);
        L(shx, shy, ex, ey, 6, bn[1], bn[2]); D(ex, ey, 3, bn[2]);
        L(ex, ey, hx, hy, 6, bn[1], bn[2]);
        D(hx, hy, 5, bn[1], 1, bn[2]);
        for (const k of [-1, 0, 1]) R(hx + k * 3 - 1, hy + 4, 2, 3, bn[0]);
        D(shx, shy, 5, bn[1], 0.9, bn[2]); R(shx - 3, shy - 1, 2, 2, OUT); R(shx + 1, shy - 1, 2, 2, OUT);
      }
      const hy = top - 9 + ri(p.open * -1);
      B(-2, top - 4, 4, 5, bn[0]);
      L(-7, hy - 4, -12, hy - 12, 3, bn[2]); L(7, hy - 4, 12, hy - 12, 3, bn[2]);
      D(0, hy, 8, bn[1], 0.92, bn[2]);
      B(-6, hy - 3, 5, 5, OUT); B(1, hy - 3, 5, 5, OUT);
      alpha(Math.min(1, 0.7 + p.glow)); R(-5, hy - 2, 3, 3, gl); R(2, hy - 2, 3, 3, gl); alpha(1);
      R(-1, hy + 2, 2, 2, OUT);
      const jo = ri(p.open * 5);
      B(-6, hy + 5 + jo, 12, 4, bn[1], bn[2]);
      for (const x of [-5, -2, 1, 4]) R(x, hy + 4, 2, 2, WHITE);
      if (p.open > 0.3) R(-5, hy + 6, 10, jo - 1, gl);
    });
  }

  /* ---------- The Rotting Mother ---------- */
  function mother(b, now) {
    rig(b, now, { foot: 24, sh: 66, ly: 0, lr: 100, sym: true }, p => {
      const wob = Math.sin(now * 3) * 2, Rr = 29 + wob + p.up * 5 - p.sq * 4 + p.s * -2, sq = ri(p.sq * 5);
      const skin = ['#1f4d33', '#2f6b3a', '#4fa04a', '#a6e05a'], tp = nearestPlayer(b.x, b.y), la = Math.atan2(tp.y - b.y, tp.x - b.x);
      // Tendrils: they lash up as she gathers herself, then come down
      for (let i = 0; i < 7; i++) {
        const base = i / 7 * TAU + 0.35, sgn = Math.cos(base) < 0 ? -1 : 1;
        let x = Math.cos(base) * Rr * 0.95, y = Math.sin(base) * Rr * 0.45 + 6;
        for (let k = 1; k <= 7; k++) {
          const nx = x + Math.cos(base) * 4 + Math.sin(now * 2.6 + k * 0.7 + i * 2) * 1.6 * (1 - p.up * 0.5) + sgn * -p.up * 0.4 * k;
          const ny = y + Math.sin(base) * 2.6 - p.up * (5.5 - k * 0.3) + 1.1 + p.s * 3;
          L(x, y, nx, ny, Math.max(2, 6 - k * 0.6), k % 2 ? skin[1] : skin[2]);
          x = nx; y = ny;
        }
        D(x, y, 2, skin[3]); R(x - 1, y + 1, 1, 2, WHITE); R(x + 1, y + 1, 1, 2, WHITE);
      }
      D(0, 7 + sq, Rr, skin[0], 0.7); D(-3, 3 + sq, Rr * 0.82, skin[1], 0.66, skin[2]); D(-8, -1 + sq, Rr * 0.42, skin[2], 0.6, skin[3]);
      for (const [x, y, r] of [[14, 4, 4], [-17, 8, 3], [9, 12, 3], [-5, -9, 3]]) { D(x, y + sq, r, skin[2], 0.8, skin[3]); R(x - 1, y + sq - 1, 1, 1, '#f2eee6'); }
      for (let i = 0; i < 10; i++) {
        const a = i * 2.39 + 0.5, rr = (i % 3) * 7 + 7, ex = Math.cos(a) * rr * 1.25, ey = Math.sin(a) * rr * 0.5 - 4 + sq;
        const blink = Math.floor(now * 2 + i * 1.7) % 7 === 0, open = 3 + p.glow * 1.5 + p.open;
        D(ex, ey, open, OUT, 0.8);
        if (blink) { R(ex - 2, ey, 5, 1, skin[0]); continue; }
        D(ex, ey, open - 1, WHITE, 0.8);
        R(ex + Math.cos(la) * 1.5 - 1, ey + Math.sin(la) * 0.9 - 1, 3, 3, b.phase || p.glow > 0.4 ? '#d8354a' : '#ffd35a'); R(ex + Math.cos(la) * 1.5, ey + Math.sin(la) * 0.9, 1, 1, OUT);
      }
      const mo = Math.abs(Math.sin(now * 1.5)) * 3 + p.open * 8;
      B(-11, 12 + sq, 22, 3 + mo, OUT);
      R(-9, 12 + sq, 18, 1, '#e8e0c4');
      for (let i = 0; i < 5; i++) R(-8 + i * 4, 15 + sq + mo - 1, 2, 2, '#e8e0c4');
      for (let i = 0; i < 4; i++) R(-7 + i * 5, 15 + sq + mo + ((now * 22 + i * 7) % 7), 1, 2, skin[3]);
      if (Math.random() < 0.18 && !snapping) addPart(b.x + rand(-Rr, Rr), b.y - 8, rand(-6, 6), rand(-22, -8), 1, '#a6e05a');
      if (b.lock > b.clock) { alpha(0.6); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; R(Math.cos(a) * (Rr + 6), Math.sin(a) * (Rr + 6) * 0.7 + 7, 1, 1, '#a6e05a'); } alpha(1); }
    });
  }

  /* ---------- The Ashen Maw ---------- */
  function maw(b, now) {
    rig(b, now, { foot: 30, sh: 52, ly: -6, lr: 110, gr: 42 }, p => {
      const hov = ri(Math.sin(now * 2.2) * 3), hy = hov - 4 - ri(p.open * 3), jo = p.open * 16, wind = b.phase;
      const hot = p.glow > 0.2 || p.open > 0.4;
      for (let k = 8; k >= 1; k--) {
        const x = -12 - k * 8, y = hy + 11 + Math.sin(now * 3 - k * 0.7) * 5 + k * 1.4, r = 13 - k * 1.1;
        D(x, y, r, k % 2 ? '#2a1020' : '#4a1626', 0.8, k % 2 ? null : '#7a1a2a');
        if (k % 2) R(x, y + r * 0.4, 2, 2, '#e8742c');
        if (!snapping && Math.random() < 0.03) addPart(b.x + x * b.dir, b.y + y, rand(-6, 6), rand(-24, -10), 0.8, pick(['#e8742c', '#5e557f']));
      }
      for (let i = 0; i < 8; i++) {
        const x = -16 + i * 4, h = 9 + Math.sin(now * 9 + i * 1.7) * 4 + p.glow * 8 + wind * 4;
        line(x, hy - 12, x + Math.sin(now * 5 + i) * 2, hy - 12 - h, 3, '#e8742c'); line(x, hy - 12, x + Math.sin(now * 5 + i) * 2, hy - 12 - h * 0.55, 1, '#ffd35a');
      }
      L(-6, hy - 12, -22, hy - 33, 5, '#36304f', '#5e557f'); L(3, hy - 13, -4, hy - 28, 4, '#36304f', '#5e557f'); R(-23, hy - 34, 2, 2, WHITE);
      D(-6, hy - 3, 14, '#5e1722', 0.85, '#7a1a2a');
      L(-2, hy + 3, 27, hy + 6 + jo, 7, '#5e1722', '#7a1a2a');
      for (let x = 6; x < 27; x += 5) R(x, hy + 3 + (x - 2) * (3 + jo) / 25, 2, -3, WHITE);
      if (jo > 2) for (let x = 3; x < 26; x++) { const top = hy + 1, bot = hy + 3 + (x + 2) * (3 + jo) / 29 - 2; R(x, top, 1, bot - top, hot ? '#ffd35a' : '#e8742c'); if (hot) R(x, top + 2, 1, Math.max(1, (bot - top) - 5), '#fff3b0'); }
      B(2, hy - 11, 25, 11, '#7a1a2a', '#d8354a'); B(26, hy - 10, 5, 5, '#5e1722'); R(28, hy - 8, 2, 2, OUT);
      for (const x of [10, 17, 24]) R(x, hy, 2, 4 + (x === 17), WHITE);
      B(3, hy - 14, 17, 4, '#36304f', '#5e557f');
      R(8, hy - 10, 8, 3, hot ? '#fff3b0' : '#ffd35a'); R(11, hy - 10, 2, 3, OUT);
      for (const [x1, y1, x2, y2] of [[-8, hy - 8, -2, hy - 2], [2, hy - 10, 8, hy - 6], [-12, hy, -6, hy + 4]]) line(x1, y1, x2, y2, 1, '#e8742c');
    });
  }

  /* ---------- The Frost Wyrm (follows its own trail) ---------- */
  function wyrm(b, now) {
    OX = 0; OY = 0; flashing = b.flash > 0.05;
    if (b.burrow > 0) {
      const [ex, ey] = b.emergeAt;
      for (let i = 0; i < 4; i++) addPart(ex + rand(-12, 12), ey + rand(-6, 6), rand(-24, 24), rand(-50, -12), 0.45, pick(['#c9f7ff', '#8ff0ff', '#f2eee6']));
      flashing = false; return;
    }
    const p = BossFx.poseOf(b), trail = b.trail || [], ox = camX, oy = camY;
    for (let i = trail.length - 1; i >= 6; i -= 6) {
      const x = trail[i][0] - ox, y = trail[i][1] - oy, k = 1 - i / ((b.segs || 14) * 6 + 6), r = ri(4 + k * 6);
      D(x, y, r, i % 12 ? '#3f8ee0' : '#1d3d7a', 0.85, '#8ff0ff');
      R(x - 3, y + r * 0.4, 6, 1, '#c9f7ff');
      line(x, y - r + 1, x + 1, y - r - 4, 1, '#c9f7ff'); line(x - 3, y - r + 2, x - 4, y - r - 2, 1, '#8ff0ff');
    }
    const a = trail.length > 6 ? Math.atan2(b.y - trail[6][1], b.x - trail[6][0]) : 0, hx = b.x - ox, hy = b.y - oy;
    const ux = Math.cos(a), uy = Math.sin(a) * 0.8, vx = -uy, vy = ux * 0.8, open = p.open + (b.lock > b.clock ? 0.3 : 0) + Math.abs(Math.sin(now * 4)) * 0.15;
    for (const s of [-1, 1]) { L(hx - ux * 3 + vx * s * 6, hy - uy * 3 + vy * s * 6, hx - ux * 13 + vx * s * 12, hy - uy * 13 + vy * s * 12, 3, '#8ff0ff', '#f2eee6'); }
    D(hx, hy, 11, '#1d3d7a', 0.8, '#3f8ee0');
    const jx = hx + ux * 19, jy = hy + uy * 19;
    L(hx + ux * 4 + vx * 3, hy + uy * 4 + vy * 3, jx - vx * open * 6, jy - vy * open * 6, 5, '#1d3d7a', '#3f8ee0');
    L(hx + ux * 4 - vx * 3, hy + uy * 4 - vy * 3, jx + vx * open * 8, jy + vy * open * 8, 4, '#0f2350', '#1d3d7a');
    if (open > 0.4) { D(hx + ux * 12, hy + uy * 12, 3 + open * 2, p.s > 0 ? '#fff' : '#8ff0ff', 0.9); }
    for (const s of [-1, 1]) { R(hx + ux * 5 + vx * s * 4 - 1, hy + uy * 5 + vy * s * 4 - 1, 3, 3, p.glow > 0.3 || p.s > 0 ? '#fff' : '#c9f7ff'); }
    if (p.s > 0.2 && !snapping) for (let i = 0; i < 3; i++) addPart(b.x + Math.cos(a) * 18, b.y + Math.sin(a) * 14, Math.cos(a) * rand(60, 150) + rand(-20, 20), Math.sin(a) * rand(40, 100) + rand(-20, 20), 0.5, pick(['#c9f7ff', '#8ff0ff', '#f2eee6']), 2, 0, 3);
    light(b.x, b.y, 70, 0.8); glowAt(b.x, b.y, 24, '#8ff0ff', 0.35 + p.glow * 0.3);
    flashing = false;
  }

  /* ---------- The Cinder Titan ---------- */
  function titan(b, now) {
    rig(b, now, { foot: 30, sh: 66, ly: -12, lr: 110, gr: 44, sym: true }, p => {
      const bob = ri(Math.sin(now * 1.4)), sq = ri(p.sq * 7), heat = b.lock > b.clock || p.glow > 0.4 ? '#fff3b0' : b.phase ? '#ffd35a' : '#e8742c', rock = ['#1c1a2b', '#2a2538', '#36304f', '#5e557f'];
      const pulse = 0.65 + Math.sin(now * 4) * 0.2 + p.glow * 0.4 + p.s * 0.3, step = Math.sin(now * 2) * 2;
      for (const s of [-1, 1]) {
        const lift = p.name === 'stomp' && s > 0 ? ri(p.up * -6) : 0;
        B(s * 12 - 6, 6 + sq + lift, 12, 16 - sq, rock[1], rock[2]); B(s * 12 - 8, 21 + lift, 16, 9, rock[2], rock[3]);
        R(s * 12 - 2, 8 + sq + lift, 2, 11 - sq, heat);
      }
      const ty = -28 + bob + sq;
      B(-20, ty, 40, 36, rock[2], rock[3]); B(-14, ty + 28, 28, 8, rock[1]);
      for (const [x, y, w, h] of [[-17, ty + 4, 10, 8], [7, ty + 4, 10, 8], [-16, ty + 20, 12, 6], [5, ty + 20, 12, 6]]) B(x, y, w, h, rock[1], rock[3]);
      alpha(Math.min(1, pulse)); D(0, ty + 15, 7, heat, 0.95); alpha(1);
      D(0, ty + 15, 3, '#fff3b0');
      for (const [x1, y1, x2, y2] of [[0, ty + 8, -6, ty + 1], [-6, ty + 1, -9, ty - 1], [0, ty + 22, 7, ty + 31], [7, ty + 31, 5, ty + 35], [8, ty + 15, 16, ty + 12], [-8, ty + 15, -17, ty + 19]]) line(x1, y1, x2, y2, 2, heat);
      for (const s of [-1, 1]) {
        const shx = s * 24, shy = ty + 5;
        const [ex, ey, hx, hy] = armPos(shx, shy, s, 15, 15, p.up);
        L(shx, shy, ex, ey, 9, rock[2], rock[3]); D(ex, ey, 5, rock[1], 1, rock[2]); L(ex, ey, hx, hy, 10, rock[2], rock[3]);
        D(hx, hy, 8, rock[1], 0.95, rock[2]); line(hx - 5, hy + 3, hx + 1, hy - 4, 2, heat); line(hx + 1, hy - 4, hx + 5, hy - 1, 1, heat);
        D(shx, shy, 8, rock[2], 0.9, rock[3]); R(shx - 3, shy - 4, 6, 2, heat);
        if (!snapping && Math.random() < 0.05) addPart(b.x + s * 24 * b.dir, b.y + shy, rand(-6, 6), rand(-40, -15), 0.6, pick(['#ffd35a', '#e8742c']));
      }
      B(-9, ty - 14, 18, 15, rock[2], rock[3]); B(-6, ty - 8, 12, 5, OUT);
      R(-5, ty - 7, 4, 3, heat); R(1, ty - 7, 4, 3, heat);
      for (let i = 0; i < 5; i++) { const x = -8 + i * 4, h = 8 + Math.sin(now * 9 + i * 1.3) * 3 + p.glow * 5; line(x, ty - 14, x, ty - 14 - h, 3, '#e8742c'); line(x, ty - 14, x, ty - 14 - h * 0.55, 1, '#ffd35a'); }
      if (!snapping && Math.random() < 0.35) addPart(b.x + rand(-16, 16), b.y - 20, rand(-6, 6), rand(-40, -15), 0.7, pick(['#ffd35a', '#e8742c']));
    });
  }

  /* ---------- The Watcher ---------- */
  function watcher(b, now) {
    const fade = b.blinkT > 0 ? Math.abs(Math.cos(b.blinkT * 6)) : 1;
    rig(b, now, { foot: 20, sh: 56, ly: -10, lr: 110, gr: 42, sym: true, jit: 1.2 }, p => {
      alpha(fade);
      const hv = ri(Math.sin(now * 1.8) * 2), tp = nearestPlayer(b.x, b.y), la = Math.atan2(tp.y - b.y, tp.x - b.x), eyeR = 22 + p.up * 2;
      for (let i = 0; i < 9; i++) {
        const base = i / 9 * TAU + now * 0.35;
        let x = Math.cos(base) * 21, y = Math.sin(base) * 15 + hv;
        for (let s = 1; s < 10; s++) {
          const a = base + Math.sin(now * 2 + i + s * 0.6) * 0.5 + p.up * 0.15 * s;
          const nx = x + Math.cos(a) * 5, ny = y + Math.sin(a) * 4 - p.up * 1.5;
          L(x, y, nx, ny, Math.max(2, 5 - (s >> 1)), s % 2 ? '#4a2470' : '#9a4fd0');
          if (s % 3 === 0) R(nx, ny + 1, 1, 1, '#e27bf0');
          x = nx; y = ny;
        }
        D(x, y, 2, '#f2eee6'); R(x, y, 1, 1, '#d8354a');
      }
      D(0, hv, eyeR, '#f2eee6', 0.95);
      for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.2; line(Math.cos(a) * 20, hv + Math.sin(a) * 19, Math.cos(a) * (11 - (i % 3)), hv + Math.sin(a) * (10 - (i % 3)), 1, '#d8354a'); }
      const ix = Math.cos(la) * 7, iy = hv + Math.sin(la) * 6, charged = p.glow;
      D(ix, iy, 9 + charged * 2, '#9a4fd0', 1, '#e27bf0'); D(ix, iy, 6, '#e27bf0', 1);
      alpha(fade * (0.4 + charged * 0.6)); disc(ix, iy, 5 + charged * 4, '#fff3fd', 1); alpha(fade);
      const pr = b.lock > b.clock ? 1.5 : 3.5 - charged * 1.5;
      disc(ix, iy, pr, OUT, 1.5); R(ix - 3, iy - 3, 2, 2, WHITE);
      const lid = clamp(0.15 + p.open * 0.5 + (p.name && p.w > 0 ? p.w * 0.25 : 0), 0, 0.7);
      if (lid > 0.1) { for (let j = 0; j < eyeR * 2 * lid; j++) { const yy = -eyeR * 0.95 + j, ww = ri(eyeR * Math.sqrt(Math.max(0, 1 - (yy / (eyeR * 0.95)) ** 2))); R(-ww, hv + yy, ww * 2 + 1, 1, '#2a1448'); } R(-eyeR * 0.8, hv - eyeR * 0.95 + eyeR * 2 * lid, eyeR * 1.6, 1, '#9a4fd0'); }
      for (let i = 0; i < 3; i++) { const a = now * 0.9 + i * TAU / 3, x = Math.cos(a) * 36, y = Math.sin(a) * 14 + hv - 6; L(x, y - 4, x + 3, y, 3, '#9a4fd0'); L(x + 3, y, x, y + 4, 3, '#4a2470'); R(x, y, 1, 1, '#fff3fd'); }
      alpha(1);
    });
  }

  /* ---------- The Leviathan ---------- */
  function leviathan(b, now) {
    OX = ri(b.x - camX); OY = ri(b.y - camY);
    flashing = b.flash > 0.05;
    const p = BossFx.poseOf(b), up = clamp((b.surf ?? 1) + p.up * 0.3, 0.2, 1.4);
    for (let i = 0; i < 3; i++) { const rr = 26 + i * 7 + Math.sin(now * 3 + i) * 2; for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; R(Math.cos(a) * rr, 8 + Math.sin(a) * rr * 0.5, 1, 1, i ? '#3f8ee0' : '#c9f7ff'); } }
    const h = ri(30 * up), jo = ri(p.open * 8), glow = p.glow > 0.3 || p.s > 0.3;
    g.save(); g.beginPath(); g.rect(OX - 56, OY - 90, 112, 100); g.clip();
    for (let i = -3; i <= 3; i++) {
      const tx = i * 11, ty = -30 - h + Math.abs(i) * 4 - (i === 0) * 6;
      tri(i * 5, -4 - h, tx - 4, ty + 10, tx + 4, ty + 10, '#10294f'); L(i * 5, -2 - h, tx, ty, 4, '#1d3d7a', '#3f8ee0'); R(tx - 1, ty - 1, 2, 2, '#8ff0ff');
    }
    D(0, 6 - h, 23, '#0f2a55', 0.88, '#1d3d7a');
    for (const [x, y] of [[-14, -4], [-8, -8], [8, -7], [14, -3], [-17, 3], [17, 4], [-3, -11], [4, -12]]) R(x, y - h, 2, 1, '#3f8ee0');
    for (const [x, y] of [[-19, 2], [-16, 5], [19, 2], [16, 5]]) R(x, y - h, 1, 1, '#8ff0ff');
    B(-19, -9 - h, 38, 4, '#0f2a55', '#3f8ee0');
    for (const s2 of [-1, 1]) { D(s2 * 11, -2 - h, 4, glow ? '#fff3b0' : '#ffd35a'); R(s2 * 11, -5 - h, 1, 7, OUT); if (glow) { alpha(0.5); disc(s2 * 11, -2 - h, 8, '#ffd35a'); alpha(1); } }
    B(-18, 9 - h, 36, 4 + jo, OUT);
    if (jo > 2) R(-16, 13 - h, 32, jo - 1, glow ? '#fff3b0' : '#8ff0ff');
    for (let i = 0; i < 9; i++) { const x = -16 + i * 4; R(x, 9 - h, 2, 3 + (i % 2), WHITE); R(x + 1, 13 - h + jo - 2, 2, 3, WHITE); }
    for (const s2 of [-1, 1]) { let px = s2 * 9, py = 14 - h + jo; for (let k = 1; k <= 5; k++) { const nx = s2 * (9 + k * 2.5) + Math.sin(now * 3 + k) * 2, ny = py + 4; L(px, py, nx, ny, 2, '#3f8ee0'); px = nx; py = ny; } R(px, py, 2, 2, '#8ff0ff'); }
    g.restore();
    for (const t of b.tentacles || []) {
      const tx = t.x - camX - OX, ty = t.y - camY - OY, rise = Math.min(1, t.t / 0.5);
      for (let s = 0; s < 11; s++) {
        const k = s / 11, a = t.ang + Math.sin(now * 3 + s * 0.6) * 0.25 * (1 - rise * 0.5);
        const x = tx + Math.cos(a) * s * 6 * rise, y = ty + Math.sin(a) * s * 4 * rise - Math.sin(k * Math.PI) * 18 * rise;
        D(x, y, Math.max(2, 7 - s * 0.5), s % 2 ? '#1d3d7a' : '#3f8ee0', 1);
        if (s % 3 === 1) R(x - 1, y + 2, 2, 1, '#c9f7ff');
      }
    }
    if (!snapping && Math.random() < 0.3) addPart(b.x + rand(-26, 26), b.y + 8, rand(-10, 10), rand(-50, -20), 0.5, pick(['#c9f7ff', '#8ff0ff']), 1, 90, 2);
    light(b.x, b.y - 10, 90, 0.8); glowAt(b.x, b.y, 30, '#3f8ee0', 0.3 + p.glow * 0.3);
    flashing = false;
  }

  /* ---------- The Eclipse Herald ---------- */
  function herald(b, now) {
    rig(b, now, { foot: 30, sh: 40, ly: -30, lr: 100, gr: 38, sym: true }, p => {
      const hov = ri(Math.sin(now * 2) * 3) - 10, sq = ri(p.sq * 4), flap = Math.sin(now * 4) * 0.25 + p.up * 0.5 - p.s * 0.4;
      // the black sun behind its head
      const sy = hov - 9;
      for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + now * 0.5, l = 19 + (i % 2) * 8 + p.glow * 12 + Math.sin(now * 6 + i) * 2; line(Math.cos(a) * 15, sy + Math.sin(a) * 15, Math.cos(a) * l, sy + Math.sin(a) * l, 1, i % 2 ? '#fff3b0' : '#ffd35a'); }
      disc(0, sy, 16, '#ffd35a', 1); disc(0, sy, 14, OUT, 1);
      alpha(0.5 + p.glow * 0.5); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; R(Math.cos(a) * 12, sy + Math.sin(a) * 12, 1, 1, '#fff3b0'); } alpha(1);
      for (const s of [-1, 1]) for (let f = 6; f >= 0; f--) {
        const a = -Math.PI / 2 + (0.35 + f * 0.27 + flap * (f / 7)) * s, len = 30 + f * 5 - (f > 4 ? 6 : 0), x0 = s * 5, y0 = hov - 2;
        const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len * 0.85 + f * 3;
        L(x0, y0, x1, y1, 6 - (f > 4), f % 2 ? '#1c1a2b' : '#2a2538', '#4a2470'); line(x0, y0, x1, y1, 1, '#9a4fd0');
        if (f > 2) R(x1, y1, 2, 2, '#e27bf0');
      }
      for (let r = 0; r < 12; r++) { const w = 4 + r * 0.9 + Math.sin(now * 3 + r) * 0.6, y = hov + r * 2.7 + sq; R(-w, y, w * 2, 3, r % 2 ? '#1c1a2b' : '#2a2538'); }
      for (let i = -3; i <= 3; i++) { const l = 6 + (i & 1) * 4 + Math.sin(now * 4 + i) * 2; L(i * 2.6, hov + 32 + sq, i * 2.6 + Math.sin(now * 3 + i) * 2, hov + 32 + l + sq, 2, '#1c1a2b'); }
      for (const s of [-1, 1]) {
        const [ex, ey, hx, hy] = armPos(s * 5, hov - 3, s, 9, 9, p.up * 0.9);
        L(s * 5, hov - 3, ex, ey, 3, '#2a2538'); L(ex, ey, hx, hy, 3, '#2a2538');
        for (const k of [-1, 0, 1]) line(hx, hy, hx + s * 3 + k * 1.5, hy - 5 - p.up * 2, 1, WHITE);
        if (p.glow > 0.2) { alpha(p.glow); disc(hx, hy - 3, 4, '#e27bf0', 1); alpha(1); }
      }
      B(-5, hov - 13, 10, 11, '#f2eee6', '#fff'); R(-3, hov - 9, 2, 2, '#e27bf0'); R(1, hov - 9, 2, 2, '#e27bf0'); R(-1, hov - 5, 2, 3, OUT);
      if (!snapping && Math.random() < 0.08) addPart(b.x + rand(-30, 30), b.y + hov - 10, rand(-5, 5), rand(10, 30), 1, '#1c1a2b', 2);
    });
  }

  /* ---------- The Gravekeeper ---------- */
  function gravekeeper(b, now) {
    rig(b, now, { foot: 18, sh: 30, ly: -6, lr: 70, gr: 28 }, p => {
      const bob = ri(Math.sin(now * 3)), sq = ri(p.sq * 4), cloth = ['#14121f', '#1c1a2b', '#36304f'], wood = '#9a6a42';
      for (const s of [-1, 1]) B(s * 4 - 2, 10, 4, 7 - (s > 0 && b.moving ? 1 : 0), cloth[1]);
      for (let r = 0; r < 14; r++) { const w = 7 + r * 0.55 + (r > 10 ? Math.sin(now * 4 + r) : 0); R(-w, -10 + r + bob + sq, w * 2, 1, cloth[r % 3 ? 1 : 0]); }
      R(-7, -10 + bob + sq, 14, 1, cloth[2]);
      B(-5, 0 + bob + sq, 10, 2, '#5a3a28'); R(-1, 0 + bob + sq, 2, 2, '#ffd35a');
      // lantern arm swings out when casting
      const lx = -11 - p.glow * 3, ly = 2 + bob + sq + Math.sin(now * 2) * 1.5 + p.up * -4;
      L(-6, -7 + bob + sq, lx, ly - 3, 2, cloth[2]); line(lx, ly - 6, lx, ly - 3, 1, '#b5b2c4');
      B(lx - 3, ly - 3, 6, 8, '#5a3a28'); alpha(0.85); R(lx - 2, ly - 2, 4, 6, '#a6e05a'); alpha(1); R(lx - 1, ly - 1, 2, 3, '#f2eee6');
      glowAt(b.x + lx * b.dir, b.y + ly, 22 + p.glow * 14, '#a6e05a', 0.5);
      // shovel in the right hand: overhead as it winds up, driven into the ground on the strike
      const hx = 8, hy = -4 + bob + sq, ang = lerp(-0.5, -2.35, clamp(p.up, 0, 1.1)) + (p.up < 0 ? -p.up * 1.9 : 0);
      const tx = hx + Math.cos(ang) * 22, ty = hy + Math.sin(ang) * 22;
      L(hx, hy, tx, ty, 2, wood, '#b98a58');
      const bx = tx + Math.cos(ang) * 6, by = ty + Math.sin(ang) * 6;
      L(tx, ty, bx, by, 5, '#b5b2c4', WHITE); R(hx - 1, hy - 1, 3, 3, '#e8b48e');
      B(-6, -22 + bob + sq, 12, 12, '#e8e2d0', WHITE); R(-4, -18 + bob + sq, 3, 3, OUT); R(1, -18 + bob + sq, 3, 3, OUT);
      R(-3, -17 + bob + sq, 2, 1, '#a6e05a'); R(2, -17 + bob + sq, 2, 1, '#a6e05a'); R(-3, -12 + bob + sq, 6, 1, OUT);
      B(-10, -25 + bob + sq, 20, 3, cloth[0], cloth[2]); B(-6, -34 + bob + sq, 12, 10, cloth[0], cloth[2]); R(-6, -27 + bob + sq, 12, 2, '#7a1a2a');
      if (!snapping && Math.random() < 0.06) addPart(b.x + rand(-10, 10), b.y - 20, rand(-5, 5), rand(-26, -10), 0.9, '#a6e05a');
    });
  }

  /* ---------- Bandit Chief ---------- */
  function chief(b, now) {
    rig(b, now, { foot: 18, sh: 32, ly: -6, lr: 70, gr: 28 }, p => {
      const bob = ri(Math.sin(now * 4)), sq = ri(p.sq * 5), lean = ri(p.sq * -3);
      for (const s of [-1, 1]) { B(s * 4 - 2, 9 + sq, 4, 8 - sq, '#3a2418'); B(s * 4 - 3, 15, 6, 3, '#1c1a2b'); }
      // cape
      for (let r = 0; r < 14; r++) R(-9 - r * 0.2 - Math.sin(now * 3 + r * 0.4) * 1.5 - 3, -9 + r + sq, 5, 1, r % 2 ? '#7a1a2a' : '#5e1722');
      B(-7, -11 + bob + sq, 15, 21 - sq, '#5a3a28', '#9a6a42');
      B(-8, -4 + bob + sq, 16, 3, '#2a1c14'); R(-2, -4 + bob + sq, 4, 3, '#ffd35a');
      B(-9, -13 + bob + sq, 18, 6, '#9a6a42', '#c79a62'); for (let i = 0; i < 6; i++) R(-8 + i * 3, -8 + bob + sq, 1, 2, '#6d4a2c');
      // off hand: a fist on the hip, or a knife held back when throwing
      L(-7, -10 + bob + sq, -12 - p.up * 2, -2 + bob + sq - p.up * 4, 4, '#e8b48e'); D(-12 - p.up * 2, -1 + bob + sq - p.up * 4, 2, '#e8b48e');
      // scimitar arm
      const hx = 9, hy = -8 + bob + sq, ang = lerp(0.3, -2.2, clamp(p.up, 0, 1.1)) + (p.up < 0 ? -p.up * 1.6 : 0);
      L(hx - 1, hy, hx + Math.cos(ang) * 7, hy + Math.sin(ang) * 7, 4, '#e8b48e');
      const px = hx + Math.cos(ang) * 8, py = hy + Math.sin(ang) * 8;
      for (let i = 0; i < 18; i++) { const k = i / 18, aa = ang - 0.3 * k * k * 3, xx = px + Math.cos(aa) * i * 1.4, yy = py + Math.sin(aa) * i * 1.4; R(xx - 1, yy - 1, 3, 3, OUT); }
      for (let i = 0; i < 18; i++) { const k = i / 18, aa = ang - 0.3 * k * k * 3, xx = px + Math.cos(aa) * i * 1.4, yy = py + Math.sin(aa) * i * 1.4; R(xx, yy, 2, 2, i > 14 ? WHITE : '#b5b2c4'); }
      R(px - 2, py - 2, 4, 4, '#ffd35a');
      B(-5, -23 + bob + sq + lean, 11, 11, '#e8b48e', '#f5c9a6'); R(-3, -18 + bob + sq + lean, 2, 2, OUT); R(1, -18 + bob + sq + lean, 2, 2, OUT); R(-4, -15 + bob + sq + lean, 8, 1, '#7a4a30');
      R(-3, -17 + bob + sq + lean, 1, 1, '#d8354a');
      B(-6, -25 + bob + sq + lean, 13, 4, '#d8354a', '#ff6a6a'); for (let i = 0; i < 3; i++) L(7, -23 + bob + sq + lean + i, 11 + i * 2, -21 + bob + sq + lean + i * 2 + Math.sin(now * 5) , 1, '#d8354a');
    });
  }

  /* ---------- Village Brute ---------- */
  function brute(b, now) {
    rig(b, now, { foot: 20, sh: 44, ly: -8, lr: 76, gr: 30 }, p => {
      const bob = ri(Math.sin(now * 2.4)), sq = ri(p.sq * 5), skin = ['#4a5a3a', '#6d7f4f', '#8a9d63'], hide = '#5a3a28';
      for (const s of [-1, 1]) { B(s * 7 - 4, 8 + sq, 8, 10 - sq, skin[0]); B(s * 7 - 5, 17, 10, 4, '#2a1c14'); }
      B(-12, -8 + bob + sq, 24, 20 - sq, skin[1], skin[2]);
      B(-14, 3 + bob + sq, 28, 4, hide, '#7a5238'); R(-3, 3 + bob + sq, 6, 4, '#b5b2c4');
      for (let i = 0; i < 4; i++) R(-9 + i * 6, -6 + bob + sq, 3, 1, skin[0]);
      B(-9, 8 + sq, 18, 8, '#7a1a2a', '#9a2a3a');
      // arms and club
      const cs = 1;
      const shx = 13, shy = -6 + bob + sq, [ex, ey, hx, hy] = armPos(shx, shy, 1, 9, 9, p.up);
      L(shx, shy, ex, ey, 7, skin[1], skin[2]); L(ex, ey, hx, hy, 7, skin[1], skin[2]); D(hx, hy, 4, skin[2]);
      const ca = lerp(-0.4, -2.3, clamp(p.up, 0, 1.1)) + (p.up < 0 ? -p.up * 1.9 : 0);
      const tx = hx + Math.cos(ca) * 26, ty = hy + Math.sin(ca) * 26;
      L(hx, hy, tx, ty, 5, '#6d4a2c', '#9a6a42');
      L(hx + Math.cos(ca) * 14, hy + Math.sin(ca) * 14, tx, ty, 9, '#7a5238', '#9a6a42');
      for (let k = 0; k < 5; k++) { const q = 14 + k * 3, sx2 = hx + Math.cos(ca) * q, sy2 = hy + Math.sin(ca) * q; R(sx2 - 1 + Math.cos(ca + 1.57) * 4, sy2 - 1 + Math.sin(ca + 1.57) * 4, 2, 2, '#b5b2c4'); R(sx2 - 1 - Math.cos(ca + 1.57) * 4, sy2 - 1 - Math.sin(ca + 1.57) * 4, 2, 2, '#b5b2c4'); }
      const [fx, fy, fhx, fhy] = armPos(-shx, shy, -1, 9, 9, p.up * 0.4);
      L(-shx, shy, fx, fy, 7, skin[1], skin[2]); L(fx, fy, fhx, fhy, 7, skin[1], skin[2]); D(fhx, fhy, 4, skin[2]);
      const hdy = -15 + bob + sq + ri(p.open * -2);
      B(-6, hdy, 12, 10, skin[1], skin[2]); B(-8, hdy + 2, 3, 4, skin[0]); B(5, hdy + 2, 3, 4, skin[0]);
      R(-4, hdy + 3, 3, 2, '#ffd35a'); R(1, hdy + 3, 3, 2, '#ffd35a'); R(-3, hdy + 3, 1, 2, OUT); R(2, hdy + 3, 1, 2, OUT);
      R(-5, hdy + 7, 10, 2, OUT); R(-5, hdy + 6, 2, 3, WHITE); R(3, hdy + 6, 2, 3, WHITE);
      R(-6, hdy - 2, 12, 3, '#3a2418');
    });
  }

  /* ---------- The Fallen Champion ---------- */
  function champion(b, now) {
    rig(b, now, { foot: 20, sh: 36, ly: -10, lr: 80, gr: 32 }, p => {
      const bob = ri(Math.sin(now * 2.6)), sq = ri(p.sq * 5), ar = ['#1c1a2b', '#36304f', '#5e557f'], tr = '#e27bf0';
      for (let r = 0; r < 20; r++) { const wave = Math.sin(now * 3 + r * 0.4) * (1 + r * 0.12); R(-14 - r * 0.15 + wave, -12 + r + sq, 7, 1, r % 2 ? '#4a2470' : '#2a1448'); }
      for (const s of [-1, 1]) { B(s * 5 - 3, 10 + sq, 6, 9 - sq, ar[1], ar[2]); B(s * 5 - 4, 17, 8, 4, ar[0]); }
      B(-9, -10 + bob + sq, 18, 22 - sq, ar[1], ar[2]); B(-9, 6 + bob + sq, 18, 3, ar[0]); R(-1, -8 + bob + sq, 2, 15, tr);
      alpha(0.7 + p.glow * 0.3); R(-3, -3 + bob + sq, 6, 1, tr); alpha(1);
      for (const s of [-1, 1]) { D(s * 11, -10 + bob + sq, 5, ar[1], 0.85, ar[2]); for (const k of [-1, 0, 1]) L(s * 11 + k * 3, -13 + bob + sq, s * 11 + k * 4, -18 + bob + sq - (k === 0) * 2, 2, ar[2]); }
      // off arm
      L(-9, -8 + bob + sq, -12, 2 + bob + sq - p.up * 6, 4, ar[1]); D(-12, 3 + bob + sq - p.up * 6, 2, ar[2]);
      // greatsword: point-down at rest, overhead when winding up, swung down on the strike
      const hx = 12, hy = -2 + bob + sq, ang = lerp(1.2, -2.0, clamp(p.up, 0, 1.1)) + (p.up < 0 ? -p.up * 1.0 : 0);
      L(-9, -8 + bob + sq, hx, hy, 4, ar[2]); D(hx, hy, 3, ar[2]);
      const bx = hx + Math.cos(ang) * 28, by = hy + Math.sin(ang) * 28;
      L(hx - Math.cos(ang) * 5, hy - Math.sin(ang) * 5, hx, hy, 3, '#5a3a28');
      line(hx - Math.sin(ang) * 6, hy + Math.cos(ang) * 6, hx + Math.sin(ang) * 6, hy - Math.cos(ang) * 6, 3, OUT); line(hx - Math.sin(ang) * 5, hy + Math.cos(ang) * 5, hx + Math.sin(ang) * 5, hy - Math.cos(ang) * 5, 1, ar[2]);
      L(hx, hy, bx, by, 5, '#b5b2c4', WHITE); line(hx, hy, bx, by, 1, tr); line(bx, by, bx + Math.cos(ang) * 4, by + Math.sin(ang) * 4, 2, WHITE);
      alpha(0.4 + p.glow * 0.4 + p.s * 0.3); line(hx, hy, bx, by, 7, tr); alpha(1);
      B(-6, -22 + bob + sq, 12, 13, ar[1], ar[2]); R(-5, -17 + bob + sq, 10, 2, OUT); R(-4, -17 + bob + sq, 3, 2, tr); R(1, -17 + bob + sq, 3, 2, tr);
      for (let i = 0; i < 6; i++) { const h = 8 + Math.sin(now * 8 + i * 1.4) * 3 + p.glow * 6; line(-5 + i * 2, -22 + bob + sq, -5 + i * 2 - 3 - i * 0.5, -22 + bob + sq - h, 3, i % 2 ? '#e27bf0' : '#9a4fd0'); }
      if (!snapping && Math.random() < 0.12) addPart(b.x + rand(-6, 6) * b.dir, b.y - 30, rand(-6, 6), rand(-30, -12), 0.6, pick(['#e27bf0', '#9a4fd0']));
    });
  }

  /* ---------- The Archfiend ---------- */
  function archfiend(b, now) {
    rig(b, now, { foot: 34, sh: 64, ly: -16, lr: 120, gr: 48, sym: true }, p => {
      const bob = ri(Math.sin(now * 2)), sq = ri(p.sq * 6), flap = Math.sin(now * 3.4) * 0.22 + p.up * 0.6 - p.s * 0.5, red = ['#4a0f1a', '#7a1a2a', '#d8354a', '#ff6a3c'];
      for (const s of [-1, 1]) {
        const sx = s * 10, sy = -22 + bob + sq;
        const tips = [[30, -40], [44, -26], [48, -6], [40, 14]].map(([x, y]) => [s * (x + flap * 16 * (1 + y / -40)), sy + y - flap * 22]);
        for (let i = 0; i < tips.length - 1; i++) {
          const mx = (tips[i][0] + tips[i + 1][0]) / 2 - s * 5, my = (tips[i][1] + tips[i + 1][1]) / 2 + 5;
          tri(sx, sy + 8, tips[i][0], tips[i][1], mx, my, i % 2 ? '#4a0f1a' : '#5e1323'); tri(sx, sy + 8, mx, my, tips[i + 1][0], tips[i + 1][1], i % 2 ? '#5e1323' : '#4a0f1a');
        }
        tri(sx, sy + 8, tips[0][0], tips[0][1], sx, sy - 4, '#4a0f1a');
        for (const [tx, ty] of tips) { L(sx, sy, tx, ty, 3, '#36304f', '#5e557f'); L(tx, ty, tx - s * 1, ty - 4, 2, WHITE); }
      }
      for (const s of [-1, 1]) {
        const tx = s * 7 - s * ri(p.sq * 2) * 0, kn = 8 + sq / 2;
        L(s * 6, 8 + sq, s * 10, 20 + sq / 2, 7, red[1], red[2]); L(s * 10, 20 + sq / 2, s * 7, 30, 5, red[0], red[1]); B(s * 7 - 4, 30, 8, 4, '#0b0a12');
      }
      B(-12, -26 + bob + sq, 24, 36 - sq, red[1], red[2]);
      for (const [x, y, w, h] of [[-9, -22, 8, 9], [1, -22, 8, 9], [-8, -11, 16, 6]]) { B(x, y + bob + sq, w, h, red[2], red[3]); }
      alpha(0.7 + p.glow * 0.3 + Math.sin(now * 4) * 0.1); D(0, -9 + bob + sq, 4 + p.glow * 2, '#ffd35a', 1); disc(0, -9 + bob + sq, 2, '#fff3b0', 1); alpha(1);
      for (const s of [-1, 1]) {
        const shx = s * 15, shy = -21 + bob + sq, [ex, ey, hx, hy] = armPos(shx, shy, s, 12, 12, p.up);
        D(shx, shy, 6, red[2], 0.9, red[3]);
        L(shx, shy, ex, ey, 6, red[1], red[2]); L(ex, ey, hx, hy, 5, red[1], red[2]);
        for (const k of [-1, 0, 1]) L(hx, hy, hx + s * 2 + k * 3, hy - 4 + (p.up < 0 ? 8 : 0), 2, '#f2eee6');
        if (p.glow > 0.2) { alpha(p.glow * 0.8); disc(hx, hy - 2, 6, '#ffd35a', 1); alpha(1); }
      }
      L(-6, 8 + sq, -20, 18 + Math.sin(now * 4) * 4, 3, red[1]); L(-20, 18 + Math.sin(now * 4) * 4, -26, 12 + Math.sin(now * 4) * 5, 3, red[2]); R(-28, 9 + Math.sin(now * 4) * 5, 4, 4, '#ffd35a');
      const hy = -37 + bob + sq + ri(p.open * -2);
      for (const s of [-1, 1]) { L(s * 5, hy - 4, s * 13, hy - 14, 4, '#36304f', '#5e557f'); L(s * 13, hy - 14, s * 11, hy - 24, 3, '#f2eee6'); }
      B(-7, hy - 6, 14, 14, red[1], red[2]); R(-5, hy - 2, 4, 2, '#ffd35a'); R(1, hy - 2, 4, 2, '#ffd35a'); R(-4, hy - 2, 1, 2, OUT); R(2, hy - 2, 1, 2, OUT);
      const jo = ri(p.open * 5);
      B(-5, hy + 3, 10, 3 + jo, OUT); for (const x of [-4, -1, 2]) R(x, hy + 3, 2, 2, WHITE); if (jo > 2) R(-4, hy + 5, 8, jo - 1, '#ffd35a');
      if (!snapping && Math.random() < 0.2) addPart(b.x + rand(-12, 12), b.y - 10, rand(-8, 8), rand(-44, -18), 0.7, pick(['#ffd35a', '#e8742c', '#d8354a']));
    });
  }

  /* ---------- Registering ---------- */
  // Renders a rig into a small sprite once, so the death burst and the netcode have real frames to work with
  function snap(fn, id, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const keep = [g, camX, camY, snapping, OX, OY];
    g = c.getContext('2d'); camX = 0; camY = 0; snapping = true;
    const def = BOSS_DEFS[id];
    try { fn({ x: w / 2, y: h / 2, dir: 1, flash: 0, phase: 0, lock: 0, clock: 0, def, r: def.r, id: 0, trail: [], tentacles: [], segs: 14 }, 0.4); }
    finally { [g, camX, camY, snapping, OX, OY] = keep; }
    return { c, w, h, sil: {} };
  }
  const RIGS = {
    colossus: [colossus, 100, 28, 80], mother: [mother, 100, 30, 80], maw: [maw, 110, 36, 90], wyrm: [wyrm, 60, 18, 46], titan: [titan, 110, 34, 90],
    watcher: [watcher, 100, 28, 84], leviathan: [leviathan, 100, 30, 70], herald: [herald, 110, 34, 90], gravekeeper: [gravekeeper, 90, 22, 56],
    chief: [chief, 90, 20, 56], brute: [brute, 90, 22, 60], champion: [champion, 90, 24, 62], archfiend: [archfiend, 120, 40, 100],
  };
  const FOOT = { colossus: 26, mother: 24, maw: 30, wyrm: 4, titan: 30, watcher: 20, leviathan: 8, herald: 30, gravekeeper: 18, chief: 18, brute: 20, champion: 20, archfiend: 34 };
  for (const id in RIGS) {
    const [fn, size, hh, cull] = RIGS[id], def = BOSS_DEFS[id];
    let spr = null;
    def.draw = fn;
    def.scale = 1;
    def.hh = hh;
    def.cull = cull;
    def.foot = FOOT[id];
    if (!['wyrm', 'leviathan'].includes(id)) def.frames = () => spr || (spr = snap(fn, id, size, size));
  }
})();
