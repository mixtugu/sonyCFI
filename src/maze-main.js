import './maze.css';
import './ocean-game.css';
import oceanTitle from './assets/you-see-i-see.png';
import wallIcon from './assets/wall-stock.svg';
import './controller.css';
import './encyclopedia.css';
import { controllerDiagram, padAction, playGuide } from './controller-guide.js';
import { createControllerUI } from './controller-ui.js';
import { DEFAULTS, LIMITS, createMaze, start, tick, move, placeWall, neighbor } from './maze.js';
import { drawFishIcon, drawMaze, pointerCell, setTextScale, setWallStyle, WALL_STYLES } from './maze-renderer.js';
import { connectMaze } from './maze-network.js';
import { connectSoloMaze } from './maze-solo.js';
import { createPadReader, firstPad, rumble } from './gamepad.js';
import { accessConnected, accessSupported, onAccessChange, reconnectAccess, requestAccess } from './access-controller.js';
import { createTutorial } from './tutorial.js';
import { createResultScene } from './result-scene.js';
import { CREATURES, HP_MAX } from './creatures.js';
import { creatureArt } from './creature-art.js';
import { contactCard, explorerPanel, hearts, navigatorPanel, wallStock, zukan } from './encyclopedia-ui.js';

const fields = [['cols', '横のマス数'], ['rows', '縦のマス数'], ['duration', '制限時間（秒）'], ['wallLimit', '壁の枚数'], ['moveMs', '移動間隔（ms）']];
const input = (key, label) => `<input type="number" name="${key}" aria-label="${label}" min="${LIMITS[key][0]}" max="${LIMITS[key][1]}" step="${key === 'moveMs' ? 50 : 1}" value="${DEFAULTS[key]}" required>`;
// Decorative particles for the in-game dialogs, laid out deterministically and animated by CSS.
const seeded = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const particles = (className, n, style, rise) => `<div class="${className}" aria-hidden="true"${rise ? ` style="--rise:${rise}px"` : ''}>${Array.from({ length: n }, (_, i) => `<i style="${style(i)}"></i>`).join('')}</div>`;
const bubbles = (n, rise = 560) => particles('fx-bubbles', n, i => `--x:${(2 + seeded(i, 1) * 96).toFixed(1)}%;--s:${(4 + seeded(i, 2) * 9).toFixed(1)}px;--d:${(5 + seeded(i, 3) * 6).toFixed(2)}s;--delay:${(-seeded(i, 4) * 10).toFixed(2)}s`, rise);
function paintZukanSizeIcons(root) {
  for (const canvas of root.querySelectorAll('.zukan-size-icon')) {
    const context = canvas.getContext('2d');
    context.scale(2, 2);
    drawFishIcon(context, 24, 16, canvas.dataset.size, 1);
  }
}
const sparkles = n => particles('fx-sparkles', n, i => `--x:${(seeded(i, 5) * 100).toFixed(1)}%;--y:${(40 + seeded(i, 6) * 38).toFixed(1)}%;--s:${(8 + seeded(i, 7) * 14).toFixed(0)}px;--d:${(1.8 + seeded(i, 8) * 2.2).toFixed(2)}s;--delay:${(.8 + seeded(i, 9) * 2.5).toFixed(2)}s`);
const drops = n => particles('fx-drops', n, i => { const a = -Math.PI * (.12 + .76 * seeded(i, 10)), r = 110 + seeded(i, 11) * 250; return `--dx:${(Math.cos(a) * r * 1.5).toFixed(0)}px;--dy:${(Math.sin(a) * r).toFixed(0)}px;--s:${(4 + seeded(i, 12) * 7).toFixed(1)}px;--delay:${(.05 + seeded(i, 13) * .35).toFixed(2)}s`; });
const waterLight = '<div class="fx-caustics" aria-hidden="true"></div><div class="fx-rays" aria-hidden="true"></div>';
// /test retains the sandbox; /test/1 and /test/2 preview a real match from either starting seat.
const route = location.pathname.replace(/\/+$/, '');
// ?pad shows the raw controller readout (see gamepad-debug.js).
if (new URLSearchParams(location.search).has('pad')) import('./gamepad-debug.js').then(m => m.showGamepadDebug());
const sandboxMode = route === '/test';
document.body.classList.toggle('sandbox-mode', sandboxMode);
const testRole = route === '/test/1' ? 'parent' : route === '/test/2' ? 'child' : null;
const testMode = sandboxMode || !!testRole;
const sandboxHome = sandboxMode ? '<div id="net-room"><a href="/" class="secondary home-icon-button" aria-label="Homeに戻る" title="Homeに戻る"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/></svg><span>Homeに戻る</span></a></div>' : '';
document.querySelector('#app').innerHTML = `
<header class="top"><nav><span id="pad-status" class="pad-status" hidden>🎮 コントローラー</span></nav></header>
<section id="lobby" class="lobby"${testMode ? ' hidden' : ''}>
<div class="ocean-story"><h1 class="ocean-wordmark"><img src="${oceanTitle}" alt="YOU SEE / I SEE"></h1></div><div class="lobby-panels"><div class="lobby-card">
<h1>2人で遊ぶ</h1>
<div id="net-lobby-mount"></div>
<p class="lobby-note lobby-role-note">作った人：ナビゲーター　　参加する人：エクスプローラー</p>
</div><section class="lobby-card lobby-solo" aria-label="1人で遊ぶ"><h1>1人で遊ぶ</h1><div class="lobby-solo-actions"><a class="primary" href="/test/1">ナビゲーターではじめる</a><a class="primary" href="/test/2">エクスプローラーではじめる</a><a class="secondary" href="/test">自由テスト</a></div></section>
<div class="lobby-card lobby-access"><button type="button" class="text-button access-connect" hidden>🎮 Access コントローラーを接続（USB）</button></div></div></section>
<main class="workspace"${testMode ? '' : ' hidden'}>
<section class="toolbar" aria-label="ゲーム操作"><div class="mode-group" aria-label="プレイモード"><button data-mode="parent" class="selected" aria-pressed="true">ナビゲーター</button><button data-mode="child" aria-pressed="false">エクスプローラー</button><button data-mode="cpu" aria-pressed="false">CPU</button></div><span id="room-chip" class="room-chip" hidden><b id="room-chip-code"></b><i id="room-chip-partner"></i></span><div class="status"><i id="phase-dot"></i><b id="phase">開始前</b><div class="oxygen" id="oxygen" role="meter" aria-label="残りの酸素" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span class="oxygen-bubbles" aria-hidden="true"><i></i><i></i><i></i></span><span class="oxygen-valve" aria-hidden="true"><i class="oxygen-knob"></i><i class="oxygen-neck"></i></span><span class="oxygen-body"><span class="oxygen-track"><span class="oxygen-fill" id="oxygen-fill"></span><span class="oxygen-ticks" aria-hidden="true"></span></span><span class="oxygen-band" aria-hidden="true"></span><span class="oxygen-band" aria-hidden="true"></span><strong id="timer">00:30</strong><span class="oxygen-label" aria-hidden="true">O₂</span></span></div></div><div class="run-controls"><button id="reset" class="secondary" aria-label="リセット">↺</button><button id="start" class="primary">スタート</button><button id="settings-open" class="secondary" aria-label="設定と部屋コード" title="設定と部屋コード (□)">⚙</button><button id="fullscreen" class="secondary" aria-label="全画面" aria-pressed="false" title="全画面 (F)">⛶</button></div></section>
<p id="mode-description" class="hint"></p>
<div class="boards">
${['parent', 'child'].map(role => `<section class="board-card ${role}"><div class="board-heading"><h2>${role === 'parent' ? 'ナビゲーター' : 'エクスプローラー'}${sandboxMode ? '側の視点' : ''} <span class="role-badge" id="badge-${role}"></span></h2><span class="score"><small>${role === 'parent' ? '壁' : '出会い'}</small><strong id="detail-${role}">0 / ${role === 'parent' ? DEFAULTS.wallLimit : CREATURES.length}</strong></span></div><div class="board-body"><div class="board-surface"><canvas id="board-${role}" tabindex="0" aria-label="${role === 'parent' ? 'ナビゲーターの迷路。マスの端をクリックして壁を設置' : 'エクスプローラーの迷路。矢印キーで移動'}"></canvas></div><aside class="board-side ${role}-side" aria-label="${role === 'parent' ? 'エクスプローラーの様子' : '図鑑'}">${role === 'parent' ? navigatorPanel() : explorerPanel()}</aside></div></section>`).join('')}
</div>
<div class="interaction-panel"><div class="touch-controls"><div class="dpad"><button data-dir="3" aria-label="上">↑</button><button data-dir="2" aria-label="左">←</button><button data-dir="1" aria-label="下">↓</button><button data-dir="0" aria-label="右">→</button></div><button id="rotate" class="secondary">↻ <span id="direction">右</span></button><button id="place" class="primary">壁を置く</button></div><p id="control-hint" class="hint"></p></div>
</main>
<dialog id="settings-dialog" class="settings-dialog"><div class="dialog-head"><h2>設定</h2><button id="settings-close" class="text-button" aria-label="閉じる">✕</button></div><button type="button" class="secondary access-connect" hidden>🎮 Access コントローラーを接続（USB）</button><div id="net-room-mount">${sandboxHome}</div><div class="wall-style" role="radiogroup" aria-label="壁のデザイン"><span>壁のデザイン</span><label><input type="radio" name="wall-style" value="ridge">岩の壁</label><label><input type="radio" name="wall-style" value="reef">サンゴと岩</label><small>この画面だけに反映されます</small></div><form id="settings"><div class="fields">${fields.map(([key, label]) => `<label class="field">${label}${input(key, label)}</label>`).join('')}</div><div class="form-actions"><button type="button" id="defaults" class="text-button">初期値</button><button class="primary" type="submit">適用</button></div></form></dialog>
<div id="notice" role="status"></div>
<dialog id="solo-start" aria-label="冒険を始める"><button id="solo-start-button" class="primary">冒険を始める</button></dialog>
<dialog id="result">${waterLight}<div class="return-art" aria-hidden="true"><canvas id="result-scene"></canvas></div><h2 id="result-title">～ 冒険が終わりました ～</h2><p class="result-count"><span id="result-count-label">出会った生き物</span><strong id="result-count"></strong></p><div class="zukan result-zukan" id="result-zukan" role="list" aria-label="図鑑"></div><p id="final-stats"></p><div class="dialog-actions"><button id="close-result" class="primary">次へ</button></div></dialog>
<dialog id="ready" class="ready-dialog">${waterLight}${bubbles(12)}<p class="eyebrow" id="ready-eyebrow"></p><h2 id="ready-title"></h2><p id="ready-note"></p><div id="ready-tutorial" class="tutorial"></div><button type="button" id="ready-review" class="secondary wide">チュートリアルを確認</button><button type="button" id="ready-start" class="primary wide">準備完了</button><p class="ready-foot"><button type="button" id="ready-settings" class="text-button">⚙ 設定</button></p></dialog>
<dialog id="countdown" class="countdown-dialog" aria-label="開始カウントダウン">${bubbles(14, 720)}<h2>まもなく探検が始まります</h2><div class="countdown-core"><span class="countdown-rings" aria-hidden="true"><i></i><i></i><i></i></span><strong id="countdown-number" aria-live="assertive" aria-atomic="true">3</strong></div><div class="depth-gauge" aria-hidden="true"><span>水面</span><i><b></b></i><span>海の底</span></div><button id="countdown-pause" class="secondary">待機に戻る</button></dialog>
<dialog id="ending" class="ending-dialog"><div class="ending-flash" aria-hidden="true"></div>${drops(24)}${sparkles(18)}<p class="eyebrow">THANK YOU FOR DIVING</p><h2>この海で様々な<br><span class="ending-highlight">出会い</span> や <span class="ending-highlight">危険</span> がありました</h2><p id="ending-wait" class="ending-wait" hidden>相手が探検を終えるのを待っています…</p><button id="ending-finish" class="primary">はじめに戻る</button></dialog>
<dialog id="help">${waterLight}<h2>遊び方</h2><p>目標は、ふたりで海の生き物の図鑑を埋めること。迷路の魚のシルエットにエクスプローラーが触れると、正体の生き物が図鑑に登録されます。大きい魚ほどレアな生き物に出会えます。</p><p>ナビゲーターには、魚から現れる生き物の最大の危険度が「!」の数（! 低・!! 中・!!! 高）で見えます。実際の生き物はそれ以下の危険度で、触れるとエクスプローラーのHPがその危険度に応じて減ります。HPはナビゲーターにしか見えず、0にはなりません。大きい魚ほど危険なことが多いので、壁で道をふさぐかどうかはナビゲーター次第です。道がふさがると、エクスプローラーだけの秘密の通路が開きます。</p><p id="keyboard-help">矢印キー/WASDで操作。ナビゲーターはTabで向き、Spaceで設置。Escで一時停止。Fで全画面。</p><div class="pad-help" hidden><b>PlayStation コントローラー</b>${controllerDiagram()}<p>左スティックで移動、上下左右の方向キーで壁の向き、×で決定・壁の設置。</p><p>ナビゲーター：位置を選んで壁を設置</p><div class="controller-actions">${playGuide('parent')}</div><p>エクスプローラー：移動してアイテムを探す</p><div class="controller-actions">${playGuide('child')}</div><p>共通の操作</p><div class="controller-actions">${padAction('prev', '長押しで一時停止')}</div><p>メニュー：左スティックで項目を選択、×で決定、← 長押しで戻る。設定の数値はスティックの左右で変更。設定と遊び方は一時停止中の画面から開けます。</p><p>チュートリアル：練習はふだんと同じ操作。→ 長押しで次へ・確認、← 長押しで戻る。</p>${sandboxMode ? '<p>テストモード：L1 / R1で役割切替、CREATEでリセット。</p>' : ''}</div><button id="help-close" class="primary">OK</button></dialog>
<div id="room-code" class="room-code" popover="manual" role="status" aria-label="部屋コード" hidden></div>`;

const $ = id => document.getElementById(id);
// Open long help content at its heading, including after a network pause reorders dialogs.
// The Access controller is read over WebHID; the browser asks permission once, from a click or key.
function accessButtons() { document.querySelectorAll('.access-connect').forEach(button => { button.hidden = !accessSupported() || accessConnected(); }); }
document.querySelectorAll('.access-connect').forEach(button => button.onclick = async () => {
  notice(await requestAccess() ? 'Access コントローラーを接続しました。' : 'Access コントローラーに接続できませんでした。USB-Cで接続し、ほかのタブやアプリで開いていないか確認してください。');
});
onAccessChange(accessButtons); accessButtons();
// Connect by default: reuse a granted controller silently; otherwise the first click or key press of
// the session opens the browser's device chooser (it cannot open without such a gesture).
reconnectAccess().then(found => {
  if (found || !accessSupported()) return;
  let asked = false;
  try { asked = sessionStorage.getItem('access-asked') === '1'; } catch { /* storage unavailable */ }
  if (asked) return;
  const ask = event => {
    if (event.target.closest?.('.access-connect')) return;   // that button asks by itself
    window.removeEventListener('pointerdown', ask, true); window.removeEventListener('keydown', ask, true);
    try { sessionStorage.setItem('access-asked', '1'); } catch { /* storage unavailable */ }
    if (!accessConnected()) requestAccess().then(ok => { if (ok) notice('Access コントローラーを接続しました。'); });
  };
  window.addEventListener('pointerdown', ask, true); window.addEventListener('keydown', ask, true);
});
const helpHeading = $('help').querySelector('h2');
helpHeading.tabIndex = -1;
helpHeading.autofocus = true;
document.querySelector('.wall-style').insertAdjacentHTML('beforebegin', '<label class="maze-zoom-control"><span>迷路の表示倍率 <output id="maze-zoom-value">100%</output></span><input id="maze-zoom" type="range" min="1" max="1.8" step="0.1" value="1" aria-label="迷路の表示倍率"></label>');
document.querySelector('.wall-style').insertAdjacentHTML('beforebegin', '<fieldset class="font-size-control"><legend>文字サイズ</legend><div class="font-size-options" role="group" aria-label="文字サイズ"><button type="button" data-text-scale="1" aria-pressed="true">標準</button><button type="button" data-text-scale="1.5" aria-pressed="false">1.5倍</button><button type="button" data-text-scale="2" aria-pressed="false">2倍</button></div></fieldset>');
let game = createMaze(), cursor = game.avatar, direction = 0, seed = 260830, keys = new Set(), last = 0, uiClock = 0, resultShown = false, lastPhase = null, sentOxygen = -1, diveTimer = 0;
const resultScene = createResultScene($('result-scene'));
const controllerUI = createControllerUI();
let padSeen = false, shownEditable = null, stateDirty = false;
let entryStarted = false;
// Presentation dialogs rise in once per real opening; fullscreen re-insertion must not replay it.
function reveal(dialog) { dialog.classList.add('entering'); dialog.showModal(); }
document.querySelectorAll('dialog').forEach(d => d.addEventListener('animationend', e => { if (e.target === d && e.animationName.startsWith('dialog-')) d.classList.remove('entering'); }));
// update() runs every 80 ms; writing only what changed keeps it from invalidating layout each time.
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
const setHTML = (el, html) => { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };
const setAttr = (el, name, value) => { value = String(value); if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
const restart = (el, name) => { el.classList.remove(name); void el.offsetWidth; el.classList.add(name); };
function countdownTick() { restart($('countdown'), 'tick'); window.dispatchEvent(new CustomEvent('ocean-pulse')); }
function diveIn() { const boards = document.querySelector('.boards'); restart(boards, 'is-diving'); clearTimeout(diveTimer); diveTimer = setTimeout(() => boards.classList.remove('is-diving'), 1500); }
const keyDirection = { ArrowRight: 0, d: 0, ArrowDown: 1, s: 1, ArrowLeft: 2, a: 2, ArrowUp: 3, w: 3 };
const descriptions = { parent: '壁を置いてエクスプローラーCPUを守ろう', child: '魚に触れて図鑑を埋めよう', cpu: 'CPU同士を観察' };
// While the ending plays the camera stays above the surface, even if the next game has already arrived.
function oceanPhase() { return $('solo-start').open ? 'entry' : $('ending').open ? 'ending' : !$('lobby').hidden ? 'lobby' : game.phase === 'result' && network.active ? 'summary' : game.phase; }
function showLobby(on) { if ($('ending').open && !on) return; $('lobby').hidden = !on; document.querySelector('.workspace').hidden = on; window.dispatchEvent(new CustomEvent('ocean-phase', { detail: oceanPhase() })); }
const network = sandboxMode ? { active: false, connected: false, state: null, send() {} } : (testRole ? connectSoloMaze : connectMaze)({ role: testRole, settings: () => Object.fromEntries(new FormData($('settings'))), notice,
  onLeave: () => { if (testRole) { location.assign('/'); return; } entryStarted = false; $('solo-start').close(); tutorial.stop(); $('ready').close(); $('help').close(); $('ending').close(); $('countdown').close(); $('settings-dialog').close(); setImmersive(false); document.querySelector('.boards').classList.remove('network-boards'); document.querySelectorAll('.board-card').forEach(b => b.hidden = false); reset(); showLobby(true); },
  onState: packet => {
    showLobby(false);
    const changed = network.stateRound !== packet.round || network.stateCode !== packet.code;
    network.stateRound = packet.round; network.stateCode = packet.code;
    game = { ...packet.game, mode: packet.role, base: new Set(packet.game.base), walls: new Set(packet.game.walls), secrets: new Set(packet.game.secrets) };
    if (changed) { tutorial.stop(); $('ready').close(); $('countdown').close(); cursor = game.avatar; resultShown = false; keys.clear(); $('result').close(); for (const [key, value] of Object.entries(game.settings)) $('settings').elements[key].value = value; }
    if (game.phase !== 'playing') keys.clear();
    document.querySelector('.boards').classList.add('network-boards');
    document.querySelectorAll('.board-card').forEach(b => b.hidden = !b.classList.contains(packet.role));
    // Packets can arrive several times a frame; the frame loop applies the newest one once (and draws).
    stateDirty = true;
    // The partner has ended too, so the ending scene that was waiting moves on to the new game.
    if (endingWaiting && (game.phase !== 'result' || !packet.partner.connected)) finishEnding();
  }
});
function notice(message) { $('notice').textContent = message; $('notice').classList.add('show'); clearTimeout(notice.timer); notice.timer = setTimeout(() => $('notice').classList.remove('show'), 2600); }
const tutorial = createTutorial($('ready-tutorial'), { onStep: () => update(), onFinish: () => { if (!tutorial.last) return; tutorial.stop(); network.send({ type: 'tutorial' }); update(); }, onClose: () => update() });
function readyPrompt() {
  if ($('ending').open) return;   // the next game's briefing waits for the ending scene
  if (!entryStarted && game.phase === 'ready' && !network.state.tutorialComplete) {
    if (!$('solo-start').open) {
      reveal($('solo-start'));
      window.dispatchEvent(new CustomEvent('ocean-phase', { detail: oceanPhase() }));
    }
    return;
  }
  const waiting = ['ready', 'paused'].includes(game.phase) && !$('result').open;
  if (!waiting) { if ($('ready').open) { $('ready').close(); tutorial.stop(); } return; }
  const { partner, ready, match, tutorialComplete } = network.state, paused = game.phase === 'paused';
  const startWasUsable = $('ready').open && !$('ready-start').hidden && !$('ready-start').disabled;
  const partnerLine = testRole ? '相手はCPU · 準備完了' : partner.connected ? partner.ready ? '相手は準備完了' : partner.tutorialComplete ? '相手は準備中' : '相手はチュートリアルを確認中' : '相手を待っています';
  $('ready-eyebrow').textContent = `${paused ? 'ひと休み中' : '探検の準備'} · ${partnerLine}`;
  $('ready-title').innerHTML = `<span class="ready-role-intro"> あなたは…</span><strong class="ready-role-name">${game.mode === 'parent' ? 'ナビゲーター' : 'エクスプローラー'}</strong>`;
  $('ready-note').textContent = !paused && tutorialComplete ? '「もう一度見る」　…　もう一度操作方法を確認できます。\n「準備完了」　…　3秒のカウントダウン後にゲームが開始します。' : testRole ? (paused ? '準備完了で3秒後に再開します。' : 'チュートリアルを確認して準備完了を押すと\n3秒のカウンダウン後にゲームが開始します。') : network.state.reason || 'チュートリアルを確認して準備完了を押してください。二人の準備ができたら3秒後に始まります。';
  // Close the countdown first: its close restores focus, which would undo the focus set below.
  if ($('countdown').open) $('countdown').close();
  if (!$('ready').open) {
    const overlays = [$('settings-dialog'), $('help')].filter(dialog => dialog.open), focused = document.activeElement;
    reveal($('ready')); if (paused || tutorialComplete) tutorial.stop(); else tutorial.start(game.mode, game.settings); setImmersive(true);
    // A server pause can arrive after settings/help opened; keep that active modal above ready.
    for (const dialog of overlays) { dialog.close(); dialog.showModal(); }
    if (overlays.length) focused?.focus({ preventScroll: true });
  }
  // The briefing is the whole prompt until it is closed or finished; its last step confirms.
  const briefing = !paused && !ready && tutorial.running;
  $('ready').classList.toggle('briefing', briefing);
  $('ready').classList.toggle('tutorial-confirmed', !briefing && !paused && tutorialComplete);
  tutorial.setKicker(`${game.mode === 'parent' ? 'ナビゲーター' : 'エクスプローラー'} · ${$('ready-eyebrow').textContent}`);
  $('ready-eyebrow').hidden = $('ready-title').hidden = $('ready-note').hidden = $('ready-start').hidden = briefing;
  $('ready-eyebrow').hidden = true;
  $('ready-tutorial').hidden = !briefing;
  $('ready-settings').hidden = true;
  document.querySelector('.ready-foot').hidden = true;
  $('ready-review').hidden = briefing || paused || ready;
  $('ready-review').textContent = tutorialComplete ? 'もう一度見る' : 'チュートリアルを確認';
  $('ready-start').disabled = !network.connected || ready || !tutorialComplete;
  $('ready-start').textContent = ready ? '相手の準備を待っています' : paused ? '再開する' : !tutorialComplete ? 'チュートリアルを確認してください' : '準備完了';
  // Once the button becomes usable it takes focus, so a controller's × confirms without hunting for it.
  if (!startWasUsable && !$('ready-start').hidden && !$('ready-start').disabled && !$('settings-dialog').open && !$('help').open) $('ready-start').focus({ preventScroll: true });
}
// The room code sits small in the top-right corner. As a popover it stays above the modal
// dialogs, and is lifted again whenever the set of open dialogs changes.
function roomCode() {
  const element = $('room-code'), code = network.active && !testRole ? network.state?.code || '' : '';
  if (element.textContent !== code) element.textContent = code;
  if (!element.showPopover) { element.hidden = !code; return; }
  element.hidden = false;
  const open = element.matches(':popover-open'), above = [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id).join();
  if (!code) { if (open) element.hidePopover(); return; }
  if (open && element.dataset.above === above) return;
  if (open) element.hidePopover();
  element.showPopover(); element.dataset.above = above;
}
function reset(settings = game.settings, nextSeed = seed) { const mode = game.mode; game = createMaze(settings, nextSeed); game.mode = mode; seed = nextSeed; cursor = game.avatar; keys.clear(); resultShown = false; $('result').close(); update(); render(); }
function setMode(mode) { if (network.active) return; game.mode = mode; keys.clear(); update(); }
// A finished round is followed by the same maze with the roles exchanged, so both sides play it.
function toggle() { if (network.active) { if (['ready', 'paused'].includes(game.phase) && !network.state.tutorialComplete) return; network.send({ type: ['playing', 'countdown'].includes(game.phase) ? 'pause' : game.phase === 'result' ? 'again' : 'ready' }); return; } if (game.phase === 'result') { endGame(); return; } if (game.phase === 'playing') { game.phase = 'paused'; keys.clear(); } else start(game); update(); }
function control(dir) { if (game.mode === 'parent') { const n = neighbor(game, cursor, dir); if (n >= 0) cursor = n; } else if (game.mode === 'child') { if (network.active) network.send({ type: 'move', direction: dir }); else move(game, dir); } }
function wall() { if (game.mode !== 'parent') return; if (network.active) { network.send({ type: 'wall', cell: cursor, direction }); return; } if (!placeWall(game, cursor, direction)) notice(game.phase !== 'playing' ? '探検を始めてから壁を置いてください。' : game.walls.size >= game.settings.wallLimit ? '設置できる壁をすべて使いました。' : 'すでに壁があります。空いている通路を選んでください。'); update(); }
function rotate() { direction = (direction + 1) % 4; update(); }
$('start').onclick = toggle; $('reset').onclick = () => { if (!network.active) reset(); }; $('close-result').onclick = () => endGame();
// Leave the ending only after confirmation; a room also waits for the partner.
let endingWaiting = false;
function endGame() {
  const found = collection();
  let sea = $('ending-creatures');
  if (!sea) {
    sea = document.createElement('div'); sea.id = 'ending-creatures';
    sea.setAttribute('role', 'list'); sea.setAttribute('aria-label', 'この海の生き物');
    $('ending').append(sea);
  }
  sea.hidden = game.mode !== 'parent';
  sea.innerHTML = game.mode === 'parent' ? CREATURES.map((c, i) => {
    const width = { small: 54, medium: 76, large: 100 }[c.size];
    return `<div role="listitem" style="--fish-x:${15 + seeded(i, 10) * 60}%;--fish-y:${12 + seeded(i, 11) * 52}%;--fish-width:${width}px;--swim-time:${4 + seeded(i, 12) * 5}s;--swim-delay:${-seeded(i, 13) * 18}s;--bob-time:${1.8 + seeded(i, 14) * 2}s;--facing:${i % 2 ? -1 : 1}">${creatureArt(c.id, { hidden: !found.has(c.id), label: found.has(c.id) ? c.name : '未発見の生き物' })}</div>`;
  }).join('') : '';
  $('result').close(); resultScene.stop?.();
  if (network.active && game.phase === 'result') network.send({ type: 'again' });
  document.querySelector('.workspace').hidden = true;
  window.dispatchEvent(new CustomEvent('ocean-phase', { detail: 'ending' }));
  endingWaiting = false; $('ending-wait').hidden = true; reveal($('ending'));
}
function finishEnding() {
  if (network.active && game.phase === 'result') {
    // A partner who has gone cannot start the next game; return to the lobby instead.
    if (!network.state.partner.connected) { $('ending').close(); network.send({ type: 'leave' }); return; }
    endingWaiting = true; $('ending-wait').hidden = false; return;
  }
  entryStarted = false;
  tutorial.stop();
  $('ready').close();
  endingWaiting = false; $('ending').close();
  document.querySelector('.workspace').hidden = false;
  if (!network.active) reset();
  window.dispatchEvent(new CustomEvent('ocean-phase', { detail: oceanPhase() }));
  update();
}
$('ending-finish').onclick = finishEnding;
$('ending').addEventListener('cancel', event => { event.preventDefault(); finishEnding(); });
$('result').addEventListener('cancel', event => { if (network.active) { event.preventDefault(); $('close-result').click(); } });
$('countdown').addEventListener('cancel', event => { event.preventDefault(); suspend(); });
$('solo-start').addEventListener('cancel', event => event.preventDefault());
$('solo-start-button').onclick = () => {
  entryStarted = true;
  $('solo-start').close();
  window.dispatchEvent(new CustomEvent('ocean-phase', { detail: oceanPhase() }));
  update();
};
$('countdown-pause').onclick = () => suspend();
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
document.querySelectorAll('[data-dir]').forEach(b => b.onclick = () => control(+b.dataset.dir));
// Immersive mode keeps only the boards, timer and start button. The class works on its own
// (e.g. iPhone Safari has no element fullscreen); the Fullscreen API is used where available.
function setImmersive(on) {
  document.body.classList.toggle('immersive', on); $('fullscreen').setAttribute('aria-pressed', on); $('fullscreen').textContent = on ? '✕' : '⛶';
  $('fullscreen').setAttribute('aria-label', on ? '全画面を終了' : '全画面');
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
const toggleImmersive = () => setImmersive(!document.body.classList.contains('immersive'));
$('fullscreen').onclick = toggleImmersive;
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) { if (document.body.classList.contains('immersive')) setImmersive(false); return; }
  // Fullscreen promotes the root above modals opened while its promise was pending.
  // Reinsert open dialogs into the top layer, keeping the focused (nested) dialog last.
  const focused = document.activeElement, topDialog = focused?.closest('dialog');
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  if (topDialog) dialogs.sort((a, b) => (a === topDialog ? 1 : 0) - (b === topDialog ? 1 : 0));
  for (const dialog of dialogs) { dialog.classList.remove('entering'); dialog.close(); dialog.showModal(); }
  if (focused?.isConnected) focused.focus({ preventScroll: true });
  $('room-code').dataset.above = ''; roomCode();
});
$('rotate').onclick = rotate; $('place').onclick = wall;
$('result').addEventListener('close', () => resultScene.stop());
$('help-close').onclick = () => $('help').close();
// The dialog sits in the top layer, so it stays reachable in fullscreen where the panels are hidden.
$('settings-open').onclick = () => { suspend(); $('settings-dialog').showModal(); };
// A popover keeps viewport positioning outside animated dialogs; parenting it
// to the active modal also keeps the button outside the modal's inert region.
const settingsDock = document.createElement('div');
settingsDock.id = 'settings-dock';
settingsDock.setAttribute('popover', 'manual');
settingsDock.append($('settings-open'));
const settingsModalStack = [...document.querySelectorAll('dialog[open]')];
const cornerLogo = document.createElement('div');
cornerLogo.id = 'corner-logo';
cornerLogo.setAttribute('popover', 'manual');
cornerLogo.innerHTML = `<img src="${oceanTitle}" alt="YOU SEE / I SEE">`;
function positionSettingsDock() {
  const parent = settingsModalStack.at(-1) || document.body;
  if (settingsDock.matches(':popover-open')) settingsDock.hidePopover();
  if (settingsDock.parentElement !== parent) parent.append(settingsDock);
  settingsDock.showPopover();
  if (cornerLogo.matches(':popover-open')) cornerLogo.hidePopover();
  if (cornerLogo.parentElement !== parent) parent.append(cornerLogo);
  syncCornerLogo();
}
function syncCornerLogo() {
  const visible = $('lobby').hidden && game.phase !== 'playing' && !($('ready').open && $('ready').classList.contains('briefing'));
  if (visible && !cornerLogo.matches(':popover-open')) cornerLogo.showPopover();
  else if (!visible && cornerLogo.matches(':popover-open')) cornerLogo.hidePopover();
}
const settingsDockObserver = new MutationObserver(records => {
  for (const { target } of records) {
    const index = settingsModalStack.indexOf(target);
    if (index !== -1) settingsModalStack.splice(index, 1);
    if (target.open) settingsModalStack.push(target);
  }
  positionSettingsDock();
});
for (const dialog of document.querySelectorAll('dialog')) {
  settingsDockObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
}
settingsDockObserver.observe($('lobby'), { attributes: true, attributeFilter: ['hidden'] });
positionSettingsDock();
// The ready prompt covers the board with a blurred backdrop, so the button is large and hard to miss.
$('ready').addEventListener('cancel', event => event.preventDefault());
$('ready-start').onclick = toggle;
$('ready-review').onclick = () => { tutorial.start(game.mode, game.settings); update(); };
$('ready-settings').onclick = () => $('settings-dialog').showModal();
// The wall design is a personal display preference, remembered in this browser only.
const mazeZoomSlider = $('maze-zoom'), mazeZoomValue = $('maze-zoom-value'), mazeZoomKey = 'maze-display-zoom';
let savedMazeZoom = 1;
try { const value = Number(localStorage.getItem(mazeZoomKey)); if (Number.isFinite(value)) savedMazeZoom = value; } catch { /* storage unavailable */ }
function updateMazeZoom(value) {
  const zoom = Math.round(Math.min(1.8, Math.max(1, Number.isFinite(+value) ? +value : 1)) * 10) / 10;
  document.documentElement.style.setProperty('--maze-display-zoom', zoom);
  mazeZoomSlider.value = zoom; mazeZoomValue.textContent = `${Math.round(zoom * 100)}%`;
  document.querySelectorAll('.board-surface').forEach(surface => surface.classList.toggle('is-zoomed', zoom > 1));
  return zoom;
}
updateMazeZoom(savedMazeZoom);
mazeZoomSlider.oninput = () => { const zoom = updateMazeZoom(mazeZoomSlider.value); try { localStorage.setItem(mazeZoomKey, zoom); } catch { /* storage unavailable */ } };
const textScaleKey = 'app-text-scale';
let savedTextScale = 1;
try { const value = Number(localStorage.getItem(textScaleKey)); if ([1, 1.5, 2].includes(value)) savedTextScale = value; } catch { /* storage unavailable */ }
function updateTextScale(value) {
  const scale = [1, 1.5, 2].includes(Number(value)) ? Number(value) : 1;
  document.documentElement.classList.toggle('large-text', scale > 1);
  document.documentElement.style.setProperty('--text-scale', scale); setTextScale(scale);
  document.querySelectorAll('[data-text-scale]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.textScale) === scale));
  return scale;
}
updateTextScale(savedTextScale);
document.querySelectorAll('[data-text-scale]').forEach(button => button.onclick = () => {
  const scale = updateTextScale(button.dataset.textScale);
  try { localStorage.setItem(textScaleKey, scale); } catch { /* storage unavailable */ }
});
let savedWallStyle = 'ridge';
try { savedWallStyle = localStorage.getItem('maze-wall-style') || 'ridge'; } catch { /* storage unavailable */ }
if (!WALL_STYLES.includes(savedWallStyle)) savedWallStyle = 'ridge';
setWallStyle(savedWallStyle);
document.querySelector(`[name=wall-style][value=${savedWallStyle}]`).checked = true;
document.querySelectorAll('[name=wall-style]').forEach(radio => radio.onchange = () => {
  setWallStyle(radio.value);
  try { localStorage.setItem('maze-wall-style', radio.value); } catch { /* storage unavailable */ }
});
$('settings-close').onclick =() => { $('settings-dialog').close(); };
$('settings').onsubmit = event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); $('settings-dialog').close(); if (network.active) { network.send({ type: 'settings', settings: values }); return; } reset(values, seed + 1); if (!$('lobby').hidden) return; notice('新しい設定で迷路を作りました。'); };
$('defaults').onclick = () => { for (const [key, value] of Object.entries(DEFAULTS)) $('settings').elements[key].value = value; reset(DEFAULTS, 260830); notice('初期設定に戻しました。'); };
$('board-parent').onpointermove = event => { if (game.mode !== 'parent') return; const hit = pointerCell(event.currentTarget, game, event); if (hit) { cursor = hit.cell; direction = hit.direction; } };
$('board-parent').onclick = event => { if (game.mode !== 'parent') return; const hit = pointerCell(event.currentTarget, game, event); if (hit) { cursor = hit.cell; direction = hit.direction; event.currentTarget.focus(); wall(); } };
window.addEventListener('keydown', event => {
  if (event.target.matches('input, select, textarea') || $('help').open || $('result').open || $('settings-dialog').open || !$('lobby').hidden) return;
  if ($('countdown').open || $('ending').open) return;
  if ($('ready').open) { if (!$('ready-tutorial').hidden) tutorial.key(event); return; }
  const dir = keyDirection[event.key];
  if (dir !== undefined) { event.preventDefault(); keys.add(event.key); if (game.mode === 'parent') control(dir); }
  if (game.mode === 'parent' && (event.key === 'Tab' && event.target.tagName === 'CANVAS')) { event.preventDefault(); rotate(); }
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); if (!event.repeat) wall(); }
  if (event.key === 'Escape' && game.phase === 'playing') suspend();
  if (event.key === 'Escape' && document.body.classList.contains('immersive')) setImmersive(false);
  if ((event.key === 'f' || event.key === 'F') && !event.repeat && !event.metaKey && !event.ctrlKey) toggleImmersive();
});
window.addEventListener('keyup', event => keys.delete(event.key));
function suspend() { keys.clear(); if (['playing', 'countdown'].includes(game.phase)) { if (network.active) network.send({ type: 'pause' }); else game.phase = 'paused'; update(); } }
window.addEventListener('blur', suspend); document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
function update() {
  // Playing defaults to fullscreen; leaving 'playing' does not force it back off (the user may toggle it off mid-round).
  if (game.phase === 'playing' && lastPhase !== 'playing') { setImmersive(true); if (['ready', 'countdown'].includes(lastPhase)) diveIn(); }
  if (lastPhase !== game.phase) window.dispatchEvent(new CustomEvent('ocean-phase', { detail: oceanPhase() }));
  lastPhase = game.phase;
  document.querySelector('.mode-group').hidden = network.active; $('reset').hidden = network.active;
  const editable = !network.active || network.state?.host && game.phase === 'ready' && network.state.match.leg === 1;
  if (editable !== shownEditable) { shownEditable = editable; document.querySelectorAll('#settings input, #settings button').forEach(b => b.disabled = !editable); }
  $('defaults').hidden = network.active;
  $('room-chip').hidden = !network.active;
  roomCode();
  if (network.active) {
    // The room code itself lives in the top-right corner; the chip only names a test run.
    setText($('room-chip-code'), game.mode === 'parent' ? 'ナビゲーター' : 'エクスプローラー');
    setText($('room-chip-partner'), testRole ? '🤖' : '');
    $('room-chip-partner').hidden = !testRole;
    $('room-chip-partner').setAttribute('aria-label', '相手はCPU');
    $('room-chip-partner').title = testRole ? '相手はCPU' : '';
  }
  setText($('phase'), { ready: '開始前', countdown: 'まもなく開始', playing: '探検中', paused: 'ひと休み中', result: '探検完了' }[game.phase]);
  $('phase-dot').classList.toggle('live', game.phase === 'playing');
  const remaining = Math.ceil(game.settings.duration - game.time); setText($('timer'), `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`);
  $('timer').classList.toggle('urgent', remaining <= 5 && game.phase === 'playing');
  const oxygen = Math.max(0, Math.min(100, (game.settings.duration - game.time) / game.settings.duration * 100));
  if (Math.round(oxygen) !== sentOxygen) { sentOxygen = Math.round(oxygen); window.dispatchEvent(new CustomEvent('ocean-oxygen', { detail: oxygen / 100 })); }
  const fill = `${oxygen}%`; if ($('oxygen-fill').style.width !== fill) $('oxygen-fill').style.width = fill; setAttr($('oxygen'), 'aria-valuenow', Math.round(oxygen)); $('oxygen').classList.toggle('low', oxygen <= 25); $('oxygen').classList.toggle('critical', oxygen <= 10); $('oxygen').classList.toggle('flowing', game.phase === 'playing');
  let startText = { ready: 'スタート', countdown: '待機に戻る', playing: '一時停止', paused: '再開', result: 'もう一度' }[game.phase], modeText = descriptions[game.mode];
  $('start').disabled = network.active && ((['ready', 'paused'].includes(game.phase) && !network.state.tutorialComplete) || !network.connected || (!['playing', 'countdown'].includes(game.phase) && (network.state?.ready && game.phase !== 'result' || network.state?.again && game.phase === 'result')));
  if (network.active) {
    modeText = network.state.reason || '対戦中';
    if (['ready', 'paused'].includes(game.phase)) startText = network.state.ready ? '相手を待機中' : '準備完了';
    if (game.phase === 'result') startText = '終了する';
    readyPrompt();
    if (game.phase === 'countdown') {
      const number = String(network.state.countdown);
      const changed = $('countdown-number').textContent !== number;
      if (changed) $('countdown-number').textContent = number;
      if (!$('countdown').open) { $('settings-dialog').close(); reveal($('countdown')); countdownTick(); }
      else if (changed) countdownTick();
    } else if ($('countdown').open) $('countdown').close();
  } else { if ($('ready').open) { $('ready').close(); tutorial.stop(); } if (game.phase === 'result') startText = '終了する'; }
  setText($('start'), startText); setText($('mode-description'), modeText);
  for (const role of ['parent', 'child']) setText($('badge-' + role), game.mode === role ? 'あなた' : 'CPU');
  sidePanels();
  setText($('detail-parent'), `${game.walls.size} / ${game.settings.wallLimit}`); setText($('detail-child'), `${game.collected} / ${game.items.length}`);
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b.dataset.mode === game.mode); setAttr(b, 'aria-pressed', b.dataset.mode === game.mode); });
  $('rotate').hidden = $('place').hidden = game.mode !== 'parent';
  document.querySelector('.dpad').hidden = game.mode === 'cpu';
  setText($('direction'), ['右', '下', '左', '上'][direction]);
  setHTML($('control-hint'), padSeen ? playGuide(game.mode) : game.mode === 'parent' ? 'マスの端をクリック、またはSpaceで壁を設置' : game.mode === 'child' ? '矢印/WASDで移動 · 点線は秘密の通路' : '');
  if (game.phase === 'result' && !resultShown) {
    resultShown = true; keys.clear();
    // A game is one round; its result offers only the way out, to the ending and the next game.
    $('result-title').textContent = '～ 冒険が終わりました ～';
    const navigatorResult = game.mode === 'parent';
    $('result').classList.toggle('navigator-result', navigatorResult);
    const found = collection();
    $('result-count-label').textContent = 'この海で出会った生き物';
    $('result-count').textContent = `${found.size} / ${CREATURES.length} 種`;
    $('result-zukan').innerHTML = zukan(found);
    paintZukanSizeIcons($('result-zukan'));
    $('final-stats').hidden = !navigatorResult;
    $('final-stats').innerHTML = navigatorResult ? `<span>残ったHP💛 <strong>${game.hp}/${HP_MAX}</strong></span><span>置いた壁<img class="result-wall-icon" src="${wallIcon}" alt="壁"> <strong>${game.walls.size}/${game.settings.wallLimit}</strong></span>` : '';
    reveal($('result')); resultScene.play();
  }
  syncCornerLogo();
}
// The encyclopedia starts empty every round.
function collection() {
  return new Set(game.items.filter(item => item.taken && item.creature).map(item => item.creature));
}
// Side panels change only when something happens, so they are rebuilt on change, not per frame.
let shownHp = null, shownMet = null, shownFound = null, shownWalls = '';
function sidePanels() {
  const left = Math.max(0, game.settings.wallLimit - game.walls.size), wallKey = `${left}/${game.settings.wallLimit}`;
  if (wallKey !== shownWalls) { shownWalls = wallKey; $('wall-stock-icons').innerHTML = wallStock(left, game.settings.wallLimit); $('wall-stock-count').textContent = `${left} / ${game.settings.wallLimit} 枚`; }
  if (Number.isFinite(game.hp) && game.hp !== shownHp) {
    const hit = shownHp !== null && game.hp < shownHp && game.phase === 'playing';
    shownHp = game.hp; $('hp-hearts').innerHTML = hearts(game.hp); $('hp-hearts').setAttribute('aria-valuenow', game.hp);
    if (hit) restart(document.querySelector('.hp-panel'), 'is-hit');
  }
  const met = game.items.filter(item => item.taken && item.creature), metKey = met.map(item => item.cell).join();
  let fresh;
  if (metKey !== shownMet) {
    const before = new Set((shownMet || '').split(','));
    fresh = shownMet === null ? undefined : met.filter(item => !before.has(String(item.cell))).at(-1);
    shownMet = metKey;
    if (!met.length) $('contact-card').innerHTML = '<p class="contact-empty">エクスプローラーが魚に触れると、<br>出会った生き物がここに出ます。</p>';
    else if (fresh && 'damage' in fresh) $('contact-card').innerHTML = contactCard(fresh);
  }
  const found = collection(), foundKey = [...found].sort().join();
  if (foundKey !== shownFound) {
    shownFound = foundKey;
    $('zukan').innerHTML = zukan(found, fresh?.creature); paintZukanSizeIcons($('zukan')); $('zukan-count').textContent = `${found.size} / ${CREATURES.length} 種`;
  }
}
// Boards are not drawn while the game screen is hidden (lobby, ending); they resume on return.
const workspace = document.querySelector('.workspace');
function render() { if (workspace.hidden) return; for (const role of ['parent', 'child']) if (!network.active || game.mode === role) drawMaze($('board-' + role), game, role, cursor, direction); }
let networkClock = 0;
// Game time advances from wall-clock deltas; rAF only paces drawing. A watchdog keeps the round
// moving when the browser stops painting the tab without firing blur/visibilitychange.
function step(now) {
  // Apply the newest state before reading input, so a press always meets the screen it was made on.
  if (stateDirty) { stateDirty = false; update(); uiClock = 0; }
  const dt = last ? Math.max(0, Math.min((now - last) / 1000, 1)) : 0; last = now; const padDir = pollPad(now), key = [...keys].at(-1), held = key !== undefined ? keyDirection[key] : padDir >= 0 ? padDir : undefined;
  if (!network.active) { for (let left = dt; left > 0; left -= .1) tick(game, Math.min(left, .1), held === undefined ? -1 : held); }
  else { network.advance?.(dt); networkClock += dt; if (networkClock >= .06) { networkClock = 0; if (held !== undefined && game.mode === 'child' && game.phase === 'playing') network.send({ type: 'move', direction: held }); } }
  uiClock += dt; if (uiClock >= .08 || game.phase === 'result' && !resultShown) { update(); uiClock = 0; }
}
const readPad = createPadReader(); let feltWalls = 0, feltItems = 0, feltPhase = '', padScreen = '';
function controllerHints() {
  let scope = document.querySelector('.workspace'), hint = '';
  const menu = controllerUI.menuHint;
  // Only the sticks, × and ○ are ever offered; settings and help are reached through the menus.
  if (controllerUI.editing) { scope = $('controller-keyboard'); hint = padAction('left', '文字を選択') + padAction('cross', '入力') + padAction('prev', '長押しで戻る'); }
  else if ($('help').open) { scope = $('help'); hint = padAction('left', 'スクロール') + padAction('prev', '長押しで閉じる'); }
  else if ($('settings-dialog').open) { scope = $('settings-dialog'); hint = menu + padAction('left', '数値は左右で変更'); }
  else if ($('ending').open) { scope = $('ending'); hint = padAction('cross', 'はじめに戻る'); }
  else if ($('countdown').open) { scope = $('countdown'); hint = padAction('prev', '長押しで待機に戻る'); }
  else if ($('result').open) { scope = $('result'); hint = padAction('left', '項目を選択') + padAction('cross', '決定') + padAction('prev', network.active ? '長押しで終了' : '長押しで閉じる'); }
  else if ($('ready').open) {
    scope = $('ready');
    // During the briefing its footer already explains the horizontal direction holds.
    hint = !$('ready-tutorial').hidden ? '' : padAction('left', '項目を選択') + padAction('cross', '決定');
  } else if (!$('lobby').hidden) { scope = document.querySelector('.lobby-card'); hint = padAction('left', '項目を選択') + padAction('cross', '決定'); }
  else hint = playGuide(game.mode) + padAction('prev', game.phase === 'playing' ? '長押しで一時停止' : '長押しで開始') + (sandboxMode ? padAction('l1', '前の役割') + padAction('r1', '次の役割') + padAction('create', 'リセット') : '');
  controllerUI.hint(scope, hint, padSeen);
}
function pollPad(now) {
  const pad = firstPad(), input = readPad(pad, now);
  if (!!pad !== padSeen) {
    padSeen = !!pad; $('pad-status').hidden = !pad;
    document.body.classList.toggle('controller-connected', padSeen);
    $('keyboard-help').hidden = padSeen; document.querySelector('.pad-help').hidden = !padSeen;
    tutorial.setController(padSeen);
    $('board-parent').setAttribute('aria-label', padSeen ? 'ナビゲーターの迷路。左スティックで位置、上下左右の方向キーで向き、×で壁を設置' : 'ナビゲーターの迷路。マスの端をクリックして壁を設置');
    $('board-child').setAttribute('aria-label', padSeen ? 'エクスプローラーの迷路。左スティックで移動' : 'エクスプローラーの迷路。矢印キーで移動');
    if (pad) notice('コントローラーを接続しました。スティック・上下左右のボタン・× で操作できます。');
    else { suspend(); notice('コントローラーが切断されました。再接続するかキーボードで操作してください。'); }
    update();
  }
  controllerHints();
  if (!pad) return -1;
  // ○ or a hold of ← goes back in menus; tutorial navigation uses its own directional holds.
  const on = name => input.pressed.has(name) || (name === 'circle' && (input.long.has('circle') || input.long.has('left')));
  // A button still held from the previous screen (e.g. the button that opened this one) must not
  // land here as a tap or hold.
  const screen = [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id).join() + `|${$('lobby').hidden}|${tutorial.running && !$('ready-tutorial').hidden ? tutorial.step : '-'}|${game.phase}`;
  if (screen !== padScreen) { padScreen = screen; readPad.consume(); input.tapped.clear(); input.long.clear(); }
  if (controllerUI.editing) { controllerUI.keyboard(input); return -1; }
  if ($('solo-start').open && !$('settings-dialog').open) {
    if (on('cross')) $('solo-start-button').click();
    return -1;
  }
  if ($('help').open) {
    if (on('cross') || on('circle')) $('help-close').click();
    else if (input.step >= 0) $('help').scrollBy(0, input.step === 1 || input.step === 0 ? 100 : -100);
    return -1;
  }
  if ($('settings-dialog').open) {
    if (on('circle')) $('settings-close').click();
    else controllerUI.navigate($('settings-dialog'), input);
    return -1;
  }
  if ($('ending').open) { if (on('cross') || on('circle')) finishEnding(); return -1; }
  if ($('countdown').open) { if (on('circle') || on('cross')) suspend(); return -1; }
  if ($('result').open) {
    if (on('circle')) $('close-result').click(); else controllerUI.navigate($('result'), input);
    return -1;
  }
  if ($('ready').open) {
    if (!$('ready-tutorial').hidden) tutorial.pad(input);
    else controllerUI.navigate($('ready'), input);
    return -1;
  }
  if (!$('lobby').hidden) { controllerUI.navigate($('app'), input); return -1; }
  // Holding ○ starts or pauses; pausing opens the ready prompt, which leads on to settings and help.
  if (input.long.has('circle') || input.long.has('left')) { toggle(); return -1; }
  // The sandbox keeps its developer shortcuts for switching roles and resetting.
  if (sandboxMode) {
    if (on('options')) { toggle(); return -1; }
    if (on('square')) { $('settings-open').click(); return -1; }
    if (on('create')) reset();
    if (on('triangle')) { toggleImmersive(); return -1; }
    if (on('l1') || on('r1')) { const modes = ['parent', 'child', 'cpu']; setMode(modes[(modes.indexOf(game.mode) + (on('r1') ? 1 : 2)) % 3]); }
  }
  // A D-pad tap aims the wall; holding ← pauses instead (handled above).
  if (game.mode === 'parent') { if (input.step >= 0) control(input.step); if (input.aim >= 0) { direction = input.aim; update(); } if (on('cross')) wall(); }
  // Haptics follow the game state, so they also fire for moves the server applied.
  if (game.walls.size > feltWalls) rumble(pad, .2, .6, 60);
  if (game.collected > feltItems) rumble(pad, .8, .4, 140);
  if (game.phase === 'result' && feltPhase !== 'result') rumble(pad, 1, 1, 400);
  feltWalls = game.walls.size; feltItems = game.collected; feltPhase = game.phase;
  return game.mode === 'child' ? input.dir : -1;
}
let lastFrame = 0;
function frame(now) { lastFrame = performance.now(); step(now); render(); requestAnimationFrame(frame); }
setInterval(() => { const now = performance.now(); if (now - lastFrame > 150) { step(now); render(); } }, 100);
update(); render(); requestAnimationFrame(frame);
