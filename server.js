// DEADLANDS — online co-op server. Serves the game page and runs each world.
//
// Two kinds of online worlds:
//  • HOSTED rooms (4-letter code): the world lives in the host's browser; the room ends when everyone leaves.
//  • SERVER worlds (5-letter code): the world is saved on this server. Anyone with the code can join at any
//    time — even when the owner is offline. The world pauses when nobody is on and wakes up when someone joins.
//    The owner's browser also keeps a backup, so if a free server restarts and forgets its files, the owner's
//    browser puts the world back automatically.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const DL = require('./public/world.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'saves');
const MAX_PLAYERS = 8;
const MAX_SERVERS = 40;
const AUTOSAVE_SEC = 45;
const SERVER_SAVE_SEC = 60;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
const rooms = new Map();    // code -> running room (hosted or server world)
const servers = new Map();  // code -> { code, name, owner, updated, day, time }
let nextClientId = 1;

const hashTok = (t) => crypto.createHash('sha256').update('deadlands:' + String(t)).digest('hex');
const validTok = (t) => typeof t === 'string' && t.length >= 16 && t.length <= 80;
const cleanWorldName = (n) => String(n || 'My World').replace(/[<>]/g, '').trim().slice(0, 30) || 'My World';
const fileOf = (code) => path.join(DATA_DIR, 'world-' + code + '.json');
const dayOf = (save) => Math.floor((save.time || 0) / DL.CYCLE) + 1;

// ----- server-world storage -----
for (const f of (() => { try { return fs.readdirSync(DATA_DIR); } catch (e) { return []; } })()) {
  const m = /^world-([A-Z]{5})\.json$/.exec(f); if (!m) continue;
  try { const j = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); servers.set(m[1], { code: m[1], name: j.name, owner: j.owner, updated: j.updated || 0, day: dayOf(j.save), time: j.save.time || 0 }); }
  catch (e) { console.log('Could not read', f); }
}
console.log('Server worlds loaded:', servers.size);
function writeServer(sv, save) {
  sv.updated = Date.now(); sv.day = dayOf(save); sv.time = save.time || 0;
  const body = JSON.stringify({ code: sv.code, name: sv.name, owner: sv.owner, updated: sv.updated, save });
  const tmp = fileOf(sv.code) + '.tmp';
  try { fs.writeFileSync(tmp, body); fs.renameSync(tmp, fileOf(sv.code)); } catch (e) { console.log('Save failed for', sv.code, e.message); }
}
function readServerSave(code) { try { return JSON.parse(fs.readFileSync(fileOf(code), 'utf8')).save; } catch (e) { return null; } }
function makeCode(len) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) { let c = ''; for (let i = 0; i < len; i++) c += A[Math.floor(Math.random() * A.length)]; if (!rooms.has(c) && !servers.has(c)) return c; }
}
function liveSave(sv) { const r = rooms.get(sv.code); return r && r.game ? r.game.toSave() : readServerSave(sv.code); }

// ----- HTTP: game files + server-world API -----
function readBody(req, cb) {
  let size = 0; const chunks = [];
  req.on('data', (d) => { size += d.length; if (size > 8 * 1024 * 1024) { req.destroy(); return; } chunks.push(d); });
  req.on('end', () => { try { cb(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { cb(null); } });
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(obj)); }
function serverList() {
  return [...servers.values()].sort((a, b) => b.updated - a.updated).map(sv => {
    const r = rooms.get(sv.code);
    return { code: sv.code, name: sv.name, day: r ? r.game.day() : sv.day, players: r ? r.clients.length : 0, updated: sv.updated };
  });
}
function api(req, res, url) {
  if (url === '/api/servers' && req.method === 'GET') return json(res, 200, { servers: serverList() });
  if (url === '/api/servers' && req.method === 'POST') return readBody(req, (b) => {
    if (!b || !validTok(b.tok)) return json(res, 400, { error: 'Bad request' });
    if (servers.size >= MAX_SERVERS) return json(res, 400, { error: 'This server already has ' + MAX_SERVERS + ' worlds — delete one first.' });
    let game;
    try { game = b.save && typeof b.save === 'object' ? new DL.Game({ save: b.save }) : new DL.Game({ seed: Math.floor(Math.random() * 1e9), kit: String(b.kit || '') }); }
    catch (e) { return json(res, 400, { error: 'That world could not be loaded.' }); }
    game.botCount = Math.max(0, Math.min(4, b.bots | 0));
    const sv = { code: makeCode(5), name: cleanWorldName(b.name), owner: hashTok(b.tok), updated: 0, day: 1, time: 0 };
    const save = game.toSave(); servers.set(sv.code, sv); writeServer(sv, save);
    json(res, 200, { code: sv.code, name: sv.name, save });
  });
  if (url === '/api/servers/restore' && req.method === 'POST') return readBody(req, (b) => {
    if (!b || !validTok(b.tok) || !/^[A-Z]{5}$/.test(b.code || '') || !b.save || typeof b.save !== 'object') return json(res, 400, { error: 'Bad request' });
    const have = servers.get(b.code);
    if (have && (have.owner !== hashTok(b.tok) || rooms.has(b.code) || (b.save.time || 0) <= have.time)) return json(res, 200, { ok: false, why: 'already there' });
    try { new DL.Game({ save: b.save }); } catch (e) { return json(res, 400, { error: 'Backup could not be loaded.' }); }
    if (!have && servers.size >= MAX_SERVERS) return json(res, 400, { error: 'Server is full.' });
    const sv = have || { code: b.code, name: cleanWorldName(b.name), owner: hashTok(b.tok), updated: 0, day: 1, time: 0 };
    servers.set(sv.code, sv); writeServer(sv, b.save);
    json(res, 200, { ok: true });
  });
  if (url === '/api/servers/backup' && req.method === 'POST') return readBody(req, (b) => {
    const sv = b && servers.get(b.code); if (!sv || !validTok(b.tok) || sv.owner !== hashTok(b.tok)) return json(res, 403, { error: 'Not your world' });
    json(res, 200, { name: sv.name, save: liveSave(sv) });
  });
  if (url === '/api/servers/delete' && req.method === 'POST') return readBody(req, (b) => {
    const sv = b && servers.get(b.code); if (!sv || !validTok(b.tok) || sv.owner !== hashTok(b.tok)) return json(res, 403, { error: 'Not your world' });
    const r = rooms.get(sv.code);
    if (r) { r.deleted = true; for (const c of r.clients.slice()) { send(c, { t: 'error', msg: 'The owner deleted this server world.' }); leaveRoom(c); send(c, { t: 'left' }); } }
    servers.delete(sv.code); try { fs.unlinkSync(fileOf(sv.code)); } catch (e) {}
    json(res, 200, { ok: true });
  });
  json(res, 404, { error: 'Not found' });
}
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (url.startsWith('/api/')) return api(req, res, url);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ----- rooms -----
const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 * 1024 });
function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); }
function cleanName(n) { return String(n || 'Player').replace(/[<>:]/g, '').trim().slice(0, 14) || 'Player'; }

function sendSave(room, reason) {
  if (room.sv) { saveServerRoom(room, reason); return; }
  const host = room.clients.find(c => c.id === room.hostId);
  if (!host || !room.game) return;
  send(host, { t: 'save', name: room.worldName, data: room.game.toSave(), reason: reason || 'auto' });
}
// server worlds: write to disk, and hand a backup copy to the owner if they're playing
function saveServerRoom(room, reason) {
  if (room.deleted) return;
  const save = room.game.toSave(); writeServer(room.sv, save);
  for (const c of room.clients) if (c.owns && c.owns === room.sv.owner) send(c, { t: 'sbackup', code: room.sv.code, name: room.sv.name, data: save, reason: reason || 'auto' });
  if (reason === 'manual') for (const c of room.clients) send(c, { t: 'info', text: 'World saved on the server.' });
}

function enterWorld(room, c) {
  room.clients.push(c); c.room = room;
  const p = room.game.addPlayer(c.id, c.name);
  c.name = p.name;
  if (room.sv && !room.botsOn) { room.botsOn = true; room.game.setBots(room.game.botCount || 0); } else room.game.syncRescued && room.game.syncRescued();
  send(c, { t: 'world', code: room.code, you: c.id, host: room.hostId === c.id, server: !!room.sv, worldName: room.worldName, init: room.game.initState() });
  broadcastRoster(room);
}

function broadcastRoster(room) {
  const msg = JSON.stringify({ t: 'roster', host: room.hostId, code: room.code, server: !!room.sv, players: room.clients.map(c => ({ id: c.id, name: c.name })) });
  for (const c of room.clients) send(c, msg);
}

function leaveRoom(c) {
  const room = c.room; if (!room) return;
  c.room = null;
  room.game.removePlayer(c.id);
  room.clients = room.clients.filter(x => x !== c);
  if (room.sv) {
    if (!room.clients.some(q => !q.bot)) { // nobody left: save to disk and let the world sleep
      saveServerRoom(room, 'empty');
      if (c.owns === room.sv.owner && c.ws.readyState === 1) send(c, { t: 'sbackup', code: room.sv.code, name: room.sv.name, data: room.game.toSave(), reason: 'leave' });
      clearInterval(room.loop); rooms.delete(room.code); return;
    }
    broadcastRoster(room); return;
  }
  if (room.hostId === c.id) {
    // send a final save to the leaving host if still connected, then pass host on
    if (c.ws.readyState === 1) send(c, { t: 'save', name: room.worldName, data: room.game.toSave(), reason: 'leave' });
    room.hostId = room.clients.length ? room.clients[0].id : 0;
    if (room.hostId) { const h = room.clients[0]; send(h, { t: 'info', text: 'You are now the host — this world will also save in your browser.' }); sendSave(room, 'newhost'); }
  }
  if (!room.clients.length) { clearInterval(room.loop); rooms.delete(room.code); return; }
  broadcastRoster(room);
}

function startLoop(room) {
  let last = Date.now();
  room.loop = setInterval(() => {
    const now = Date.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const g = room.game;
    g.tick(dt);
    const d = g.pullDeltas();
    for (const cl of room.clients) { const s = g.snapshotFor(cl.id); if (s) send(cl, { t: 'snap', s, d }); }
    g.flushEvents();
    room.saveT -= dt;
    if (room.saveT <= 0) { room.saveT = room.sv ? SERVER_SAVE_SEC : AUTOSAVE_SEC; sendSave(room, 'auto'); }
  }, 1000 / 30);
}

function createRoom(c, worldName, save, kit) {
  let game;
  try { game = save ? new DL.Game({ save }) : new DL.Game({ seed: Math.floor(Math.random() * 1e9), kit: String(kit || '') }); }
  catch (e) { send(c, { t: 'error', msg: 'That save file could not be loaded.' }); return; }
  const room = { code: makeCode(4), clients: [], hostId: c.id, game, worldName: String(worldName || 'My World').slice(0, 30), loop: null, saveT: AUTOSAVE_SEC };
  rooms.set(room.code, room);
  enterWorld(room, c);
  startLoop(room);
}

// wake a sleeping server world
function openServerRoom(sv) {
  const save = readServerSave(sv.code); if (!save) return null;
  let game; try { game = new DL.Game({ save }); } catch (e) { return null; }
  game.botCount = save.botCount || 0;
  const room = { code: sv.code, sv, clients: [], hostId: 0, game, worldName: sv.name, loop: null, saveT: SERVER_SAVE_SEC };
  rooms.set(room.code, room); startLoop(room);
  return room;
}

wss.on('connection', (ws) => {
  const c = { ws, id: nextClientId++, name: 'Player', room: null, msgs: 0, msgT: Date.now(), owns: null };
  ws.on('message', (raw) => {
    const now = Date.now();
    if (now - c.msgT > 1000) { c.msgT = now; c.msgs = 0; }
    if (++c.msgs > 150) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = c.room;
    switch (m.t) {
      case 'input': if (room) room.game.input(c.id, m); break;
      case 'ping': send(c, { t: 'pong', c: m.c }); break;
      case 'host':
        leaveRoom(c); c.name = cleanName(m.name);
        createRoom(c, m.worldName, m.save && typeof m.save === 'object' ? m.save : null, m.kit);
        if (c.room && c.room.game) c.room.game.setBots(Math.max(0, Math.min(4, m.bots | 0)));
        break;
      case 'join': {
        const code = String(m.code || '').toUpperCase().trim();
        let r = rooms.get(code);
        if (!r && servers.has(code)) { r = openServerRoom(servers.get(code)); if (!r) { send(c, { t: 'error', msg: 'That server world could not be loaded.' }); break; } }
        if (!r) { send(c, { t: 'error', msg: code.length === 5 ? 'No server world with that code on this server.' : 'Room not found. Check the code with your host.' }); break; }
        if (r.clients.length >= MAX_PLAYERS) { send(c, { t: 'error', msg: 'That world is full (' + MAX_PLAYERS + ' players).' }); break; }
        leaveRoom(c); c.name = cleanName(m.name);
        c.owns = r.sv && validTok(m.tok) ? hashTok(m.tok) : null;
        enterWorld(r, c);
        break;
      }
      case 'chat': if (room && typeof m.text === 'string') room.game.chat(c.id, m.text); break;
      case 'saveNow': if (room && (room.sv || room.hostId === c.id)) sendSave(room, m.quit ? 'quit' : 'manual'); break;
      case 'leave': leaveRoom(c); send(c, { t: 'left' }); break;
    }
  });
  ws.on('close', () => leaveRoom(c));
  ws.on('error', () => {});
});

// save every running server world before the process stops (deploys, restarts)
function saveAll() { for (const r of rooms.values()) if (r.sv && !r.deleted) { try { writeServer(r.sv, r.game.toSave()); } catch (e) {} } }
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { saveAll(); process.exit(0); });

server.listen(PORT, () => console.log('DEADLANDS server running on http://localhost:' + PORT));
