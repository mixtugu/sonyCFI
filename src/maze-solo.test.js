import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoloSession } from './maze-solo.js';
import { edge } from './maze.js';

function setup(role, settings = {}) {
  let left = false;
  const session = createSoloSession({ role, settings: () => ({ duration: 5, ...settings }), onLeave: () => { left = true; } });
  session.start();
  const ready = () => { session.send({ type: 'tutorial' }); session.send({ type: 'ready' }); };
  return { session, ready, get left() { return left; } };
}
for (const role of ['parent', 'child']) {
  test(`offline ${role} starts privately, confirms, counts down, swaps, totals and replays without a partner`, () => {
    const run = setup(role), { session, ready } = run;
    assert.equal(session.state.role, role); assert.equal(session.state.game.phase, 'ready');
    assert.equal(session.state.tutorialComplete, false); assert.equal(session.state.partner.ready, true);
    assert.equal(session.state.game[role === 'parent' ? 'childScore' : 'parentScore'], null);
    assert.equal('seed' in session.state.game, false);
    if (role === 'parent') assert.deepEqual(session.state.game.secrets, []);
    else assert.ok(session.state.game.items.every(item => !('highRisk' in item)));
    session.send({ type: 'ready' }); assert.equal(session.state.game.phase, 'ready');
    ready();
    for (const number of [3, 2, 1]) { assert.equal(session.state.countdown, number); assert.equal(session.state.game.time, 0); session.advance(1); }
    assert.equal(session.state.game.phase, 'playing');
    session.advance(5.1);
    assert.equal(session.state.match.leg, 2); assert.equal(session.state.game.phase, 'ready');
    assert.notEqual(session.state.role, role); assert.equal(session.state.tutorialComplete, false);
    assert.equal(session.state.partner.ready, true);
    ready(); session.advance(8.1);
    assert.equal(session.state.match.done, true); assert.equal(session.state.match.results.length, 2);
    const [first, second] = session.state.match.results;
    assert.equal(session.state.match.you, first[role] + second[role === 'parent' ? 'child' : 'parent']);
    session.send({ type: 'again' }); assert.equal(session.state.role, role); assert.equal(session.state.match.leg, 1);
    assert.equal(session.state.tutorialComplete, false);
    session.send({ type: 'leave' }); assert.equal(run.left, true); assert.equal(session.active, false);
    session.start(); assert.equal(session.state.role, role); assert.equal(session.state.game.phase, 'ready');
  });
}
test('CPU fills only the opposite seat; countdown and pause do not advance either player', () => {
  const { session, ready } = setup('parent'); ready();
  const initial = session.state.game.avatar;
  session.advance(1); session.send({ type: 'pause' }); session.advance(10);
  assert.equal(session.state.game.time, 0); assert.equal(session.state.game.avatar, initial);
  session.send({ type: 'ready' }); session.advance(4);
  assert.ok(session.state.game.moves > 0); assert.equal(session.state.game.walls.length, 0);
  session.send({ type: 'pause' }); const paused = session.state.game;
  session.advance(10); assert.deepEqual(session.state.game, paused);
  const child = setup('child'); child.ready(); child.session.advance(6);
  assert.equal(child.session.state.game.moves, 0); assert.ok(child.session.state.game.walls.length > 0);
});
test('solo player actions use the same wall costs, movement cooldown and settings permissions', () => {
  const { session, ready } = setup('parent');
  session.send({ type: 'tutorial' }); session.send({ type: 'settings', settings: { duration: 8, wallCost: 3 } });
  assert.equal(session.state.game.settings.duration, 8); assert.equal(session.state.tutorialComplete, false);
  ready(); session.advance(3);
  const g = session.state.game;
  const cell = Array.from({ length: g.settings.cols * g.settings.rows }, (_, i) => i).find(i => i % g.settings.cols < g.settings.cols - 1 && !g.base.includes(edge(i, i + 1)));
  session.send({ type: 'wall', cell, direction: 0 }); assert.equal(session.state.game.parentScore, 97);
  const before = session.state.game.avatar;
  session.send({ type: 'move', direction: 0 }); assert.equal(session.state.game.avatar, before);
  session.send({ type: 'settings', settings: { duration: 120 } }); assert.equal(session.state.game.settings.duration, 8);
  const child = setup('child', { wallLimit: 0 });
  child.session.send({ type: 'settings', settings: { duration: 120 } }); assert.equal(child.session.state.game.settings.duration, 5);
  child.ready(); child.session.advance(3);
  const start = child.session.state.game.avatar;
  for (const direction of [0, 3]) child.session.send({ type: 'move', direction });
  assert.notEqual(child.session.state.game.avatar, start); assert.equal(child.session.state.game.moves, 1);
});
