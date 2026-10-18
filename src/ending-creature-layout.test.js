import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES, SIZES } from './creatures.js';
import { endingCreatureLayout } from './ending-creature-layout.js';

test('balances each size and the total on both sides for every collection', () => {
  for (let mask = 0; mask < 1 << CREATURES.length; mask++) {
    const found = new Set(CREATURES.filter((c, i) => mask & (1 << i)).map(c => c.id));
    const layout = endingCreatureLayout(CREATURES, found);
    assert.equal(layout.size, CREATURES.length);
    for (const collected of [true, false]) {
      const group = CREATURES.filter(c => found.has(c.id) === collected && layout.get(c.id).side !== 'center');
      for (const size of [null, ...SIZES]) {
        const subset = group.filter(c => !size || c.size === size);
        const left = subset.filter(c => layout.get(c.id).side === 'left').length;
        assert.ok(Math.abs(left - (subset.length - left)) <= 1);
      }
    }
    for (const c of CREATURES) {
      const { x, y, side } = layout.get(c.id);
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      if (side === 'center') {
        assert.equal(c.id, 'squid');
        assert.ok(CREATURES.filter(item => item.size === 'large').every(item => found.has(item.id)));
        continue;
      }
      const width = { butterflyfish: 64, octopus: 120 }[c.id]
        ?? { large: 280, medium: 84, small: 64 }[c.size];
      const travel = width / 9.6 * { large: .65, medium: .7, small: .3 }[c.size];
      if (side === 'left') assert.ok(x + width / 9.6 + travel < 48);
      else assert.ok(x - travel > 52);
    }
  }
});

test('places the third collected large creature below the explorer, keeping the others balanced', () => {
  const layout = endingCreatureLayout(CREATURES, new Set(CREATURES.map(c => c.id)));
  assert.deepEqual(layout.get('squid'), { x: 35.4, y: 62, side: 'center' });
  assert.equal(layout.get('shark').side, 'left');
  assert.equal(layout.get('mermaid').side, 'right');
  assert.equal(layout.get('octopus').y, layout.get('turtle').y);
  assert.ok(layout.get('shrimp').y > layout.get('octopus').y);
});

test('keeps large creatures at the sides unless all three are collected', () => {
  for (const missing of CREATURES.filter(c => c.size === 'large')) {
    const found = new Set(CREATURES.filter(c => c.id !== missing.id).map(c => c.id));
    assert.ok([...endingCreatureLayout(CREATURES, found).values()].every(p => p.side !== 'center'));
  }
});
