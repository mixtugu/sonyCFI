import { randomBytes, randomInt } from 'node:crypto';
import { createGame, step, addWall, WORLD, haven, gate, treasures, clamp } from '../src/game.js';

const missions = {
  child: { title: 'まだ知らない海へ。', objective: '真珠を5つ集め、東の「光の門」にたどり着く。', description: 'あなたは小さな探検家。見つけたいものは、いつも少し遠くにあります。', target: 5 },
  parent: { title: 'そばにいてほしい。', objective: '子どもが西の「静かな入り江」にいる時間を、合計25秒にする。', description: 'あなたは海の見守り手。壁で進む道を変え、穏やかな海へ導いてください。', target: 25 },
};
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);

export class RoomService {
  constructor() { this.rooms = new Map(); this.bindings = new Map(); }

  send(socket, message) {
    if (socket?.readyState === 1 && (socket.bufferedAmount || 0) < 1_000_000) socket.send(JSON.stringify(message));
  }

  error(socket, message, code = 'invalid') { this.send(socket, { type: 'error', message, code }); }

  addMember(room, role, socket) {
    const member = { role, token: randomBytes(24).toString('hex'), socket, ready: false, swap: false };
    room.members.push(member);
    this.bindings.set(socket, { room, member });
    this.send(socket, { type: 'session', code: room.code, token: member.token, role });
    this.broadcast(room);
  }

  handle(socket, data) {
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
    const binding = this.bindings.get(socket);
    if (!binding) {
      if (data.type === 'create') {
        if (!['child', 'parent'].includes(data.role)) return this.error(socket, '役割を選んでください。');
        if (this.rooms.size >= 200) return this.error(socket, '部屋がいっぱいです。少し待ってからお試しください。');
        let code;
        do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (this.rooms.has(code));
        const room = { code, members: [], game: createGame(), status: 'waiting', countdown: 3, input: { x: 0, y: 0 }, inputAt: 0, touched: Date.now(), reason: '', round: 1 };
        this.rooms.set(code, room);
        return this.addMember(room, data.role, socket);
      }
      const code = typeof data.code === 'string' ? data.code.toUpperCase().trim() : '';
      const room = this.rooms.get(code);
      if (!room) return this.error(socket, '部屋が見つかりません。コードを確認するか、新しい部屋を作ってください。', 'missing');
      if (data.type === 'join') {
        if (room.members.length >= 2) return this.error(socket, 'この部屋はすでに2人が参加しています。', 'full');
        return this.addMember(room, room.members[0]?.role === 'child' ? 'parent' : 'child', socket);
      }
      if (data.type === 'resume') {
        const member = room.members.find(m => m.token === data.token);
        if (!member) return this.error(socket, 'この画面の参加情報が見つかりません。入り直してください。', 'expired');
        // A refresh can arrive before the old socket closes. Transfer the seat without letting
        // that old socket's close event disconnect the replacement.
        if (member.socket) { this.bindings.delete(member.socket); member.socket.close(4001, 'replaced'); }
        member.socket = socket;
        this.bindings.set(socket, { room, member });
        this.send(socket, { type: 'session', code, token: member.token, role: member.role });
        this.broadcast(room);
        return;
      }
      return this.error(socket, '先に部屋を作るか、参加してください。');
    }
    const { room, member } = binding;
    room.touched = Date.now();
    if (data.type === 'leave') {
      this.bindings.delete(socket);
      room.members = room.members.filter(m => m !== member);
      room.status = 'waiting'; room.game = createGame(); room.input = { x: 0, y: 0 }; room.round++;
      room.reason = '相手が退出しました。別の相手を招待できます。';
      room.members.forEach(m => { m.ready = false; m.swap = false; });
      this.send(socket, { type: 'left' }); this.broadcast(room); return;
    }
    if (data.type === 'ready' && ['waiting', 'paused'].includes(room.status)) {
      member.ready = true;
      if (room.members.length === 2 && room.members.every(m => m.ready && m.socket?.readyState === 1)) {
        room.status = 'countdown'; room.countdown = 3; room.reason = ''; room.input = { x: 0, y: 0 };
      }
      this.broadcast(room); return;
    }
    if (data.type === 'pause' && ['playing', 'countdown'].includes(room.status)) {
      this.pause(room, '相手がひと休みしています。二人の準備ができたら再開しましょう。'); return;
    }
    if (data.type === 'finish' && room.status === 'paused') {
      room.game.ended = true; room.status = 'review'; room.reason = 'ここまでの航海を振り返ります。'; this.broadcast(room); return;
    }
    if (data.type === 'swap' && room.status === 'review') {
      member.swap = true;
      if (room.members.length === 2 && room.members.every(m => m.swap && m.socket?.readyState === 1)) {
        room.members.forEach(m => { m.role = m.role === 'child' ? 'parent' : 'child'; m.ready = false; m.swap = false; });
        room.game = createGame(); room.status = 'waiting'; room.reason = '役割を交代しました。新しい目標を確認してください。'; room.round++;
      }
      this.broadcast(room); return;
    }
    if (room.status !== 'playing') return;
    if (data.type === 'input') {
      if (member.role !== 'child') return this.error(socket, 'この役割では移動できません。', 'role');
      if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
      room.input = { x: clamp(data.x, -1, 1), y: clamp(data.y, -1, 1) }; room.inputAt = Date.now(); return;
    }
    if (data.type === 'wall') {
      if (member.role !== 'parent') return this.error(socket, 'この役割では壁を置けません。', 'role');
      if (!point(data.a) || !point(data.b)) return;
      if (!addWall(room.game, data.a, data.b)) this.error(socket, '壁を置けません。少し待つか、探検家から離して置いてください。', 'wall');
    }
  }

  pause(room, reason) {
    room.status = 'paused'; room.reason = reason; room.input = { x: 0, y: 0 };
    room.members.forEach(m => { m.ready = false; }); this.broadcast(room);
  }

  disconnect(socket) {
    const binding = this.bindings.get(socket);
    if (!binding) return;
    this.bindings.delete(socket);
    const { room, member } = binding;
    member.socket = null; member.ready = false; member.swap = false; room.touched = Date.now();
    if (['playing', 'countdown'].includes(room.status)) this.pause(room, '相手との接続が切れました。航海を止めて、再接続を待っています。');
    else this.broadcast(room);
  }

  view(room, member) {
    const g = room.game, child = member.role === 'child', review = room.status === 'review';
    // Never send the other player's mission, progress or private map to this socket during play.
    const view = { time: g.time, child: g.child, walls: g.walls, cooldown: g.cooldown, found: child || review ? g.found : [],
      treasures: child || review ? treasures : [], gate: child || review ? gate : null, haven: !child || review ? haven : null };
    const packet = { type: 'state', code: room.code, role: member.role, round: room.round, status: room.status, countdown: Math.ceil(room.countdown),
      self: { ready: member.ready, swap: member.swap, mission: missions[member.role], progress: child ? g.found.length : g.safeTime },
      partner: { connected: room.members.some(m => m !== member && m.socket?.readyState === 1), ready: room.members.some(m => m !== member && m.ready), swap: room.members.some(m => m !== member && m.swap) },
      reason: room.reason, view };
    if (review) packet.review = { frames: g.frames, logs: g.logs, safeTime: g.safeTime, blockedTime: g.blockedTime, breaks: g.breaks, escaped: g.escaped, found: g.found, missions };
    return packet;
  }

  broadcast(room) { for (const member of room.members) this.send(member.socket, this.view(room, member)); }

  tick(dt = 1 / 30) {
    for (const [code, room] of this.rooms) {
      if (!room.members.some(m => m.socket?.readyState === 1) && Date.now() - room.touched > 120_000) { this.rooms.delete(code); continue; }
      if (room.status === 'countdown') {
        room.countdown -= dt;
        if (room.countdown <= 0) room.status = 'playing';
        this.broadcast(room);
      } else if (room.status === 'playing') {
        const input = Date.now() - room.inputAt < 250 ? room.input : { x: 0, y: 0 };
        step(room.game, input, dt);
        if (room.game.ended) { room.status = 'review'; room.reason = room.game.escaped ? '探検家が光の門にたどり着きました。' : '90秒の航海が終わりました。'; }
        this.broadcast(room);
      }
    }
  }
}
