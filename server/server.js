// Myths and Legends: the online play server. A small WebSocket relay that
// gathers players into rooms by a four-letter code. It doesn't run the fight:
// every player's game does, each one in charge of its own hero, and one of
// them (the room's host) keeps the monsters for everyone (see src/net in the
// game). The server only says who is in which room, who the host is, and
// passes each message on to the others in the room.
//
// Messages are JSON objects with a type `t`.
//   Player -> server:
//     { t: 'create', mode: 'coop' | 'duel', arena, name, hero, look }
//     { t: 'join', code, name, hero, look }
//     { t: 'leave' }
//     anything else, in a room: passed on to the others (or only to `to`, a player id)
//   Server -> player:
//     { t: 'joined', code, you, host, mode, arena, players: [{ id, name, hero, look }] }
//     { t: 'error', msg }
//     { t: 'peer+', p: { id, name, hero, look } }   someone came in
//     { t: 'peer-', id }                             someone left
//     { t: 'host', id }                              the host changed
//     passed-on messages, with `f`: the sender's id

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8080;
/** Most players a room holds, by mode. */
const CAPACITY = { coop: 4, duel: 2 };
/** Biggest message passed on, in bytes. */
const MAX_MESSAGE = 16 * 1024;
/** Letters for room codes, without ones easily mistaken for each other (I, O, 0, 1). */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** code -> { code, mode, arena, host, players: Map<id, player> } */
const rooms = new Map();
let nextId = 1;

function newCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    if (!rooms.has(code)) return code;
  }
}

const clean = (s, max) => String(s ?? '').replace(/[^\w .'-]/g, '').slice(0, max);
const info = (p) => ({ id: p.id, name: p.name, hero: p.hero, look: p.look });

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
}

function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p !== except) send(p.ws, data);
}

function enter(room, player) {
  player.room = room;
  room.players.set(player.id, player);
  send(player.ws, {
    t: 'joined',
    code: room.code,
    you: player.id,
    host: room.host,
    mode: room.mode,
    arena: room.arena,
    players: [...room.players.values()].map(info),
  });
  broadcast(room, { t: 'peer+', p: info(player) }, player);
}

function leave(player) {
  const room = player.room;
  if (!room) return;
  player.room = null;
  room.players.delete(player.id);
  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }
  broadcast(room, { t: 'peer-', id: player.id });
  if (room.host === player.id) {
    // The longest-standing player takes over the monsters.
    room.host = room.players.keys().next().value;
    broadcast(room, { t: 'host', id: room.host });
  }
}

function onMessage(player, raw) {
  if (raw.length > MAX_MESSAGE) return;
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;

  if (msg.t === 'create' || msg.t === 'join') {
    leave(player);
    player.name = clean(msg.name, 16) || 'Hero';
    player.hero = clean(msg.hero, 24);
    player.look = clean(msg.look, 24);
    if (msg.t === 'create') {
      const mode = msg.mode === 'duel' ? 'duel' : 'coop';
      const room = { code: newCode(), mode, arena: clean(msg.arena, 24), host: player.id, players: new Map() };
      rooms.set(room.code, room);
      enter(room, player);
    } else {
      const room = rooms.get(String(msg.code ?? '').toUpperCase().trim());
      if (!room) return send(player.ws, { t: 'error', msg: 'No room with that code.' });
      if (room.players.size >= CAPACITY[room.mode]) return send(player.ws, { t: 'error', msg: 'That room is full.' });
      enter(room, player);
    }
    return;
  }
  if (msg.t === 'leave') return leave(player);

  const room = player.room;
  if (!room) return;
  msg.f = player.id;
  if (typeof msg.to === 'number') {
    const to = room.players.get(msg.to);
    if (to) send(to.ws, msg);
  } else broadcast(room, msg, player);
}

const http = createServer((req, res) => {
  // A health check for the host, and a friendly word for anyone who opens it in a browser.
  res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
  res.end(req.url === '/health' ? 'ok' : `Myths and Legends server: ${rooms.size} rooms open\n`);
});

const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE });

wss.on('connection', (ws) => {
  const player = { id: nextId++, ws, room: null, name: 'Hero', hero: '', look: '', alive: true };
  ws.on('message', (raw) => onMessage(player, raw));
  ws.on('pong', () => (player.alive = true));
  ws.on('close', () => leave(player));
  ws.on('error', () => ws.terminate());
  ws.player = player;
});

// Drop players whose connection died without a goodbye (a phone losing signal).
setInterval(() => {
  for (const ws of wss.clients) {
    const p = ws.player;
    if (!p.alive) {
      ws.terminate();
      continue;
    }
    p.alive = false;
    ws.ping();
  }
}, 15000);

http.listen(PORT, () => console.log(`Myths and Legends server on port ${PORT}`));
