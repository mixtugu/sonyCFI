import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES, HP_MAX, SIZE_MIX, applyDamage, creature, pickCreature } from './creatures.js';
import { createMaze, reachable, start, tick, move, placeWall, neighbor, neighbors, canMove, edge, autoDirection, rng, DEFAULTS } from './maze.js';

test('seeded mazes are connected at every supported board size', () => {
  for (const [cols, rows] of [[10, 8], [14, 10], [20, 12], [28, 18]]) {
    const s = createMaze({ cols, rows });
    assert.equal(reachable(s).size, cols * rows);
    assert.deepEqual([...s.base], [...createMaze({ cols, rows }).base]);
    assert.equal(new Set(s.items.map(i => i.cell)).size, 12);
    assert.deepEqual(s.items.map(i => i.size).sort(), [...SIZE_MIX].sort());
    // Each fish hides a creature of its own size, and its risk is that creature's.
    assert.ok(s.items.every(i => creature(i.creature).size === i.size && creature(i.creature).risk === i.risk));
    // 「!」is the maximum risk: the creature is at that risk or below, and large fish are always「!!!」.
    assert.ok(s.items.every(i => i.risk <= i.maxRisk && i.maxRisk <= 3 && (i.size !== 'large' || i.maxRisk === 3)));
    assert.ok(s.items.every(i => i.cell !== s.avatar && i.cell !== s.goal));
  }
});
test('generated fish can be reached without the top-right cell and its zone always has a large fish', () => {
  for (let cols = 10; cols <= 28; cols++) for (let rows = 8; rows <= 18; rows++) for (let seed = 0; seed < 20; seed++) {
    const s = createMaze({ cols, rows }, seed);
    const seen = new Set([s.avatar]), queue = [s.avatar];
    for (let i = 0; i < queue.length; i++) for (const n of neighbors(s, queue[i])) {
      if (n !== s.goal && !seen.has(n) && canMove(s, queue[i], n)) { seen.add(n); queue.push(n); }
    }
    assert.equal(seen.size, cols * rows - 1, `${cols}x${rows}, seed ${seed}`);
    assert.ok(s.items.every(item => seen.has(item.cell)));
    const topRightFish = s.items.filter(item => item.cell % cols >= Math.floor(3 * cols / 4) && Math.floor(item.cell / cols) < Math.floor(rows / 3));
    assert.equal(topRightFish.length, 1);
    assert.equal(topRightFish[0].size, 'large');
    assert.equal(reachable(s).size, cols * rows);
    assert.equal(new Set(s.items.map(item => item.cell)).size, 12);
    assert.deepEqual(s.items.map(item => item.size).sort(), [...SIZE_MIX].sort());
    assert.deepEqual(s.items, createMaze({ cols, rows }, seed).items);
  }
});
test('every parent wall preserves child reachability and costs 2 HP, floored at one', () => {
  const s = createMaze({ wallLimit: 30 }); start(s);
  const count = s.settings.cols * s.settings.rows;
  for (let a = 0; a < count; a++) for (let d = 0; d < 4; d++) {
    const hp = s.hp, placed = placeWall(s, a, d);
    assert.equal(s.hp, placed ? Math.max(1, hp - 2) : hp);
    if (placed) assert.equal(reachable(s).size, count);
  }
  assert.equal(s.walls.size, 30); assert.equal(s.hp, 1); assert.ok(s.secrets.size > 0);
  assert.equal(s.collected, 0); assert.ok(s.items.every(item => !item.taken));
});
test('rejected wall placements never consume HP', () => {
  const s = createMaze({ wallLimit: 1 });
  const dir = [0, 3].find(d => !s.base.has(edge(s.avatar, neighbor(s, s.avatar, d))));
  assert.notEqual(dir, undefined);
  for (const phase of ['ready', 'paused', 'countdown', 'result']) {
    s.phase = phase;
    assert.equal(placeWall(s, s.avatar, dir), false); assert.equal(s.hp, HP_MAX);
  }
  s.phase = 'ready'; start(s);
  assert.equal(placeWall(s, s.avatar, 2), false); assert.equal(s.hp, HP_MAX);
  const [a, b] = [...s.base][0].split(':').map(Number), direction = b === a + 1 ? 0 : 1;
  assert.equal(placeWall(s, a, direction), false); assert.equal(s.hp, HP_MAX);
  assert.equal(placeWall(s, s.avatar, dir), true); assert.equal(s.hp, HP_MAX - 2);
  assert.match(s.logs[0].text, /壁を設置 · HP −2/);
  assert.equal(placeWall(s, s.avatar, dir), false); assert.equal(s.hp, HP_MAX - 2);
  const other = Array.from({ length: s.settings.cols * s.settings.rows }, (_, cell) => cell)
    .find(cell => cell % s.settings.cols < s.settings.cols - 1 && !s.base.has(edge(cell, cell + 1)) && !s.walls.has(edge(cell, cell + 1)));
  assert.notEqual(other, undefined);
  assert.equal(placeWall(s, other, 0), false); assert.equal(s.hp, HP_MAX - 2);
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
  assert.equal(createMaze().settings.wallLimit, 8);
  start(s); assert.ok(move(s, autoDirection(s))); assert.equal(move(s, autoDirection(s)), false);
});
test('a maximum risk only ever hides creatures at or below it', () => {
  const random = rng(11);
  for (let i = 0; i < 2000; i++) for (const size of ['small', 'medium']) {
    const maxRisk = 1 + (i % 3), found = pickCreature(size, random, maxRisk);
    assert.ok(found.size === size && found.risk <= maxRisk);
  }
});
