import { createMaze, move, placeWall } from './maze.js';

// Shared by Node, Workers and the offline role previews.
const randomHex = length => Array.from(crypto.getRandomValues(new Uint8Array(length)), byte => byte.toString(16).padStart(2, '0')).join('');
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;

export class MazeRooms {
  constructor() { this.rooms = new Map(); this.bindings = new Map(); }
  send(socket, packet) { if (socket?.readyState === 1 && (socket.bufferedAmount || 0) < 1_000_000) socket.send(JSON.stringify(packet)); }
  error(socket, message, code = 'invalid') { this.send(socket, { type: 'error', message, code }); }
  add(room, role, socket) {
    // `seat` is the role this member opens a match with; `role` alternates between the two legs.
    const member = { role, seat: role, socket, token: randomHex(24), ready: false, tutorialComplete: false, again: false };
    room.members.push(member); this.bindings.set(socket, { room, member }); this.session(room, member); this.broadcast(room);
  }
  session(room, member) { this.send(member.socket, { type: 'session', code: room.code, token: member.token }); }
  // A match is two legs: everyone plays parent once and child once, then it is over.
  reset(room, settings = room.game?.settings, next = false) {
    room.game = createMaze(settings, randomSeed()); room.game.mode = 'duo'; room.round++;
    if (next) { room.leg = 2; room.members.forEach(m => { m.role = m.role === 'parent' ? 'child' : 'parent'; }); }
    else { room.leg = 1; room.results = []; room.members.forEach(m => { m.role = m.seat; }); }
    room.members.forEach(m => { m.ready = false; m.tutorialComplete = false; m.again = false; });
    room.countdown = 0;
    room.reason = next ? '役割を交代しました。新しい役割のチュートリアルを確認し、二人とも準備完了を押すと3秒後に始まります。' : 'チュートリアルを確認し、二人とも準備完了を押すと3秒後に始まります。';
  }
  finish(room) {
    if (room.game.phase !== 'result') return;
    room.results[room.leg - 1] = { parent: room.game.parentScore, child: room.game.childScore };
    // Only the completed match has a results screen. The first leg goes straight to a new briefing.
    if (room.leg === 1) this.reset(room, undefined, true);
  }
  advance(room, elapsed) {
    if (room.game.phase === 'countdown') {
      const remaining = Math.max(0, room.countdown - elapsed);
      elapsed = Math.max(0, elapsed - room.countdown); room.countdown = remaining;
      if (remaining > 1e-9) return;
      room.countdown = 0; room.game.phase = 'playing';
    }
    if (room.game.phase === 'playing' && elapsed > 0) {
      // Duo rooms have no CPU simulation; consume the complete wall-clock delta (also after Worker hibernation).
      const g = room.game;
      g.time = Math.min(g.settings.duration, g.time + elapsed);
      g.cooldown = Math.max(0, g.cooldown - elapsed);
      if (g.time >= g.settings.duration) g.phase = 'result';
    }
  }
  handle(socket, data) {
    if (!data || typeof data !== 'object') return;
    const binding = this.bindings.get(socket);
    if (!binding) {
      if (data.type === 'create') {
        if (this.rooms.size >= 200) return this.error(socket, '部屋を作れません。少し待ってからお試しください。');
        const code = 'A';
        if (this.rooms.has(code)) return this.error(socket, '部屋「A」はすでに使用中です。', 'full');
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
        const member = room.members.find(m => m.token && m.token === data.token);
        if (!member) return this.error(socket, '参加情報の有効期限が切れました。参加し直してください。', 'missing');
        if (member.socket) { this.bindings.delete(member.socket); member.socket.close(4001, 'replaced'); }
        member.socket = socket; this.bindings.set(socket, { room, member }); this.session(room, member); this.broadcast(room); return;
      }
      return;
    }
    const { room, member } = binding, g = room.game; room.touched = Date.now();
    if (data.type === 'leave') {
      this.bindings.delete(socket);
      if (g.phase === 'result' && room.leg === 2) {
        // Keep both scores readable for the partner who is still reviewing the match.
        member.socket = null; member.token = null; member.ready = false; member.again = false;
      } else { room.members = room.members.filter(m => m !== member); this.reset(room); }
      this.send(socket, { type: 'left' }); this.broadcast(room);
      if (!room.members.some(m => m.token)) this.rooms.delete(room.code);
      return;
    }
    if (data.type === 'tutorial' && g.phase === 'ready') {
      member.tutorialComplete = true;
    } else if (data.type === 'ready' && ['ready', 'paused'].includes(g.phase)) {
      if (!member.tutorialComplete) return this.error(socket, 'チュートリアルを最後まで確認してください。', 'tutorial');
      member.ready = true;
      if (room.members.length === 2 && room.members.every(m => m.tutorialComplete && m.ready && m.socket?.readyState === 1)) {
        g.phase = 'countdown'; room.countdown = 3; room.reason = '';
      }
    } else if (data.type === 'pause' && ['playing', 'countdown'].includes(g.phase)) {
      this.pause(room, 'ひと休み中です。二人とも準備ができたら再開します。');
    } else if (data.type === 'again' && g.phase === 'result') {
      // A completed match restarts only after both players ask to play again.
      member.again = true; if (room.members.length === 2 && room.members.every(m => m.again && m.socket?.readyState === 1)) this.reset(room, undefined, room.leg === 1);
    } else if (data.type === 'settings' && g.phase === 'ready' && room.leg === 1 && member === room.members[0]) {
      this.reset(room, data.settings);
    } else if (data.type === 'move' && g.phase === 'playing') {
      if (member.role !== 'child') return this.error(socket, 'エクスプローラーだけが移動できます。', 'role');
      if (Number.isInteger(data.direction) && data.direction >= 0 && data.direction < 4) move(g, data.direction);
    } else if (data.type === 'wall' && g.phase === 'playing') {
      if (member.role !== 'parent') return this.error(socket, 'ナビゲーターだけが壁を置けます。', 'role');
      if (!Number.isInteger(data.cell) || data.cell < 0 || data.cell >= g.settings.cols * g.settings.rows || !Number.isInteger(data.direction) || data.direction < 0 || data.direction > 3) return;
      if (!placeWall(g, data.cell, data.direction)) this.error(socket, '壁を置けません。空いている通路と残りの壁の枚数を確認してください。');
    }
    this.broadcast(room);
  }
  pause(room, reason) { room.game.phase = 'paused'; room.countdown = 0; room.reason = reason; room.members.forEach(m => m.ready = false); }
  disconnect(socket) {
    const binding = this.bindings.get(socket); if (!binding) return;
    this.bindings.delete(socket); const { room, member } = binding; member.socket = null; member.ready = false; member.again = false; room.touched = Date.now();
    if (['playing', 'countdown'].includes(room.game.phase)) this.pause(room, '相手との接続が切れたため探検を停止しました。再接続を待っています。');
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
    return { type: 'state', code: room.code, round: room.round, role: member.role, host: member === room.members[0], ready: member.ready, tutorialComplete: !!member.tutorialComplete, countdown: Math.ceil(room.countdown || 0), again: member.again,
      match: { leg: room.leg, done: review && room.leg === 2, results: room.results, you: this.total(room, member), partner: partner ? this.total(room, partner) : 0 },
      partner: { connected: room.members.some(m => m !== member && m.socket?.readyState === 1), ready: room.members.some(m => m !== member && m.ready), tutorialComplete: room.members.some(m => m !== member && m.tutorialComplete), again: room.members.some(m => m !== member && m.again) }, reason: room.reason,
      game: { settings: g.settings, phase: g.phase, time: g.time, avatar: g.avatar, goal: parent || review ? g.goal : null,
        base: [...g.base], walls: [...g.walls], secrets: !parent || review ? [...g.secrets] : [],
        items: g.items.map(i => ({ cell: i.cell, taken: i.taken, fishSize: i.fishSize, ...(i.taken ? { fishKind: i.fishKind } : {}), ...(!i.taken && parent ? { highRisk: i.category === 'red' } : {}), ...(i.taken && (parent || review) ? { category: i.category, risk: i.risk } : {}), ...(i.taken && (!parent || review) ? { reward: i.reward } : {}) })),
        parentScore: parent || review ? g.parentScore : null, childScore: !parent || review ? g.childScore : null,
        collected: g.collected, moves: g.moves, trail: g.trail, logs: review ? g.logs : g.logs.filter(l => l.text.startsWith('壁を設置')).map(l => ({ time: l.time, text: 'ナビゲーターが壁を置きました。' })) } };
  }
  broadcast(room) { this.finish(room); for (const member of room.members) this.send(member.socket, this.view(room, member)); }
  tick(dt = 1 / 30) {
    for (const [code, room] of this.rooms) {
      if (!room.members.some(m => m.socket?.readyState === 1) && Date.now() - room.touched > 120_000) { this.rooms.delete(code); continue; }
      if (['playing', 'countdown'].includes(room.game.phase)) { this.advance(room, dt); this.broadcast(room); }
    }
  }
}
