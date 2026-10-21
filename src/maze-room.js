import { createMaze, move, placeWall, tick } from './maze.js';

// Shared by Node, Workers and the offline role previews.
const randomHex = length => Array.from(crypto.getRandomValues(new Uint8Array(length)), byte => byte.toString(16).padStart(2, '0')).join('');
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;

export class MazeRooms {
  constructor() { this.rooms = new Map(); this.bindings = new Map(); }
  send(socket, packet) { if (socket?.readyState === 1 && (socket.bufferedAmount || 0) < 1_000_000) socket.send(JSON.stringify(packet)); }
  error(socket, message, code = 'invalid') { this.send(socket, { type: 'error', message, code }); }
  add(room, role, socket) {
    // `seat` is the role this member keeps; `role` is what this game's view uses.
    const member = { role, seat: role, socket, token: randomHex(24), ready: false, tutorialComplete: false, again: false };
    room.members.push(member); this.bindings.set(socket, { room, member }); this.session(room, member); this.broadcast(room);
  }
  session(room, member) { this.send(member.socket, { type: 'session', code: room.code, token: member.token }); }
  // In a solo game the host plays alone against the CPU; the guest stays in the room and waits.
  // Only the members returned here take part: their readiness starts the game, their connection
  // pauses it, and their actions reach it.
  // Every game begins with the host choosing the number of players (`chosen`); until then both wait.
  players(room) { return room.solo && room.chosen ? room.members.slice(0, 1) : room.members; }
  plays(room, member) { return this.players(room).includes(member); }
  readyReason(room) { return room.solo ? 'ひとりで探検します。チュートリアルを確認して準備完了を押すと3秒後に始まります。' : 'チュートリアルを確認し、二人とも準備完了を押すと3秒後に始まります。'; }
  // A game is a single round; players keep their seats from game to game.
  reset(room, settings = room.game?.settings) {
    room.game = createMaze(settings, randomSeed()); room.game.mode = 'duo'; room.round++;
    room.leg = 1; room.results = []; room.members.forEach(m => { m.role = m.seat; });
    room.members.forEach(m => { m.ready = false; m.tutorialComplete = false; m.again = false; });
    room.countdown = 0; room.solo = !!room.solo; room.chosen = false;
    room.reason = this.readyReason(room);
  }
  finish(room) {
    if (room.game.phase !== 'result') return;
    // The round's encyclopedia is the result. Each player ends it ('again'); once both have, a new
    // game starts in the same room.
    room.results[room.leg - 1] = { caught: room.game.items.filter(i => i.taken).map(i => i.creature) };
  }
  advance(room, elapsed) {
    if (room.game.phase === 'countdown') {
      const remaining = Math.max(0, room.countdown - elapsed);
      elapsed = Math.max(0, elapsed - room.countdown); room.countdown = remaining;
      if (remaining > 1e-9) return;
      room.countdown = 0; room.game.phase = 'playing';
    }
    if (room.game.phase === 'playing' && elapsed > 0 && room.solo && room.members[0]) {
      // Solo: the CPU takes the seat the host is not playing. Step in the engine's 0.1 s slices so a
      // long gap (a slow tick, or Worker hibernation) plays out the same as a steady clock.
      const g = room.game;
      g.mode = room.members[0].role;
      for (let left = elapsed; left > 1e-9 && g.phase === 'playing'; left -= .1) tick(g, Math.min(.1, left));
      g.mode = 'duo';
      return;
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
        const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : 'A';
        if (!/^[A-Z0-9]{1,6}$/.test(code)) return this.error(socket, '部屋コードは英数字1〜6文字で入力してください。');
        if (this.rooms.has(code)) return this.error(socket, `部屋「${code}」はすでに使用中です。`, 'full');
        // The host always starts as the parent and the guest as the child; they swap each round.
        const room = { code, members: [], round: 0, touched: Date.now() }; this.reset(room, data.settings); this.rooms.set(code, room); this.add(room, 'parent', socket); return;
      }
      const room = this.rooms.get(typeof data.code === 'string' ? data.code.trim().toUpperCase() : '');
      if (!room) return this.error(socket, '部屋が見つかりません。コードを確認するか、新しい部屋を作ってください。', 'missing');
      if (data.type === 'join') {
        // While the host plays alone, nobody new can come in; a guest already in the room may still reconnect.
        if (room.solo && room.chosen) return this.error(socket, 'いまはひとりで遊んでいるため参加できません。終わるまでお待ちください。', 'solo');
        if (room.members.length >= 2) return this.error(socket, 'この部屋にはすでに二人が参加しています。', 'full');
        // Seats, not this round's roles: a solo host may be playing the other seat's role.
        this.add(room, room.members[0].seat === 'parent' ? 'child' : 'parent', socket); return;
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
      if (g.phase === 'result') {
        // Keep the match's encyclopedia readable for the partner who is still reviewing the match.
        member.socket = null; member.token = null; member.ready = false; member.again = false;
      } else if (!this.plays(room, member)) {
        // A waiting guest leaving must not disturb the host's solo game.
        room.members = room.members.filter(m => m !== member);
      } else {
        // The remaining member becomes the host and chooses again, starting from a duo room.
        room.members = room.members.filter(m => m !== member); room.solo = false; this.reset(room);
      }
      this.send(socket, { type: 'left' }); this.broadcast(room);
      if (!room.members.some(m => m.token)) this.rooms.delete(room.code);
      return;
    }
    // A guest waiting out a solo game only watches; nothing it sends reaches the game.
    if (!this.plays(room, member)) return;
    if (data.type === 'restart' && member === room.members[0]) {
      // The host's reset: from any screen, both go back to the player-count choice, still in the room.
      room.members = room.members.filter(m => m.token);
      this.reset(room); room.hostScreen = 'entry'; room.restartRound = room.round;
    } else if (data.type === 'screen' && member === room.members[0]) {
      // The host's client reports which screen it shows, so a spectating guest can follow along.
      if (typeof data.screen === 'string' && /^(entry|opening|tutorial:[0-9]|ready|countdown|game|result|ending)$/.test(data.screen)) room.hostScreen = data.screen;
    } else if (data.type === 'players' && g.phase === 'ready' && member === room.members[0] && typeof data.solo === 'boolean') {
      // The host chooses, before the start screen, whether to play as two or alone. Alone, the host
      // explores and the CPU navigates, unless the host switches to navigator for this round.
      if (room.solo !== data.solo || !room.chosen) {
        room.solo = data.solo; room.chosen = true; room.countdown = 0;
        room.members.forEach(m => { m.role = m.seat; m.ready = false; m.tutorialComplete = false; });
        if (room.solo) room.members[0].role = 'child';
        room.reason = this.readyReason(room);
      }
    } else if (data.type === 'soloRole' && g.phase === 'ready' && room.solo && room.chosen && member === room.members[0] && ['parent', 'child'].includes(data.role)) {
      // Lasts for this round only: the next game resets roles and asks for the player count again.
      if (member.role !== data.role) { member.role = data.role; member.ready = false; member.tutorialComplete = false; room.countdown = 0; }
    } else if (data.type === 'tutorial' && g.phase === 'ready') {
      member.tutorialComplete = true;
    } else if (data.type === 'ready' && ['ready', 'paused'].includes(g.phase)) {
      if (!member.tutorialComplete) return this.error(socket, 'チュートリアルを最後まで確認してください。', 'tutorial');
      member.ready = true;
      const players = this.players(room);
      if (room.chosen && players.length === (room.solo ? 1 : 2) && players.every(m => m.tutorialComplete && m.ready && m.socket?.readyState === 1)) {
        g.phase = 'countdown'; room.countdown = 3; room.reason = '';
      }
    } else if (data.type === 'unready' && ['ready', 'paused', 'countdown'].includes(g.phase)) {
      member.ready = false;
      if (g.phase === 'countdown') {
        g.phase = g.time > 0 ? 'paused' : 'ready';
        room.countdown = 0;
      }
    } else if (data.type === 'pause' && ['playing', 'countdown'].includes(g.phase)) {
      this.pause(room, room.solo ? 'ひと休み中です。準備ができたら再開します。' : 'ひと休み中です。二人とも準備ができたら再開します。');
    } else if (data.type === 'again' && g.phase === 'result') {
      // A finished game restarts only after everyone who played has ended it (just the host when solo).
      member.again = true;
      const players = this.players(room);
      if (players.length === (room.solo ? 1 : 2) && players.every(m => m.again && m.socket?.readyState === 1)) this.reset(room);
    } else if (data.type === 'settings' && g.phase === 'ready' && member === room.members[0]) {
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
    // A waiting guest's connection does not matter to a solo game; only a player's drop pauses it.
    if (this.plays(room, member) && ['playing', 'countdown'].includes(room.game.phase)) this.pause(room, '相手との接続が切れたため探検を停止しました。再接続を待っています。');
    this.broadcast(room);
  }
  view(room, member) {
    // A spectating guest sees exactly what the host sees: the host's role, readiness and screen.
    const spectator = !this.plays(room, member), seen = spectator && room.members[0] ? room.members[0] : member;
    const g = room.game, review = g.phase === 'result', parent = seen.role === 'parent';
    // Only send public state plus this role's information; never send the seed or hidden item values.
    return { type: 'state', code: room.code, round: room.round, role: seen.role, host: member === room.members[0], ready: seen.ready, tutorialComplete: !!seen.tutorialComplete, countdown: Math.ceil(room.countdown || 0), again: seen.again,
      solo: !!room.solo, chosen: !!room.chosen, spectator, hostScreen: room.hostScreen || 'entry', restarted: room.restartRound === room.round,
      match: { leg: room.leg, done: review, results: room.results },
      partner: { connected: room.members.some(m => m !== member && m.socket?.readyState === 1), ready: room.members.some(m => m !== member && m.ready), tutorialComplete: room.members.some(m => m !== member && m.tutorialComplete), again: room.members.some(m => m !== member && m.again) }, reason: room.reason,
      game: { settings: g.settings, phase: g.phase, time: g.time, avatar: g.avatar, goal: parent || review ? g.goal : null,
        base: [...g.base], walls: [...g.walls], secrets: !parent || review ? [...g.secrets] : [],
        // Both see a fish's size and, once met, the creature. Only the navigator sees the maximum
        // risk and HP; a creature's own risk is shown only after it is met (or in the report).
        items: g.items.map(i => ({ cell: i.cell, taken: i.taken, size: i.size, ...(i.taken ? { creature: i.creature } : {}), ...(parent || review ? { maxRisk: i.maxRisk } : {}), ...((i.taken && parent) || review ? { risk: i.risk } : {}), ...(i.taken && parent ? { damage: i.damage } : {}) })),
        hp: parent ? g.hp : null,
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
