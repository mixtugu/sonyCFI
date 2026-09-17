import './maze.css';
import { DEFAULTS, LIMITS, createMaze, start, tick, move, placeWall, neighbor } from './maze.js';
import { drawMaze, pointerCell } from './maze-renderer.js';
import { connectMaze } from './maze-network.js';

const fields = [['cols', '横のマス数'], ['rows', '縦のマス数'], ['duration', '制限時間（秒）'], ['wallLimit', '壁の枚数'], ['wallCost', '親の壁コスト'], ['moveMs', '移動間隔（ms）']];
const ranges = [['red', '高リスク', 'redMin', 'redMax'], ['yellow', '中リスク', 'yellowMin', 'yellowMax'], ['green', '低リスク', 'greenMin', 'greenMax'], ['gold', '子どもの報酬', 'rewardMin', 'rewardMax']];
const input = (key, label) => `<input type="number" name="${key}" aria-label="${label}" min="${LIMITS[key][0]}" max="${LIMITS[key][1]}" step="${key === 'moveMs' ? 50 : 1}" value="${DEFAULTS[key]}" required>`;
document.querySelector('#app').innerHTML = `
<header class="top"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">〰</span>ふたりのあいだの海</a><nav><a href="?online=1">海のゲーム ↗</a><button id="help-open" class="text-button">遊び方</button></nav></header>
<main class="workspace">
<section class="toolbar" aria-label="ゲーム操作"><div class="mode-group" aria-label="プレイモード"><button data-mode="parent" class="selected" aria-pressed="true">親</button><button data-mode="child" aria-pressed="false">子ども</button><button data-mode="cpu" aria-pressed="false">CPU</button></div><div class="status"><i id="phase-dot"></i><b id="phase">開始前</b><div class="oxygen" id="oxygen" role="meter" aria-label="残りの酸素" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span class="oxygen-bubbles" aria-hidden="true"><i></i><i></i><i></i></span><span class="oxygen-valve" aria-hidden="true"><i class="oxygen-knob"></i><i class="oxygen-neck"></i></span><span class="oxygen-body"><span class="oxygen-track"><span class="oxygen-fill" id="oxygen-fill"></span><span class="oxygen-ticks" aria-hidden="true"></span></span><span class="oxygen-band" aria-hidden="true"></span><span class="oxygen-band" aria-hidden="true"></span><strong id="timer">01:30</strong><span class="oxygen-label" aria-hidden="true">O₂</span></span></div></div><div class="run-controls"><button id="reset" class="secondary" aria-label="リセット">↺</button><button id="start" class="primary">スタート</button></div></section>
<p id="mode-description" class="hint"></p>
<div class="boards">
${['parent', 'child'].map(role => `<section class="board-card ${role}"><div class="board-heading"><h2>${role === 'parent' ? '親' : '子ども'} <span class="role-badge" id="badge-${role}"></span></h2><span class="score"><strong id="score-${role}">${role === 'parent' ? '100' : '0'}</strong><small id="detail-${role}">0 / 12</small></span></div><div class="board-surface"><canvas id="board-${role}" tabindex="0" aria-label="${role === 'parent' ? '親の迷路。マスの端をクリックして壁を設置' : '子どもの迷路。矢印キーで移動'}"></canvas></div></section>`).join('')}
</div>
<div class="interaction-panel"><div class="touch-controls"><div class="dpad"><button data-dir="3" aria-label="上">↑</button><button data-dir="2" aria-label="左">←</button><button data-dir="1" aria-label="下">↓</button><button data-dir="0" aria-label="右">→</button></div><button id="rotate" class="secondary">↻ <span id="direction">右</span></button><button id="place" class="primary">壁を置く</button></div><p id="control-hint" class="hint"></p></div>
<details class="settings-panel"><summary>設定</summary><form id="settings"><div class="fields">${fields.map(([key, label]) => `<label class="field">${label}${input(key, label)}</label>`).join('')}${ranges.map(([color, label, min, max]) => `<div class="field"><label for="${min}"><i class="legend-dot ${color}"></i>${label}</label><span>${input(min, label + ' 最小値').replace('type="number"', `id="${min}" type="number"`)}–${input(max, label + ' 最大値')}</span></div>`).join('')}</div><div class="form-actions"><button type="button" id="defaults" class="text-button">初期値</button><button class="primary" type="submit">適用</button></div></form></details>
</main>
<div id="notice" role="status"></div>
<dialog id="result"><h2>探検完了</h2><div class="result-scores"><div>親<strong id="final-parent"></strong></div><div>子ども<strong id="final-child"></strong></div></div><p id="final-stats"></p><div class="dialog-actions"><button id="close-result" class="secondary">閉じる</button><button id="again" class="primary">もう一度</button></div></dialog>
<dialog id="help"><h2>遊び方</h2><p>親は100点から。子どもがアイテムを取ると、隠れたリスク分だけ親の点が減り、子どもは報酬を得ます。</p><p>親は通路に壁を置けます。道がふさがると、子どもだけの秘密の通路が開きます。</p><p>矢印キー/WASDで操作。親はTabで向き、Spaceで設置。Escで一時停止。</p><button id="help-close" class="primary">OK</button></dialog>`;

const $ = id => document.getElementById(id);
let game = createMaze(), cursor = game.avatar, direction = 0, seed = 260830, keys = new Set(), last = 0, uiClock = 0, resultShown = false;
const keyDirection = { ArrowRight: 0, d: 0, ArrowDown: 1, s: 1, ArrowLeft: 2, a: 2, ArrowUp: 3, w: 3 };
const descriptions = { parent: '壁を置いて子どもCPUを導こう', child: 'アイテムを集めよう', cpu: 'CPU同士を観察' };
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
function reset(settings = game.settings, nextSeed = seed) { const mode = game.mode; game = createMaze(settings, nextSeed); game.mode = mode; seed = nextSeed; cursor = game.avatar; keys.clear(); resultShown = false; $('result').close(); update(); render(); }
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
  const oxygen = Math.max(0, Math.min(100, (game.settings.duration - game.time) / game.settings.duration * 100));
  $('oxygen-fill').style.width = `${oxygen}%`; $('oxygen').setAttribute('aria-valuenow', Math.round(oxygen)); $('oxygen').classList.toggle('low', oxygen <= 25); $('oxygen').classList.toggle('critical', oxygen <= 10); $('oxygen').classList.toggle('flowing', game.phase === 'playing');
  $('start').textContent = { ready: 'スタート', playing: '一時停止', paused: '再開', result: 'もう一度' }[game.phase];
  $('mode-description').textContent = descriptions[game.mode];
  $('start').disabled = network.active && (!network.connected || (game.phase !== 'playing' && (network.state?.ready && game.phase !== 'result' || network.state?.again && game.phase === 'result')));
  if (network.active) {
    $('mode-description').textContent = network.state.reason || '対戦中';
    if (['ready', 'paused'].includes(game.phase)) $('start').textContent = network.state.ready ? '相手を待機中' : '準備完了';
    if (game.phase === 'result') $('start').textContent = network.state.again ? '相手を待機中' : 'もう一度';
    $('again').disabled = network.state.again || !network.connected; $('again').textContent = network.state.again ? '相手を待機中' : 'もう一度';
  } else { $('again').disabled = false; $('again').textContent = 'もう一度'; }
  for (const role of ['parent', 'child']) { $('score-' + role).textContent = game[role + 'Score']; $('badge-' + role).textContent = game.mode === role ? 'あなた' : 'CPU'; }
  $('detail-parent').textContent = `${game.walls.size} / ${game.settings.wallLimit}`; $('detail-child').textContent = `${game.collected} / ${game.items.length}`;
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b.dataset.mode === game.mode); b.setAttribute('aria-pressed', b.dataset.mode === game.mode); });
  $('rotate').hidden = $('place').hidden = game.mode !== 'parent';
  document.querySelector('.dpad').hidden = game.mode === 'cpu';
  $('direction').textContent = ['右', '下', '左', '上'][direction];
  $('control-hint').textContent = game.mode === 'parent' ? 'マスの端をクリック、またはSpaceで壁を設置' : game.mode === 'child' ? '矢印/WASDで移動 · 点線は秘密の通路' : '';
  if (game.phase === 'result' && !resultShown) { resultShown = true; keys.clear(); $('final-parent').textContent = game.parentScore; $('final-child').textContent = game.childScore; $('final-stats').textContent = `${game.moves}マスの旅 · アイテム ${game.collected} · 壁 ${game.walls.size} · 秘密の通路 ${game.secrets.size}`; $('result').showModal(); }
}
function render() { for (const role of ['parent', 'child']) if (!network.active || game.mode === role) drawMaze($('board-' + role), game, role, cursor, direction); }
let networkClock = 0;
function frame(now) { const dt = last ? Math.min((now - last) / 1000, .1) : 0; last = now; const held = [...keys].at(-1); if (!network.active) tick(game, dt, held === undefined ? -1 : keyDirection[held]); else { networkClock += dt; if (networkClock >= .06) { networkClock = 0; if (held !== undefined && game.mode === 'child' && game.phase === 'playing') network.send({ type: 'move', direction: keyDirection[held] }); } } uiClock += dt; if (uiClock >= .08 || game.phase === 'result' && !resultShown) { update(); uiClock = 0; } render(); requestAnimationFrame(frame); }
update(); render(); requestAnimationFrame(frame);
