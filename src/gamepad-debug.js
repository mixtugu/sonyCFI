import { heldButtons } from './gamepad.js';
import { accessConnected, accessState, accessSupported } from './access-controller.js';

// Opened with ?pad in the address: shows exactly what the browser reports for each controller, and
// which game buttons that turns into, so a controller's layout can be checked without dev tools.
export function showGamepadDebug() {
  const panel = document.createElement('pre');
  panel.className = 'gamepad-debug'; panel.setAttribute('aria-hidden', 'true');
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;margin:0;max-width:min(560px,calc(100vw - 16px));max-height:45vh;overflow:auto;padding:10px 12px;border-radius:10px;background:#000c;color:#d6ffe9;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;pointer-events:none';
  document.body.append(panel);
  let shown = '';
  (function frame() {
    const pads = [...(navigator.getGamepads?.() ?? [])].filter(pad => pad?.connected);
    let text = pads.length ? pads.map(pad => [
      `#${pad.index} ${pad.id}`,
      `mapping: ${pad.mapping || '(なし・非標準)'}  buttons: ${pad.buttons.length}  axes: ${pad.axes.length}`,
      `押下中のボタン番号: ${pad.buttons.map((b, i) => b.pressed ? i : null).filter(i => i !== null).join(', ') || '—'}`,
      `axes: ${pad.axes.map((v, i) => `${i}:${v.toFixed(2)}`).join('  ')}`,
      `ゲームの認識: ${[...heldButtons(pad)].join(', ') || '—'}`,
    ].join('\n')).join('\n\n') : 'コントローラー未検出（ボタンを1回押してください）';
    const state = accessState();
    const hid = !accessSupported() ? 'WebHID: このブラウザは非対応（Chrome / Edge が必要）' : !accessConnected() ? 'WebHID: Access コントローラー未接続' : `WebHID Access: 物理ボタン ${state ? [...state.buttons].join(', ') || '—' : '（入力待ち）'}  スティック ${state ? state.stick.map(v => v.toFixed(2)).join(', ') : '—'}`;
    text = `${hid}\n\n${text}`;
    if (text !== shown) { panel.textContent = text; shown = text; }
    requestAnimationFrame(frame);
  })();
}
