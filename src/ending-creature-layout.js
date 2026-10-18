import { SIZES } from './creatures.js';

export function endingCreatureLayout(creatures, found) {
  const layout = new Map();
  for (const collected of [true, false]) {
    const sides = { left: 0, right: 0 };
    const largeCounts = { left: 0, right: 0 };
    for (const size of SIZES) {
      const group = creatures.filter(c => c.size === size && found.has(c.id) === collected);
      const startLeft = sides.left <= sides.right;
      const slots = { left: 0, right: 0 };
      group.forEach((c, index) => {
        if (collected && size === 'large' && group.length === 3 && index === 2) {
          layout.set(c.id, { x: 35.4, y: 62, side: 'center' });
          return;
        }
        const left = index % 2 === 0 ? startLeft : !startLeft;
        const side = left ? 'left' : 'right';
        const slot = slots[side]++;
        sides[side]++;
        let x, y;
        if (size === 'large') {
          largeCounts[side]++;
          x = left ? -2 : 73;
          y = -8 + slot * 48;
        } else {
          const lower = largeCounts[side] > 1;
          if (size === 'medium') {
            x = left ? 2 + slot * 14 : 85 - slot * 14;
            y = (lower ? 80 : 45) + slot * 5;
          } else {
            x = left ? slot * 12 : 93 - slot * 12;
            y = (lower ? 103 : 82) + (slot % 2) * 6;
          }
        }
        const silhouetteY = size === 'large' ? 80 - slot * 36
          : size === 'medium' ? 104 + slot * 4 : 108 + slot * 4;
        layout.set(c.id, { x, y: collected ? y : silhouetteY, side });
      });
    }
  }
  return layout;
}
