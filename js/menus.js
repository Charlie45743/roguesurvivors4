'use strict';
/* Home flow: Play -> mode cards (normal / story / co-op) -> co-op (local / online), plus Leaderboard and Settings.
   Also drives every menu with a controller: d-pad or stick moves focus, A presses, B goes back, Start pauses. */

SCREENS.push('modes', 'coopmenu', 'board', 'settings');

const openModes = () => { setState('modes'); fillArt(); };
const openCoopMenu = () => { setState('coopmenu'); fillArt(); };
const openOnline = () => { $('lobby').classList.remove('joining'); openLobby(); };

/* ---------- Card art: sprites from the game on a little night scene ---------- */
const artCache = {};
function scene(top, bottom, parts) {
  const w = 130, h = 160, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.65)';
  for (let i = 0; i < 22; i++) x.fillRect((i * 47) % w, (i * 29) % 90, 2, 2);
  for (const [col, px, py, r] of parts.filter(p => p.length === 4)) {   // glowing portals and moons
    x.fillStyle = col; x.globalAlpha = .35; x.beginPath(); x.arc(px, py, r + 5, 0, 7); x.fill();
    x.globalAlpha = 1; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  x.fillStyle = '#0b0a12'; x.fillRect(0, h - 22, w, 22);
  x.imageSmoothingEnabled = false;
  for (const [f, frac, px] of parts.filter(p => p.length === 3)) {      // sprites, standing on the ground
    const k = Math.max(1, Math.floor(h * frac / f.c.height)), sw = f.c.width * k, sh = f.c.height * k;
    x.drawImage(f.c, Math.round(px * w - sw / 2), h - 14 - sh, sw, sh);
  }
  return c.toDataURL();
}
const ARTS = {
  normal: () => scene('#1a1030', '#4a2250', [['#9a4fd0', 28, 40, 14], ['#8ff0ff', 104, 62, 9], [charFrames('wren')[0], .32, .42], [SPR.swarmeye[0], .2, .8]]),
  story: () => scene('#2a1a12', '#6a3a1c', [['#ffd35a', 100, 34, 12], [NPC_SPR.lamplighter[0], .34, .35], [NPC_SPR.witch[0], .3, .72]]),
  coop: () => scene('#10203a', '#1c4a6a', [['#e8742c', 65, 36, 10], [charFrames('wren')[0], .3, .25], [charFrames('morrow')[0], .3, .5], [charFrames('isolde')[0], .3, .75]]),
  local: () => scene('#122a2a', '#1f5a4a', [['#a6e05a', 100, 34, 10], [charFrames('wren')[0], .34, .3], [charFrames('nyx')[0], .34, .7]]),
  online: () => scene('#1a1a3a', '#2a3a8a', [['#8ff0ff', 65, 52, 22], [charFrames('wren')[0], .26, .2], [charFrames('brask')[0], .26, .8]]),
};
function fillArt() {
  document.querySelectorAll('img[data-art]').forEach(img => { img.src = artCache[img.dataset.art] ||= ARTS[img.dataset.art](); });
}

/* ---------- Leaderboard ---------- */
function openBoard() {
  setState('board');
  const runs = save.runs || [];
  $('boardList').innerHTML = runs.length ? runs.map((r, i) => {
    const ch = CHARS.find(c => c.id === r.ch) || CHARS[0];
    return `<div class="brow"><span class="rk">${i + 1}</span><img src="${charFrames(ch.id)[0].c.toDataURL()}" alt=""><span class="bn">${ch.name}<br><small>${r.k} slain · level ${r.lv}${r.w ? ' · survived' : ''}</small></span><span class="bt">${fmtTime(r.t)}</span></div>`;
  }).join('') : '<div class="empty">No nights survived yet. Go and make some history.</div>';
}

/* ---------- Settings ---------- */
function openSettings() {
  setState('settings');
  $('setSfx').value = save.vol.sfx; $('setMus').value = save.vol.mus;
  $('setMute').textContent = save.muted ? 'Sound off' : 'Sound on';
}
$('setSfx').oninput = e => { save.vol.sfx = +e.target.value; save.muted = false; applyVolume(); persist(); $('setMute').textContent = 'Sound on'; };
$('setMus').oninput = e => { save.vol.mus = +e.target.value; save.muted = false; applyVolume(); persist(); $('setMute').textContent = 'Sound on'; };
$('setMute').onclick = () => { save.muted = !save.muted; persist(); applyVolume(); Snd.play('select'); $('setMute').textContent = save.muted ? 'Sound off' : 'Sound on'; };
$('setFull').onclick = () => { Snd.play('select'); if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };

/* ---------- Wiring ---------- */
$('btnPlay').onclick = () => { Snd.play('select'); openModes(); };
$('btnBoard').onclick = () => { Snd.play('select'); openBoard(); };
$('btnSettings').onclick = () => { Snd.play('select'); openSettings(); };
$('btnNormal').onclick = () => { Snd.play('select'); openChars(); };
$('btnCoop').onclick = () => { Snd.play('select'); openCoopMenu(); };
$('btnGoLocal').onclick = () => { Snd.play('select'); openLocalLobby(); };
$('btnGoOnline').onclick = () => { Snd.play('select'); openOnline(); };
$('btnOnline').onclick = () => { Snd.play('select'); openOnline(); };
$('btnLocalBack').onclick = () => { Snd.play('select'); openCoopMenu(); };

// Online: first choose Create or Join; the code box appears once Join is chosen
const joinNow = $('btnJoin').onclick;
$('btnJoin').onclick = () => {
  if ($('lobby').classList.contains('joining')) { joinNow(); return; }
  Snd.play('select'); $('lobby').classList.add('joining'); $('roomCode').focus();
};
$('btnCreate').textContent = 'Create game';
$('btnJoin').textContent = 'Join game';

// Each Back button goes one step up the flow
const BACK = { altar: openMenu, modes: openMenu, board: openMenu, settings: openMenu, chars: openModes, story: openModes, coopmenu: openModes,
  lobby: () => { if (Net.ws) Net.ws.close(); openCoopMenu(); } };
document.querySelectorAll('[data-back]').forEach(b => {
  b.onclick = () => { Snd.play('select'); (BACK[b.closest('section').id] || openMenu)(); };
});

/* ---------- Controllers in menus ---------- */
const PN = { prev: {}, dir: { x: 0, y: 0 }, rep: 0, cur: null, seen: false, focusNext: false, hadSeat: false };
const pnVisible = el => el.getClientRects().length > 0;
function pnSetFocus(el) {
  document.querySelectorAll('.pf').forEach(x => x.classList.remove('pf'));
  PN.cur = el;
  if (el) { el.classList.add('pf'); el.scrollIntoView?.({ block: 'nearest' }); }
}
function pnItems(scr) { return [...scr.querySelectorAll('button:not(:disabled), input')].filter(pnVisible); }
function pnDefault(items) { return items.find(e => e.matches('.sel, .big, .mode')) || items[0] || null; }
function pnMove(scr, dx, dy) {
  const items = pnItems(scr);
  if (!PN.cur || !items.includes(PN.cur)) { pnSetFocus(pnDefault(items)); return; }
  if (PN.cur.type === 'range' && dx) { dx > 0 ? PN.cur.stepUp() : PN.cur.stepDown(); PN.cur.dispatchEvent(new Event('input')); Snd.play('hover'); return; }
  const r = PN.cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = 1e9;
  for (const el of items) {
    if (el === PN.cur) continue;
    const b = el.getBoundingClientRect(), ox = b.left + b.width / 2 - cx, oy = b.top + b.height / 2 - cy;
    const main = dx ? ox * dx : oy * dy, side = Math.abs(dx ? oy : ox);
    if (main <= 4) continue;
    const s = main + side * 2;
    if (s < bs) { bs = s; best = el; }
  }
  if (best) { pnSetFocus(best); Snd.play('hover'); }
}
function pnPress(scr) {
  const el = PN.cur && pnVisible(PN.cur) ? PN.cur : null;
  if (el && el.tagName === 'INPUT') { el.focus(); return; }
  if (el && el.type !== 'range') el.click();
  else if (!el) scr.click();                                   // a plain click-to-continue screen, such as dialogue
}
function pnBack(scr) {
  const b = scr.querySelector('[data-back]:not(:disabled)') || (state === 'pause' ? $('btnResume') : null);
  if (b && pnVisible(b)) b.click();
}
function padMenu() {
  const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  let a = false, b = false, st = false, x = 0, y = 0, any = false;
  for (const gp of pads) {
    const was = PN.prev[gp.index] || {}, held = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const now = { a: held(0), b: held(1), s: held(9) };
    PN.prev[gp.index] = now;
    a = a || (now.a && !was.a); b = b || (now.b && !was.b); st = st || (now.s && !was.s);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    x = x || (held(15) || ax > 0.6 ? 1 : held(14) || ax < -0.6 ? -1 : 0);
    y = y || (held(13) || ay > 0.6 ? 1 : held(12) || ay < -0.6 ? -1 : 0);
    any = any || now.a || now.b || now.s || held(12) || held(13) || held(14) || held(15) || Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6;
  }
  if (any) PN.seen = true;
  const seated = lobby.length > 0;
  if (state === 'localco') {                                    // seats are driven by local.js; with nobody seated, B leaves
    if (b && !seated && !PN.hadSeat) openCoopMenu();
    PN.hadSeat = seated;
    return;
  }
  PN.hadSeat = false;
  if (st && (state === 'play' || state === 'dungeon')) { openPause(); return; }
  if (state === 'play' || state === 'dungeon') return;
  if (G && G.local && LOCAL_MENU_STATES.includes(state)) return;   // those belong to the players in local.js
  const cd = $('cdlg');
  if (a && cd && !cd.classList.contains('hidden')) { cd.click(); return; }
  const scr = document.querySelector('section.screen:not(.hidden)');
  if (!scr) return;
  if (st && state === 'pause') { $('btnResume').click(); return; }
  if (PN.focusNext && PN.seen) { PN.focusNext = false; pnSetFocus(pnDefault(pnItems(scr))); }
  if (a) { pnPress(scr); return; }
  if (b) { pnBack(scr); return; }
  const now = performance.now(), d = PN.dir;
  if ((x || y) && (x !== d.x || y !== d.y)) { pnMove(scr, x, x ? 0 : y); PN.rep = now + 380; }
  else if ((x || y) && now > PN.rep) { pnMove(scr, x, x ? 0 : y); PN.rep = now + 130; }
  PN.dir = { x, y };
}
Mods.add({
  input() { padMenu(); },
  state() { pnSetFocus(null); PN.focusNext = true; },
});
addEventListener('mousemove', e => { if (!e.movementX && !e.movementY) return; PN.seen = false; pnSetFocus(null); });
