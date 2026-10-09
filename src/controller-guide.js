// Shared PlayStation artwork and vocabulary for the briefing, help and live hints.
const marks = {
  cross: '<path d="m8 8 16 16M24 8 8 24"/>',
  circle: '<circle cx="16" cy="16" r="10"/>',
  square: '<rect x="7" y="7" width="18" height="18" rx="1"/>',
  triangle: '<path d="m16 6 12 20H4Z"/>',
  dpad: '<path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9Z"/>',
  touchpad: '<rect x="3" y="7" width="26" height="18" rx="4"/><path d="M9 13h1m5 0h1m5 0h1M9 19h1m5 0h1m5 0h1"/>',
};
const labels = { cross: '× ボタン', circle: '○ ボタン', square: '□ ボタン', triangle: '△ ボタン', dpad: '方向キー', left: '左スティック', right: '右スティック', options: 'OPTIONS', create: 'CREATE', l1: 'L1', r1: 'R1', touchpad: 'タッチパッドボタン' };
export function padIcon(name) {
  const graphic = marks[name] || (name === 'left' || name === 'right' ? `<circle cx="16" cy="16" r="12"/><text x="16" y="21">${name === 'left' ? 'L' : 'R'}</text>` : '');
  return `<span class="ps-button ps-${name}" role="img" aria-label="${labels[name]}">${graphic ? `<svg viewBox="0 0 32 32" aria-hidden="true">${graphic}</svg>` : labels[name]}</span>`;
}
export const padAction = (name, text) => `<span class="ps-action">${padIcon(name)}<span>${text}</span></span>`;
export function controllerDiagram() {
  return `<svg class="ps-controller" viewBox="0 0 360 174" role="img" aria-label="PlayStation コントローラー。左側に方向キーと左スティック、右側に右スティックと△○×□ボタン、上部にL1・R1とCREATE・OPTIONS。">
    <path fill="#dce9e8" stroke="#93b9bd" stroke-width="2" d="M80 32Q54 28 44 61L24 130Q19 156 38 159Q53 161 79 120L122 125Q180 143 238 125L281 120Q307 161 322 159Q341 156 336 130L316 61Q306 28 280 32Z"/>
    <path fill="#122e40" d="m115 55 17 64q48 22 96 0l17-64Z"/>
    <rect x="132" y="34" width="96" height="49" rx="9" fill="#78949c"/>
    <g fill="#13374a" font-family="sans-serif" font-size="11" text-anchor="middle"><text x="80" y="21" fill="#d7e9e4">L1</text><text x="280" y="21" fill="#d7e9e4">R1</text><text x="112" y="43" font-size="8">CREATE</text><text x="250" y="43" font-size="8">OPTIONS</text></g>
    <g stroke="#a4c7c8" fill="#19384a" stroke-width="2"><circle cx="133" cy="110" r="19"/><circle cx="227" cy="110" r="19"/></g>
    <g fill="#e3f2ef" font-family="sans-serif" font-size="13" text-anchor="middle"><text x="133" y="115">L</text><text x="227" y="115">R</text></g>
    <path d="M76 52h12v14h14v12H88v14H76V78H62V66h14Z" fill="#19384a"/>
    <g fill="#19384a"><circle cx="279" cy="51" r="11"/><circle cx="300" cy="73" r="11"/><circle cx="279" cy="95" r="11"/><circle cx="258" cy="73" r="11"/></g>
    <g fill="none" stroke-width="1.8"><path stroke="#8ad6bc" d="m279 45 6 11h-12Z"/><circle stroke="#f0a4ad" cx="300" cy="73" r="6"/><path stroke="#9ac7f4" d="m274 90 10 10m0-10-10 10"/><rect stroke="#e3a8d5" x="253" y="68" width="10" height="10"/></g>
  </svg>`;
}
export function playGuide(role) {
  return (role === 'cpu' ? '' : padAction('left', role === 'parent' ? '位置を選択' : '移動')) +
    (role === 'parent' ? padAction('right', '壁の向き') + padAction('circle', '向きを回転') + padAction('cross', '壁を設置') : '');
}
