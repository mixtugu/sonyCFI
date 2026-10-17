import test from 'node:test';
import assert from 'node:assert/strict';
import { MazeRooms } from './maze-rooms.js';
import { autoDirection, neighbor, edge } from '../src/maze.js';
const socket = () => ({ readyState: 1, packets: [], send(raw) { this.packets.push(JSON.parse(raw)); }, close() { this.readyState = 3; } });
function setup() {
  const service = new MazeRooms(), parent = socket(), child = socket();
  service.handle(parent, { type: 'create', role: 'child' }); const room = [...service.rooms.values()][0];
  assert.equal(room.code, 'A');
  service.handle(child, { type: 'join', code: room.code });
  assert.deepEqual(room.members.map(m => m.role), ['parent', 'child']);
  const both = type => { service.handle(parent, { type }); service.handle(child, { type }); };
  const ready = () => { both('tutorial'); both('ready'); };
  return { service, parent, child, room, both, ready };
}
test('room key is A and an occupied fixed key cannot be replaced', () => {
  const { service, room } = setup(), duplicate = socket();
  service.handle(duplicate, { type: 'create' });
  assert.equal(service.rooms.get('A'), room);
  assert.equal(duplicate.packets.at(-1).code, 'full');
});
test('fixed key becomes reusable after both players explicitly leave', () => {
  for (const completed of [false, true]) {
    const { service, parent, child, room } = setup();
    if (completed) { room.leg = 2; room.game.phase = 'result'; }
    service.handle(parent, { type: 'leave' });
    assert.equal(service.rooms.get('A'), room, 'preserve the remaining player session and report');
    service.handle(child, { type: 'leave' });
    assert.equal(service.rooms.has('A'), false);
    const next = socket();
    service.handle(next, { type: 'create' });
    assert.notEqual(service.rooms.get('A'), room);
    assert.equal(next.packets[0].type, 'session');
  }
});
test('both tutorial confirmations and ready votes precede a locked 3, 2, 1 countdown', () => {
  const { service, parent, child, room, both } = setup();
  both('ready'); assert.equal(room.game.phase, 'ready'); assert.ok(room.members.every(m => !m.ready));
  service.handle(parent, { type: 'tutorial' }); both('ready'); assert.equal(room.game.phase, 'ready');
  service.handle(child, { type: 'tutorial' }); assert.equal(room.game.phase, 'ready');
  service.handle(child, { type: 'ready' }); assert.equal(room.game.phase, 'countdown');
  const pos = room.game.avatar, direction = autoDirection(room.game);
  for (const expected of [3, 2, 1]) {
    assert.equal(service.view(room, room.members[0]).countdown, expected);
    service.handle(child, { type: 'move', direction }); service.handle(parent, { type: 'wall', cell: pos, direction });
    assert.equal(room.game.avatar, pos); assert.equal(room.game.walls.size, 0); assert.equal(room.game.time, 0);
    service.tick(1);
  }
  assert.equal(room.game.phase, 'playing'); assert.equal(room.game.time, 0);
  service.tick(.25); assert.equal(room.game.time, .25);
});
test('playing keeps private views and role restrictions with no CPU actions', () => {
  const { service, parent, child, room, ready } = setup(); ready(); service.tick(3);
  const pos = room.game.avatar; for (let i = 0; i < 90; i++) service.tick();
  assert.equal(room.game.avatar, pos); assert.equal(room.game.walls.size, 0);
  const direction = autoDirection(room.game); service.handle(parent, { type: 'move', direction }); assert.equal(room.game.avatar, pos);
  service.handle(child, { type: 'move', direction }); assert.notEqual(room.game.avatar, pos);
  for (let cell = 0; cell < room.game.settings.cols * room.game.settings.rows; cell++) {
    const b = neighbor(room.game, cell, 0); if (b < 0 || room.game.base.has(edge(cell, b))) continue;
    service.handle(child, { type: 'wall', cell, direction: 0 }); assert.equal(room.game.walls.size, 0);
    service.handle(parent, { type: 'wall', cell, direction: 0 }); assert.equal(room.game.walls.size, 1); break;
  }
  const parentView = service.view(room, room.members[0]).game, childView = service.view(room, room.members[1]).game;
  assert.deepEqual(parentView.secrets, []); assert.equal(childView.goal, null);
  // HP and risk are the navigator's alone; neither role learns a creature before it is met.
  assert.equal(parentView.hp, 18); assert.equal(childView.hp, null);
  assert.ok(parentView.items.filter(i => !i.taken).every(i => ['small', 'medium', 'large'].includes(i.size) && [1, 2, 3].includes(i.maxRisk) && !('risk' in i) && !('creature' in i) && !('damage' in i)));
  assert.ok(childView.items.every(i => ['small', 'medium', 'large'].includes(i.size) && !('risk' in i) && !('maxRisk' in i) && !('damage' in i)));
  assert.equal('seed' in childView, false);
});
test('a creature stays hidden until met and is then shared; only the navigator sees the damage', () => {
  const { service, room } = setup(), item = room.game.items[0];
  const member = role => room.members.find(m => m.role === role);
  const viewItem = role => service.view(room, member(role)).game.items.find(i => i.cell === item.cell);
  assert.equal('creature' in viewItem('parent'), false);
  assert.equal('creature' in viewItem('child'), false);
  item.taken = true; item.damage = 3;
  assert.equal(viewItem('parent').creature, item.creature); assert.equal(viewItem('parent').damage, 3);
  assert.equal(viewItem('child').creature, item.creature); assert.equal('damage' in viewItem('child'), false);
});
test('a game is one round: both see its encyclopedia, and both ending it starts a new game in the same seats', () => {
  const { service, parent, room, both, ready } = setup(); ready(); service.tick(3);
  const [a, b] = room.game.items; a.taken = b.taken = true;
  room.game.time = room.game.settings.duration - .01; service.tick(.02);
  assert.equal(room.game.phase, 'result'); assert.deepEqual(room.results, [{ caught: [a.creature, b.creature] }]);
  for (const member of room.members) {
    const view = service.view(room, member);
    assert.equal(view.match.done, true); assert.deepEqual(view.game.items.filter(i => i.taken).map(i => i.creature), [a.creature, b.creature]);
  }
  const round = room.round;
  service.handle(parent, { type: 'again' }); assert.equal(room.game.phase, 'result'); assert.equal(room.round, round);
  both('again');
  assert.equal(room.round, round + 1); assert.equal(room.game.phase, 'ready'); assert.deepEqual(room.results, []);
  assert.deepEqual(room.members.map(m => m.role), ['parent', 'child']);   // no swap
  assert.ok(room.game.items.every(i => !i.taken)); assert.ok(room.members.every(m => !m.ready && !m.tutorialComplete));
});
test('disconnect cancels countdown and both players must ready again after reconnect', () => {
  const { service, parent, child, room, ready } = setup();
  const guest = socket(); service.handle(guest, { type: 'join', code: room.code }); assert.equal(guest.packets.at(-1).code, 'full');
  ready(); service.tick(1); service.disconnect(child); assert.equal(room.game.phase, 'paused'); assert.equal(room.countdown, 0);
  service.tick(10); assert.equal(room.game.time, 0);
  const replacement = socket(); service.handle(replacement, { type: 'resume', code: room.code, token: room.members[1].token });
  service.handle(replacement, { type: 'ready' }); assert.equal(room.game.phase, 'paused'); service.handle(parent, { type: 'ready' }); assert.equal(room.countdown, 3);
  service.tick(3.5); assert.equal(room.game.phase, 'playing'); assert.equal(room.game.time, .5);
  service.handle(parent, { type: 'pause' }); service.tick(5); assert.equal(room.game.time, .5);
});
test('settings invalidate tutorial approvals and cannot discard a finished game', () => {
  const { service, parent, child, room, both } = setup(); both('tutorial'); service.handle(parent, { type: 'ready' });
  service.handle(child, { type: 'settings', settings: { duration: 120 } }); assert.equal(room.game.settings.duration, 30);
  service.handle(parent, { type: 'settings', settings: { duration: 45 } }); assert.equal(room.game.settings.duration, 45);
  assert.ok(room.members.every(m => !m.ready && !m.tutorialComplete));
  room.game.phase = 'result'; service.broadcast(room);
  service.handle(parent, { type: 'settings', settings: { duration: 120 } }); assert.equal(room.game.phase, 'result'); assert.equal(room.game.settings.duration, 45);
});
test('leaving after the report preserves the other player totals and rejects a departed token', () => {
  const { service, parent, child, room } = setup(); room.game.phase = 'result'; service.broadcast(room);
  const before = service.view(room, room.members[1]).match, token = room.members[0].token;
  service.handle(parent, { type: 'leave' }); assert.equal(parent.packets.at(-1).type, 'left');
  assert.equal(room.game.phase, 'result'); assert.deepEqual(service.view(room, room.members[1]).match, before);
  const resumed = socket(); service.handle(resumed, { type: 'resume', code: room.code, token }); assert.equal(resumed.packets.at(-1).code, 'missing');
  service.handle(resumed, { type: 'resume', code: room.code, token: null }); assert.equal(resumed.packets.at(-1).code, 'missing');
  service.handle(child, { type: 'leave' }); assert.equal(child.packets.at(-1).type, 'left');
});
