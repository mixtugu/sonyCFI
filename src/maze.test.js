import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES, HP_MAX, SIZE_MIX, applyDamage, creature, pickCreature } from './creatures.js';
import { createMaze, reachable, start, tick, move, placeWall, neighbor, autoDirection, rng, DEFAULTS } from './maze.js';

test('seeded mazes are connected at every supported board size', () => {
  for (const [cols, rows] of [[10, 8], [14, 10], [20, 12], [28, 18]]) {
    const s = createMaze({ cols, rows });
    assert.equal(reachable(s).size, cols * rows);
    assert.deepEqual([...s.base], [...createMaze({ cols, rows }).base]);
    assert.equal(new Set(s.items.map(i => i.cell)).size, 12);
    assert.deepEqual(s.items.map(i => i.size).sort(), [...SIZE_MIX].sort());
    // Each fish hides a creature of its own size, and its risk is that creature's.
    assert.ok(s.items.every(i => creature(i.creature).size === i.size && creature(i.creature).risk === i.risk));
    assert.ok(s.items.every(i => i.cell !== s.avatar && i.cell !== s.goal));
  }
});
test('every parent wall preserves child reachability and costs no HP', () => {
  const s = createMaze({ wallLimit: 30 }); start(s);
  const count = s.settings.cols * s.settings.rows;
  for (let a = 0; a < count; a++) for (let d = 0; d < 4; d++) if (placeWall(s, a, d)) assert.equal(reachable(s).size, count);
  assert.equal(s.walls.size, 30); assert.equal(s.hp, HP_MAX); assert.ok(s.secrets.size > 0);
});
test('meeting a fish registers it once and costs HP by its risk', () => {
  const s = createMaze(); start(s);
  while (!s.collected) { const dir = autoDirection(s); assert.notEqual(dir, -1); s.cooldown = 0; assert.ok(move(s, dir)); }
  const item = s.items.find(i => i.taken);
  assert.equal(s.hp, applyDamage(HP_MAX, item.damage));
  assert.ok({ 1: [-1, 0, 1], 2: [1, 2, 3], 3: [3, 4, 5] }[item.risk].includes(item.damage));
  const dir = [0, 1, 2, 3].find(d => neighbor(s, s.avatar, d) === s.trail.at(-2));
  s.cooldown = 0; move(s, dir); s.cooldown = 0; move(s, (dir + 2) % 4);
  assert.equal(s.collected, 1); assert.equal(s.hp, applyDamage(HP_MAX, item.damage));
});
test('HP never drops below one or rises above the maximum', () => {
  assert.equal(applyDamage(2, 5), 1); assert.equal(applyDamage(1, 3), 1); assert.equal(applyDamage(HP_MAX, -1), HP_MAX);
  const s = createMaze(); start(s); s.mode = 'cpu';
  for (const item of s.items) item.risk = 3;
  for (let i = 0; i < 400 && s.phase === 'playing'; i++) tick(s, .1);
  assert.ok(s.collected > 3); assert.ok(s.hp >= 1);
});
test('creatures come from their size pool, rarer ones less often', () => {
  const random = rng(7), counts = {};
  for (let i = 0; i < 3000; i++) { const c = pickCreature('large', random); counts[c.id] = (counts[c.id] || 0) + 1; }
  assert.deepEqual(Object.keys(counts).sort(), CREATURES.filter(c => c.size === 'large').map(c => c.id).sort());
  assert.ok(counts.mermaid < counts.shark);   // ★5 is rarer than ★4
});
test('ready, pause and result freeze time and actions; CPU completes a timed round', () => {
  const s = createMaze({ duration: 5 }); tick(s, .1); assert.equal(s.time, 0); assert.equal(placeWall(s, s.avatar, 0), false);
  start(s); s.mode = 'cpu'; for (let i = 0; i < 20; i++) tick(s, .1);
  assert.ok(s.moves > 0); s.phase = 'paused'; const time = s.time; tick(s, .1); assert.equal(s.time, time);
  start(s); for (let i = 0; i < 50; i++) tick(s, .1);
  assert.equal(s.phase, 'result'); assert.equal(s.time, 5); assert.equal(move(s, 0), false);
});
test('movement respects the configured interval and configuration is bounded', () => {
  const s = createMaze({ cols: 100, rows: -1, duration: NaN });
  assert.equal(s.settings.cols, 28); assert.equal(s.settings.rows, 8); assert.equal(s.settings.duration, DEFAULTS.duration);
  start(s); assert.ok(move(s, autoDirection(s))); assert.equal(move(s, autoDirection(s)), false);
});
