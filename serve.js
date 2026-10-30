// Cinderwake server: serves the game and relays co-op rooms over WebSocket (no dependencies).
// Local:  node serve.js [port]  ->  http://localhost:8765
// Hosted: set PORT (Render, Fly.io and Railway do this for you) and run `node serve.js`.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = __dirname, port = +process.env.PORT || +process.argv[2] || 8765;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html');
  const file = path.join(root, rel);
  if (!file.startsWith(root) || rel.includes('serve.js')) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

/* ---------- Minimal WebSocket (RFC 6455, text frames) ---------- */
function upgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return null; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const ws = { alive: true, onmessage: () => {}, onclose: () => {} };
  let buf = Buffer.alloc(0), frags = [];
  const frame = (op, data) => {
    const len = data.length;
    const head = len < 126 ? Buffer.from([0x80 | op, len])
      : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255])
      : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h; })();
    if (ws.alive) socket.write(Buffer.concat([head, data]));
  };
  ws.send = str => frame(1, Buffer.from(str));
  ws.close = () => { if (ws.alive) { frame(8, Buffer.alloc(0)); socket.end(); } };
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80;
      let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 4 * 1024 * 1024) { socket.destroy(); return; }
      if (buf.length < off + (masked ? 4 : 0) + len) return;
      const mask = masked ? buf.subarray(off, off + 4) : null;
      if (masked) off += 4;
      const payload = Buffer.from(buf.subarray(off, off + len));
      if (mask) for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
      buf = buf.subarray(off + len);
      if (op === 8) { ws.close(); return; }
      if (op === 9) { frame(10, payload); continue; }
      if (op === 1 || op === 0) {
        frags.push(payload);
        if (fin) { const msg = Buffer.concat(frags).toString(); frags = []; try { ws.onmessage(msg); } catch (e) { /* bad message */ } }
      }
    }
  });
  const end = () => { if (!ws.alive) return; ws.alive = false; ws.onclose(); };
  socket.on('close', end);
  socket.on('error', end);
  return ws;
}

/* ---------- Rooms: a host and one guest, addressed by a 4-letter code ---------- */
const rooms = new Map();
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => ALPHA[Math.random() * ALPHA.length | 0]).join(''); } while (rooms.has(c)); return c; };
server.on('upgrade', (req, socket) => {
  if (!req.url.startsWith('/ws')) { socket.destroy(); return; }
  const ws = upgrade(req, socket);
  if (!ws) return;
  let room = null;
  const peer = () => room && (room.host === ws ? room.guest : room.host);
  ws.onmessage = raw => {
    const m = JSON.parse(raw);
    if (m.t === 'create') {
      const want = String(m.code || '').toUpperCase();
      const code = /^[A-Z]{4}$/.test(want) && !rooms.has(want) ? want : newCode();
      room = { code, host: ws, guest: null };
      rooms.set(code, room);
      ws.send(JSON.stringify({ t: 'created', code }));
    } else if (m.t === 'join') {
      const r = rooms.get(String(m.code || '').toUpperCase());
      if (!r) { ws.send(JSON.stringify({ t: 'error', msg: 'No room with that code.' })); return; }
      if (r.guest) { ws.send(JSON.stringify({ t: 'error', msg: 'That room is already full.' })); return; }
      r.guest = ws; room = r;
      ws.send(JSON.stringify({ t: 'joined', code: r.code }));
      r.host.send(JSON.stringify({ t: 'peer' }));
    } else if (m.t === 'relay') {
      const p = peer();
      if (p) p.send(JSON.stringify({ t: 'relay', d: m.d }));
    }
  };
  ws.onclose = () => {
    if (!room) return;
    const p = peer();
    if (p) p.send(JSON.stringify({ t: 'left' }));
    if (room.host === ws) { rooms.delete(room.code); if (room.guest) room.guest.close(); }
    else room.guest = null;
  };
});

server.listen(port, '0.0.0.0', () => console.log(`Cinderwake running at http://localhost:${port}`));
