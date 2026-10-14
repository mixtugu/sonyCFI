// Shared PlayStation (Access controller) artwork and vocabulary for the briefing, help and live hints.
const marks = {
  cross: '<path d="m8 8 16 16M24 8 8 24"/>',
  circle: '<circle cx="16" cy="16" r="10"/>',
  // The Access controller's ← / → petals (D-pad): held, they go to the previous / next screen.
  prev: '<path d="M6 16 18 6v6h8v8h-8v6Z"/>',
  next: '<path d="M26 16 14 6v6H6v8h8v6Z"/>',
  square: '<rect x="7" y="7" width="18" height="18" rx="1"/>',
  triangle: '<path d="m16 6 12 20H4Z"/>',
  dpad: '<path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9Z"/>',
  touchpad: '<rect x="3" y="7" width="26" height="18" rx="4"/><path d="M9 13h1m5 0h1m5 0h1M9 19h1m5 0h1m5 0h1"/>',
};
const labels = { cross: '× ボタン', circle: '○ ボタン', prev: '← ボタン', next: '→ ボタン', square: '□ ボタン', triangle: '△ ボタン', dpad: '上下左右のボタン', left: '左スティック', right: '右スティック', options: 'OPTIONS', create: 'CREATE', l1: 'L1', r1: 'R1', touchpad: 'タッチパッドボタン' };
export function padIcon(name) {
  const graphic = marks[name] || (name === 'left' || name === 'right' ? `<text x="16" y="21">${name === 'left' ? 'L' : 'R'}</text>` : '');
  return `<span class="ps-button ps-${name}" role="img" aria-label="${labels[name]}">${graphic ? `<svg viewBox="0 0 32 32" aria-hidden="true">${graphic}</svg>` : labels[name]}</span>`;
}
export const padAction = (name, text) => `<span class="ps-action">${padIcon(name)}<span>${text}</span></span>`;
// Access controller: eight petal buttons and a centre button ring a round body, with the stick module beside it.
const CX = 250, CY = 122;
const point = (r, a) => `${(CX + r * Math.sin(a * Math.PI / 180)).toFixed(1)} ${(CY - r * Math.cos(a * Math.PI / 180)).toFixed(1)}`;
const petal = (a0, a1, r0 = 57, r1 = 99) => `M${point(r1, a0)}A${r1} ${r1} 0 0 1 ${point(r1, a1)}L${point(r0, a1)}A${r0} ${r0} 0 0 0 ${point(r0, a0)}Z`;
// Only the stick, the centre × and the up/right/down/left petals (which aim the wall) are mapped;
// the diagonal petals are switched off.
const PETALS = { 0: 'dpad', 90: 'dpad', 180: 'dpad', 270: 'dpad' };
const ARROW = '<path d="M16 6 26 18h-6v8h-8v-8H6Z"/>';
let diagrams = 0;
export function controllerDiagram(active = []) {
  // Each copy gets its own gradient ids, since a hidden copy's defs do not paint the visible one.
  const id = `ps-${++diagrams}`;
  const on = name => active.includes(name) ? ' is-active' : '';
  const petals = Array.from({ length: 8 }, (_, i) => {
    const angle = i * 45, name = PETALS[angle];
    if (!name) return `<g class="ps-petal is-off"><path d="${petal(angle - 19, angle + 19)}"/></g>`;
    const [x, y] = point(78, angle).split(' ').map(Number);
    return `<g class="ps-petal${on(name)}" data-pad="${name}"><path d="${petal(angle - 19, angle + 19)}"/><g transform="translate(${x - 13} ${y - 13}) scale(.8125) rotate(${angle} 16 16)"><g class="ps-mark">${ARROW}</g></g></g>`;
  }).join('');
  return `<svg class="ps-controller" viewBox="0 0 370 240" role="img" aria-label="Access コントローラー。左にスティック、本体の中央に×ボタン、上下左右に向きのボタン。ほかのボタンは使いません。">
    <defs><radialGradient id="${id}-ball" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#5b6068"/><stop offset=".45" stop-color="#1d2025"/><stop offset="1" stop-color="#050608"/></radialGradient>
    <radialGradient id="${id}-ring" r=".5"><stop offset=".78" stop-color="#2f6bff" stop-opacity="0"/><stop offset=".9" stop-color="#3f7dff"/><stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="226" cy="226" rx="130" ry="9" fill="#0007"/>
    <g class="ps-stick${on('left')}" data-pad="left"><path d="M38 196q2-20 40-22 38 2 40 22-2 18-40 20-38-2-40-20Z" fill="#202328"/><path d="M118 192l40-14v20l-40 12Z" fill="#202328"/><rect x="71" y="96" width="14" height="88" rx="6" fill="#16181c"/><circle class="ps-ball" cx="78" cy="78" r="34" fill="url(#${id}-ball)"/><ellipse cx="66" cy="64" rx="11" ry="7" fill="#fff" opacity=".18"/></g>
    <circle cx="${CX}" cy="${CY}" r="108" fill="#1b1d22"/>
    <g class="ps-petals">${petals}</g>
    <circle cx="${CX}" cy="${CY}" r="53" fill="#15171b"/><circle cx="${CX}" cy="${CY}" r="56" fill="url(#${id}-ring)"/>
    <g class="ps-petal ps-center${on('cross')}" data-pad="cross"><circle cx="${CX}" cy="${CY}" r="38"/><g transform="translate(${CX - 14} ${CY - 14}) scale(.875)"><g class="ps-mark">${marks.cross}</g></g></g>
  </svg>`;
}
export function playGuide(role) {
  return (role === 'cpu' ? '' : padAction('left', role === 'parent' ? '位置を選択' : '移動')) +
    (role === 'parent' ? padAction('dpad', '壁の向き') + padAction('cross', '壁を設置') : '');
}
