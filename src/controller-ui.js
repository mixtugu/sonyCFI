import { padAction } from './controller-guide.js';

const visible = element => !element.disabled && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
const controls = scope => [...scope.querySelectorAll('button, a[href], input:not([readonly]), select, summary')].filter(visible);

// Modal-scoped navigation. Up/down selects controls; left/right edits numeric fields.
// Room codes use a local hex keypad, so joining never requires a hardware keyboard.
export function createControllerUI() {
  const hint = document.createElement('div'); hint.className = 'controller-guide'; hint.hidden = true;
  const keyboard = document.createElement('dialog'); keyboard.id = 'controller-keyboard';
  keyboard.innerHTML = `<h2>部屋コードを入力</h2><output aria-live="polite"></output><div class="controller-keypad">${'0123456789ABCDEF'.split('').map(c => `<button type="button" class="secondary" data-character="${c}">${c}</button>`).join('')}</div><div class="dialog-actions"><button type="button" data-edit="delete" class="secondary">1文字消す</button><button type="button" data-edit="clear" class="secondary">クリア</button><button type="button" data-edit="cancel" class="secondary">戻る</button><button type="button" data-edit="done" class="primary">入力完了</button></div><p>方向キーで選択 · × 入力 · □ 1文字消す · OPTIONS 完了 · ○ 戻る</p>`;
  document.querySelector('#app').append(keyboard);
  let target = null, draft = '', marked = null, hintHTML = '';
  function mark(element) {
    marked?.classList.remove('controller-focus'); marked = element;
    element?.classList.add('controller-focus');
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function showDraft() { keyboard.querySelector('output').textContent = draft.padEnd(6, '–'); }
  function finish(commit) {
    if (commit && target) { target.value = draft; target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('change', { bubbles: true })); }
    keyboard.close(); mark(target); target = null;
  }
  keyboard.addEventListener('cancel', e => { e.preventDefault(); finish(false); });
  keyboard.onclick = event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.character && draft.length < 6) draft += button.dataset.character;
    if (button.dataset.edit === 'delete') draft = draft.slice(0, -1);
    if (button.dataset.edit === 'clear') draft = '';
    if (button.dataset.edit === 'done') finish(true);
    if (button.dataset.edit === 'cancel') finish(false);
    showDraft();
  };
  function openKeyboard(input) { target = input; draft = input.value.toUpperCase(); showDraft(); keyboard.showModal(); mark(keyboard.querySelector('button')); }
  function navigate(scope, input) {
    const items = controls(scope); if (!items.length) return;
    let current = document.activeElement;
    if (!items.includes(current)) { mark(items[0]); current = items[0]; }
    else if (marked !== current && (input.step >= 0 || input.pressed.size)) mark(current);
    if (input.step >= 0) {
      const forward = input.step === 0 || input.step === 1;
      if ((input.step === 0 || input.step === 2) && current.matches('input[type=number], input[type=range]')) {
        if (forward) current.stepUp(); else current.stepDown();
        current.dispatchEvent(new Event('input', { bubbles: true })); current.dispatchEvent(new Event('change', { bubbles: true })); mark(current);
      } else {
        const offset = scope === keyboard && current.hasAttribute('data-character') && (input.step === 1 || input.step === 3) ? 4 : 1;
        mark(items[(items.indexOf(current) + (forward ? offset : -offset) + items.length) % items.length]);
      }
    }
    if (input.pressed.has('cross')) {
      current = document.activeElement;
      if (current.matches('input[name=code]')) openKeyboard(current);
      else if (current.tagName === 'SELECT') { current.selectedIndex = (current.selectedIndex + 1) % current.options.length; current.dispatchEvent(new Event('change', { bubbles: true })); }
      else current.click();
    }
  }
  return {
    navigate,
    hint(scope, html, connected) {
      hint.hidden = !connected;
      if (!connected) { marked?.classList.remove('controller-focus'); return; }
      if (hint.parentElement !== scope) scope.append(hint);
      // SVG serialization changes self-closing tags; compare source strings to avoid repainting every frame.
      if (hintHTML !== html) { hint.innerHTML = html; hintHTML = html; }
    },
    get editing() { return keyboard.open; },
    keyboard(input) {
      if (input.pressed.has('circle')) { finish(false); return; }
      if (input.pressed.has('options')) { finish(true); return; }
      if (input.pressed.has('square')) { draft = draft.slice(0, -1); showDraft(); }
      navigate(keyboard, input);
    },
    get menuHint() { return padAction('dpad', '項目を選択') + padAction('left', '項目を選択') + padAction('cross', '決定') + padAction('circle', '戻る'); },
  };
}
