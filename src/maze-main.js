import './maze.css';
import { DEFAULTS, LIMITS, createMaze, start, tick, move, placeWall, neighbor } from './maze.js';
import { drawMaze, pointerCell } from './maze-renderer.js';
import { connectMaze } from './maze-network.js';

const fields = [['cols', '横のマス数'], ['rows', '縦のマス数'], ['duration', '制限時間（秒）'], ['wallLimit', '壁の枚数'], ['wallCost', '親の壁コスト'], ['moveMs', '移動間隔（ms）']];
const ranges = [['red', '高リスク', 'redMin', 'redMax'], ['yellow', '中リスク', 'yellowMin', 'yellowMax'], ['green', '低リスク', 'greenMin', 'greenMax'], ['gold', '子どもの報酬', 'rewardMin', 'rewardMax']];
const input = (key, label) => `<input type="number" name="${key}" aria-label="${label}" min="${LIMITS[key][0]}" max="${LIMITS[key][1]}" step="${key === 'moveMs' ? 50 : 1}" value="${DEFAULTS[key]}" required>`;
document.querySelector('#app').innerHTML = `
<header class="top"><a class="brand" href="/"><span class="brand-mark">↱</span><span>ふたりのあいだの道<small>BETWEEN PATHS</small></span></a><nav><span class="edition">MAZE EXPERIMENT / 01</span><a href="?online=1">海のゲームへ ↗</a><button id="help-open" class="text-button">遊び方</button></nav></header>
<main class="workspace"><section class="intro"><div><p class="eyebrow">同じ迷路、違う願い</p><h1>守りたい気持ち。<br><span>見つけたい気持ち。</span></h1><p class="intro-copy">親は壁をつくり、子どもは新しい道を探す。<br>ふたつの視点で、ひとつの探検を。</p></div><div class="intro-aside"><span class="experiment-label">A SHARED WORLD</span><div class="path-art" aria-hidden="true"><i></i><b>?</b><span>↗</span></div><p>ふさがれた道の向こうにも<br>子どもの可能性は続いています。</p></div></section>
<section class="toolbar" aria-label="ゲーム操作"><div class="mode-group" aria-label="プレイモード"><button data-mode="parent" class="selected" aria-pressed="true">01 <b>親でプレイ</b></button><button data-mode="child" aria-pressed="false">02 <b>子どもでプレイ</b></button><button data-mode="cpu" aria-pressed="false">03 <b>CPU観察</b></button></div><div class="run-controls"><button id="reset" class="secondary">↺ リセット</button><button id="start" class="primary">探検を始める ↗</button></div></section>
<div class="session-strip"><span><i id="phase-dot"></i><b id="phase">開始前</b><span id="mode-description">子どもCPUが移動します。親として壁を置いてみましょう。</span></span><strong id="timer">00:15</strong></div>
<div class="game-layout"><div class="boards">
${['parent', 'child'].map((role, index) => `<section class="board-card ${role}"><div class="board-heading"><div><span class="view-number">0${index + 1}</span><h2>${role === 'parent' ? '親の視点' : '子どもの視点'}<small>${role === 'parent' ? '守りたい世界' : '探検したい世界'}</small></h2></div><span class="role-badge" id="badge-${role}">${role === 'parent' ? 'あなたが操作' : 'CPU'}</span></div><div class="board-surface"><canvas id="board-${role}" tabindex="0" aria-label="${role === 'parent' ? '親の迷路。マスの端をクリックして壁を設置' : '子どもの迷路。矢印キーで移動'}"></canvas></div><div class="score-row"><div><span>${role === 'parent' ? '安全スコア' : '探検スコア'}</span><strong id="score-${role}">${role === 'parent' ? '100' : '0'}</strong></div><div class="score-detail"><span>${role === 'parent' ? '置いた壁' : '見つけたアイテム'}</span><b id="detail-${role}">0 / 12</b></div></div><div class="board-note">${role === 'parent' ? '<i class="legend-dot coral"></i> 親の壁 <i class="legend-dot gold"></i> 獲得後にリスク公開' : '<i class="legend-dot teal"></i> 自分だけの秘密の通路 <i class="legend-dot gold"></i> 未知のアイテム'}</div></section>`).join('')}
<div class="interaction-panel"><p id="control-hint"><kbd>矢印キー</kbd> 位置を選択 <kbd>Tab</kbd> 向きを変更 <kbd>Space</kbd> 壁を設置 · マスの端をクリックしても設置できます。</p><div class="touch-controls"><div class="dpad"><button data-dir="3" aria-label="上">↑</button><button data-dir="2" aria-label="左">←</button><button data-dir="1" aria-label="下">↓</button><button data-dir="0" aria-label="右">→</button></div><button id="rotate" class="secondary">↻ 壁の向き <span id="direction">右</span></button><button id="place" class="primary">＋ 壁を設置</button></div></div>
<section class="journal"><div><p class="eyebrow">FIELD NOTES</p><h2>探検の記録</h2></div><ol id="events" aria-live="polite"><li>開始ボタンを押すと、二人の歩みが記録されます。</li></ol></section></div>
<aside class="settings-panel"><div class="settings-heading"><span class="eyebrow">YOUR EXPERIMENT</span><h2>探検の設定</h2><p>小さな条件が、違う道をつくります。</p></div><form id="settings"><fieldset><legend>迷路とプレイ</legend>${fields.map(([key, label]) => `<label class="field">${label}${input(key, label)}</label>`).join('')}</fieldset><fieldset><legend>アイテムの二つの顔</legend><p class="setting-note">親の減点と子どもの報酬は、<br>それぞれの範囲で別々に決まります。</p>${ranges.map(([color, label, min, max]) => `<div class="range-field"><label for="${min}"><i class="legend-dot ${color}"></i>${label}</label><div>${input(min, label + ' 最小値').replace('type="number"', `id="${min}" type="number"`)}<span>–</span>${input(max, label + ' 最大値')}</div></div>`).join('')}</fieldset><button class="primary apply" type="submit">設定を適用・新しい迷路 ↗</button><button type="button" id="defaults" class="text-button defaults">初期設定に戻す</button><p class="setting-note">設定を適用すると探検がリセットされます。壁を1枚置くたびに子どもの点数も1点減ります。</p></form></aside></div>
<footer class="bottom">BETWEEN PATHS <span>ひとつの道を、ふたつの視点で。</span><span>PYTHON PROTOTYPE → WEB EDITION</span></footer></main>
<div id="notice" role="status"></div>
<dialog id="result"><p class="eyebrow">EXPERIMENT COMPLETE</p><h2>同じ旅、違う結果。</h2><p>守ってくれた壁も、新しい発見につながった道もありました。</p><div class="result-scores"><div>親の安全スコア<strong id="final-parent"></strong></div><div>子どもの探検スコア<strong id="final-child"></strong></div></div><p id="final-stats"></p><div class="dialog-actions"><button id="close-result" class="secondary">迷路を振り返る</button><button id="again" class="primary">もう一度探検する ↗</button></div></dialog>
<dialog id="help"><p class="eyebrow">HOW TO PLAY</p><h2>見え方の違う迷路</h2><p>親は100点からスタート。子どもがアイテムを集めると、隠れたリスクの分だけ親の点数が減ります。子どもは同じアイテムからランダムな報酬を獲得します。集める前は、どちらにも値は見えません。</p><p>親は空いている通路に壁を置けます。道が完全にふさがると、子どもだけに見える秘密の通路が生まれ、すべてのマスに進めます。親の画面の旗は目印です。到着しても探検は終わりません。</p><p><b>親でプレイ</b> · 子どもCPUがアイテムを探して移動します。<br><b>子どもでプレイ</b> · 子どもを操作し、親CPUが壁を置きます。<br><b>CPU観察</b> · 両方とも自動で動きます。</p><p>矢印キー・WASDで操作します。親モードでは迷路にフォーカスしてTabで壁の向きを変え、Spaceで設置します。画面下のボタンでも操作できます。Escで一時停止します。</p><button id="help-close" class="primary">わかりました</button></dialog>`;

const $ = id => document.getElementById(id);
let game = createMaze(), cursor = game.avatar, direction = 0, seed = 260830, keys = new Set(), last = 0, uiClock = 0, logKey = '', resultShown = false;
const keyDirection = { ArrowRight: 0, d: 0, ArrowDown: 1, s: 1, ArrowLeft: 2, a: 2, ArrowUp: 3, w: 3 };
const descriptions = { parent: '子どもCPUが移動します。親として壁を置いてみましょう。', child: '親CPUが壁を置きます。子どもになって、未知のアイテムを集めましょう。', cpu: '二つのCPUの選択と、壁や秘密の通路の変化を観察しましょう。' };
const network = connectMaze({ settings: () => Object.fromEntries(new FormData($('settings'))), notice,
  onLeave: () => { document.querySelector('.boards').classList.remove('network-boards'); document.querySelectorAll('.board-card').forEach(b => b.hidden = false); reset(); },
  onState: packet => {
    const changed = network.stateRound !== packet.round || network.stateCode !== packet.code;
    network.stateRound = packet.round; network.stateCode = packet.code;
    game = { ...packet.game, mode: packet.role, base: new Set(packet.game.base), walls: new Set(packet.game.walls), secrets: new Set(packet.game.secrets) };
    if (changed) { cursor = game.avatar; resultShown = false; keys.clear(); $('result').close(); for (const [key, value] of Object.entries(game.settings)) $('settings').elements[key].value = value; }
    if (game.phase !== 'playing') keys.clear();
    document.querySelector('.boards').classList.add('network-boards');
    document.querySelectorAll('.board-card').forEach(b => b.hidden = !b.classList.contains(packet.role));
    update(); render();
  }
});
function notice(message) { $('notice').textContent = message; $('notice').classList.add('show'); clearTimeout(notice.timer); notice.timer = setTimeout(() => $('notice').classList.remove('show'), 2600); }
function reset(settings = game.settings, nextSeed = seed) { const mode = game.mode; game = createMaze(settings, nextSeed); game.mode = mode; seed = nextSeed; cursor = game.avatar; keys.clear(); resultShown = false; logKey = ''; $('result').close(); update(); render(); }
function setMode(mode) { if (network.active) return; game.mode = mode; keys.clear(); update(); }
function toggle() { if (network.active) { network.send({ type: game.phase === 'playing' ? 'pause' : game.phase === 'result' ? 'again' : 'ready' }); return; } if (game.phase === 'result') reset(); if (game.phase === 'playing') { game.phase = 'paused'; keys.clear(); } else start(game); update(); }
function control(dir) { if (game.mode === 'parent') { const n = neighbor(game, cursor, dir); if (n >= 0) cursor = n; } else if (game.mode === 'child') { if (network.active) network.send({ type: 'move', direction: dir }); else move(game, dir); } }
function wall() { if (game.mode !== 'parent') return; if (network.active) { network.send({ type: 'wall', cell: cursor, direction }); return; } if (!placeWall(game, cursor, direction)) notice(game.phase !== 'playing' ? '探検を始めてから壁を置いてください。' : game.walls.size >= game.settings.wallLimit ? '設置できる壁をすべて使いました。' : 'すでに壁があります。空いている通路を選んでください。'); update(); }
function rotate() { direction = (direction + 1) % 4; update(); }
$('start').onclick = toggle; $('reset').onclick = () => { if (!network.active) reset(); }; $('again').onclick = () => { if (network.active) { network.send({ type: 'again' }); return; } reset(); start(game); update(); }; $('close-result').onclick = () => $('result').close();
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
document.querySelectorAll('[data-dir]').forEach(b => b.onclick = () => control(+b.dataset.dir));
$('rotate').onclick = rotate; $('place').onclick = wall;
$('help-open').onclick = () => { suspend(); $('help').showModal(); };
$('help-close').onclick = () => $('help').close();
$('settings').onsubmit = event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); for (const [, , min, max] of ranges) if (+values[min] > +values[max]) { notice('最小値は最大値以下にしてください。'); event.target.elements[min].focus(); return; } if (network.active) { network.send({ type: 'settings', settings: values }); return; } reset(values, seed + 1); notice('新しい設定で迷路を作りました。'); };
$('defaults').onclick = () => { for (const [key, value] of Object.entries(DEFAULTS)) $('settings').elements[key].value = value; reset(DEFAULTS, 260830); notice('初期設定に戻しました。'); };
$('board-parent').onpointermove = event => { if (game.mode !== 'parent') return; const hit = pointerCell(event.currentTarget, game, event); if (hit) { cursor = hit.cell; direction = hit.direction; } };
$('board-parent').onclick = event => { if (game.mode !== 'parent') return; const hit = pointerCell(event.currentTarget, game, event); if (hit) { cursor = hit.cell; direction = hit.direction; event.currentTarget.focus(); wall(); } };
window.addEventListener('keydown', event => {
  if (event.target.matches('input, select, textarea') || $('help').open || $('result').open) return;
  const dir = keyDirection[event.key];
  if (dir !== undefined) { event.preventDefault(); keys.add(event.key); if (game.mode === 'parent') control(dir); }
  if (game.mode === 'parent' && (event.key === 'Tab' && event.target.tagName === 'CANVAS')) { event.preventDefault(); rotate(); }
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); if (!event.repeat) wall(); }
  if (event.key === 'Escape' && game.phase === 'playing') suspend();
});
window.addEventListener('keyup', event => keys.delete(event.key));
function suspend() { keys.clear(); if (game.phase === 'playing') { if (network.active) network.send({ type: 'pause' }); else game.phase = 'paused'; update(); } }
window.addEventListener('blur', suspend); document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
function update() {
  document.querySelector('.mode-group').hidden = network.active; $('reset').hidden = network.active;
  const editable = !network.active || network.state?.host && game.phase === 'ready';
  document.querySelectorAll('#settings input, #settings button').forEach(b => b.disabled = !editable);
  $('defaults').hidden = network.active;
  $('phase').textContent = { ready: '開始前', playing: '探検中', paused: 'ひと休み中', result: '探検完了' }[game.phase];
  $('phase-dot').classList.toggle('live', game.phase === 'playing');
  const remaining = Math.ceil(game.settings.duration - game.time); $('timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('urgent', remaining <= 5 && game.phase === 'playing');
  $('start').textContent = { ready: '探検を始める ↗', playing: 'Ⅱ 一時停止', paused: '探検を続ける ↗', result: '新しい探検 ↗' }[game.phase];
  $('mode-description').textContent = descriptions[game.mode];
  $('start').disabled = network.active && (!network.connected || (game.phase !== 'playing' && (network.state?.ready && game.phase !== 'result' || network.state?.again && game.phase === 'result')));
  if (network.active) {
    $('mode-description').textContent = network.state.reason || '相手と同時にプレイしています。';
    if (['ready', 'paused'].includes(game.phase)) $('start').textContent = network.state.ready ? '相手の準備を待っています' : '準備完了 ↗';
    if (game.phase === 'result') $('start').textContent = network.state.again ? '相手の再プレイを待っています' : '再プレイを希望 ↗';
    $('again').disabled = network.state.again || !network.connected; $('again').textContent = network.state.again ? '相手の再プレイを待っています' : '再プレイを希望 ↗';
  } else { $('again').disabled = false; $('again').textContent = 'もう一度探検する ↗'; }
  for (const role of ['parent', 'child']) { $('score-' + role).textContent = game[role + 'Score']; $('badge-' + role).textContent = game.mode === role ? 'あなたが操作' : 'CPU'; }
  $('detail-parent').textContent = `${game.walls.size} / ${game.settings.wallLimit}`; $('detail-child').textContent = `${game.collected} / ${game.items.length}`;
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b.dataset.mode === game.mode); b.setAttribute('aria-pressed', b.dataset.mode === game.mode); });
  $('rotate').hidden = $('place').hidden = game.mode !== 'parent';
  document.querySelector('.dpad').hidden = game.mode === 'cpu';
  $('direction').textContent = ['右', '下', '左', '上'][direction];
  $('control-hint').textContent = game.mode === 'parent' ? '矢印・WASDで位置を選択 · 迷路にフォーカスしてTabで回転 · Spaceまたはマスの端をクリックして壁を設置' : game.mode === 'child' ? '矢印・WASDまたは下のボタンで移動 · 青緑の点線は子どもだけが通れる秘密の通路です。' : 'CPUが自動で探検します。いつでも親・子どもモードに切り替えて操作できます。';
  const nextLog = JSON.stringify(game.logs);
  if (nextLog !== logKey) { logKey = nextLog; $('events').replaceChildren(...(game.logs.length ? game.logs.slice(0, 5).map(entry => { const li = document.createElement('li'); const time = document.createElement('time'); time.textContent = `${entry.time.toFixed(1)}s`; li.append(time, entry.text); return li; }) : [Object.assign(document.createElement('li'), { textContent: '開始ボタンを押すと、二人の歩みが記録されます。' })])); }
  if (game.phase === 'result' && !resultShown) { resultShown = true; keys.clear(); $('final-parent').textContent = game.parentScore; $('final-child').textContent = game.childScore; $('final-stats').textContent = `${game.moves}マスの旅 · アイテム ${game.collected}個 · 壁 ${game.walls.size}枚 · 秘密の通路 ${game.secrets.size}本`; $('result').showModal(); }
}
function render() { for (const role of ['parent', 'child']) if (!network.active || game.mode === role) drawMaze($('board-' + role), game, role, cursor, direction); }
let networkClock = 0;
function frame(now) { const dt = last ? Math.min((now - last) / 1000, .1) : 0; last = now; const held = [...keys].at(-1); if (!network.active) tick(game, dt, held === undefined ? -1 : keyDirection[held]); else { networkClock += dt; if (networkClock >= .06) { networkClock = 0; if (held !== undefined && game.mode === 'child' && game.phase === 'playing') network.send({ type: 'move', direction: keyDirection[held] }); } } uiClock += dt; if (uiClock >= .08 || game.phase === 'result' && !resultShown) { update(); uiClock = 0; } render(); requestAnimationFrame(frame); }
update(); render(); requestAnimationFrame(frame);
