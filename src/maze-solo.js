import { MazeRooms } from './maze-room.js';
import { tick } from './maze.js';

// In-memory transport around the real room engine. Only the other seat is automated.
// No WebSocket, room service or saved multiplayer session is used by these previews.
export function createSoloSession({ role = 'parent', settings = () => ({}), onState, onLeave, notice = () => {} }) {
  let service, room, human, bot, initializing = false;
  const client = { active: false, connected: true, state: null, start, send, advance };
  function socket(seat) {
    return { readyState: 1, send(raw) {
      if (initializing || seat !== role) return;
      const packet = JSON.parse(raw);
      if (packet.type === 'state') { client.active = true; client.state = packet; onState?.(packet); }
      if (packet.type === 'error') notice(packet.message);
      if (packet.type === 'left') { client.active = false; client.state = null; onLeave?.(); }
    } };
  }
  function automatePartner() {
    const member = service.bindings.get(bot)?.member;
    if (!member) return;
    if (room.game.phase === 'result' && human && service.bindings.get(human).member.again) service.handle(bot, { type: 'again' });
    if (room.game.phase === 'ready' && !member.tutorialComplete) service.handle(bot, { type: 'tutorial' });
    if (['ready', 'paused'].includes(room.game.phase) && member.tutorialComplete && !member.ready) service.handle(bot, { type: 'ready' });
  }
  function start() {
    initializing = true;
    service = new MazeRooms();
    const parent = socket('parent'), child = socket('child');
    service.handle(parent, { type: 'create', settings: settings() });
    room = [...service.rooms.values()][0];
    service.handle(child, { type: 'join', code: room.code });
    human = role === 'parent' ? parent : child; bot = role === 'parent' ? child : parent;
    automatePartner(); initializing = false;
    client.active = true; service.broadcast(room);
  }
  function send(data) {
    if (!client.active) return;
    service.handle(human, data);
    if (client.active) automatePartner();
  }
  function advance(elapsed) {
    if (!client.active || !Number.isFinite(elapsed) || elapsed <= 0) return;
    if (!['playing', 'countdown'].includes(room.game.phase)) return;
    if (room.game.phase === 'countdown') {
      const consumed = Math.min(elapsed, room.countdown);
      service.advance(room, consumed); elapsed -= consumed;
    }
    // The room lifecycle and views are shared; the existing CPU supplies the missing player's actions.
    const game = room.game;
    if (game.phase === 'playing') {
      game.mode = service.bindings.get(human).member.role;
      for (let remaining = elapsed; remaining > 0 && game.phase === 'playing'; remaining -= .1) tick(game, Math.min(.1, remaining));
      game.mode = 'duo';
    }
    service.broadcast(room); automatePartner();
  }
  return client;
}

export function connectSoloMaze(options) {
  const mount = document.getElementById('net-room-mount');
  mount.innerHTML = '<div id="net-room"><p><b id="maze-role"></b> <span id="maze-partner">相手はCPU</span></p><button type="button" id="maze-leave" class="text-button">テストを終了</button></div>';
  const client = createSoloSession({ ...options, onState: packet => {
    document.getElementById('maze-role').textContent = packet.role === 'parent' ? '親役' : '子ども役';
    options.onState(packet);
  } });
  document.getElementById('maze-leave').onclick = () => client.send({ type: 'leave' });
  document.getElementById('test-restart').onclick = () => client.start();
  // The shared UI and tutorial must exist before the first room snapshot is delivered.
  queueMicrotask(() => client.start());
  return client;
}
