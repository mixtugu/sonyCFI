import { DurableObject } from 'cloudflare:workers';
import { MazeRooms } from '../server/maze-rooms.js';
import { rng } from '../src/maze.js';

const TTL = 24 * 60 * 60 * 1000;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

// Persist the complete round, including the random generator's position, without sockets/functions.
function snapshot(room) {
  const { random, ...game } = room.game;
  return { ...room, game: { ...game, base: [...game.base], walls: [...game.walls], secrets: [...game.secrets], randomState: random.state() },
    members: room.members.map(({ socket, ...m }) => m) };
}
function hydrate(saved) {
  return { ...saved, members: saved.members.map(m => ({ ...m, socket: null })), game: { ...saved.game,
    base: new Set(saved.game.base), walls: new Set(saved.game.walls), secrets: new Set(saved.game.secrets), random: rng(saved.game.randomState) } };
}

export class MazeRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)');
  }
  load() {
    const rows = this.ctx.storage.sql.exec('SELECT data FROM room_state WHERE id = 1').toArray();
    if (!rows.length) return null;
    const room = hydrate(JSON.parse(rows[0].data));
    return room;
  }
  service(room) {
    const service = new MazeRooms(), outbox = [], adapters = new Map();
    service.rooms.set(room.code, room);
    service.send = (socket, packet) => { if (socket?.readyState === 1) outbox.push([socket, packet]); };
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      const adapter = { get readyState() { return ws.readyState; }, send: raw => ws.send(raw), close: (code, reason) => { ws.serializeAttachment({ ...ws.deserializeAttachment(), token: null }); ws.close(code, reason); }, ws };
      adapters.set(ws, adapter);
      const member = room.members.find(m => m.token === attachment?.token);
      if (member) { member.socket = adapter; service.bindings.set(adapter, { room, member }); }
    }
    return { service, outbox, adapters };
  }
  advance(room) {
    const now = Date.now();
    if (room.game.phase === 'playing') {
      const elapsed = Math.max(0, (now - room.updatedAt) / 1000);
      room.game.time = Math.min(room.game.settings.duration, room.game.time + elapsed);
      room.game.cooldown = Math.max(0, room.game.cooldown - elapsed);
      if (room.game.time >= room.game.settings.duration) room.game.phase = 'result';
    }
    room.updatedAt = now;
  }
  async commit(room, outbox = []) {
    // Output is only released after the durable checkpoint succeeds.
    this.ctx.storage.sql.exec('INSERT INTO room_state (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', JSON.stringify(snapshot(room)));
    await this.ctx.storage.setAlarm(room.game.phase === 'playing' ? Date.now() + 1000 : room.touched + TTL);
    for (const [socket, packet] of outbox) { try { socket.send(JSON.stringify(packet)); } catch { /* Close event handles disconnection. */ } }
  }
  async initialize(code, settings, role) {
    if (this.load()) return null;
    const service = new MazeRooms(); const room = { code, members: [], round: 0, touched: Date.now(), updatedAt: Date.now() };
    service.reset(room, settings);
    const seat = { readyState: 0 };
    service.add(room, role, seat);
    const member = room.members[0]; member.socket = null;
    await this.commit(room);
    return { code, token: member.token };
  }
  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket required' }, 426);
    if (!this.load()) return json({ error: '部屋が見つかりません。' }, 404);
    if (this.ctx.getWebSockets().length >= 6) return json({ error: '接続数の上限です。' }, 429);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ token: null, count: 0, since: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 4096) { ws.close(1009, 'Message too large'); return; }
    let data; try { data = JSON.parse(raw); } catch { return; }
    if (!data || typeof data !== 'object') return;
    const attachment = ws.deserializeAttachment() || { token: null, count: 0, since: Date.now() };
    if (Date.now() - attachment.since > 1000) { attachment.count = 0; attachment.since = Date.now(); }
    if (++attachment.count > 40) { ws.close(1008, 'Rate limit'); return; }
    ws.serializeAttachment(attachment);
    const room = this.load(); if (!room) { ws.close(1008, 'Room expired'); return; }
    const { service, outbox, adapters } = this.service(room), adapter = adapters.get(ws);
    this.advance(room);
    // The URL chooses the room; a packet cannot create or jump to another one.
    if (data.type === 'create' || ['join', 'resume'].includes(data.type) && data.code?.toUpperCase() !== room.code) return;
    service.handle(adapter, data);
    const member = service.bindings.get(adapter)?.member;
    ws.serializeAttachment({ ...attachment, token: member?.token || null });
    await this.commit(room, outbox);
  }
  async webSocketClose(ws) { await this.disconnect(ws); }
  async webSocketError(ws) { await this.disconnect(ws); }
  async disconnect(ws) {
    const room = this.load(); if (!room) return;
    this.advance(room);
    const { service, outbox, adapters } = this.service(room);
    // Closed sockets might already be absent from getWebSockets().
    const member = room.members.find(m => m.token === ws.deserializeAttachment()?.token);
    const adapter = adapters.get(ws);
    if (adapter && service.bindings.has(adapter)) service.disconnect(adapter);
    else if (member && !member.socket) {
      member.ready = false; member.again = false; room.touched = Date.now();
      if (room.game.phase === 'playing') service.pause(room, '相手との接続が切れました。再接続を待っています。');
    }
    service.broadcast(room); await this.commit(room, outbox);
  }
  async alarm() {
    const room = this.load(); if (!room) return;
    if (Date.now() - room.touched >= TTL) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'Room expired');
      await this.ctx.storage.deleteAll(); return;
    }
    const { service, outbox } = this.service(room); this.advance(room); service.broadcast(room); await this.commit(room, outbox);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname === '/connection-info') return json({ lan: [], durable: true });
    if (url.pathname === '/maze-api') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (request.headers.get('Origin') !== url.origin) return json({ error: 'Forbidden' }, 403);
      if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'JSON required' }, 415);
      const reader = request.body?.getReader(); if (!reader) return json({ error: 'JSON required' }, 400);
      const chunks = []; let length = 0;
      for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > 4096) { await reader.cancel(); return json({ error: 'Payload too large' }, 413); } chunks.push(value); }
      const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const text = new TextDecoder().decode(bytes);
      let data; try { data = JSON.parse(text); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!data || !['parent', 'child'].includes(data.role) || !data.settings || typeof data.settings !== 'object') return json({ error: '設定を確認してください。' }, 400);
      for (let i = 0; i < 5; i++) {
        const codeBytes = crypto.getRandomValues(new Uint8Array(3));
        const code = [...codeBytes].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        const ticket = await env.MAZE_ROOMS.getByName(code).initialize(code, data.settings, data.role);
        if (ticket) return json(ticket, 201);
      }
      return json({ error: 'もう一度お試しください。' }, 503);
    }
    if (url.pathname === '/maze-socket') {
      if (request.headers.get('Origin') !== url.origin) return json({ error: 'Forbidden' }, 403);
      const code = url.searchParams.get('code')?.toUpperCase();
      if (!/^[A-F0-9]{6}$/.test(code || '')) return json({ error: 'Invalid room code' }, 400);
      return env.MAZE_ROOMS.getByName(code).fetch(request);
    }
    // The legacy Node-only sea prototype remains available in local development.
    if (url.pathname === '/socket' || url.searchParams.has('online') || url.searchParams.has('room')) return Response.redirect(url.origin, 302);
    return env.ASSETS.fetch(request);
  }
};
