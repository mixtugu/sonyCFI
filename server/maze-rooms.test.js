import test from 'node:test';
import assert from 'node:assert/strict';
import { MazeRooms } from './maze-rooms.js';
import { autoDirection, neighbor, edge } from '../src/maze.js';
const socket = () => ({ readyState: 1, packets: [], send(raw) { this.packets.push(JSON.parse(raw)); }, close() { this.readyState = 3; } });
function setup() { const service = new MazeRooms(), parent = socket(), child = socket(); service.handle(parent, { type: 'create', role: 'parent' }); const room = [...service.rooms.values()][0]; service.handle(child, { type: 'join', code: room.code }); return { service, parent, child, room }; }
test('two humans must ready; no CPU movement or walls; role actions are enforced', () => {
  const { service, parent, child, room } = setup();
  service.handle(parent, { type: 'ready' }); assert.equal(room.game.phase, 'ready');
  service.handle(child, { type: 'ready' }); assert.equal(room.game.phase, 'playing');
  const pos = room.game.avatar; for (let i = 0; i < 90; i++) service.tick();
  assert.equal(room.game.avatar, pos); assert.equal(room.game.walls.size, 0);
  const direction = autoDirection(room.game); service.handle(parent, { type: 'move', direction }); assert.equal(room.game.avatar, pos);
  service.handle(child, { type: 'move', direction }); assert.notEqual(room.game.avatar, pos);
  for (let cell = 0; cell < 240; cell++) { const b = neighbor(room.game, cell, 0); if (b >= 0 && !room.game.base.has(edge(cell, b))) {
    service.handle(child, { type: 'wall', cell, direction: 0 }); assert.equal(room.game.walls.size, 0);
    service.handle(parent, { type: 'wall', cell, direction: 0 }); assert.equal(room.game.walls.size, 1); break;
  } }
  const parentView = service.view(room, room.members[0]).game, childView = service.view(room, room.members[1]).game;
  assert.deepEqual(parentView.secrets, []); assert.equal(parentView.childScore, null); assert.equal(childView.parentScore, null); assert.equal(childView.goal, null);
  assert.ok(parentView.items.every(i => !('risk' in i) && !('reward' in i) && !('category' in i))); assert.equal('seed' in childView, false);
});
test('disconnect pauses, seat resumes, full rooms reject guests, replay needs both votes', () => {
  const { service, parent, child, room } = setup(); const guest = socket(); service.handle(guest, { type: 'join', code: room.code }); assert.equal(guest.packets.at(-1).code, 'full');
  service.handle(parent, { type: 'ready' }); service.handle(child, { type: 'ready' }); service.disconnect(child); assert.equal(room.game.phase, 'paused');
  const replacement = socket(); service.handle(replacement, { type: 'resume', code: room.code, token: room.members[1].token });
  service.handle(replacement, { type: 'ready' }); assert.equal(room.game.phase, 'paused'); service.handle(parent, { type: 'ready' }); assert.equal(room.game.phase, 'playing');
  room.game.phase = 'result'; service.handle(parent, { type: 'again' }); assert.equal(room.game.phase, 'result'); service.handle(replacement, { type: 'again' }); assert.equal(room.game.phase, 'ready');
  service.handle(replacement, { type: 'settings', settings: { duration: 120 } }); assert.equal(room.game.settings.duration, 15);
  service.handle(parent, { type: 'settings', settings: { duration: 30 } }); assert.equal(room.game.settings.duration, 30);
});
