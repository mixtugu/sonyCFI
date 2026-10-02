import './maze.css';
import './ocean-game.css';
import { DEFAULTS, LIMITS, createMaze, start, tick, move, placeWall, neighbor } from './maze.js';
import { drawMaze, pointerCell, setWallStyle, WALL_STYLES } from './maze-renderer.js';
import { connectMaze } from './maze-network.js';
import { createPadReader, firstPad, rumble } from './gamepad.js';
import { createTutorial } from './tutorial.js';
import { createResultScene } from './result-scene.js';

const fields = [['cols', '横のマス数'], ['rows', '縦のマス数'], ['duration', '制限時間（秒）'], ['wallLimit', '壁の枚数'], ['wallCost', '親の壁コスト'], ['moveMs', '移動間隔（ms）']];
const ranges = [['red', '高リスク', 'redMin', 'redMax'], ['yellow', '中リスク', 'yellowMin', 'yellowMax'], ['green', '低リスク', 'greenMin', 'greenMax'], ['gold', '子どもの報酬', 'rewardMin', 'rewardMax']];
const input = (key, label) => `<input type="number" name="${key}" aria-label="${label}" min="${LIMITS[key][0]}" max="${LIMITS[key][1]}" step="${key === 'moveMs' ? 50 : 1}" value="${DEFAULTS[key]}" required>`;
// Decorative particles for the in-game dialogs, laid out deterministically and animated by CSS.
const seeded = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const particles = (className, n, style, rise) => `<div class="${className}" aria-hidden="true"${rise ? ` style="--rise:${rise}px"` : ''}>${Array.from({ length: n }, (_, i) => `<i style="${style(i)}"></i>`).join('')}</div>`;
const bubbles = (n, rise = 560) => particles('fx-bubbles', n, i => `--x:${(2 + seeded(i, 1) * 96).toFixed(1)}%;--s:${(4 + seeded(i, 2) * 9).toFixed(1)}px;--d:${(5 + seeded(i, 3) * 6).toFixed(2)}s;--delay:${(-seeded(i, 4) * 10).toFixed(2)}s`, rise);
const sparkles = n => particles('fx-sparkles', n, i => `--x:${(seeded(i, 5) * 100).toFixed(1)}%;--y:${(40 + seeded(i, 6) * 38).toFixed(1)}%;--s:${(8 + seeded(i, 7) * 14).toFixed(0)}px;--d:${(1.8 + seeded(i, 8) * 2.2).toFixed(2)}s;--delay:${(.8 + seeded(i, 9) * 2.5).toFixed(2)}s`);
const drops = n => particles('fx-drops', n, i => { const a = -Math.PI * (.12 + .76 * seeded(i, 10)), r = 110 + seeded(i, 11) * 250; return `--dx:${(Math.cos(a) * r * 1.5).toFixed(0)}px;--dy:${(Math.sin(a) * r).toFixed(0)}px;--s:${(4 + seeded(i, 12) * 7).toFixed(1)}px;--delay:${(.05 + seeded(i, 13) * .35).toFixed(2)}s`; });
const waterLight = '<div class="fx-caustics" aria-hidden="true"></div><div class="fx-rays" aria-hidden="true"></div>';
// Playing with another person is the game; /test is the single-device mode with the CPU.
const testMode = location.pathname.replace(/\/+$/, '') === '/test';
document.querySelector('#app').innerHTML = `
<header class="top"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">〰</span>ふたりのあいだの海${testMode ? '<span class="test-badge">テスト</span>' : ''}</a><nav><span id="pad-status" class="pad-status" hidden>🎮 コントローラー</span><button id="help-open" class="text-button">遊び方</button></nav></header>
<section id="lobby" class="lobby"${testMode ? ' hidden' : ''}>
<div class="ocean-story"><p class="ocean-kicker">BETWEEN TIDES / ふたりのあいだの海</p><h1>きみと見つける、<br><em>海の向こう。</em></h1><p>光が揺れる、ふたりだけの海。<br>ひとりは泳ぎ、ひとりは道をつくる。<br>まだ知らない景色を、いっしょに。</p><div class="ocean-coordinate"><span>01 — INTO THE BLUE</span><span>ふたりの海底探検</span></div></div><div class="lobby-card">
<p class="eyebrow">DIVE TOGETHER · 二人で、ひとつの迷路</p><h1>部屋をつくって、<br>相手を招待しよう。</h1>
<div id="net-lobby-mount"></div>
<p class="lobby-note">つくった人が親、参加した人が子どもではじまります。ラウンドごとに必ず交代します。</p>
<p class="lobby-settings"><span id="lobby-summary"></span><button type="button" id="lobby-settings-open" class="text-button">⚙ 迷路の設定</button></p>
<p class="lobby-foot">相手がいないときは <a href="/test">ひとりで試す（テストモード）↗</a></p>
</div></section>
<main class="workspace"${testMode ? '' : ' hidden'}>
<section class="toolbar" aria-label="ゲーム操作"><div class="mode-group" aria-label="プレイモード"><button data-mode="parent" class="selected" aria-pressed="true">親</button><button data-mode="child" aria-pressed="false">子ども</button><button data-mode="cpu" aria-pressed="false">CPU</button></div><span id="room-chip" class="room-chip" hidden><b id="room-chip-code"></b><i id="room-chip-partner"></i></span><div class="status"><i id="phase-dot"></i><b id="phase">開始前</b><div class="oxygen" id="oxygen" role="meter" aria-label="残りの酸素" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span class="oxygen-bubbles" aria-hidden="true"><i></i><i></i><i></i></span><span class="oxygen-valve" aria-hidden="true"><i class="oxygen-knob"></i><i class="oxygen-neck"></i></span><span class="oxygen-body"><span class="oxygen-track"><span class="oxygen-fill" id="oxygen-fill"></span><span class="oxygen-ticks" aria-hidden="true"></span></span><span class="oxygen-band" aria-hidden="true"></span><span class="oxygen-band" aria-hidden="true"></span><strong id="timer">00:30</strong><span class="oxygen-label" aria-hidden="true">O₂</span></span></div></div><div class="run-controls"><button id="reset" class="secondary" aria-label="リセット">↺</button><button id="start" class="primary">スタート</button><button id="settings-open" class="secondary" aria-label="設定と部屋コード" title="設定と部屋コード (□)">⚙</button><button id="fullscreen" class="secondary" aria-label="全画面" aria-pressed="false" title="全画面 (F)">⛶</button></div></section>
<p id="mode-description" class="hint"></p>
<div class="boards">
${['parent', 'child'].map(role => `<section class="board-card ${role}"><div class="board-heading"><h2>${role === 'parent' ? '親' : '子ども'} <span class="role-badge" id="badge-${role}"></span></h2><span class="score"><strong id="score-${role}">${role === 'parent' ? '100' : '0'}</strong><small id="detail-${role}">0 / 12</small></span></div><div class="board-surface"><canvas id="board-${role}" tabindex="0" aria-label="${role === 'parent' ? '親の迷路。マスの端をクリックして壁を設置' : '子どもの迷路。矢印キーで移動'}"></canvas></div></section>`).join('')}
</div>
<div class="interaction-panel"><div class="touch-controls"><div class="dpad"><button data-dir="3" aria-label="上">↑</button><button data-dir="2" aria-label="左">←</button><button data-dir="1" aria-label="下">↓</button><button data-dir="0" aria-label="右">→</button></div><button id="rotate" class="secondary">↻ <span id="direction">右</span></button><button id="place" class="primary">壁を置く</button></div><p id="control-hint" class="hint"></p></div>
</main>
<dialog id="settings-dialog" class="settings-dialog"><div class="dialog-head"><h2>設定</h2><button id="settings-close" class="text-button" aria-label="閉じる">✕</button></div><div id="net-room-mount"></div><div class="wall-style" role="radiogroup" aria-label="壁のデザイン"><span>壁のデザイン</span><label><input type="radio" name="wall-style" value="ridge">岩の壁</label><label><input type="radio" name="wall-style" value="reef">サンゴと岩</label><small>この画面だけに反映されます</small></div><form id="settings"><div class="fields">${fields.map(([key, label]) => `<label class="field">${label}${input(key, label)}</label>`).join('')}${ranges.map(([color, label, min, max]) => `<div class="field"><label for="${min}"><i class="legend-dot ${color}"></i>${label}</label><span>${input(min, label + ' 最小値').replace('type="number"', `id="${min}" type="number"`)}–${input(max, label + ' 最大値')}</span></div>`).join('')}</div><div class="form-actions"><button type="button" id="defaults" class="text-button">初期値</button><button class="primary" type="submit">適用</button></div></form></dialog>
<div id="notice" role="status"></div>
<dialog id="result">${waterLight}<div class="return-art" aria-hidden="true"><canvas id="result-scene"></canvas></div><p class="eyebrow">BACK TO THE LIGHT</p><h2 id="result-title">探検完了</h2><div class="result-scores"><div><small id="result-label-a">親</small><strong id="final-parent"></strong></div><div><small id="result-label-b">子ども</small><strong id="final-child"></strong></div></div><p id="final-stats"></p><p id="result-rounds" class="result-rounds" hidden></p><p id="swap-note" class="swap-note">次のラウンドは役割を交代します。</p><div class="dialog-actions"><button id="close-result" class="secondary">閉じる</button><button id="again" class="primary">もう一度</button></div></dialog>
<dialog id="ready" class="ready-dialog">${waterLight}${bubbles(12)}<p class="eyebrow" id="ready-eyebrow"></p><h2 id="ready-title"></h2><p id="ready-note"></p><div id="ready-tutorial" class="tutorial"></div><div id="ready-invite" hidden><p class="ready-code"><span>部屋コード</span><strong id="ready-code"></strong></p><button type="button" id="ready-copy" class="secondary wide">招待リンクをコピー</button></div><button type="button" id="ready-review" class="secondary wide">チュートリアルを確認</button><button type="button" id="ready-start" class="primary wide">準備完了</button><p class="ready-foot"><button type="button" id="ready-settings" class="text-button">⚙ 設定</button></p></dialog>
<dialog id="countdown" class="countdown-dialog" aria-label="開始カウントダウン">${bubbles(14, 720)}<p class="eyebrow" id="countdown-round"></p><h2>まもなく探検が始まります</h2><div class="countdown-core"><span class="countdown-rings" aria-hidden="true"><i></i><i></i><i></i></span><strong id="countdown-number" aria-live="assertive" aria-atomic="true">3</strong></div><div class="depth-gauge" aria-hidden="true"><span>水面</span><i><b></b></i><span>海の底</span></div><p>ふたりで、海の向こうへ。</p><button id="countdown-pause" class="secondary">待機に戻る</button></dialog>
<dialog id="ending" class="ending-dialog"><div class="ending-flash" aria-hidden="true"></div>${drops(24)}${sparkles(18)}<p class="eyebrow">THANK YOU FOR DIVING</p><h2>ふたりの旅は、ここまで。</h2><p>同じ海で見つけた景色を、<br>ふたりで話してみよう。</p><button id="ending-finish" class="primary">海から戻る</button></dialog>
<dialog id="help">${waterLight}<h2>遊び方</h2><p>親は100点から。子どもがアイテムを取ると、隠れたリスク分だけ親の点が減り、子どもは報酬を得ます。</p><p>親は通路に壁を置けます。壁1枚ごとに親は設定したコスト、子どもは1点を失うので、アイテムを取る前でも子どもの点はマイナスになることがあります。道がふさがると、子どもだけの秘密の通路が開きます。</p><p>矢印キー/WASDで操作。親はTabで向き、Spaceで設置。Escで一時停止。Fで全画面。</p><p class="pad-help"><b>🎮 PS5コントローラー</b><br>方向キー/左スティック 移動・位置選択 · × 壁を置く · 右スティック/○ 壁の向き · OPTIONS スタート/一時停止 · CREATE リセット · L1/R1 モード切替 · □ 設定 · △ 全画面</p><button id="help-close" class="primary">OK</button></dialog>`;

const $ = id => document.getElementById(id);
let game = createMaze(), cursor = game.avatar, direction = 0, seed = 260830, keys = new Set(), last = 0, uiClock = 0, resultShown = false, lastPhase = null, endingTimer = null, sentOxygen = -1, diveTimer = 0;
const resultScene = createResultScene($('result-scene'));
// Presentation dialogs rise in once per real opening; fullscreen re-insertion must not replay it.
function reveal(dialog) { dialog.classList.add('entering'); dialog.showModal(); }
document.querySelectorAll('dialog').forEach(d => d.addEventListener('animationend', e => { if (e.target === d && e.animationName.startsWith('dialog-')) d.classList.remove('entering'); }));
const restart = (el, name) => { el.classList.remove(name); void el.offsetWidth; el.classList.add(name); };
function countdownTick() { restart($('countdown'), 'tick'); window.dispatchEvent(new CustomEvent('ocean-pulse')); }
function diveIn() { const boards = document.querySelector('.boards'); restart(boards, 'is-diving'); clearTimeout(diveTimer); diveTimer = setTimeout(() => boards.classList.remove('is-diving'), 1500); }
const keyDirection = { ArrowRight: 0, d: 0, ArrowDown: 1, s: 1, ArrowLeft: 2, a: 2, ArrowUp: 3, w: 3 };
const descriptions = { parent: '壁を置いて子どもCPUを導こう', child: 'アイテムを集めよう', cpu: 'CPU同士を観察' };
function oceanPhase() { return !$('lobby').hidden ? 'lobby' : game.phase === 'result' && network.active ? 'summary' : game.phase; }
function showLobby(on) { if ($('ending').open && !on) return; $('lobby').hidden = !on; document.querySelector('.workspace').hidden = on; if (on) lobbySummary(); window.dispatchEvent(new CustomEvent('ocean-phase', { detail: oceanPhase() })); }
const network = testMode ? { active: false, connected: false, state: null, send() {} } : connectMaze({ settings: () => Object.fromEntries(new FormData($('settings'))), notice,
  onLeave: () => { clearTimeout(endingTimer); $('ending').close(); $('countdown').close(); $('settings-dialog').close(); setImmersive(false); document.querySelector('.boards').classList.remove('network-boards'); document.querySelectorAll('.board-card').forEach(b => b.hidden = false); reset(); showLobby(true); },
  onState: packet => {
    showLobby(false);
    const changed = network.stateRound !== packet.round || network.stateCode !== packet.code;
    network.stateRound = packet.round; network.stateCode = packet.code;
    game = { ...packet.game, mode: packet.role, base: new Set(packet.game.base), walls: new Set(packet.game.walls), secrets: new Set(packet.game.secrets) };
    if (changed) { tutorial.stop(); $('ready').close(); $('countdown').close(); cursor = game.avatar; resultShown = false; keys.clear(); $('result').close(); for (const [key, value] of Object.entries(game.settings)) $('settings').elements[key].value = value; }
    if (game.phase !== 'playing') keys.clear();
    document.querySelector('.boards').classList.add('network-boards');
    document.querySelectorAll('.board-card').forEach(b => b.hidden = !b.classList.contains(packet.role));
    update(); render();
  }
});
function notice(message) { $('notice').textContent = message; $('notice').classList.add('show'); clearTimeout(notice.timer); notice.timer = setTimeout(() => $('notice').classList.remove('show'), 2600); }
const tutorial = createTutorial($('ready-tutorial'), { onStep: () => update(), onFinish: () => { if (!tutorial.last) return; tutorial.stop(); network.send({ type: 'tutorial' }); update(); }, onClose: () => update() });
function readyPrompt() {
  const waiting = ['ready', 'paused'].includes(game.phase) && !$('result').open;
  if (!waiting) { if ($('ready').open) { $('ready').close(); tutorial.stop(); } return; }
  const { partner, ready, code, match, tutorialComplete } = network.state, paused = game.phase === 'paused';
  const partnerLine = partner.connected ? partner.ready ? '相手は準備完了' : partner.tutorialComplete ? '相手は準備中' : '相手はチュートリアルを確認中' : '相手を待っています';
  $('ready-eyebrow').textContent = `${paused ? 'ひと休み中' : `第${match.leg}ラウンド / 全2ラウンド`} · ${partnerLine}`;
  $('ready-title').textContent = game.mode === 'parent' ? 'あなたは親です。' : 'あなたは子どもです。';
  $('ready-note').textContent = network.state.reason || 'チュートリアルを確認して準備完了を押してください。二人の準備ができたら3秒後に始まります。';
  if (!$('ready').open) { reveal($('ready')); if (paused || tutorialComplete) tutorial.stop(); else tutorial.start(game.mode, game.settings); setImmersive(true); }
  // The briefing is the whole prompt until it is closed or finished; its last step confirms.
  const briefing = !paused && !ready && tutorial.running;
  $('ready').classList.toggle('briefing', briefing);
  tutorial.setKicker(`${match.leg === 2 && !paused ? '役割交代 · ' : ''}${game.mode === 'parent' ? '親' : '子ども'} · ${$('ready-eyebrow').textContent}`);
  $('ready-eyebrow').hidden = $('ready-title').hidden = $('ready-note').hidden = $('ready-start').hidden = briefing;
  $('ready-tutorial').hidden = !briefing;
  $('ready-invite').hidden = partner.connected; $('ready-code').textContent = code;
  $('ready-review').hidden = briefing || paused || ready;
  $('ready-review').textContent = tutorialComplete ? 'チュートリアルをもう一度見る' : 'チュートリアルを確認';
  $('ready-start').disabled = !network.connected || ready || !tutorialComplete;
  $('ready-start').textContent = ready ? '相手の準備を待っています' : paused ? '再開する' : !tutorialComplete ? 'チュートリアルを確認してください' : '準備完了';
}
function lobbySummary() { const v = Object.fromEntries(new FormData($('settings'))); $('lobby-summary').textContent = `${v.cols}×${v.rows}のマス · ${v.duration}秒 · 壁 ${v.wallLimit}枚`; }
function reset(settings = game.settings, nextSeed = seed) { const mode = game.mode; game = createMaze(settings, nextSeed); game.mode = mode; seed = nextSeed; cursor = game.avatar; keys.clear(); resultShown = false; $('result').close(); update(); render(); }
function setMode(mode) { if (network.active) return; game.mode = mode; keys.clear(); update(); }
// A finished round is followed by the same maze with the roles exchanged, so both sides play it.
function swapRoles() { if (game.mode === 'cpu') return; game.mode = game.mode === 'parent' ? 'child' : 'parent'; notice(game.mode === 'parent' ? '交代 · 今度はあなたが親です。' : '交代 · 今度はあなたが子どもです。'); }
function toggle() { if (network.active) { if (['ready', 'paused'].includes(game.phase) && !network.state.tutorialComplete) return; network.send({ type: ['playing', 'countdown'].includes(game.phase) ? 'pause' : game.phase === 'result' ? 'again' : 'ready' }); return; } if (game.phase === 'result') { reset(); swapRoles(); } if (game.phase === 'playing') { game.phase = 'paused'; keys.clear(); } else start(game); update(); }
function control(dir) { if (game.mode === 'parent') { const n = neighbor(game, cursor, dir); if (n >= 0) cursor = n; } else if (game.mode === 'child') { if (network.active) network.send({ type: 'move', direction: dir }); else move(game, dir); } }
function wall() { if (game.mode !== 'parent') return; if (network.active) { network.send({ type: 'wall', cell: cursor, direction }); return; } if (!placeWall(game, cursor, direction)) notice(game.phase !== 'playing' ? '探検を始めてから壁を置いてください。' : game.walls.size >= game.settings.wallLimit ? '設置できる壁をすべて使いました。' : 'すでに壁があります。空いている通路を選んでください。'); update(); }
function rotate() { direction = (direction + 1) % 4; update(); }
$('start').onclick = toggle; $('reset').onclick = () => { if (!network.active) reset(); }; $('again').onclick = () => { if (network.active) { network.send({ type: 'again' }); return; } reset(); swapRoles(); start(game); update(); }; $('close-result').onclick = () => {
  $('result').close();
  if (!network.active) return;
  document.querySelector('.workspace').hidden = true;
  window.dispatchEvent(new CustomEvent('ocean-phase', { detail: 'ending' }));
  reveal($('ending'));
  clearTimeout(endingTimer); endingTimer = setTimeout(finishEnding, 5000);
};
function finishEnding() { clearTimeout(endingTimer); $('ending').close(); network.send({ type: 'leave' }); }
$('ending-finish').onclick = finishEnding;
$('ending').addEventListener('cancel', event => { event.preventDefault(); finishEnding(); });
$('result').addEventListener('cancel', event => { if (network.active) { event.preventDefault(); $('close-result').click(); } });
$('countdown').addEventListener('cancel', event => { event.preventDefault(); suspend(); });
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
});
$('rotate').onclick = rotate; $('place').onclick = wall;
$('help-open').onclick = () => { suspend(); reveal($('help')); };
$('result').addEventListener('close', () => resultScene.stop());
$('help-close').onclick = () => $('help').close();
// The dialog sits in the top layer, so it stays reachable in fullscreen where the panels are hidden.
$('settings-open').onclick = () => { suspend(); $('settings-dialog').showModal(); };
$('lobby-settings-open').onclick = () => $('settings-dialog').showModal();
// The ready prompt covers the board with a blurred backdrop, so the button is large and hard to miss.
$('ready').addEventListener('cancel', event => event.preventDefault());
$('ready-start').onclick = toggle;
$('ready-review').onclick = () => { tutorial.start(game.mode, game.settings); update(); };
$('ready-settings').onclick = () => $('settings-dialog').showModal();
$('ready-copy').onclick = () => $('maze-copy').click();
// The wall design is a personal display preference, remembered in this browser only.
let savedWallStyle = 'ridge';
try { savedWallStyle = localStorage.getItem('maze-wall-style') || 'ridge'; } catch { /* storage unavailable */ }
if (!WALL_STYLES.includes(savedWallStyle)) savedWallStyle = 'ridge';
setWallStyle(savedWallStyle);
document.querySelector(`[name=wall-style][value=${savedWallStyle}]`).checked = true;
document.querySelectorAll('[name=wall-style]').forEach(radio => radio.onchange = () => {
  setWallStyle(radio.value);
  try { localStorage.setItem('maze-wall-style', radio.value); } catch { /* storage unavailable */ }
});
$('settings-close').onclick =() => { $('settings-dialog').close(); lobbySummary(); };
$('settings').onsubmit = event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); for (const [, , min, max] of ranges) if (+values[min] > +values[max]) { notice('最小値は最大値以下にしてください。'); event.target.elements[min].focus(); return; } $('settings-dialog').close(); lobbySummary(); if (network.active) { network.send({ type: 'settings', settings: values }); return; } reset(values, seed + 1); if (!$('lobby').hidden) return; notice('新しい設定で迷路を作りました。'); };
$('defaults').onclick = () => { for (const [key, value] of Object.entries(DEFAULTS)) $('settings').elements[key].value = value; reset(DEFAULTS, 260830); lobbySummary(); notice('初期設定に戻しました。'); };
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
  document.querySelectorAll('#settings input, #settings button').forEach(b => b.disabled = !editable);
  $('defaults').hidden = network.active;
  $('room-chip').hidden = !network.active;
  if (network.active) {
    $('room-chip-code').textContent = network.state.code;
    $('room-chip-partner').textContent = network.state.partner.connected ? network.state.partner.ready ? '相手は準備完了' : '相手が接続中' : '相手を待っています';
  }
  $('phase').textContent = { ready: '開始前', countdown: 'まもなく開始', playing: '探検中', paused: 'ひと休み中', result: '探検完了' }[game.phase];
  $('phase-dot').classList.toggle('live', game.phase === 'playing');
  const remaining = Math.ceil(game.settings.duration - game.time); $('timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('urgent', remaining <= 5 && game.phase === 'playing');
  const oxygen = Math.max(0, Math.min(100, (game.settings.duration - game.time) / game.settings.duration * 100));
  if (Math.round(oxygen) !== sentOxygen) { sentOxygen = Math.round(oxygen); window.dispatchEvent(new CustomEvent('ocean-oxygen', { detail: oxygen / 100 })); }
  $('oxygen-fill').style.width = `${oxygen}%`; $('oxygen').setAttribute('aria-valuenow', Math.round(oxygen)); $('oxygen').classList.toggle('low', oxygen <= 25); $('oxygen').classList.toggle('critical', oxygen <= 10); $('oxygen').classList.toggle('flowing', game.phase === 'playing');
  $('start').textContent = { ready: 'スタート', countdown: '待機に戻る', playing: '一時停止', paused: '再開', result: 'もう一度' }[game.phase];
  $('mode-description').textContent = descriptions[game.mode];
  $('start').disabled = network.active && ((['ready', 'paused'].includes(game.phase) && !network.state.tutorialComplete) || !network.connected || (!['playing', 'countdown'].includes(game.phase) && (network.state?.ready && game.phase !== 'result' || network.state?.again && game.phase === 'result')));
  if (network.active) {
    $('mode-description').textContent = network.state.reason || '対戦中';
    if (['ready', 'paused'].includes(game.phase)) $('start').textContent = network.state.ready ? '相手を待機中' : '準備完了';
    const nextLabel = network.state.match.done ? 'もう一度あそぶ' : '交代して第2ラウンドへ';
    if (game.phase === 'result') $('start').textContent = network.state.again ? '相手を待機中' : nextLabel;
    $('again').disabled = network.state.again || !network.connected || !network.state.partner.connected; $('again').textContent = network.state.again ? '相手を待機中' : nextLabel;
    readyPrompt();
    if (game.phase === 'countdown') {
      $('countdown-round').textContent = `第${network.state.match.leg}ラウンド / 全2ラウンド`;
      const number = String(network.state.countdown);
      const changed = $('countdown-number').textContent !== number;
      if (changed) $('countdown-number').textContent = number;
      if (!$('countdown').open) { $('settings-dialog').close(); reveal($('countdown')); countdownTick(); }
      else if (changed) countdownTick();
    } else if ($('countdown').open) $('countdown').close();
  } else { if ($('ready').open) { $('ready').close(); tutorial.stop(); } $('again').disabled = false; $('again').textContent = game.mode === 'cpu' ? 'もう一度' : '交代してもう一度'; if (game.phase === 'result' && game.mode !== 'cpu') $('start').textContent = '交代してもう一度'; }
  for (const role of ['parent', 'child']) {
    const score = $('score-' + role), value = String(game[role + 'Score']);
    if (score.textContent !== value) { score.textContent = value; if (game.phase === 'playing') restart(score, 'bump'); }
    $('badge-' + role).textContent = game.mode === role ? 'あなた' : 'CPU'; }
  $('detail-parent').textContent = `${game.walls.size} / ${game.settings.wallLimit}`; $('detail-child').textContent = `${game.collected} / ${game.items.length}`;
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b.dataset.mode === game.mode); b.setAttribute('aria-pressed', b.dataset.mode === game.mode); });
  $('rotate').hidden = $('place').hidden = game.mode !== 'parent';
  document.querySelector('.dpad').hidden = game.mode === 'cpu';
  $('direction').textContent = ['右', '下', '左', '上'][direction];
  $('control-hint').textContent = game.mode === 'parent' ? 'マスの端をクリック、またはSpaceで壁を設置' : game.mode === 'child' ? '矢印/WASDで移動 · 点線は秘密の通路' : '';
  if (game.phase === 'result' && !resultShown) {
    resultShown = true; keys.clear();
    // A match is one round as the parent and one as the child; the second result closes it out.
    const match = network.active ? network.state.match : null, done = !!match?.done;
    $('result-title').textContent = done ? 'ふたりの探検が終わりました' : network.active ? `第${match.leg}ラウンド終了` : '探検完了';
    $('result-label-a').textContent = done ? 'あなた' : '親'; $('result-label-b').textContent = done ? '相手' : '子ども';
    $('final-parent').textContent = done ? match.you : game.parentScore; $('final-child').textContent = done ? match.partner : game.childScore;
    $('final-stats').textContent = `${game.moves}マスの旅 · アイテム ${game.collected} · 壁 ${game.walls.size} · 秘密の通路 ${game.secrets.size}`;
    $('result-rounds').hidden = !done;
    if (done) $('result-rounds').textContent = match.results.map((leg, i) => `第${i + 1}ラウンド 親 ${leg.parent} · 子ども ${leg.child}`).join('　/　');
    $('swap-note').hidden = done || game.mode === 'cpu';
    $('close-result').className = network.active ? 'primary' : 'secondary'; $('again').className = network.active ? 'secondary' : 'primary';
    $('close-result').hidden = false; $('close-result').textContent = network.active ? '終了する' : '閉じる';
    reveal($('result')); resultScene.play();
  }
}
function render() { for (const role of ['parent', 'child']) if (!network.active || game.mode === role) drawMaze($('board-' + role), game, role, cursor, direction); }
let networkClock = 0;
// Game time advances from wall-clock deltas; rAF only paces drawing. A watchdog keeps the round
// moving when the browser stops painting the tab without firing blur/visibilitychange.
function step(now) {
  const dt = last ? Math.max(0, Math.min((now - last) / 1000, 1)) : 0; last = now; const padDir = pollPad(now), key = [...keys].at(-1), held = key !== undefined ? keyDirection[key] : padDir >= 0 ? padDir : undefined;
  if (!network.active) { for (let left = dt; left > 0; left -= .1) tick(game, Math.min(left, .1), held === undefined ? -1 : held); }
  else { networkClock += dt; if (networkClock >= .06) { networkClock = 0; if (held !== undefined && game.mode === 'child' && game.phase === 'playing') network.send({ type: 'move', direction: held }); } }
  uiClock += dt; if (uiClock >= .08 || game.phase === 'result' && !resultShown) { update(); uiClock = 0; }
}
const readPad = createPadReader(); let padSeen = false, feltWalls = 0, feltItems = 0, feltPhase = '';
function pollPad(now) {
  const pad = firstPad(), input = readPad(pad, now);
  if (!!pad !== padSeen) { padSeen = !!pad; $('pad-status').hidden = !pad; if (pad) notice('コントローラーを接続しました 🎮'); }
  if (!pad) return -1;
  const on = name => input.pressed.has(name);
  if ($('ending').open) { if (on('cross') || on('circle')) finishEnding(); return -1; }
  if ($('countdown').open) { if (on('options') || on('circle')) suspend(); return -1; }
  if ($('help').open) { if (on('cross') || on('circle')) $('help').close(); return -1; }
  if ($('result').open) { if (on('cross')) $('again').click(); if (on('circle')) $('close-result').click(); return -1; }
  if ($('settings-dialog').open) { if (on('circle') || on('square')) $('settings-close').click(); return -1; }
  if ($('ready').open) {
    const briefing = !$('ready-tutorial').hidden;
    if (briefing) tutorial.pad(input, on);
    if (on('options')) { if (briefing) { if (tutorial.last) $('ready-tutorial').querySelector('.briefing-launch').click(); else tutorial.next(); } else $('ready-start').click(); }
    if (on('square')) $('ready-settings').click();
    return -1;
  }
  if (!$('lobby').hidden) { if (on('square')) $('lobby-settings-open').click(); return -1; }
  if (on('square')) { $('settings-open').click(); return -1; }
  if (on('options')) toggle();
  if (on('triangle')) toggleImmersive();
  if (on('create') && !network.active) reset();
  if ((on('l1') || on('r1')) && !network.active) { const modes = ['parent', 'child', 'cpu']; setMode(modes[(modes.indexOf(game.mode) + (on('r1') ? 1 : 2)) % 3]); }
  if (game.mode === 'parent') { if (input.step >= 0) control(input.step); if (input.aim >= 0) { direction = input.aim; update(); } if (on('circle')) rotate(); if (on('cross')) wall(); }
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
lobbySummary(); update(); render(); requestAnimationFrame(frame);
