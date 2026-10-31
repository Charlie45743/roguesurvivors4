'use strict';
/* Local co-op: up to four players on one screen. Anyone joins by pressing their keys (WASD or the arrow keys), a button on
   a controller, or by clicking the mouse slot. Each joined player gets a panel to pick a wanderer and ready up, and the
   first player also picks the mode (normal night or story). Everyone shares one run and one level-up pool, whoever picks
   an upgrade gets it, and the screen splits into one view per player. */

SCREENS.push('localco');

const KB_DEVS = [
  { kind: 'kb', name: 'WASD', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyE', back: 'KeyQ', hint: 'E',
    nav: 'A D change · W S options · E ready · Q leave',
    cry: { left: ['KeyA'], right: ['KeyD'], down: ['KeyS'], jump: ['KeyW', 'Space'], attack: ['KeyE', 'KeyJ'], roll: ['KeyQ', 'ShiftLeft'] },
    controls: [['Move', 'W A S D'], ['Interact', 'E'], ['Level-up menu', 'A D to browse · E to pick'], ['Crypts', 'W jump · E attack · Q roll']], leave: 'Q' },
  { kind: 'kb', name: 'Arrow keys', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Slash', back: 'Period', hint: '/',
    nav: 'Left Right change · Up Down options · / ready · Period leave',
    cry: { left: ['ArrowLeft'], right: ['ArrowRight'], down: ['ArrowDown'], jump: ['ArrowUp'], attack: ['Slash', 'KeyX'], roll: ['Period', 'ShiftRight'] },
    controls: [['Move', 'Arrow keys'], ['Interact', '/'], ['Level-up menu', 'Left Right to browse · / to pick'], ['Crypts', 'Up jump · / attack · Period roll']], leave: 'Period key' },
];
const MOUSE_DEV = { kind: 'mouse', name: 'Mouse', hint: 'R-CLICK', nav: 'Click the arrows and buttons',
  controls: [['Move', 'Hold left click and drag'], ['Interact', 'Right click'], ['Level-up menu', 'Click a card, or hover and right click'], ['Crypts', 'Drag to move · Roll, Jump and Hit buttons']], leave: 'Leave button' };
const LOCAL_MENU_STATES = ['levelup', 'chest', 'shrine'];
const MAX_SEATS = 4;
const READY_DELAY = 1.2;                         // seconds between the last player readying up and the night starting

const lobby = [];                                 // joined players in join order: { dev, ch, row, ready, showKeys }
const setup = { mode: 'normal', chapter: 0 };     // chosen by the first player
const padPrev = {};                               // last button state per controller, for presses
const portraits = {};
let launching = 0;                                // counts down once everyone is ready
let promptT = 0, promptIdx = 0;
let lastLaunch = null;                            // what the current run started with, so "Rise again" can repeat it

const asPlayer = (pl, fn) => { const keep = P; P = pl; try { return fn(); } finally { P = keep; } };
const fakeKey = code => ({ code, key: code, synthetic: true, preventDefault() { /* synthetic */ } });
const statusMsg = t => { $('localStatus').textContent = t; };
const localChars = () => CHARS.filter(c => !c.cost || save.unlocked[c.id]).map(c => c.id);
const portraitFor = id => portraits[id] || (portraits[id] = charFrames(id)[0].c.toDataURL());
const openChapters = () => STORY.map((c, i) => i).filter(i => i === 0 || save.story?.[STORY[i - 1].id]);
const mousePlayer = () => G && G.local ? G.players.find(p => p.dev && p.dev.kind === 'mouse') : null;
const seatOf = dev => lobby.find(s => s.dev === dev);
const padSeat = index => lobby.find(s => s.dev.kind === 'pad' && s.dev.pad === index);

function openLocalLobby() {
  if (document.activeElement) document.activeElement.blur();
  lobby.length = 0;
  setup.mode = 'normal'; setup.chapter = 0;
  launching = 0; promptT = 0; promptIdx = 0;
  setState('localco');
  renderLobby();
}

/* ---------- Joining and leaving ---------- */
function padDevice(gp) {
  const ps = /054c|playstation|dualshock|dualsense/i.test(gp.id), xbox = /xbox|045e|xinput/i.test(gp.id);
  const hint = ps ? 'X' : 'A';
  return { kind: 'pad', pad: gp.index, name: ps ? 'PlayStation controller' : xbox ? 'Xbox controller' : 'Controller ' + (gp.index + 1), hint,
    nav: `D-pad change · ${hint} ready · ${ps ? 'Circle' : 'B'} leave`,
    controls: [['Move', 'Left stick or D-pad'], ['Interact', hint], ['Level-up menu', `D-pad to browse · ${hint} to pick`], ['Crypts', `${hint} attack · ${ps ? 'Circle' : 'B'} roll · ${ps ? 'Square' : 'X'} or Up jump`]], leave: ps ? 'Circle' : 'B' };
}
function firstFreeChar() {
  const list = localChars(), taken = new Set(lobby.map(s => s.ch));
  return list.find(c => !taken.has(c)) || list[lobby.length % list.length];
}
function addSeat(dev) {
  if (seatOf(dev)) return;
  if (lobby.length >= MAX_SEATS) { statusMsg('All four seats are taken'); return; }
  lobby.push({ dev, ch: firstFreeChar(), row: 0, ready: false, showKeys: false });
  launching = 0;
  Snd.play('chest');
  renderLobby();
}
function removeSeat(seat) {
  lobby.splice(lobby.indexOf(seat), 1);
  Snd.play('select');
  rearm();
  renderLobby();
}
// The night starts on its own once everyone has readied up
function rearm() { launching = lobby.length && lobby.every(s => s.ready) ? READY_DELAY : 0; }

/* ---------- Lobby choices ---------- */
// Only the first player picks the mode; everyone picks their own wanderer
const rowsOf = seat => seat === lobby[0] ? (setup.mode === 'story' ? ['char', 'mode', 'chapter'] : ['char', 'mode']) : ['char'];
const rowOf = seat => { const rows = rowsOf(seat); return rows[Math.min(seat.row, rows.length - 1)]; };

function cycleChar(seat, dir) {
  const list = localChars(), taken = new Set(lobby.filter(s => s !== seat).map(s => s.ch));
  let i = list.indexOf(seat.ch);
  for (let k = 0; k < list.length; k++) {
    i = (i + dir + list.length) % list.length;
    if (!taken.has(list[i])) { seat.ch = list[i]; return; }
  }
}
function adjust(seat, dir) {
  if (seat.ready || seat.showKeys) return;
  const row = rowOf(seat);
  if (row === 'char') cycleChar(seat, dir);
  else if (row === 'mode') setup.mode = setup.mode === 'story' ? 'normal' : 'story';
  else {
    const open = openChapters(), i = open.indexOf(setup.chapter);
    setup.chapter = open[(i + dir + open.length) % open.length];
  }
  Snd.play('hover');
  renderLobby();
}
function moveRow(seat, dir) {
  if (seat.showKeys) return;
  const n = rowsOf(seat).length;
  seat.row = (Math.min(seat.row, n - 1) + dir + n) % n;
  Snd.play('hover');
  renderLobby();
}
function toggleReady(seat) {
  seat.ready = !seat.ready;
  seat.showKeys = false;
  Snd.play(seat.ready ? 'select' : 'hover');
  rearm();
  renderLobby();
}
// One vocabulary for every device: left, right, up, down, act (ready) and back
function navSeat(seat, a) {
  if (a === 'left') adjust(seat, -1);
  else if (a === 'right') adjust(seat, 1);
  else if (a === 'up') moveRow(seat, -1);
  else if (a === 'down') moveRow(seat, 1);
  else if (a === 'act') toggleReady(seat);
  else if (a === 'back') {
    if (seat.showKeys) { seat.showKeys = false; renderLobby(); }
    else if (seat.ready) toggleReady(seat);
    else removeSeat(seat);
  }
}

/* ---------- Lobby screen ---------- */
function joinPrompts() {
  const out = [];
  if (!seatOf(KB_DEVS[0])) out.push('Click WASD to join');
  if (!seatOf(KB_DEVS[1])) out.push('Click the arrow keys to join');
  out.push('Click A to join (Xbox)', 'Click X to join (PlayStation)');
  if (!seatOf(MOUSE_DEV)) out.push('Click here to join with the mouse');
  return out;
}
function showPrompt(el) {
  const list = joinPrompts();
  el.textContent = list[promptIdx % list.length];
  el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
}
function controlsHtml(dev, inLobby) {
  const rows = [...dev.controls, ['Revive', 'Stand next to a fallen friend']];
  if (inLobby) rows.push(['Leave', dev.leave]);
  return `<dl class="ctl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
}
function paneHtml(seat, n) {
  const ch = CHARS.find(c => c.id === seat.ch), row = rowOf(seat), host = seat === lobby[0];
  const pick = (id, label, name, sub, prev, next) =>
    `<div class="prow${row === id ? ' focus' : ''}" data-row="${id}"><button class="arrow" data-do="${prev}">&lt;</button><div class="pv"><div class="lbl">${label}</div><div class="name">${name}</div>${sub ? `<div class="title2">${sub}</div>` : ''}</div><button class="arrow" data-do="${next}">&gt;</button></div>`;
  const body = seat.showKeys ? controlsHtml(seat.dev, true) : `
    <img class="portrait" src="${portraitFor(ch.id)}" alt="">
    ${pick('char', '', ch.name, ch.title, 'charPrev', 'charNext')}
    <div class="pstart"><img src="${ICON_URL[ch.weapon]}" alt="">${WEAPONS[ch.weapon].name}</div>
    <div class="pdesc">${ch.desc}</div>
    ${host ? pick('mode', 'Game mode', setup.mode === 'story' ? 'Story' : 'Normal', setup.mode === 'story' ? 'The six chapters, together' : 'Survive until dawn', 'modePrev', 'modeNext') : ''}
    ${host && setup.mode === 'story' ? pick('chapter', 'Chapter', STORY[setup.chapter].title, '', 'chapPrev', 'chapNext') : ''}`;
  return `<div class="pane p${n}${seat.ready ? ' ready' : ''}" data-seat="${n}">
    <div class="phead"><b>Player ${n + 1}</b><span>${seat.dev.name}</span></div>
    ${body}
    <div class="pbtns">
      <button class="btn${seat.ready ? '' : ' ghost'}" data-do="ready">${seat.ready ? 'Ready!' : 'Ready up'} · ${seat.dev.hint}</button>
      <div class="pbtns2"><button class="btn ghost small" data-do="controls">${seat.showKeys ? 'Back' : 'Controls'}</button><button class="btn ghost small" data-do="leave">Leave</button></div>
    </div>
    <div class="pnav">${seat.dev.nav}</div>
  </div>`;
}
function renderLobby() {
  const box = $('seats');
  const open = lobby.length < MAX_SEATS
    ? `<${seatOf(MOUSE_DEV) ? 'div' : 'button'} class="pane open${lobby.length ? '' : ' alone'}" data-do="join"><div class="phead"><b>${lobby.length ? 'Player ' + (lobby.length + 1) : 'Local co-op'}</b></div><div class="joinprompt"></div></${seatOf(MOUSE_DEV) ? 'div' : 'button'}>`
    : '';
  box.innerHTML = lobby.map(paneHtml).join('') + open;
  box.querySelectorAll('.joinprompt').forEach(showPrompt);
  statusMsg(!lobby.length ? 'Everyone plays on this screen, up to four at once.'
    : launching > 0 ? 'Starting the night... press ready again to cancel'
    : 'Pick your wanderer and ready up. Player 1 picks the game mode.');
}
$('seats').onclick = e => {
  const btn = e.target.closest('[data-do]'), pane = e.target.closest('[data-seat]');
  const seat = pane && lobby[+pane.dataset.seat], rowEl = e.target.closest('[data-row]');
  if (seat && rowEl) seat.row = Math.max(0, rowsOf(seat).indexOf(rowEl.dataset.row));
  if (!btn) { if (seat) renderLobby(); return; }
  const a = btn.dataset.do;
  if (a === 'join') { addSeat(MOUSE_DEV); return; }
  if (!seat) return;
  if (a === 'charPrev' || a === 'modePrev' || a === 'chapPrev') adjust(seat, -1);
  else if (a === 'charNext' || a === 'modeNext' || a === 'chapNext') adjust(seat, 1);
  else if (a === 'ready') toggleReady(seat);
  else if (a === 'controls') { seat.showKeys = !seat.showKeys; renderLobby(); }
  else if (a === 'leave') removeSeat(seat);
};

/* ---------- Starting the night ---------- */
function launchRun(l) {
  l.devs.forEach((d, i) => { d.ch = l.chars[i]; });
  Snd.play('select');
  if (l.mode === 'story') startChapter(l.chapter, l.devs);
  else newRun(l.devs[0].ch, { local: l.devs });
}
function startLocal() {
  if (!lobby.length) return;
  launching = 0;
  lastLaunch = { devs: lobby.map(s => s.dev), chars: lobby.map(s => s.ch), mode: setup.mode, chapter: setup.chapter };
  launchRun(lastLaunch);
}
// "Rise again" and "Retry chapter": same players, same characters, and the chapter they died in
function restartLocal() {
  if (!lastLaunch) return;
  if (G && G.story) lastLaunch.chapter = G.story.chapter;
  launchRun(lastLaunch);
}

/* ---------- Devices ---------- */
// Movement for one local player: keyboard keys, a controller's stick and d-pad, or a click-and-drag with the mouse
function devVec(dev) {
  let x = 0, y = 0;
  if (dev.kind === 'mouse') {
    if (!joy.active) return [0, 0];
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
    if (d <= 6) return [0, 0];
    const m = Math.min(1, d / 40);
    return [dx / d * m, dy / d * m];
  }
  if (dev.kind === 'pad') {
    const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[dev.pad];
    if (!gp) return [0, 0];
    const dz = v => (Math.abs(v) > 0.2 ? v : 0);
    x = dz(gp.axes[0] || 0); y = dz(gp.axes[1] || 0);
    const held = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (held(14)) x--;
    if (held(15)) x++;
    if (held(12)) y--;
    if (held(13)) y++;
  } else {
    if (keys[dev.left]) x--;
    if (keys[dev.right]) x++;
    if (keys[dev.up]) y--;
    if (keys[dev.down]) y++;
  }
  const l = Math.hypot(x, y);
  return l > 1 ? [x / l, y / l] : [x, y];
}

// Interact for one player. The first player uses the normal path; the others use the same flow as them.
function interactFor(pl) {
  if (pl === ME) { interact(); return; }
  if (asPlayer(pl, () => Mods.first('interact', pl))) return;
  const c = G.nearCrypt;
  if (c && Math.hypot(pl.x - c.x, pl.y + 6 - c.y) < 24) enterCrypt(c);   // any player can lead the party down
}
// A menu belongs to one player at a time: whoever is choosing an upgrade, or whose chest it is. Everyone else is frozen out of it.
const menuOwner = () => !G || !G.local ? null : state === 'levelup' ? G.chooser : state === 'chest' && G.chest ? G.chest.owner : null;
const menuAct = pl => { const o = menuOwner(); if (o && o !== pl) return; asPlayer(pl, () => onKey(fakeKey('Enter'))); };
// A click on a menu counts when nobody holds the mouse, or when it is the mouse player's turn
const menuClickOk = () => { const o = menuOwner(), m = mousePlayer(); return !o || !m || o === m; };

// Controllers: a button joins and readies in the lobby, and acts in the run
function padDirs(gp) {
  const held = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  return { x: held(15) || ax > 0.6 ? 1 : held(14) || ax < -0.6 ? -1 : 0, y: held(13) || ay > 0.6 ? 1 : held(12) || ay < -0.6 ? -1 : 0 };
}
function pollPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const was = padPrev[gp.index] || { x: 0, y: 0 }, held = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const d = padDirs(gp), now = { a: held(0), b: held(1), x: d.x, y: d.y };
    padPrev[gp.index] = now;
    const pressA = now.a && !was.a, pressB = now.b && !was.b;
    const stepX = now.x && now.x !== was.x ? now.x : 0, stepY = now.y && now.y !== was.y ? now.y : 0;
    if (state === 'localco') {
      const seat = padSeat(gp.index);
      if (!seat) { if (pressA) addSeat(padDevice(gp)); continue; }
      if (pressA) navSeat(seat, 'act');
      else if (pressB) navSeat(seat, 'back');
      else if (stepX) navSeat(seat, stepX < 0 ? 'left' : 'right');
      else if (stepY) navSeat(seat, stepY < 0 ? 'up' : 'down');
      continue;
    }
    if (!G || !G.local) continue;
    const pl = G.players.find(p => p.dev && p.dev.kind === 'pad' && p.dev.pad === gp.index);
    if (!pl) continue;
    if (state === 'levelup' && stepX && pl === G.chooser) onKey(fakeKey(stepX < 0 ? 'ArrowLeft' : 'ArrowRight'));
    if (!pressA) continue;
    if (state === 'play') interactFor(pl);
    else if (LOCAL_MENU_STATES.includes(state)) menuAct(pl);
  }
}

// Keyboard: in the lobby a movement or action key joins that set and then drives its panel; in the run it acts for its player
function lobbyKey(e) {
  if (e.code === 'Escape') { openMenu(); return true; }
  const dev = KB_DEVS.find(d => [d.up, d.down, d.left, d.right, d.act, d.back].includes(e.code));
  if (!dev) return false;
  e.preventDefault();
  if (e.repeat) return true;
  const seat = seatOf(dev);
  if (!seat) { if (e.code !== dev.back) addSeat(dev); return true; }
  navSeat(seat, e.code === dev.left ? 'left' : e.code === dev.right ? 'right' : e.code === dev.up ? 'up' : e.code === dev.down ? 'down' : e.code === dev.act ? 'act' : 'back');
  return true;
}
function localKey(e) {
  if (state === 'localco') return lobbyKey(e);
  if (!G || !G.local) return false;
  const owner = menuOwner();
  if (owner && !e.synthetic && !['KeyM', 'Escape', 'KeyP'].includes(e.code)) {
    // while one player picks, the other players' keys do nothing
    const dev = KB_DEVS.find(d => [d.up, d.down, d.left, d.right, d.act, d.back].includes(e.code));
    if (dev ? dev !== owner.dev : G.players.length > 1) { e.preventDefault(); return true; }
  }
  const pl = G.players.find(p => p.dev && p.dev.act === e.code);
  if (!pl) return false;
  e.preventDefault();
  if (state === 'play') interactFor(pl);
  else if (LOCAL_MENU_STATES.includes(state)) menuAct(pl);
  return true;
}

Mods.add({
  key(e) { return localKey(e); },
  input() { pollPads(); },
  frame(st, dt) {
    if (st !== 'localco') return;
    promptT += dt;
    if (promptT > 1.8) { promptT = 0; promptIdx++; $('seats').querySelectorAll('.joinprompt').forEach(showPrompt); }
    if (launching > 0) { launching -= dt; if (launching <= 0) startLocal(); }
  },
  state(s) {
    const box = $('pauseControls');
    if (s === 'pause' && G && G.local) {
      box.innerHTML = G.players.map((p, i) => `<div class="pctl p${i}"><b>Player ${i + 1} · ${p.ch.name} · ${p.dev.name}</b>${controlsHtml(p.dev, false)}</div>`).join('');
      box.classList.remove('hidden');
    } else box.classList.add('hidden');
  },
});
addEventListener('gamepadconnected', e => { if (state === 'localco') statusMsg(`${e.gamepad.id.split('(')[0].trim()} connected. Press its main button to join.`); });

// The mouse seat: right click interacts, and in a menu it confirms. Left clicks in a menu count as the mouse player's.
document.addEventListener('contextmenu', e => {
  const pl = mousePlayer();
  if (!pl) return;
  e.preventDefault();
  if (state === 'play') interactFor(pl);
  else if (LOCAL_MENU_STATES.includes(state)) menuAct(pl);
});
let clickSwap = false;
document.addEventListener('click', () => {
  const pl = mousePlayer();
  if (pl && pl !== P && LOCAL_MENU_STATES.includes(state)) { P = pl; clickSwap = true; }
}, true);
document.addEventListener('click', () => { if (clickSwap) { clickSwap = false; P = ME; } });

/* ---------- Split screen ---------- */
// Draws the night once per player into its own part of the canvas. W and H shrink to that part while it draws.
function renderSplit(draw, list = G.players) {
  const full = { W, H }, n = list.length, hw = Math.floor(W / 2), hh = Math.floor(H / 2);
  const rects = n === 2 ? [[0, 0, hw, H], [hw, 0, W - hw, H]]
    : [[0, 0, hw, hh], [hw, 0, W - hw, hh], [0, hh, hw, H - hh], [hw, hh, W - hw, H - hh]];
  ctx.fillStyle = '#05040c'; ctx.fillRect(0, 0, W, H);
  list.forEach((pl, i) => {
    const [x, y, w, h] = rects[i];
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y);
    W = w; H = h; P = pl;
    draw();
    ctx.restore();
  });
  W = full.W; H = full.H; P = ME;
  ctx.fillStyle = '#0b0a12';
  ctx.fillRect(hw - 1, 0, 2, H);
  if (n > 2) ctx.fillRect(0, hh - 1, W, 2);
}

/* ---------- Crypts: the whole party goes below ---------- */
const CRYPT_ACTS = ['left', 'right', 'down', 'jump', 'attack', 'roll'];
// What one device is holding right now, as {left, right, down, jump, attack, roll}
function cryptHold(dev) {
  const h = {};
  if (!dev || dev.kind === 'mouse') { for (const a of CRYPT_ACTS) h[a] = pointerHeld(a); return h; }
  if (dev.kind === 'pad') {
    const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[dev.pad];
    if (!gp) return h;
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    h.left = ax < -0.4 || b(14); h.right = ax > 0.4 || b(15); h.down = ay > 0.6 || b(13);
    h.jump = b(2) || b(3) || b(12) || ay < -0.6; h.attack = b(0); h.roll = b(1);
    return h;
  }
  for (const a of CRYPT_ACTS) h[a] = dev.cry[a].some(k => keys[k]);
  return h;
}
// Once a frame: read every body's device and turn fresh presses into press flags (the mouse's buttons count taps)
function refreshCryptInputs() {
  for (const b of D.bodies) {
    const h = cryptHold(b.pl.dev), prev = b.hold || {};
    b.press = b.press || {};
    for (const a of CRYPT_ACTS) if (h[a] && !prev[a]) b.press[a] = true;
    if (!b.pl.dev || b.pl.dev.kind === 'mouse') for (const a of CRYPT_ACTS) if (ptrPress[a]) b.press[a] = true;
    b.hold = h;
  }
  for (const a in ptrPress) ptrPress[a] = false;
}
// One pane per player, each following its own body. Anyone who fell below watches whoever still stands.
function renderCryptViews() {
  if (!(G.local && D.bodies && D.bodies.length > 1)) { renderCrypt(); return; }
  renderSplit(() => {
    const mine = D.bodies.find(b => b.pl === P) || D.bodies[0];
    DP = mine.out ? D.bodies.find(b => !b.out) || mine : mine;
    renderCrypt();
    if (mine.out) drawText(ctx, 'FALLEN', W / 2, 14, '#d8354a');
  }, D.bodies.map(b => b.pl));
  DP = D.bodies[0];
}

/* ---------- Menu wiring ---------- */
$('btnCoop').onclick = () => { Snd.play('select'); openLocalLobby(); };
$('btnLocalBack').onclick = () => { Snd.play('select'); openMenu(); };
$('btnOnline').onclick = () => { Snd.play('select'); openLobby(); };
