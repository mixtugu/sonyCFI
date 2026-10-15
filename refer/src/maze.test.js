import test from 'node:test';
import assert from 'node:assert/strict';
import { createMaze, reachable, start, tick, move, placeWall, neighbor, autoDirection, DEFAULTS, INITIAL_HP, FISH_DAMAGE } from './maze.js';
import { CREATURES, creatureCandidates } from './creatures.js';

test('seeded mazes are connected at every supported board size', () => {
  for (const [cols, rows] of [[10, 8], [14, 10], [20, 12], [28, 18]]) {
    const s = createMaze({ cols, rows });
    assert.equal(reachable(s).size, cols * rows);
    assert.deepEqual([...s.base], [...createMaze({ cols, rows }).base]);
    assert.equal(new Set(s.items.map(i => i.cell)).size, 12);
    assert.ok(s.items.every(i => ['small', 'medium', 'large'].includes(i.fishSize)));
    assert.ok(s.items.every(i => CREATURES[i.fishKind].size === i.fishSize));
    assert.ok(s.items.every(i => i.cell !== s.avatar && i.cell !== s.goal));
  }
});
test('every parent wall preserves child reachability and costs 2 HP, floored at zero, without changing catalog', () => {
  const s = createMaze({ wallLimit: 30 }); start(s);
  const count = s.settings.cols * s.settings.rows;
  for (let a = 0; a < count; a++) for (let d = 0; d < 4; d++) {
    const hp = s.navigatorHp;
    if (placeWall(s, a, d)) {
      assert.equal(reachable(s).size, count);
      assert.equal(s.navigatorHp, Math.max(0, hp - 2));
    } else assert.equal(s.navigatorHp, hp, 'failed placement consumes no HP');
  }
  assert.equal(s.walls.size, 30); assert.equal(s.navigatorHp, 0); assert.equal(s.collected, 0); assert.ok(s.secrets.size > 0);
  assert.equal(s.phase, 'playing', 'zero HP does not end the round');
  while (s.collected < 12) {
    s.cooldown = 0; assert.ok(move(s, autoDirection(s)));
    assert.equal(s.navigatorHp, 0, 'fish contact at zero HP still registers without negative HP');
  }
  assert.equal(s.collected, 12);
});
test('initial settings use ten walls, thirty HP and doubled fish damage', () => {
  const s = createMaze();
  assert.equal(s.settings.wallLimit, 10);
  assert.equal(s.navigatorHp, 30);
  assert.deepEqual(FISH_DAMAGE, { green: 2, yellow: 3, red: 4 });
});
test('fractional HP is floored at zero by either wall or fish damage', () => {
  const s = createMaze(); start(s); s.navigatorHp = .5;
  s.items.forEach(item => { item.damage = 2; });
  const dir = autoDirection(s);
  assert.ok(placeWall(s, s.avatar, dir)); assert.equal(s.navigatorHp, 0);
  assert.equal(placeWall(s, s.avatar, dir), false); assert.equal(s.navigatorHp, 0);
  s.navigatorHp = .5;
  while (!s.collected) { s.cooldown = 0; assert.ok(move(s, autoDirection(s))); }
  assert.equal(s.navigatorHp, 0); assert.equal(s.collected, 1); assert.equal(s.phase, 'playing');
});
test('fish contact registers a catalog entry and deals risk-based damage only once', () => {
  const s = createMaze(); start(s);
  while (!s.collected) { const dir = autoDirection(s); assert.notEqual(dir, -1); s.cooldown = 0; assert.ok(move(s, dir)); }
  const item = s.items.find(i => i.taken);
  assert.equal(s.collected, 1); assert.equal(s.navigatorHp, INITIAL_HP - item.damage);
  const dir = [0, 1, 2, 3].find(d => neighbor(s, s.avatar, d) === s.trail.at(-2));
  s.cooldown = 0; move(s, dir); s.cooldown = 0; move(s, (dir + 2) % 4);
  assert.equal(s.collected, 1); assert.equal(s.navigatorHp, INITIAL_HP - item.damage);
  assert.equal('parentScore' in s, false); assert.equal('childScore' in s, false);
  assert.equal('reward' in item, false);
});
test('all 12 encounter slots are unique and doubled fish damage clamps HP at zero', () => {
  for (const [cols, rows] of [[10, 8], [14, 10], [28, 18]]) for (let seed = 0; seed < 30; seed++) {
    const s = createMaze({ cols, rows, wallCost: 20, redMax: 50, rewardMax: 50 }, seed);
    assert.equal(new Set(s.items.map(i => i.id)).size, 12);
    const totalDamage = s.items.reduce((sum, i) => sum + i.damage, 0);
    assert.ok(totalDamage <= 36);
    for (const category of ['green', 'yellow', 'red']) assert.equal(s.items.filter(i => i.category === category).length, 4);
    assert.deepEqual(Object.keys(s.settings), Object.keys(DEFAULTS));
    start(s);
    let steps = 0;
    while (s.collected < 12 && steps++ < cols * rows * 12) {
      s.cooldown = 0; assert.ok(move(s, autoDirection(s)));
      assert.ok(s.navigatorHp >= 0);
    }
    assert.equal(s.collected, 12); assert.ok(s.items.every(i => i.taken));
    assert.equal(s.navigatorHp, Math.max(0, INITIAL_HP - totalDamage)); assert.equal(autoDirection(s), -1);
    assert.equal(s.phase, 'playing', 'collection does not end a timed round');
  }
});
test('creatures match silhouette size and never exceed its risk; actual creature determines damage', () => {
  assert.deepEqual(creatureCandidates('large', 1), []);
  assert.deepEqual(creatureCandidates('large', 3), ['shark', 'mermaid', 'squid']);
  assert.deepEqual(creatureCandidates('medium', 1), ['turtle', 'butterflyfish']);
  assert.deepEqual(creatureCandidates('small', 1), ['clownfish', 'shrimp', 'seahorse']);
  const seen = new Set(); let downgraded = 0;
  for (let seed = 0; seed < 200; seed++) {
    const s = createMaze({}, seed);
    assert.deepEqual(s.items, createMaze({}, seed).items, 'seeded outcomes survive reset');
    for (const item of s.items) {
      const creature = CREATURES[item.fishKind], level = { green: 1, yellow: 2, red: 3 }[item.category];
      seen.add(item.fishKind);
      assert.equal(creature.size, item.fishSize); assert.ok(creature.risk <= level);
      assert.ok(Number.isInteger(item.damage) && item.damage >= 0 && item.damage <= [0, 2, 3, 4][creature.risk]);
      if (creature.risk < level) { downgraded++; assert.ok(item.damage < FISH_DAMAGE[item.category]); }
    }
  }
  assert.equal(seen.size, 12, 'all supplied creatures can appear');
  assert.ok(downgraded > 0, 'higher risk silhouettes can reveal safer creatures');
});
test('damage samples every integer uniformly within the revealed creature risk cap', () => {
  const counts = { 1: [0, 0, 0], 2: [0, 0, 0, 0], 3: [0, 0, 0, 0, 0] };
  for (let seed = 0; seed < 3000; seed++) {
    for (const item of createMaze({}, seed).items) counts[CREATURES[item.fishKind].risk][item.damage]++;
  }
  for (const bins of Object.values(counts)) {
    const mean = bins.reduce((sum, count) => sum + count, 0) / bins.length;
    for (const count of bins) assert.ok(Math.abs(count - mean) / mean < .15, 'all outcomes including zero and maximum occur near equal frequency');
  }
});
test('ready, pause and result freeze time and actions; CPU completes a timed round', () => {
  const s = createMaze({ duration: 5 }); tick(s, .1); assert.equal(s.time, 0); assert.equal(placeWall(s, s.avatar, 0), false);
  start(s); s.mode = 'cpu'; for (let i = 0; i < 20; i++) tick(s, .1);
  assert.ok(s.moves > 0); s.phase = 'paused'; const time = s.time; tick(s, .1); assert.equal(s.time, time);
  start(s); for (let i = 0; i < 50; i++) tick(s, .1);
  assert.equal(s.phase, 'result'); assert.equal(s.time, 5); assert.equal(move(s, 0), false);
});
test('a room role can play against the CPU on either side', () => {
  const navigator = createMaze(); navigator.mode = 'parent'; start(navigator); tick(navigator, .1);
  assert.ok(navigator.moves > 0);

  const explorer = createMaze(); explorer.mode = 'child'; start(explorer);
  const direction = autoDirection(explorer); tick(explorer, .1, direction);
  assert.equal(explorer.moves, 1);
  explorer.nextCpu = 0; tick(explorer, .1, autoDirection(explorer));
  assert.ok(explorer.walls.size > 0);
});
test('movement respects the configured interval and configuration is bounded', () => {
  const s = createMaze({ cols: 100, rows: -1, duration: NaN });
  assert.equal(s.settings.cols, 28); assert.equal(s.settings.rows, 8); assert.equal(s.settings.duration, DEFAULTS.duration);
  start(s); assert.ok(move(s, autoDirection(s))); assert.equal(move(s, autoDirection(s)), false);
});
