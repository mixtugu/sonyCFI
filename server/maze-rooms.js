import { randomBytes, randomInt } from 'node:crypto';
import { createMaze, start, tick, move, placeWall } from '../src/maze.js';

export class MazeRooms {
  constructor() { this.rooms = new Map(); this.bindings = new Map(); }
  send(socket, packet) { if (socket?.readyState === 1 && (socket.bufferedAmount || 0) < 1_000_000) socket.send(JSON.stringify(packet)); }
  error(socket, message, code = 'invalid') { this.send(socket, { type: 'error', message, code }); }
  add(room, role, socket) {
    // `seat` is the role this member opens a match with; `role` alternates between the two legs.
    const member = { role, seat: role, socket, token: randomBytes(24).toString('hex'), ready: false, again: false };
    room.members.push(member); this.bindings.set(socket, { room, member }); this.session(room, member); this.broadcast(room);
  }
  session(room, member) { this.send(member.socket, { type: 'session', code: room.code, token: member.token }); }
  // A match is two legs: everyone plays parent once and child once, then it is over.
  reset(room, settings = room.game?.settings, next = false) {
    room.game = createMaze(settings, randomInt(0x7fffffff)); room.game.mode = 'duo'; room.round++;
    if (next) { room.leg = 2; room.members.forEach(m => { m.role = m.role === 'parent' ? 'child' : 'parent'; }); }
    else { room.leg = 1; room.results = []; room.members.forEach(m => { m.role = m.seat; }); }
    room.members.forEach(m => { m.ready = false; m.again = false; });
    room.reason = next ? '役割を交代しました。二人とも準備完了を押すと始まります。' : '二人とも準備完了を押すと始まります。';
  }
  finish(room) { if (room.game.phase === 'result') room.results[room.leg - 1] = { parent: room.game.parentScore, child: room.game.childScore }; }
  handle(socket, data) {
    if (!data || typeof data !== 'object') return;
    const binding = this.bindings.get(socket);
    if (!binding) {
      if (data.type === 'create') {
        if (this.rooms.size >= 200) return this.error(socket, '部屋を作れません。少し待ってからお試しください。');
        let code; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (this.rooms.has(code));
        // The host always starts as the parent and the guest as the child; they swap each round.
        const room = { code, members: [], round: 0, touched: Date.now() }; this.reset(room, data.settings); this.rooms.set(code, room); this.add(room, 'parent', socket); return;
      }
      const room = this.rooms.get(typeof data.code === 'string' ? data.code.trim().toUpperCase() : '');
      if (!room) return this.error(socket, '部屋が見つかりません。コードを確認するか、新しい部屋を作ってください。', 'missing');
      if (data.type === 'join') {
        if (room.members.length >= 2) return this.error(socket, 'この部屋にはすでに二人が参加しています。', 'full');
        this.add(room, room.members[0].role === 'parent' ? 'child' : 'parent', socket); return;
      }
      if (data.type === 'resume') {
        const member = room.members.find(m => m.token === data.token);
        if (!member) return this.error(socket, '参加情報の有効期限が切れました。参加し直してください。', 'missing');
        if (member.socket) { this.bindings.delete(member.socket); member.socket.close(4001, 'replaced'); }
        member.socket = socket; this.bindings.set(socket, { room, member }); this.session(room, member); this.broadcast(room); return;
      }
      return;
    }
    const { room, member } = binding, g = room.game; room.touched = Date.now();
    if (data.type === 'leave') {
      this.bindings.delete(socket); room.members = room.members.filter(m => m !== member); this.reset(room);
      this.send(socket, { type: 'left' }); this.broadcast(room); return;
    }
    if (data.type === 'ready' && ['ready', 'paused'].includes(g.phase)) {
      member.ready = true;
      if (room.members.length === 2 && room.members.every(m => m.ready && m.socket?.readyState === 1)) { start(g); room.reason = ''; }
    } else if (data.type === 'pause' && g.phase === 'playing') {
      this.pause(room, 'ひと休み中です。二人とも準備ができたら再開します。');
    } else if (data.type === 'again' && g.phase === 'result') {
      // After the first leg both sides swap; after the second the match restarts from the seats.
      member.again = true; if (room.members.length === 2 && room.members.every(m => m.again && m.socket?.readyState === 1)) this.reset(room, undefined, room.leg === 1);
    } else if (data.type === 'settings' && g.phase === 'ready' && member === room.members[0]) {
      this.reset(room, data.settings);
    } else if (data.type === 'move' && g.phase === 'playing') {
      if (member.role !== 'child') return this.error(socket, '子ども役だけが移動できます。', 'role');
      if (Number.isInteger(data.direction) && data.direction >= 0 && data.direction < 4) move(g, data.direction);
    } else if (data.type === 'wall' && g.phase === 'playing') {
      if (member.role !== 'parent') return this.error(socket, '親役だけが壁を置けます。', 'role');
      if (!Number.isInteger(data.cell) || data.cell < 0 || data.cell >= g.settings.cols * g.settings.rows || !Number.isInteger(data.direction) || data.direction < 0 || data.direction > 3) return;
      if (!placeWall(g, data.cell, data.direction)) this.error(socket, '壁を置けません。空いている通路と残りの壁の枚数を確認してください。');
    }
    this.broadcast(room);
  }
  pause(room, reason) { room.game.phase = 'paused'; room.reason = reason; room.members.forEach(m => m.ready = false); }
  disconnect(socket) {
    const binding = this.bindings.get(socket); if (!binding) return;
    this.bindings.delete(socket); const { room, member } = binding; member.socket = null; member.ready = false; member.again = false; room.touched = Date.now();
    if (room.game.phase === 'playing') this.pause(room, '相手との接続が切れたため探検を停止しました。再接続を待っています。');
    this.broadcast(room);
  }
  total(room, member) {
    const other = role => role === 'parent' ? 'child' : 'parent';
    return room.results.reduce((sum, leg, i) => sum + (leg ? leg[i === 0 ? member.seat : other(member.seat)] : 0), 0);
  }
  view(room, member) {
    const g = room.game, review = g.phase === 'result', parent = member.role === 'parent';
    const partner = room.members.find(m => m !== member);
    // Only send public state plus this role's information; never send the seed or hidden item values.
    return { type: 'state', code: room.code, round: room.round, role: member.role, host: member === room.members[0], ready: member.ready, again: member.again,
      match: { leg: room.leg, done: review && room.leg === 2, results: room.results, you: this.total(room, member), partner: partner ? this.total(room, partner) : 0 },
      partner: { connected: room.members.some(m => m !== member && m.socket?.readyState === 1), ready: room.members.some(m => m !== member && m.ready), again: room.members.some(m => m !== member && m.again) }, reason: room.reason,
      game: { settings: g.settings, phase: g.phase, time: g.time, avatar: g.avatar, goal: parent || review ? g.goal : null,
        base: [...g.base], walls: [...g.walls], secrets: !parent || review ? [...g.secrets] : [],
        items: g.items.map(i => ({ cell: i.cell, taken: i.taken, ...(i.taken && (parent || review) ? { category: i.category, risk: i.risk } : {}), ...(i.taken && (!parent || review) ? { reward: i.reward } : {}) })),
        parentScore: parent || review ? g.parentScore : null, childScore: !parent || review ? g.childScore : null,
        collected: g.collected, moves: g.moves, trail: g.trail, logs: review ? g.logs : g.logs.filter(l => l.text.startsWith('壁を設置')).map(l => ({ time: l.time, text: '親が壁を置きました。' })) } };
  }
  broadcast(room) { this.finish(room); for (const member of room.members) this.send(member.socket, this.view(room, member)); }
  tick(dt = 1 / 30) {
    for (const [code, room] of this.rooms) {
      if (!room.members.some(m => m.socket?.readyState === 1) && Date.now() - room.touched > 120_000) { this.rooms.delete(code); continue; }
      if (room.game.phase === 'playing') { tick(room.game, dt); this.broadcast(room); }
    }
  }
}
