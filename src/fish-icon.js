export const FISH_ICON_PATH = 'M-4.5-1.2C-1-5 3.3-3.4 5 0C3.3 3.4-1 5-4.5 1.2Q-8.6 4.5-6.8 0Q-8.6-4.5-4.5-1.2Z';

export function fishIconSvg(dangerous = false) {
  const fill = dangerous ? '#e83b43' : 'rgba(67,177,235,.12)';
  const outline = dangerous ? '#ff5b61' : '#62d8ff';
  const highlight = dangerous ? '#ffaaa5' : '#d4f8ff';
  return `<svg class="damage-fish-icon${dangerous ? ' is-dangerous' : ''}" viewBox="-10 -8 20 16" aria-hidden="true"><path d="${FISH_ICON_PATH}" fill="${fill}" stroke="${outline}" stroke-width="2.2" stroke-linejoin="round"/><path d="${FISH_ICON_PATH}" fill="none" stroke="${highlight}" stroke-width=".55" stroke-linejoin="round"/>${dangerous ? '<text x="0" y=".15" fill="#fff" font-family="sans-serif" font-size="9" font-weight="900" text-anchor="middle" dominant-baseline="central">!</text>' : ''}</svg>`;
}
