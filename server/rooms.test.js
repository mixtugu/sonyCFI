import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from './rooms.js';

function client() { return { readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); }, close() { this.readyState = 3; } }; }
function pair() {
  const service = new RoomService(), child = client(), parent = client();
  service.handle(child, { type: 'create', role: 'child' });
  const session = child.messages.find(m => m.type === 'session');
  service.handle(parent, { type: 'join', code: session.code });
  const room = service.rooms.get(session.code);
  return { service, child, parent, session, room };
}
function start(p) { p.service.handle(p.child, { type: 'ready' }); p.service.handle(p.parent, { type: 'ready' }); for (let i = 0; i < 92; i++) p.service.tick(); }

test('別々の役割で参加し、相手の目標・専用地図を送らない', () => {
  const p = pair(), a = p.child.messages.at(-1), b = p.parent.messages.at(-1);
  assert.equal(a.role, 'child'); assert.equal(b.role, 'parent');
  assert.equal(a.self.mission.target, 5); assert.equal(b.self.mission.target, 25);
  assert.equal(a.view.haven, null); assert.equal(b.view.gate, null); assert.deepEqual(b.view.treasures, []);
  assert.equal(a.review, undefined); assert.equal(b.review, undefined);
  assert.equal(a.partner.mission, undefined); assert.equal(b.partner.mission, undefined);
  assert.ok(!JSON.stringify(a).includes('合計25秒')); assert.ok(!JSON.stringify(b).includes('真珠を5つ'));
  const third = client(); p.service.handle(third, { type: 'join', code: p.session.code }); assert.equal(third.messages.at(-1).code, 'full');
});
test('二人が準備するまで進まず、親の移動・子の壁操作を拒否する', () => {
  const p = pair(); p.service.handle(p.child, { type: 'ready' }); p.service.tick(); assert.equal(p.room.status, 'waiting'); assert.equal(p.room.game.time, 0);
  start(p); assert.equal(p.room.status, 'playing');
  p.service.handle(p.parent, { type: 'input', x: 1, y: 0 }); assert.equal(p.parent.messages.at(-1).code, 'role');
  p.service.handle(p.child, { type: 'wall', a: { x: 400, y: 200 }, b: { x: 400, y: 350 } }); assert.equal(p.child.messages.at(-1).code, 'role');
  assert.equal(p.room.game.walls.length, 0);
  p.service.handle(p.child, { type: 'input', x: 1, y: 0 }); p.service.tick(); assert.ok(p.room.game.child.x > 285);
  p.service.handle(p.parent, { type: 'wall', a: { x: 500, y: 200 }, b: { x: 500, y: 350 } }); p.service.tick();
  assert.equal(p.child.messages.at(-1).view.walls.length, 1); assert.equal(p.parent.messages.at(-1).view.walls.length, 1);
});
test('切断時に双方を停止し、トークンによる復帰と二人の再開を待つ', () => {
  const p = pair(); start(p); p.service.handle(p.child, { type: 'input', x: 1, y: 0 }); p.service.tick();
  const position = p.room.game.child.x; p.service.disconnect(p.child); const time = p.room.game.time;
  p.service.tick(); assert.equal(p.room.status, 'paused'); assert.equal(p.room.game.time, time); assert.equal(p.room.game.child.x, position);
  const stranger = client(); p.service.handle(stranger, { type: 'resume', code: p.session.code, token: 'incorrect' }); assert.equal(stranger.messages.at(-1).code, 'expired');
  const reconnected = client(); p.service.handle(reconnected, { type: 'resume', code: p.session.code, token: p.session.token });
  assert.equal(reconnected.messages.at(-1).role, 'child'); assert.equal(reconnected.messages.at(-1).view.child.x, position);
  p.service.handle(reconnected, { type: 'ready' }); assert.equal(p.room.status, 'paused'); p.service.handle(p.parent, { type: 'ready' }); assert.equal(p.room.status, 'countdown');
});
test('古い移動入力を失効させ、無効な座標は受け付けない', () => {
  const p = pair(); start(p); p.room.input = { x: 1, y: 0 }; p.room.inputAt = Date.now() - 1000;
  const x = p.room.game.child.x; p.service.tick(); assert.equal(p.room.game.child.x, x);
  p.service.handle(p.child, { type: 'input', x: NaN, y: 1 }); p.service.handle(p.parent, { type: 'wall', a: { x: Infinity, y: 0 }, b: { x: 500, y: 600 } });
  assert.equal(p.room.game.walls.length, 0); assert.ok(Number.isFinite(p.room.game.child.x));
});
test('終了時に初めて両方の目標を公開し、双方の同意で役割を交代する', () => {
  const p = pair(); start(p); p.service.handle(p.parent, { type: 'pause' }); p.service.handle(p.child, { type: 'finish' });
  assert.equal(p.room.status, 'review'); assert.ok(p.child.messages.at(-1).review.missions.parent); assert.ok(p.parent.messages.at(-1).review.missions.child);
  p.service.handle(p.child, { type: 'swap' }); assert.equal(p.room.status, 'review');
  p.service.handle(p.parent, { type: 'swap' }); assert.equal(p.room.status, 'waiting'); assert.equal(p.room.game.time, 0);
  assert.equal(p.child.messages.at(-1).role, 'parent'); assert.equal(p.parent.messages.at(-1).role, 'child');
  assert.equal(p.child.messages.at(-1).review, undefined); assert.equal(p.parent.messages.at(-1).review, undefined);
});
test('明示的な退出後は空席に別の人を招待できる', () => {
  const p = pair(); p.service.handle(p.child, { type: 'leave' }); const newcomer = client();
  p.service.handle(newcomer, { type: 'join', code: p.session.code }); assert.equal(newcomer.messages.at(-1).role, 'child'); assert.equal(p.room.members.length, 2);
});
