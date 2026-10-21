import { heldButtons as heldButtonsOf } from './gamepad.js';
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
const ARROW = '<path class="ps-direction-mark" d="M16 6 28 26H4Z"/>';
let diagrams = 0;
export function controllerDiagram(active = []) {
  // Each copy gets its own gradient ids, since a hidden copy's defs do not paint the visible one.
  const id = `ps-${++diagrams}`;
  const on = name => active.includes(name) ? ' is-active' : '';
  const petals = Array.from({ length: 8 }, (_, i) => {
    const angle = i * 45, name = PETALS[angle];
    if (!name) return `<g class="ps-petal is-off"><path d="${petal(angle - 19, angle + 19)}"/></g>`;
    const [x, y] = point(78, angle).split(' ').map(Number);
    return `<g class="ps-petal${on(name)}" data-pad="${name}" data-angle="${angle}"><path d="${petal(angle - 19, angle + 19)}"/><g transform="translate(${x - 13} ${y - 13}) scale(.8125) rotate(${angle} 16 16)"><g class="ps-mark">${ARROW}</g></g></g>`;
  }).join('');
  return `<svg class="ps-controller" style="--pad-cap:url(#${id}-cap);--pad-active:url(#${id}-active);--pad-off:url(#${id}-off)" viewBox="0 0 370 250" role="img" aria-label="Access コントローラー。左にスティック、本体の中央に×ボタン、上下左右に向きのボタン。ほかのボタンは使いません。">
    <defs><radialGradient id="${id}-ball" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#5b6068"/><stop offset=".45" stop-color="#1d2025"/><stop offset="1" stop-color="#050608"/></radialGradient>
    <linearGradient id="${id}-body" x2=".35" y2="1"><stop stop-color="#52647a"/><stop offset=".4" stop-color="#252f40"/><stop offset="1" stop-color="#080f1b"/></linearGradient>
    <linearGradient id="${id}-cap" x2=".3" y2="1"><stop stop-color="#ffffff"/><stop offset=".45" stop-color="#e3edf4"/><stop offset="1" stop-color="#8b9eaf"/></linearGradient>
    <linearGradient id="${id}-active" x2=".3" y2="1"><stop stop-color="#ffffff"/><stop offset=".5" stop-color="#e3f6ff"/><stop offset="1" stop-color="#82b7db"/></linearGradient>
    <linearGradient id="${id}-off" x2=".3" y2="1"><stop stop-color="#708095"/><stop offset="1" stop-color="#273445"/></linearGradient>
    <linearGradient id="${id}-metal" x2="1"><stop stop-color="#182330"/><stop offset=".4" stop-color="#a4bdcf"/><stop offset=".65" stop-color="#40576c"/><stop offset="1" stop-color="#101a27"/></linearGradient>
    <radialGradient id="${id}-shadow"><stop stop-color="#000b"/><stop offset="1" stop-color="#0000"/></radialGradient>
    <radialGradient id="${id}-ring" r=".5"><stop offset=".78" stop-color="#2f6bff" stop-opacity="0"/><stop offset=".9" stop-color="#3f7dff"/><stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="215" cy="228" rx="151" ry="22" fill="url(#${id}-shadow)"/>
    <circle cx="${CX}" cy="${CY + 9}" r="109" fill="#060d18" stroke="#38506b" stroke-width="2"/>
    <g class="joystick-direction-arrow" transform="translate(58 17) scale(1.25)" aria-hidden="true"><path d="M16 2 30 16H22V30H10V16H2Z"/></g>
    <g class="ps-stick${on('left')}" data-pad="left">
      <path d="M118 163l40-14v20l-40 14Z" fill="url(#${id}-body)"/>
      <ellipse cx="78" cy="172" rx="43" ry="32" fill="#080f1b"/>
      <ellipse cx="78" cy="166" rx="43" ry="32" fill="url(#${id}-body)" stroke="#829cb0" stroke-width="1"/>
      <ellipse cx="78" cy="158" rx="20" ry="15" fill="#0b1420" stroke="#526b80"/>
      <rect x="71" y="118" width="14" height="40" rx="6" fill="url(#${id}-metal)"/>
      <ellipse cx="78" cy="150" rx="26" ry="13" fill="#000" opacity=".3"/>
      <circle class="ps-ball" cx="78" cy="112" r="34" fill="url(#${id}-ball)"/>
      <ellipse cx="66" cy="98" rx="11" ry="8" fill="#fff" opacity=".18"/>
    </g>
    <circle cx="${CX}" cy="${CY}" r="108" fill="url(#${id}-body)" stroke="#a3bdcf" stroke-opacity=".6" stroke-width="1.5"/>
    <g transform="translate(0 4)" opacity=".7" fill="#030912">${Array.from({ length: 8 }, (_, i) => `<path d="${petal(i * 45 - 19, i * 45 + 19)}"/>`).join('')}</g>
    <g class="ps-petals">${petals}</g>
    <circle cx="${CX}" cy="${CY}" r="53" fill="#15171b"/><circle cx="${CX}" cy="${CY}" r="56" fill="url(#${id}-ring)"/>
    <g class="ps-petal ps-center${on('cross')}" data-pad="cross"><circle cx="${CX}" cy="${CY}" r="38"/><g transform="translate(${CX - 14} ${CY - 14}) scale(.875)"><g class="ps-mark">${marks.cross}</g></g></g>
  </svg>`;
}
// One petal of the drawing above, cut out as a button icon: the ← / → petals that go to the
// previous / next screen look the same in the tutorial footer as on the drawn controller.
let petalIcons = 0;
export function petalIcon(name) {
  const angle = name === 'prev' ? 270 : 90, id = `ps-petal-icon-${++petalIcons}`;
  const [x, y] = point(78, angle).split(' ').map(Number);
  const box = name === 'prev' ? `${CX - 101} ${CY - 34} 49 68` : `${CX + 52} ${CY - 34} 49 68`;
  return `<span class="ps-button ps-${name} ps-petal-icon" role="img" aria-label="${labels[name]}"><svg viewBox="${box}" aria-hidden="true"><defs><linearGradient id="${id}" x2=".3" y2="1"><stop stop-color="#ffffff"/><stop offset=".45" stop-color="#e3edf4"/><stop offset="1" stop-color="#8b9eaf"/></linearGradient></defs><path class="ps-petal-cap" d="${petal(angle - 19, angle + 19)}" fill="url(#${id})" stroke="#a3bdcf" stroke-width="1.5"/><g transform="translate(${x - 13} ${y - 13}) scale(.8125) rotate(${angle} 16 16)"><path class="ps-petal-arrow" d="M16 6 28 26H4Z"/></g></svg></span>`;
}
export function playGuide(role) {
  return (role === 'cpu' ? '' : padAction('left', role === 'parent' ? '位置を選択' : '移動')) +
    (role === 'parent' ? padAction('dpad', '壁の向き') + padAction('cross', '壁を設置') : '');
}
// Live press feedback: every controller drawing and button icon on screen lights up while its
// button is held, and the drawn stick leans with the real one.
const ANGLE = { up: 0, right: 90, down: 180, left: 270 };
export function startPressFeedback(readPad) {
  let last = '';
  const frame = () => {
    const pad = readPad(), held = pad ? heldButtonsOf(pad) : new Set();
    const [x = 0, y = 0] = pad?.axes ?? [];
    const key = [...held].sort().join() + x.toFixed(2) + y.toFixed(2);
    if (key !== last) {
      last = key;
      const lit = { cross: held.has('cross'), prev: held.has('left'), next: held.has('right'), dpad: ['up', 'down', 'left', 'right'].some(n => held.has(n)), left: Math.hypot(x, y) > .3 };
      document.querySelectorAll('.ps-controller .ps-petal[data-angle]').forEach(el => el.classList.toggle('is-pressed', Object.entries(ANGLE).some(([n, a]) => held.has(n) && +el.dataset.angle === a)));
      document.querySelectorAll('.ps-controller .ps-center').forEach(el => el.classList.toggle('is-pressed', lit.cross));
      document.querySelectorAll('.ps-controller .ps-ball').forEach(el => el.setAttribute('transform', `translate(${(x * 12).toFixed(1)} ${(y * 9).toFixed(1)})`));
      document.querySelectorAll('.ps-controller .ps-stick').forEach(el => el.classList.toggle('is-pressed', lit.left));
      document.querySelectorAll('.ps-button').forEach(el => { const name = [...el.classList].find(c => c.startsWith('ps-') && c !== 'ps-button')?.slice(3); el.classList.toggle('is-pressed', !!lit[name]); });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
