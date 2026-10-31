'use strict';
/* Local co-op: up to four players on one screen. Seats 1 and 2 are keyboard sets (WASD with E, arrow keys with /);
   a controller takes any free seat with A. Everyone shares one run and one level-up pool, whoever picks an upgrade
   gets it, and the screen splits into one view per player. */

SCREENS.push('coopmenu', 'localco');

const KB_DEVS = [
  { kind: 'kb', name: 'WASD', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyE', hint: 'E' },
  { kind: 'kb', name: 'Arrow keys', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Slash', hint: '/' },
];
const PAD_SEATS = [2, 3, 0, 1];                  // controllers prefer the seats without keyboard sets
const LOCAL_MENU_STATES = ['levelup', 'chest', 'shrine'];
const seats = [null, null, null, null];           // the device sitting in each seat
const padPrev = {};                               // last button state per controller, for presses

const asPlayer = (pl, fn) => { const keep = P; P = pl; try { return fn(); } finally { P = keep; } };
const enterKey = () => ({ code: 'Enter', key: 'Enter', preventDefault() { /* synthetic */ } });
const statusMsg = t => { $('localStatus').textContent = t; };
const localChars = () => CHARS.filter(c => !c.cost || save.unlocked[c.id]).map(c => c.id);
const charPick = n => { const list = localChars(); return list[n % list.length]; };
const seatedCount = () => seats.filter(Boolean).length;

function openCoopMenu() { setState('coopmenu'); }
function openLocalLobby() {
  if (document.activeElement) document.activeElement.blur();   // so Enter and Space do not also press a focused button
  setState('localco');
  renderSeats();
  statusMsg('Tap a seat, press E for WASD or / for the arrow keys, or press A on a controller.');
}

/* ---------- Seats ---------- */
function joinKb(i) {
  if (seats[i] === KB_DEVS[i]) return;
  if (seats[i]) { statusMsg('That seat has a controller in it'); return; }
  seats[i] = KB_DEVS[i];
  Snd.play('chest');
  renderSeats();
}
function joinPad(index) {
  if (seats.some(d => d && d.kind === 'pad' && d.pad === index)) return;
  const i = PAD_SEATS.find(s => !seats[s]);
  if (i === undefined) { statusMsg('All four seats are taken'); return; }
  seats[i] = { kind: 'pad', pad: index, name: 'Controller ' + (index + 1), hint: 'A' };
  Snd.play('chest');
  renderSeats();
}
function seatTap(i) {
  if (seats[i]) seats[i] = null;
  else if (i < 2) joinKb(i);
  else statusMsg('Press A on a controller to take this seat');
  renderSeats();
}
function renderSeats() {
  const box = $('seats');
  box.innerHTML = '';
  seats.forEach((d, i) => {
    const b = document.createElement('button');
    b.className = 'card seat' + (d ? '' : ' open');
    b.onclick = () => seatTap(i);
    if (d) {
      const n = seats.slice(0, i).filter(Boolean).length;
      const ch = CHARS.find(c => c.id === charPick(n));
      b.innerHTML = `<div class="name">Player ${n + 1}</div><div class="title2">${ch.name} · ${d.name}</div><div class="desc">Tap to leave</div>`;
    } else {
      const how = i === 0 ? 'E · WASD keys' : i === 1 ? '/ · arrow keys' : 'A on a controller';
      b.innerHTML = `<div class="name">Tap to join</div><div class="desc">${how}</div>`;
    }
    box.appendChild(b);
  });
  $('btnLocalStart').classList.toggle('hidden', !seatedCount());
}
function startLocal() {
  const devs = seats.filter(Boolean);
  if (!devs.length) { statusMsg('Someone has to join first'); return; }
  devs.forEach((d, n) => { d.ch = charPick(n); });
  Snd.play('select');
  newRun(devs[0].ch, { local: devs });
}

/* ---------- Devices ---------- */
// Movement for one local player: keyboard keys, or a controller's stick and d-pad
function devVec(dev) {
  let x = 0, y = 0;
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
  asPlayer(pl, () => Mods.first('interact', pl));
}

// Controllers: A joins a seat in the lobby, and acts in the run; Start begins the night from the lobby
function pollPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const was = padPrev[gp.index] || {};
    const now = { a: !!(gp.buttons[0] && gp.buttons[0].pressed), start: !!(gp.buttons[9] && gp.buttons[9].pressed) };
    padPrev[gp.index] = now;
    const pressA = now.a && !was.a, pressStart = now.start && !was.start;
    if (!pressA && !pressStart) continue;
    if (state === 'localco') { if (pressA) joinPad(gp.index); else startLocal(); continue; }
    if (!G || !G.local || !pressA) continue;
    const pl = G.players.find(p => p.dev && p.dev.kind === 'pad' && p.dev.pad === gp.index);
    if (!pl) continue;
    if (state === 'play') interactFor(pl);
    else if (LOCAL_MENU_STATES.includes(state)) asPlayer(pl, () => onKey(enterKey()));
  }
}

// Keyboard: E and / join or act for their seats; in the lobby they take the seats too
function localKey(e) {
  if (state === 'localco') {
    if (e.code === 'KeyE') { joinKb(0); return true; }
    if (e.code === 'Slash') { joinKb(1); return true; }
    if (e.code === 'Enter' || e.code === 'Space') { startLocal(); return true; }
    if (e.code === 'Escape') { openCoopMenu(); return true; }
    return false;
  }
  if (!G || !G.local) return false;
  const pl = G.players.find(p => p.dev && p.dev.act === e.code);
  if (!pl) return false;
  e.preventDefault();
  if (state === 'play') interactFor(pl);
  else if (LOCAL_MENU_STATES.includes(state)) asPlayer(pl, () => onKey(enterKey()));
  return true;
}

Mods.add({
  key(e) { return localKey(e); },
  input() { pollPads(); },
});
addEventListener('gamepadconnected', e => { if (state === 'localco') statusMsg(`${'Controller ' + (e.gamepad.index + 1)} connected. Press A to join.`); });

/* ---------- Split screen ---------- */
// Draws the night once per player into its own part of the canvas. W and H shrink to that part while it draws.
function renderSplit(draw) {
  const full = { W, H }, n = G.players.length, hw = Math.floor(W / 2), hh = Math.floor(H / 2);
  const rects = n === 2 ? [[0, 0, hw, H], [hw, 0, W - hw, H]]
    : [[0, 0, hw, hh], [hw, 0, W - hw, hh], [0, hh, hw, H - hh], [hw, hh, W - hw, H - hh]];
  ctx.fillStyle = '#05040c'; ctx.fillRect(0, 0, W, H);
  G.players.forEach((pl, i) => {
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

/* ---------- Menu wiring ---------- */
$('btnLocal').onclick = () => { Snd.play('select'); openLocalLobby(); };
$('btnLocalBack').onclick = () => { Snd.play('select'); openCoopMenu(); };
$('btnLocalStart').onclick = () => startLocal();
