import { CREATURES, HP_MAX, RISK_LABELS, SIZES, SIZE_LABELS, creature } from './creatures.js';
import { creatureArt } from './creature-art.js';

const stars = n => `<span class="stars" aria-label="レア度 ${n}">${'★'.repeat(n)}</span>`;
export const riskMarks = risk => `<b class="risk-marks risk-${risk}" aria-label="${RISK_LABELS[risk]}">${'!'.repeat(risk)}</b>`;
const damageText = damage => damage > 0 ? `HP −${damage}` : damage < 0 ? `HP +${-damage}` : 'HP ±0';

// The navigator's side panel: the explorer's HP, the creature just met, and the「!」legend.
export function navigatorPanel() {
  return `<div class="hp-panel"><span class="hp-label">HP</span><div class="hp-hearts" id="hp-hearts" role="meter" aria-label="エクスプローラーのHP" aria-valuemin="0" aria-valuemax="${HP_MAX}"></div></div>
<div class="contact-card" id="contact-card" aria-live="polite"><p class="contact-empty">エクスプローラーが魚に触れると、<br>出会った生き物がここに出ます。</p></div>
<ul class="risk-legend">${[3, 2, 1].map(r => `<li>${riskMarks(r)}<span>危険度 ${['', '小', '中', '大'][r]}</span></li>`).join('')}</ul>`;
}
export function hearts(hp) {
  return Array.from({ length: HP_MAX }, (_, i) => `<i class="heart${i < hp ? '' : ' is-lost'}" aria-hidden="true"></i>`).join('');
}
export function contactCard(item) {
  const c = creature(item.creature);
  return `<div class="contact-hit${item.damage > 0 ? ' is-hurt' : ''}">${creatureArt(c.id, { label: c.name })}<p class="contact-name">${c.name}${riskMarks(c.risk)}</p><p class="contact-damage">${damageText(item.damage)}</p></div>`;
}

// The explorer's encyclopedia: one row per size, undiscovered entries as silhouettes.
export function explorerPanel() {
  return `<div class="zukan-head"><b>図鑑</b><span id="zukan-count">0 / ${CREATURES.length}</span></div><div class="zukan" id="zukan"></div>`;
}
export function zukan(found, fresh = '', { risk = false } = {}) {
  return SIZES.map(size => `<div class="zukan-row"><span class="zukan-size">${SIZE_LABELS[size]}</span><div class="zukan-cells">${CREATURES.filter(c => c.size === size).map(c => {
    const seen = found.has(c.id);
    return `<div class="zukan-cell${seen ? ' is-found' : ''}${c.id === fresh ? ' is-new' : ''}" role="listitem">${creatureArt(c.id, { hidden: !seen, label: seen ? c.name : '未発見の生き物' })}<span class="zukan-name">${seen ? c.name : '？？？'}</span>${seen ? stars(c.stars) + (risk ? riskMarks(c.risk) : '') : ''}</div>`;
  }).join('')}</div></div>`).join('');
}
