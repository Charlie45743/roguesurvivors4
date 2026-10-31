'use strict';
/* Online co-op. The host simulates everything and streams compact snapshots; the guest renders them,
   sends its stick input and answers the dialogs the host forwards (level-ups, chests, shops, shrines). */

const Net = {
  ws: null, role: null, code: null, peer: false, myChar: 'wren', peerChar: null,
  lvl: false, modal: null, chest: false, crypt: false, afterGuest: null, sfx: [], banners: [], kills: [], lastSnap: 0, lastIn: 0,
  active() { return !!(this.ws && this.peer && G && G.coop); },
  busy() { return this.role === 'host' && (this.lvl || this.modal || this.chest || this.crypt || this.gpause); },
  send(d) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'relay', d })); },
};
SCREENS.push('lobby', 'wait');
HUD_STATES.add('wait');

/* ---------- Lobby ---------- */
function openLobby() {
  setState('lobby');
  lobbyStatus('Create a room and share its code, or join a friend\'s room.');
  renderLobbyChars();
}
function lobbyStatus(t) { $('lobbyStatus').textContent = t; }
function renderLobbyChars() {
  const box = $('lobbyChars');
  box.innerHTML = '';
  for (const ch of CHARS) {
    if (ch.cost && !save.unlocked[ch.id]) continue;
    const b = document.createElement('button');
    b.className = 'lchar' + (ch.id === Net.myChar ? ' sel' : '');
    b.innerHTML = `<img src="${charFrames(ch.id)[0].c.toDataURL()}" alt=""><span>${ch.name}</span>`;
    b.onclick = () => { Net.myChar = ch.id; Snd.play('select'); Net.send({ t: 'char', id: ch.id }); renderLobbyChars(); };
    box.appendChild(b);
  }
  $('roomInfo').textContent = Net.peer ? `Partner joined as ${CHARS.find(c => c.id === Net.peerChar)?.name || '...'}` : Net.code ? 'Waiting for your partner...' : '';
  $('btnStartCoop').classList.toggle('hidden', !(Net.role === 'host' && Net.peer));
}
/* Transport. Co-op rooms run through a free public MQTT broker over secure WebSockets, so the game works from static
   hosting such as GitHub Pages with no game server of our own, and it works behind any home or school router
   (unlike peer to peer, which strict NATs block). To use the serve.js relay instead, set COOP_SERVER to its address
   (e.g. 'wss://your-app.onrender.com/ws') or open the page with ?server=wss://host/ws. */
const COOP_SERVER = '';
const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
/* Preferred: the relay in serve.js on the same host (/ws), which is reliable and needs no third-party broker.
   Hosts that do not run serve.js (such as static pages) fail to open it and fall back to the public transports below. */
const coopUrl = () => new URLSearchParams(location.search).get('server') || COOP_SERVER || sameHostRelay();
function sameHostRelay() {
  if (!/^https?:$/.test(location.protocol)) return '';
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
}

/* A WebSocket look-alike speaking the same protocol as serve.js (create / join / relay), carried over MQTT topics:
     <room>/room      retained "live" marker the host owns; cleared when the host leaves or drops (via the MQTT will)
     <room>/h         everything sent to the host        <room>/g/<id>   everything sent to guest <id>
   Control messages are {"c":...}; relayed game messages are passed through untouched. */
function mqttSocket() {
  const ws = {
    readyState: 0, onopen: null, onerror: null, onclose: null, onmessage: null, cli: null, base: '', gid: '', guest: null, role: null, timer: 0, gen: 0,
    emit(m) { if (ws.onmessage) ws.onmessage({ data: JSON.stringify(m) }); },
    fail(msg) { ws.emit({ t: 'error', msg }); ws.close(); },
    errs: [],
    reset() { ws.gen++; ws.errs = []; clearTimeout(ws.timer); if (ws.cli) { ws.cli.end(true); ws.cli = null; } ws.guest = null; ws.role = null; },
    pub(topic, str, retain) { if (ws.cli) ws.cli.publish(topic, str, { qos: 0, retain: !!retain }); },
    /* Connect to the first broker that answers, then hand the client to `use`. Stale attempts (gen changed) are dropped. */
    open(will, use, i = 0) {
      const gen = ws.gen;
      if (i >= BROKERS.length) { ws.fail('Could not reach the co-op service (' + ws.errs.join('; ') + '). Your network may be blocking it. Try another connection, such as a phone hotspot.'); return; }
      const cli = mqtt.connect(BROKERS[i], { reconnectPeriod: 0, connectTimeout: 7000, keepalive: 15, clean: true, will });
      let done = false;
      const next = why => { if (done || gen !== ws.gen) return; done = true; ws.errs.push(BROKERS[i].split('/')[2] + ' ' + why); console.warn('co-op broker failed:', BROKERS[i], why); cli.end(true); ws.open(will, use, i + 1); };
      cli.on('error', e => next(e && e.message || 'error'));
      cli.on('close', () => { if (!done) next('connection closed'); else if (gen === ws.gen && ws.cli === cli) ws.close(); });
      cli.on('connect', () => { if (done || gen !== ws.gen) { if (!done) { done = true; cli.end(true); } return; } done = true; ws.cli = cli; use(cli, i); });
      cli.on('message', (topic, buf) => { if (gen === ws.gen) ws.onTopic(topic, buf.toString()); });
    },
    send(str) {
      if (str.startsWith('{"t":"create"')) ws.host(0);
      else if (str.startsWith('{"t":"join"')) ws.join(JSON.parse(str).code);
      else if (ws.role === 'host') { if (ws.guest) ws.pub(ws.base + '/g/' + ws.guest, str); }
      else if (ws.role === 'guest') ws.pub(ws.base + '/h', str);
    },
    onTopic(topic, s) {
      if (topic.endsWith('/room')) { if (ws.role === 'guest' && !s) { ws.emit({ t: 'left' }); ws.close(); } else ws.roomSeen = !!s; return; }
      if (!s.startsWith('{"c":')) { if (ws.onmessage) ws.onmessage({ data: s }); return; }
      const m = JSON.parse(s);
      if (ws.role === 'host') {
        if (m.c === 'hello') {
          if (!ws.guest || ws.guest === m.id) { const fresh = ws.guest !== m.id; ws.guest = m.id; ws.pub(ws.base + '/g/' + m.id, '{"c":"ack"}'); if (fresh) ws.emit({ t: 'peer' }); }
          else ws.pub(ws.base + '/g/' + m.id, '{"c":"full"}');
        } else if (m.c === 'bye' && m.id === ws.guest) { ws.guest = null; ws.emit({ t: 'left' }); }
      } else if (ws.role === 'guest') {
        if (m.c === 'ack') { clearTimeout(ws.timer); ws.emit({ t: 'joined', code: ws.code }); }
        else if (m.c === 'full') ws.fail('That room is already full.');
      }
    },
    host(tries) {
      ws.reset();
      const code = ws.code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join('');
      const base = ws.base = 'rogue-survivors-3/v1/' + code, gen = ws.gen;
      ws.role = 'host'; ws.roomSeen = false;
      ws.timer = setTimeout(() => ws.fail('The co-op service is not answering. Try again in a minute.'), 20000);
      ws.open({ topic: base + '/room', payload: '', retain: true }, cli => {
        cli.subscribe(base + '/room', () => setTimeout(() => {
          if (gen !== ws.gen) return;
          if (ws.roomSeen) { if (tries < 8) ws.host(tries + 1); else ws.fail('Could not find a free room code.'); return; } // someone else is hosting this code
          clearTimeout(ws.timer);
          cli.subscribe(base + '/h', () => { ws.pub(base + '/room', 'live', true); ws.emit({ t: 'created', code }); });
        }, 900));
      });
    },
    join(code) {
      ws.reset();
      const base = ws.base = 'rogue-survivors-3/v1/' + code, gid = ws.gid = Math.random().toString(36).slice(2, 10), gen = ws.gen;
      ws.role = 'guest'; ws.code = code; ws.roomSeen = false;
      ws.timer = setTimeout(() => ws.fail('The co-op service is not answering. Try again in a minute.'), 25000);
      const will = { topic: base + '/h', payload: JSON.stringify({ c: 'bye', id: gid }) };
      /* A broker only knows the rooms made on it, so look for the host on each one in turn */
      const look = (cli, i) => cli.subscribe(base + '/room', () => setTimeout(() => {
        if (gen !== ws.gen) return;
        if (!ws.roomSeen) {
          if (i + 1 < BROKERS.length) { cli.end(true); ws.cli = null; ws.open(will, look, i + 1); } else ws.fail('No room with that code.');
          return;
        }
        cli.subscribe(base + '/g/' + gid, () => {
          ws.pub(base + '/h', JSON.stringify({ c: 'hello', id: gid }));
          clearTimeout(ws.timer);
          ws.timer = setTimeout(() => ws.fail('The host did not answer.'), 10000);
        });
      }, 1500));
      ws.open(will, look);
    },
    close() {
      if (ws.readyState === 3) return;
      ws.readyState = 3;
      const cli = ws.cli, role = ws.role, base = ws.base, gid = ws.gid;
      if (cli && cli.connected) {
        if (role === 'host') cli.publish(base + '/room', '', { retain: true });
        else if (role === 'guest') cli.publish(base + '/h', JSON.stringify({ c: 'bye', id: gid }));
      }
      const c = cli; ws.cli = null; ws.reset();
      if (c) setTimeout(() => c.end(), 300);
      if (ws.onclose) ws.onclose();
    },
  };
  setTimeout(() => { ws.readyState = 1; if (ws.onopen) ws.onopen(); }, 0);
  return ws;
}
/* Nostr relays are public, free, always on and speak secure WebSockets on port 443, so they work from almost any network.
   We send every message to several relays at once and drop duplicates, which makes the link survive a slow or failing relay.
   Rooms are an ephemeral-event tag (kind 29111, never stored). Message format: to|from|seq|payload. */
const NOSTR_RELAYS = ['wss://relay.snort.social', 'wss://relay.primal.net', 'wss://nos.lol', 'wss://purplerelay.com', 'wss://nostr.mom'];
const NOSTR_KIND = 29111;
function nostrSocket() {
  const { generateSecretKey, finalizeEvent } = NostrTools;
  const sk = generateSecretKey(), me = Math.random().toString(36).slice(2, 10);
  const ws = {
    readyState: 0, onopen: null, onerror: null, onclose: null, onmessage: null, onunreachable: null,
    socks: [], role: null, code: '', tag: '', gen: 0, seq: 0, seen: new Set(), peerSeen: 0, guest: null, hostId: null, created: false, whoisHit: false, timers: [],
    emit(m) { if (ws.onmessage) ws.onmessage({ data: JSON.stringify(m) }); },
    fail(msg) { ws.emit({ t: 'error', msg }); ws.close(); },
    later(fn, ms) { const id = setTimeout(fn, ms); ws.timers.push(id); return id; },
    reset() { ws.gen++; for (const t of ws.timers) { clearTimeout(t); clearInterval(t); } ws.timers = []; for (const s of ws.socks) { s.onopen = s.onmessage = s.onerror = s.onclose = null; try { s.close(); } catch (e) { /* closed */ } } ws.socks = []; ws.guest = null; ws.hostId = null; ws.created = false; ws.seen.clear(); },
    raw(to, payload) {
      if (payload.length > 60000) return;
      const live = ws.socks.filter(s => s.readyState === 1);
      if (!live.length) return;
      const ev = finalizeEvent({ kind: NOSTR_KIND, created_at: Math.floor(Date.now() / 1000), tags: [['t', ws.tag]], content: `${to}|${me}|${++ws.seq}|${payload}` }, sk);
      const msg = JSON.stringify(['EVENT', ev]);
      for (const s of live) s.send(msg);
    },
    connectRelays(done) {
      const gen = ws.gen;
      let opened = 0, called = false, dead = 0;
      const finish = () => { if (called || gen !== ws.gen) return; called = true; done(); };
      const unreachable = () => { if (called || gen !== ws.gen) return; called = true; if (ws.onunreachable) ws.onunreachable(); else ws.fail('Could not reach any co-op relay. Check your connection.'); };
      for (const url of NOSTR_RELAYS) {
        let s;
        try { s = new WebSocket(url); } catch (e) { dead++; continue; }
        ws.socks.push(s);
        s.onopen = () => {
          if (gen !== ws.gen) return;
          s.send(JSON.stringify(['REQ', 'rs3', { kinds: [NOSTR_KIND], '#t': [ws.tag], since: Math.floor(Date.now() / 1000) - 3 }]));
          opened++;
          if (opened === 1) ws.later(finish, 1300);
          if (opened >= 3) finish();
        };
        s.onmessage = ev => { if (gen === ws.gen) ws.onEvent(ev.data); };
        s.onerror = s.onclose = () => { if (gen !== ws.gen) return; s.onerror = s.onclose = null; dead++; if (dead >= NOSTR_RELAYS.length && !opened) unreachable(); };
      }
      ws.later(() => { if (!opened) unreachable(); }, 7000);
    },
    onEvent(data) {
      let m;
      try { m = JSON.parse(data); } catch (e) { return; }
      if (m[0] !== 'EVENT' || !m[2] || m[2].kind !== NOSTR_KIND) return;
      const c = m[2].content, i1 = c.indexOf('|'), i2 = c.indexOf('|', i1 + 1), i3 = c.indexOf('|', i2 + 1);
      if (i3 < 0) return;
      const to = c.slice(0, i1), from = c.slice(i1 + 1, i2), seq = c.slice(i2 + 1, i3), payload = c.slice(i3 + 1);
      if (from === me) return;
      const key = from + ':' + seq;
      if (ws.seen.has(key)) return;
      ws.seen.add(key);
      if (ws.seen.size > 800) ws.seen.delete(ws.seen.values().next().value);
      if (to !== '*' && to !== me && !(to === 'h' && ws.role === 'host')) return;
      const isCtl = payload.startsWith('{"c":');
      if (ws.role === 'host') {
        if (ws.guest && from === ws.guest) ws.peerSeen = Date.now();
        if (!isCtl) { if (from === ws.guest) ws.onmessage({ data: payload }); return; }
        const ctl = JSON.parse(payload).c;
        if (ctl === 'whois') { if (ws.created) ws.raw('*', '{"c":"iam"}'); }
        else if (ctl === 'iam') { if (!ws.created) ws.whoisHit = true; }
        else if (ctl === 'hello' && ws.created) {
          if (!ws.guest || ws.guest === from) { const fresh = ws.guest !== from; ws.guest = from; ws.peerSeen = Date.now(); ws.raw(from, '{"c":"ack"}'); if (fresh) ws.emit({ t: 'peer' }); }
          else ws.raw(from, '{"c":"full"}');
        } else if (ctl === 'bye' && from === ws.guest) { ws.guest = null; ws.emit({ t: 'left' }); }
      } else if (ws.role === 'guest') {
        if (ws.hostId && from === ws.hostId) ws.peerSeen = Date.now();
        if (!isCtl) { if (from === ws.hostId) ws.onmessage({ data: payload }); return; }
        const ctl = JSON.parse(payload).c;
        if (ctl === 'ack' && !ws.hostId) { ws.hostId = from; ws.peerSeen = Date.now(); ws.emit({ t: 'joined', code: ws.code }); ws.beat(); }
        else if (ctl === 'full') ws.fail('That room is already full.');
        else if (ctl === 'bye' && from === ws.hostId) { ws.emit({ t: 'left' }); ws.close(); }
      }
    },
    beat() {
      const id = setInterval(() => {
        if (ws.readyState === 3) return;
        const alive = Date.now() - ws.peerSeen < 14000;
        if (ws.role === 'host') { if (ws.guest) { ws.raw(ws.guest, '{"c":"hb"}'); if (!alive) { ws.guest = null; ws.emit({ t: 'left' }); } } }
        else if (ws.role === 'guest') { ws.raw('h', '{"c":"hb"}'); if (!alive) { ws.emit({ t: 'left' }); ws.close(); } }
      }, 2500);
      ws.timers.push(id);
    },
    send(str) {
      if (str.startsWith('{"t":"create"')) ws.host(0);
      else if (str.startsWith('{"t":"join"')) ws.join(JSON.parse(str).code);
      else if (ws.role === 'host') { if (ws.guest) ws.raw(ws.guest, str); }
      else if (ws.role === 'guest' && ws.hostId) ws.raw('h', str);
    },
    host(tries) {
      ws.reset();
      ws.role = 'host';
      ws.code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join('');
      ws.tag = 'rs3-' + ws.code; ws.whoisHit = false;
      const gen = ws.gen;
      ws.connectRelays(() => {
        ws.raw('*', '{"c":"whois"}');
        ws.later(() => {
          if (gen !== ws.gen) return;
          if (ws.whoisHit) { if (tries < 8) ws.host(tries + 1); else ws.fail('Could not find a free room code.'); return; }
          ws.created = true; ws.peerSeen = Date.now(); ws.beat();
          ws.emit({ t: 'created', code: ws.code });
        }, 1300);
      });
    },
    join(code) {
      ws.reset();
      ws.role = 'guest'; ws.code = code; ws.tag = 'rs3-' + code;
      const gen = ws.gen;
      ws.connectRelays(() => {
        let tries = 0;
        const hello = () => {
          if (gen !== ws.gen || ws.hostId) return;
          if (tries++ >= 5) { ws.fail('No room with that code, or the host did not answer.'); return; }
          ws.raw('h', JSON.stringify({ c: 'hello', id: me }));
          ws.later(hello, 1600);
        };
        hello();
      });
    },
    bye() { if (ws.role === 'host' && ws.guest) ws.raw(ws.guest, '{"c":"bye"}'); else if (ws.role === 'guest' && ws.hostId) ws.raw('h', '{"c":"bye"}'); },
    close() {
      if (ws.readyState === 3) return;
      ws.readyState = 3;
      ws.bye();
      const socks = ws.socks; ws.socks = [];
      ws.reset();
      setTimeout(() => { for (const s of socks) try { s.close(); } catch (e) { /* closed */ } }, 400);
      if (ws.onclose) ws.onclose();
    },
  };
  setTimeout(() => { ws.readyState = 1; if (ws.onopen) ws.onopen(); }, 0);
  return ws;
}
addEventListener('pagehide', () => { try { if (Net.ws && Net.ws.bye) Net.ws.bye(); } catch (e) { /* leaving */ } });

/* Nostr first; if no relay can be reached at all, fall back to the MQTT broker */
function hybridSocket() {
  const ws = { readyState: 0, onopen: null, onerror: null, onclose: null, onmessage: null, inner: null, pending: null,
    send(str) { if (str.startsWith('{"t":"create"') || str.startsWith('{"t":"join"')) ws.pending = str; ws.inner.send(str); },
    bye() { if (ws.inner && ws.inner.bye) ws.inner.bye(); },
    close() { ws.readyState = 3; ws.inner.close(); } };
  const wire = inner => {
    ws.inner = inner;
    inner.onmessage = ev => ws.onmessage && ws.onmessage(ev);
    inner.onclose = () => { if (ws.inner === inner && ws.onclose) ws.onclose(); };
  };
  const nostr = nostrSocket();
  wire(nostr);
  nostr.onunreachable = () => {
    if (typeof mqtt === 'undefined') { nostr.fail('Could not reach any co-op relay. Check your connection.'); return; }
    const m = mqttSocket();
    wire(m);
    if (ws.pending) m.send(ws.pending);
  };
  setTimeout(() => { ws.readyState = 1; if (ws.onopen) ws.onopen(); }, 0);
  return ws;
}

function connect(then) {
  if (Net.ws && Net.ws.readyState <= 1) { then(); return; }
  const url = coopUrl();
  if (!url && typeof NostrTools === 'undefined' && typeof mqtt === 'undefined') { lobbyStatus('Could not load the co-op library. Check your connection and reload.'); return; }
  lobbyStatus(url ? 'Connecting to the co-op server...' : 'Connecting...');
  const publicSocket = () => typeof NostrTools !== 'undefined' ? hybridSocket() : mqttSocket();
  if (url) useSocket(new WebSocket(url), then, () => useSocket(publicSocket(), then, null));
  else useSocket(publicSocket(), then, null);
}
/* Wire a socket into the lobby. `fallback` runs if the socket fails before it opens; it is only set for the same-host relay. */
function useSocket(ws, then, fallback) {
  let open = false;
  Net.ws = ws;
  ws.onopen = () => { open = true; then(); };
  ws.onerror = () => {
    if (open || Net.ws !== ws) return;
    if (fallback) { ws.onerror = ws.onclose = null; try { ws.close(); } catch (e) { /* not open */ } Net.ws = null; lobbyStatus('Connecting...'); fallback(); return; }
    lobbyStatus('Could not reach the co-op server.');
  };
  ws.onclose = () => {
    if (Net.ws !== ws) return;
    const wasPlaying = Net.peer && G && G.coop;
    Object.assign(Net, { ws: null, peer: false, code: null, role: null });
    if (wasPlaying) { banner('Connection lost', 'Your partner is gone', '#d8354a'); if (G.remote) setTimeout(openMenu, 1500); }
    if (state === 'lobby') { $('roomBox').classList.add('hidden'); renderLobbyChars(); }
  };
  ws.onmessage = ev => onNet(JSON.parse(ev.data));
}
$('btnCreate').onclick = () => { Snd.play('select'); connect(() => Net.ws.send(JSON.stringify({ t: 'create' }))); };
$('btnJoin').onclick = () => {
  const code = $('roomCode').value.trim().toUpperCase();
  if (code.length !== 4) { lobbyStatus('Enter the 4-letter room code.'); return; }
  Snd.play('select');
  connect(() => Net.ws.send(JSON.stringify({ t: 'join', code })));
};
$('btnStartCoop').onclick = () => {
  const seed = Math.random() * 1e9 | 0;
  Net.send({ t: 'start', seed, host: Net.myChar, guest: Net.peerChar });
  newRun(Net.myChar, { seed, coop: { guestChar: Net.peerChar, role: 'host' } });
};
document.querySelectorAll('#lobby [data-back]').forEach(b => { b.onclick = () => { if (Net.ws) Net.ws.close(); Snd.play('select'); openMenu(); }; });

function onNet(m) {
  if (m.t === 'created') { Object.assign(Net, { role: 'host', code: m.code }); $('roomCodeShow').textContent = m.code; $('roomBox').classList.remove('hidden'); lobbyStatus('Room created. Share this code:'); renderLobbyChars(); return; }
  if (m.t === 'joined') { Object.assign(Net, { role: 'guest', code: m.code, peer: true }); $('roomCodeShow').textContent = m.code; $('roomBox').classList.remove('hidden'); lobbyStatus('Joined. Waiting for the host to start.'); Net.send({ t: 'char', id: Net.myChar }); renderLobbyChars(); return; }
  if (m.t === 'peer') { Net.peer = true; Net.send({ t: 'char', id: Net.myChar }); Snd.play('chest'); renderLobbyChars(); return; }
  if (m.t === 'error') { lobbyStatus(m.msg); return; }
  if (m.t === 'left') {
    Net.peer = false;
    if (G && G.coop && Net.role === 'host') { const g = G.players[1]; if (g) { g.down = true; g.hp = 0; } G.coop = null; banner('Your partner left', 'The night goes on', '#a59cc4'); Net.lvl = Net.modal = Net.chest = Net.crypt = Net.gpause = false; if (state === 'wait') setState('play'); }
    else if (G && G.remote) { banner('The host left', '', '#d8354a'); setTimeout(openMenu, 1500); }
    if (state === 'lobby') renderLobbyChars();
    return;
  }
  if (m.t === 'relay') (Net.role === 'host' ? hostMsg : guestMsg)(m.d);
}

/* ---------- Host side ---------- */
const guestPl = () => G && G.players[1];
const asGuest = fn => { const keep = P; P = guestPl(); try { return fn(); } finally { P = keep; } };
function hostMsg(d) {
  if (d.t === 'char') { Net.peerChar = d.id; renderLobbyChars(); return; }
  if (!G || !G.coop) return;
  const g = guestPl();
  switch (d.t) {
    case 'pause':
      Net.gpause = d.on;
      if (d.on) $('waitText').textContent = 'Your partner has paused the game. Please wait.';
      else release();
      break;
    case 'in': g.input = d.v; break;
    case 'act': if (state === 'play') asGuest(() => Mods.first('interact', g)); break;
    case 'pick': if (Net.lvl && G.guestChoices[d.i]) { asGuest(() => applyChoice(G.guestChoices[d.i])); guestLevelDone(); } break;
    case 'skip': if (Net.lvl) guestLevelDone(); break;
    case 'reroll': if (Net.lvl && G.rerolls > 0) { G.rerolls--; sendGuestLevel(); } break;
    case 'mpick': { const def = Net.modal; Net.modal = null; const b = def && def.buttons[d.i]; if (b && !b.disabled && b.act) asGuest(() => b.act()); release(); break; }
    case 'mclose': Net.modal = null; release(); break;
    case 'done':
      Net.chest = false;
      if (G.hostChestOwed) { const note = G.hostChestOwed; G.hostChestOwed = null; openChest(true, note, ME); }   // the crypt gave the host a chest as well
      else release();
      break;
    case 'cryptDone': {
      Net.crypt = false;
      g.hp = clamp(d.hp, 0, g.maxHp); G.gold += d.gold; G.kills += d.kills;
      if (d.st) { const st = regionCache.get(d.st); if (st) st.done = true; }
      if (d.died || g.hp <= 0) asGuest(() => playerDown());
      else if (d.cleared) {
        if (d.relic) dropRelic(d.relic, g.x + 14, g.y);
        if (d.frag) dropFragment(g.x - 14, g.y);
        for (let i = 0; i < (d.deep || 0); i++) dropAt('chest', g.x + 18 * (i + 1), g.y + 10, { boss: true });
        for (const t of d.rescued || []) if (ALLY_TYPES[t]) recruit(t, g);
        Mods.call('remoteChest', g, true);
        G.hostChestOwed = { icon: 'star', name: 'Crypt cleared by your partner', lv: 'A chest for each of you' };
      }
      release();
      break;
    }
  }
}
function release() { if (!Net.busy() && state === 'wait') setState('play'); }
function sendGuestLevel() {
  G.guestChoices = asGuest(() => rollChoices(3));
  const cards = asGuest(() => G.guestChoices.map(choiceInfo));
  Net.send({ t: 'lvl', cards, rerolls: G.rerolls });
}
function guestLevelDone() {
  Net.lvl = false;
  if (Net.afterGuest) { const f = Net.afterGuest; Net.afterGuest = null; f(); }
  else release();
}
/* Level-ups are one player at a time: the host chooses while the guest's screen is held, then the guest chooses while the
   host waits. Each level gives both of them an upgrade. */
const baseOpenLevelUp = openLevelUp;
openLevelUp = function () {
  if (Net.role === 'host' && Net.active() && !Net.lvl && guestPl() && !guestPl().down) {
    G.guestOwed = true;
    Net.send({ t: 'hold', text: 'Your partner is choosing an upgrade...' });
  }
  baseOpenLevelUp();
};
const baseFinishLevel = finishLevel;
finishLevel = function () {
  if (Net.role === 'host' && G.guestOwed && !(G.lvQueue && G.lvQueue.length)) {
    G.guestOwed = false;
    if (Net.active() && guestPl() && !guestPl().down) {
      Net.lvl = true; sendGuestLevel();
      Net.afterGuest = baseFinishLevel; setState('wait'); $('waitText').textContent = 'Your partner is choosing an upgrade...';
      return;
    }
  }
  baseFinishLevel();
};
const baseUpdate = update;
update = function (dt) {
  if (Net.role === 'host' && Net.busy() && G.coop) { setState('wait'); return; }
  baseUpdate(dt);
  if (Net.role === 'host' && Net.active()) {
    const now = performance.now();
    if (now - Net.lastSnap > 66) { Net.lastSnap = now; Net.send(snapshot()); }
  }
};
const baseSndPlay = Snd.play;
Snd.play = function (name, p) { baseSndPlay(name, p); if (Net.role === 'host' && G && G.coop && Net.sfx.length < 30 && !Net.sfx.includes(name)) Net.sfx.push(name); };
const baseBanner = banner;
banner = function (t, s, c) { baseBanner(t, s, c); if (Net.role === 'host' && G && G.coop) Net.banners.push([t, s, c]); };
Mods.add({
  kill(e) { if (Net.role === 'host' && G.coop && Net.kills.length < 40) Net.kills.push([e.x | 0, e.y | 0, e.type, e.scale || 1]); },
  remoteModal(actor, def) {
    if (!Net.active()) return true;
    Net.modal = def;
    $('waitText').textContent = 'Your partner is busy...';
    Net.send({ t: 'modal', def: { title: def.title, sub: def.sub, body: def.body, color: def.color, buttons: def.buttons.map(b => ({ label: b.label, desc: b.desc, primary: b.primary, disabled: b.disabled })) } });
    return true;
  },
  remoteChest(pl, boss) {
    if (!Net.active()) return false;
    const rows = asGuest(() => {
      const out = [], evo = pl.weapons.find(canEvolve);
      if (evo) { evo.evo = true; evo.level = WEAPON_MAX(evo.id); recalc(); out.push({ icon: evo.id, name: WEAPONS[evo.id].evoName, lv: WEAPONS[evo.id].evoDesc, evo: true }); }
      const n = boss ? 3 : Math.random() < 0.25 ? 3 : 1;
      while (out.length < n) { const c = rollChoices(1, true)[0]; if (!c) break; const info = choiceInfo(c); applyChoice(c); out.push({ icon: info.icon, name: info.name, lv: info.lv + ' · ' + info.desc }); }
      const gold = Math.round(rand(15, 40) * (boss ? 3 : 1) * pl.greed);
      G.gold += gold;
      out.push({ icon: 'gold', name: gold + ' gold', lv: 'Shared with your partner' });
      return out;
    });
    Net.chest = true;
    $('waitText').textContent = 'Your partner is opening a chest...';
    Net.send({ t: 'chest', rows });
    return true;
  },
  remoteCrypt(pl, theme, st) {
    if (!Net.active()) return;
    Net.crypt = true;
    $('waitText').textContent = 'Your partner is exploring below. The night waits for them.';
    Net.send({ t: 'crypt', theme, st: st ? st.id : null });
  },
});

/* compact snapshot of everything the guest needs to draw */
const r1 = v => Math.round(v * 10) / 10;
function wvis(p) { return p.weapons.map(w => [w.id, w.level, w.evo ? 1 : 0, r1(w.ang || 0), r1(w.active || 0), w.s ? r1(w.s.area) : 1, w.s ? w.s.amount : 1, w.s ? r1(w.s.dur) : 1, w.dealt | 0]); }
function snapshot() {
  const g = guestPl(), vx = g.x, vy = g.y, mx = W * 0.75 + 60, my = H * 0.75 + 60;
  const inView = (x, y) => Math.abs(x - vx) < mx && Math.abs(y - vy) < my;
  const s = {
    t: 'snap',
    g: [r1(G.t), G.level, r1(G.xp), G.xpNext, G.kills, G.gold, G.dim, G.dimPhase || '', r1(G.dimT || 0), G.won ? 1 : 0, G.over ? 1 : 0, r1(G.shake), G.fragments || 0, G.darkMul || 0, r1(G.dimLeft || 0), r1(G.advanceT || 0)],
    al: (G.allies || []).map(a => [a.id, a.type, r1(a.x), r1(a.y), a.face, a.moving ? 1 : 0, r1(a.anim), Math.round(a.hp), a.maxHp, a.down ? 1 : 0, r1(a.reviveT)]),
    sp: G.spawner ? [r1(G.spawner.x), r1(G.spawner.y), G.spawner.on ? 1 : 0, G.spawner.dim] : null,
    bf: G.buffs,
    pl: G.players.map(p => [r1(p.x), r1(p.y), r1(p.hp), p.maxHp, p.face, p.moving ? 1 : 0, r1(p.anim), p.down ? 1 : 0, r1(p.reviveT), r1(p.inv), p.ch.id, r1(p.hurtT || 0), wvis(p)]),
    me: { might: g.might, armor: g.armor, luck: g.luck, greed: g.greed, blood: g.blood, maxHp: g.maxHp, magnet: g.magnet, passives: g.passives, relics: g.relics || [] },
    en: [], pr: [], bu: [], ge: [], it: [], po: [], to: [], hz: [], fx: [], tx: [],
    sh: G.shrines.filter(x => inView(x.x, x.y)).map(x => [r1(x.x), r1(x.y), x.uses, x.kind || 'fortune', r1(x.ph || 0), x.spent || 0]),
    cr: G.crypts.map(c => [r1(c.x), r1(c.y)]),
    pt: (G.portals || []).map(p => [p.dim, r1(p.x), r1(p.y), r1(p.t)]),
    sfx: Net.sfx.splice(0), bn: Net.banners.splice(0), kl: Net.kills.splice(0),
    ev: G.ev && G.ev.x !== undefined ? [G.ev.kind, r1(G.ev.x), r1(G.ev.y), r1(G.ev.t), G.ev.fall ?? -1, r1(G.ev.mine || 0), G.ev.dur, G.ev.name] : G.ev ? [G.ev.kind, 0, 0, r1(G.ev.t), -1, 0, G.ev.dur, G.ev.name] : null,
    boss: G.boss && !G.boss.dead ? [G.boss.name, r1(G.boss.hp / G.boss.maxHp)] : null,
    pend: state === 'levelup' || state === 'wait' ? 1 : 0,
  };
  for (const e of G.enemies) {
    if (e.dead || !inView(e.x, e.y)) continue;
    const b = e.def ? [e.phase || 0, e.lock > e.clock ? 1 : 0, r1(e.z || 0), e.trail ? e.trail.filter((_, i) => i % 6 === 0).slice(0, 16).map(([x, y]) => [r1(x), r1(y)]) : 0, r1(e.burrow || 0), e.emergeAt || 0, r1(e.surf ?? 1), (e.tentacles || []).map(t => [r1(t.x), r1(t.y), r1(t.ang), r1(t.t)]), r1(e.blinkT || 0)] : 0;
    s.en.push([e.id, e.prop ? (e.graveOf ? 'grave' : 'brazier') : e.type, r1(e.x), r1(e.y), e.dir || 1, e.flash > 0.05 ? 1 : 0, e.freeze > 0 ? 1 : e.slow > 0 ? 2 : 0, r1(e.hp / e.maxHp), e.elite ? 1 : 0, r1(e.anim), r1(e.rise || 0), e.dawn !== undefined ? r1(e.dawn) : -1, b, e.sortY ?? null]);
  }
  for (const p of G.projs) if (inView(p.x, p.y)) s.pr.push([p.k, r1(p.x), r1(p.y), r1(p.vx || 0), r1(p.vy || 0), r1(p.ang ?? p.rot ?? 0), p.evo ? 1 : 0, r1(p.area || 1), r1(p.z || 0)]);
  for (const b of G.bullets) if (inView(b.x, b.y)) s.bu.push([r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.r, b.c, b.style || 0, r1(b.z || 0)]);
  for (const x of G.gems) if (inView(x.x, x.y)) s.ge.push([r1(x.x), r1(x.y), x.tier]);
  for (const x of G.items) if (inView(x.x, x.y)) s.it.push([x.k, r1(x.x), r1(x.y), x.b || x.relic || 0]);
  for (const x of G.pools) if (inView(x.x, x.y)) s.po.push([r1(x.x), r1(x.y), r1(x.r), r1(x.life), x.evo ? 1 : 0, x.seed | 0]);
  for (const x of G.totems) if (inView(x.x, x.y)) s.to.push([r1(x.x), r1(x.y), r1(x.life), x.w.evo ? 1 : 0]);
  for (const h of G.hazards) s.hz.push([h.k, r1(h.x), r1(h.y), h.r || 0, h.r0 || 0, r1(h.cur || 0), r1(h.ang || 0), h.len || 0, h.w || 0, h.spread || 0, h.warn, r1(h.t), h.life, h.color, h.liveColor || 0, h.squash || 0]);
  for (const f of G.fx) {
    const o = f.o ? G.players.indexOf(f.o) : -1;
    if (f.k === 'bolt') s.fx.push(['bolt', r1(f.t), f.dur, f.pts.map(([x, y]) => [r1(x), r1(y)])]);
    else s.fx.push([f.k, r1(f.t), f.dur, o, r1(f.x || 0), r1(f.y || 0), r1(f.r || 0), r1(f.ang || 0), r1(f.arc || 0), f.evo ? 1 : 0, f.c || 0, r1(f.max || 0), f.delay || 0]);
  }
  for (const t of G.texts) if (inView(t.x, t.y)) s.tx.push([r1(t.x), r1(t.y), t.s, t.c, r1(t.life), t.max, t.scale]);
  return s;
}

/* ---------- Guest side ---------- */
const NET_ENEMY = {};
function guestMsg(d) {
  if (d.t === 'char') { Net.peerChar = d.id; renderLobbyChars(); return; }
  if (d.t === 'start') { startGuest(d); return; }
  if (!G || !G.remote) return;
  if (d.t === 'pause') {
    Net.hpause = d.on;
    if (d.on && state === 'play') { $('waitText').textContent = 'Your partner has paused the game. Please wait.'; setState('wait'); }
    else if (!d.on && state === 'wait') setState('play');
  } else if (d.t === 'hold') {   // the host is choosing an upgrade: this screen freezes until its turn
    Net.hold = true;
    if (state === 'play') { $('waitText').textContent = d.text; setState('wait'); }
  } else if (d.t === 'snap') {
    if (Net.hold && state === 'wait' && !Net.hpause) setState('play');   // the host is simulating again
    Net.hold = false;
    applySnap(d);
  } else if (d.t === 'lvl') { Net.hold = false; showGuestLevel(d); }
  else if (d.t === 'modal') openModal({ ...d.def, buttons: d.def.buttons.map((b, i) => ({ ...b, act: () => Net.send({ t: 'mpick', i }) })) }, ME);
  else if (d.t === 'chest') {
    Snd.play('chest');
    openModal({ title: 'Treasure', color: '#ffd35a', sub: 'Your partner waits while you look', body: d.rows.map(r => `<div class="rew${r.evo ? ' evo' : ''}"><div class="ic"><img src="${ICON_URL[r.icon]}" alt=""></div><div><div class="name">${r.name}</div><div class="lv">${r.lv}</div></div></div>`).join(''),
      buttons: [{ label: 'Continue', primary: true, act: () => Net.send({ t: 'done' }) }] }, ME);
  } else if (d.t === 'crypt') { G.cryptStart = { gold: G.gold, kills: G.kills, st: d.st }; enterCrypt(null, d.theme, d.st ? { id: d.st } : null); }
  else if (d.t === 'over') { G.remote = false; G.over = true; gameOver(d.won); }
}
function startGuest(d) {
  D = null; DP = null;
  G = {
    remote: true, t: 0, enemies: [], projs: [], bullets: [], gems: [], items: [], parts: [], texts: [], fx: [], pools: [], totems: [], shrines: [], crypts: [], portals: [], hazards: [], wells: [],
    allies: [], level: 1, xp: 0, xpNext: 5, kills: 0, gold: 0, shake: 0, slowT: 0, hurtFlash: 0, whiteFlash: 0, boss: null, buffs: {}, players: [], coop: { role: 'guest' },
    seed: d.seed, dim: null, won: false, over: false, winT: 0, choices: [], rerolls: 0, fragments: 0, keys: {}, revivals: 0, shrineCost: 25,
  };
  Object.defineProperties(G, { weapons: { get: () => P.weapons }, passives: { get: () => P.passives }, ch: { get: () => P.ch }, p: { get: () => ME } });
  resetWorldCache();
  regionCache.clear();
  G.players = [makePlayer(d.host), makePlayer(d.guest, 18, 0)];
  ME = P = G.players[1];
  for (const p of G.players) { p.weapons = []; p.relics = []; p.bonus = {}; p.might = 1; p.greed = 1; p.magnet = 32; p.luck = 0; p.armor = 0; p.blood = 0; }
  setState('play');
  Snd.music(1);
  banner('The night begins', 'Stay close to your partner', '#ffd35a');
}
let lastBuild = '';
function applySnap(s) {
  const [t, level, xp, xpNext, kills, gold, dim, dimPhase, dimT, won, over, shake, frags, darkMul, dimLeft, advanceT] = s.g;
  if (dim !== G.dim) { G.dim = dim; G.dimStructs = !!dim; regionCache.clear(); biomeOverride = dim ? (dim === 'island' ? isleBiome : () => dim) : null; resetWorldCache(); }
  Object.assign(G, { t, level, xp, xpNext, kills, gold, dimPhase, dimT, won: !!won, shake: Math.max(G.shake, shake), fragments: frags, darkMul: darkMul || null, buffs: s.bf, dimLeft, advanceT });
  G.spawner = s.sp ? { x: s.sp[0], y: s.sp[1], on: !!s.sp[2], dim: s.sp[3] } : null;
  const keepAl = new Map((G.allies || []).map(a => [a.id, a]));
  G.allies = (s.al || []).map(([id, type, x, y, face, moving, anim, hp, maxHp, down, reviveT]) => {
    const a = keepAl.get(id) || { id, isAlly: true, type, t: ALLY_TYPES[type], name: ALLY_TYPES[type].name, frames: NPC_SPR[ALLY_TYPES[type].spr], x, y, hurtT: 0 };
    if (a.x === undefined || Math.hypot(a.x - x, a.y - y) > 60) { a.x = x; a.y = y; }
    a.tx = x; a.ty = y;
    return Object.assign(a, { face, moving: !!moving, anim, hp, maxHp, down: !!down, reviveT });
  });
  s.pl.forEach((a, i) => {
    const p = G.players[i];
    if (!p) return;
    const [x, y, hp, maxHp, face, moving, anim, down, reviveT, inv, chId, hurtT, wv] = a;
    p.tx = x; p.ty = y;
    if (p.x === undefined || Math.hypot(p.x - x, p.y - y) > 60) { p.x = x; p.y = y; }
    Object.assign(p, { hp, maxHp, face, moving: !!moving, anim, down: !!down, reviveT, inv, hurtT });
    if (p.ch.id !== chId) { p.ch = CHARS.find(c => c.id === chId); p.frames = charFrames(chId); }
    p.weapons = wv.map(([id, lvl, evo, ang, active, area, amount, dur, dealt]) => ({ id, level: lvl, evo: !!evo, ang, active, dealt, s: { area, amount, dur } }));
  });
  Object.assign(ME, s.me);
  const sig = JSON.stringify([ME.weapons.map(w => [w.id, w.level, w.evo]), ME.passives]);
  if (sig !== lastBuild) { lastBuild = sig; refreshSlots(); }
  const seen = new Set();
  G.enemies = s.en.map(a => {
    const [id, type, x, y, dir, flash, status, hpk, elite, anim, rise, dawn, bx, sortY] = a;
    seen.add(id);
    let e = NET_ENEMY[id];
    if (!e) {
      e = NET_ENEMY[id] = netEnemy(id, type, x, y);
    }
    e.tx = x; e.ty = y;
    Object.assign(e, { dir, flash: flash ? 0.1 : 0, freeze: status === 1 ? 1 : 0, slow: status === 2 ? 1 : 0, hp: hpk * (e.maxHp || 1), elite: !!elite, anim, rise, dead: false });
    if (dawn >= 0) e.dawn = dawn; else delete e.dawn;
    if (sortY !== null) e.sortY = sortY;
    if (bx && e.def) {
      const [phase, lockOn, z, trail, burrow, emergeAt, surf, tent, blinkT] = bx;
      Object.assign(e, { phase, lock: lockOn ? 1 : 0, clock: 0, z, burrow, emergeAt, surf, blinkT, tentacles: tent.map(([tx, ty, ang, tt]) => ({ x: tx, y: ty, ang, t: tt })) });
      if (trail) { e.trail = []; for (const [tx2, ty2] of trail) for (let k = 0; k < 6; k++) e.trail.push([tx2, ty2]); }
    }
    return e;
  });
  for (const id in NET_ENEMY) if (!seen.has(+id)) delete NET_ENEMY[id];
  G.projs = s.pr.map(([k, x, y, vx, vy, a, evo, area, z]) => ({ k, x, y, vx, vy, ang: a, rot: a, evo: !!evo, area, z, life: 1 }));
  G.bullets = s.bu.map(([x, y, vx, vy, r, c, style, z]) => { const b = { x, y, vx, vy, r, c, z, life: 1 }; if (style) { b.style = style; b.draw = drawStyledBullet; } return b; });
  G.gems = s.ge.map(([x, y, tier]) => ({ x, y, tier, ph: (x + y) % 6 }));
  G.items = s.it.map(([k, x, y, extra]) => {
    const it = { k, x, y, ph: (x * 7 + y) % 6 };
    if (k === 'buff') { it.b = extra; it.spr = SPR.buff[extra]; }
    if (k === 'relic') it.spr = ICON[RELICS[extra].icon];
    if (k === 'fragment') it.spr = BUILD.fragment;
    if (k === 'key') it.spr = BUILD.key;
    return it;
  });
  G.pools = s.po.map(([x, y, r, life, evo, seed]) => ({ x, y, r, life, evo: !!evo, seed }));
  G.totems = s.to.map(([x, y, life, evo]) => ({ isTotem: true, x, y, life, w: { evo: !!evo } }));
  G.shrines = s.sh.map(([x, y, uses, kind, ph, spent]) => ({ isShrine: true, x, y, uses, kind, ph, spent }));
  G.crypts = s.cr.map(([x, y]) => ({ isCrypt: true, x, y, ph: 0 }));
  G.portals = s.pt.map(([dim2, x, y, pt]) => ({ isPortal: true, dim: dim2, x, y, t: pt, sortY: y, draw(now) { drawPortal(this, now); } }));
  G.hazards = s.hz.map(([k, x, y, r, r0, cur, ang, len, w, spread, warn, ht, life, color, liveColor, squash]) => ({ k, x, y, r, r0, cur, ang, len, w, spread, warn, t: ht, life, color, liveColor: liveColor || undefined, squash: squash || undefined, hit: new Set() }));
  G.fx = s.fx.map(a => {
    if (a[0] === 'bolt') return { k: 'bolt', t: a[1], dur: a[2], pts: a[3] };
    const [k, ft, dur, o, x, y, r, ang, arc, evo, c, max, delay] = a;
    return { k, t: ft, dur, o: G.players[o] || undefined, x, y, r, ang, arc, evo: !!evo, c, max, delay, hit: new Set() };
  });
  G.texts = s.tx.map(([x, y, str, c, life, max, scale]) => ({ x, y, s: str, c, life, max, scale }));
  for (const name of s.sfx) Snd.play(name);
  for (const [bt, bs, bc] of s.bn) banner(bt, bs, bc);
  for (const [x, y, type, sc] of s.kl) { const f = (SPR[ENEMIES[type]?.spr] || SPR.ghoul)[0]; disintegrate({ x, y }, f, sc); }
  G.ev = s.ev ? { kind: s.ev[0], x: s.ev[0] === 'bloodmoon' ? undefined : s.ev[1], y: s.ev[2], t: s.ev[3], fall: s.ev[4] < 0 ? undefined : s.ev[4], mine: s.ev[5], dur: s.ev[6], name: s.ev[7] } : null;
  if (s.boss) { G.boss = { name: s.boss[0], hp: s.boss[1], maxHp: 1 }; $('bossname').textContent = s.boss[0]; $('bossbar').classList.remove('hidden'); }
  else if (G.boss) { G.boss = null; $('bossbar').classList.add('hidden'); }
  if (over && !G.over) { G.over = true; }
}
function netEnemy(id, type, x, y) {
  if (type === 'brazier') return { id, prop: true, x, y, r: 5, d: { color: '#e8742c' }, frames: [SPR.brazier], anim: 0, hh: 4, scale: 1, maxHp: 1 };
  if (type === 'grave') return { id, prop: true, x, y, r: 5, d: { color: '#5e557f' }, frames: [DECOR.grave], maxHp: 1, hh: 4, scale: 1, draw() { blit(DECOR.grave.c, this.x, this.y - 4, 8, 9); }, sortY: y };
  const def = BOSS_DEFS[type];
  if (def) {
    const frames = def.frames ? def.frames() : SPR.colossus;
    return { id, type, boss: true, def, name: def.name, x, y, r: def.r || 16, frames, scale: def.scale || 2, d: { color: def.color, anim: 0.35 }, maxHp: 1, hh: frames[0].h / 2, clock: 0, lock: 0, drawFn: def.draw || drawSpriteBoss, trail: [], tentacles: [], segs: 14 };
  }
  const d = ENEMIES[type] || ENEMIES.ghoul;
  const frames = SPR[d.spr];
  return { id, type, d, x, y, r: d.r, frames, scale: 1, maxHp: 1, hh: frames[0].h / 2, elite: !!d.elite };
}
// Guest frame: smooth toward the latest snapshot and keep local effects alive
Mods.add({
  remoteUpdate(dt) {
    const k = Math.min(1, dt * 14);
    for (const p of G.players) if (p.tx !== undefined) { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
    for (const e of G.enemies) if (e.tx !== undefined) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
    for (const a of G.allies || []) if (a.tx !== undefined) { a.x += (a.tx - a.x) * k; a.y += (a.ty - a.y) * k; }
    for (const p of G.projs) { p.x += p.vx * dt; p.y += p.vy * dt; }
    for (const b of G.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const f of G.fx) f.t += dt;
    for (const h of G.hazards) h.t += dt;
    for (const t of G.texts) { t.life -= dt; t.y -= 26 * dt; }
    G.shake = Math.max(0, G.shake - dt * 18);
    G.hurtFlash = Math.max(0, G.hurtFlash - dt);
    for (const pl of G.players) if (!G.dim) for (const st of structsNear(pl.x, pl.y)) if (!st.built) buildStruct(st);
    updateParts(dt);
    const now = performance.now();
    const iv = ME.down ? [0, 0] : inputVec(), same = Net.lastV && Net.lastV[0] === iv[0] && Net.lastV[1] === iv[1];
    if ((!same && now - Net.lastIn > 60) || now - Net.lastIn > 250) { Net.lastIn = now; Net.lastV = iv; Net.send({ t: 'in', v: iv }); }
    updateHud();
  },
});
const baseInteract = interact;
interact = function () { if (G && G.remote) { if (state === 'play') Net.send({ t: 'act' }); return; } baseInteract(); };
function showGuestLevel(d) {
  setState('levelup');
  Snd.play('levelup');
  const box = $('luCards');
  box.innerHTML = '';
  d.cards.forEach((info, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.style.animationDelay = i * 0.06 + 's';
    b.innerHTML = `<span class="key">${i + 1}</span><div class="top"><div class="ic"><img src="${ICON_URL[info.icon]}" alt=""></div><div><div class="name">${info.name}</div><div class="lv ${info.cls || ''}">${info.lv}</div></div></div><div class="desc">${info.desc}</div>`;
    b.onclick = () => guestPick(i);
    box.appendChild(b);
  });
  G.netCards = d.cards.length;
  $('btnReroll').textContent = `Reroll (${d.rerolls})`;
  $('btnReroll').disabled = d.rerolls <= 0;
}
function guestPick(i) { if (state !== 'levelup') return; Snd.play('select'); Net.send({ t: 'pick', i }); setState('play'); }
const hostReroll = $('btnReroll').onclick, hostSkip = $('btnSkip').onclick;
$('btnReroll').onclick = () => { if (G && G.remote) { Net.send({ t: 'reroll' }); return; } hostReroll(); };
$('btnSkip').onclick = () => { if (G && G.remote) { Net.send({ t: 'skip' }); setState('play'); return; } hostSkip(); };
const basePickChoice = pickChoice;
pickChoice = function (i) { if (G && G.remote) { if (i < (G.netCards || 0)) guestPick(i); return; } basePickChoice(i); };

// Guest dungeons are played here and reported back to the host
const coopFinish = finishCrypt, coopDeath = cryptDeath;
finishCrypt = function () {
  if (!(G && G.remote)) {
    coopFinish();
    // the host's crypt hands the guest a chest too
    if (Net.role === 'host' && Net.active() && guestPl() && !guestPl().down) Mods.call('remoteChest', guestPl(), true);
    return;
  }
  const theme = D.theme || 'crypt', swift = D.t <= CRYPT_PAR * (D.floor || 1);
  const deep = D.deep || 0, relic = cryptRelic(theme, deep), frag = cryptFrag(theme, deep, D.oreCount || 0), rescued = [...(D.rescued || [])];
  if (swift) P.hp = P.maxHp;
  Net.send({ t: 'cryptDone', cleared: true, hp: P.hp, gold: G.gold - G.cryptStart.gold + Math.round((swift ? 100 : 40) * (1 + 0.9 * deep)), kills: G.kills - G.cryptStart.kills, st: G.cryptStart.st, relic, frag, deep, rescued });
  D.dead = true;
  leaveCrypt(() => {});
};
cryptDeath = function () {
  if (!(G && G.remote)) { coopDeath(); return; }
  D.dead = true;
  Snd.play('death');
  Net.send({ t: 'cryptDone', died: true, hp: 0, gold: G.gold - G.cryptStart.gold, kills: G.kills - G.cryptStart.kills });
  setTimeout(() => leaveCrypt(() => {}), 900);
};

// Host tells the guest when the run ends
const coopGameOver = gameOver;
gameOver = function (won) {
  if (Net.role === 'host' && G && G.coop && Net.active()) Net.send({ t: 'over', won });
  coopGameOver(won);
};
// Pausing in co-op tells the partner, who sees "please wait" (the host's pause also freezes the simulation)
Mods.add({
  state(s) {
    if (s === 'wait') $('waitText').textContent = $('waitText').textContent || 'Waiting for your partner...';
    const paused = s === 'pause' && !!(G && (G.coop || G.remote));
    if (paused !== !!Net.pauseSent) { Net.pauseSent = paused; Net.send({ t: 'pause', on: paused }); }
  },
});
