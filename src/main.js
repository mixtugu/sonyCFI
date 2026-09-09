import './style.css';
import { createRenderer } from './renderer.js';

const app = document.querySelector('#app');
app.innerHTML = `
<header><a href="/" class="brand"><b>≈</b><span>ふたりのあいだの海<small>BETWEEN TIDES</small></span></a><div class="header-right"><span id="connection" class="connection">接続しています…</span><button class="quiet" data-action="help">遊び方 ↗</button></div></header>
<main>
  <section id="lobby" class="lobby-grid">
    <div class="lobby-story"><p class="eyebrow">2人で遊ぶ、90秒の海。</p><h1>同じ海。<br><em>違う願い。</em></h1><p class="subtitle">子どもは泳ぐ。親は壁をつくる。<br>別々の画面から、同じ海へ。</p>
      <svg class="lobby-sea" viewBox="0 0 400 140" aria-hidden="true"><path d="M0 60 Q50 20 100 60 T200 60 T300 60 T400 60 V140H0Z" fill="#c9e9e5"/><path d="M0 91 Q50 55 100 91 T200 91 T300 91 T400 91 V140H0Z" fill="#88cdcf"/><path d="M0 122 Q50 88 100 122 T200 122 T300 122 T400 122 V140H0Z" fill="#42a6b2"/><g transform="translate(235 55)"><path d="M-12-4L-25-13V9L-12 3" fill="#247887"/><ellipse rx="17" ry="12" fill="#176477"/><ellipse cx="8" rx="6" ry="8" fill="#edf9f2"/></g><circle cx="320" cy="28" r="9" fill="#f2bb94"/></svg>
    </div>
    <div class="room-card"><h2>さあ、はじめよう。</h2><form id="create-form"><fieldset><legend>あなたの役割</legend><label><input type="radio" name="role" value="child" checked><span>✧ 子ども</span></label><label><input type="radio" name="role" value="parent"><span>◉ 親</span></label></fieldset><button class="primary wide" type="submit" id="create-button" disabled>部屋をつくる →</button></form><div class="or-divider">招待された方はこちら</div><form id="join-form"><label for="room-input">ルームコード</label><div class="join-row"><input id="room-input" name="code" maxlength="6" minlength="6" pattern="[A-Za-z2-9]{6}" autocomplete="off" autocapitalize="characters" placeholder="6文字のコード" required><button type="submit" class="primary" id="join-button" disabled>参加</button></div></form><p id="lobby-error" class="error" role="alert"></p></div>
  </section>
  <section id="play" hidden>
    <div class="heading"><div><p class="eyebrow" id="role-eyebrow"></p><h1 id="role-title"></h1></div><div class="room-pill"><small>ルーム</small><strong id="room-code"></strong><span id="partner-status"></span></div></div>
    <div class="play-grid"><div class="board-column"><section class="arena"><div class="arena-bar"><span><i></i><b id="phase-label">出航準備</b></span><div class="metrics"><span>残り <strong id="timer">01:30</strong></span><button class="quiet" id="pause" data-action="pause" disabled>Ⅱ ひと休み</button></div></div>
    <div class="canvas-wrap"><canvas id="sea" width="1200" height="720" tabindex="0" aria-label="二人で共有する海の地図"></canvas><div id="stage-overlay" class="stage-overlay"></div><div class="joystick" id="joystick" role="group" aria-label="移動用ジョイスティック"><span id="stick"></span><small id="joystick-label">移動</small></div><div class="wall-tools" id="wall-tools" hidden><button data-action="rotate" aria-label="壁の向きを変える">↻ <span id="orientation">縦の壁</span></button><button data-action="place" id="place-button">＋ 壁を置く</button></div></div>
    <div class="arena-footer"><div><span class="legend child-dot">探検家</span><span class="legend wall-dot">親の壁</span><span class="legend pearl-dot" id="private-legend"></span></div><span id="wall-count">壁 0 / 5</span></div></section>
    <div id="replay-controls" hidden><label class="replay-label">航海を巻き戻す <span id="replay-time"></span><input id="replay" type="range" min="0" value="0" aria-label="リプレイの時間"></label><p class="fine">スライダーを動かすと、その瞬間の位置と壁が地図に戻ります。</p></div>
    <details class="my-controls"><summary>操作ガイド</summary><p id="control-description"></p><small id="pad-status">ゲームパッドは接続後にボタンを押してください。</small></details></div>
    <aside class="private-panel"><div class="mission"><div><span class="eyebrow">あなたの目標</span><strong id="mission-objective"></strong></div><div class="mission-meter"><p id="mission-progress"></p><div class="progress-track"><span id="progress-bar"></span></div></div></div><details class="invite"><summary>招待・設定</summary><div class="invite-content"><label for="invite-link">招待リンク</label><input id="invite-link" readonly aria-label="招待リンク"><button class="primary wide" data-action="copy">リンクをコピー</button><p class="fine" id="invite-note"></p><p class="private-note">この目標は相手の画面には表示されません。</p><button class="quiet wide" data-action="leave">部屋を出る</button></div></details></aside></div>
    <section id="review" hidden></section>
  </section>
  <footer>BETWEEN TIDES <span>ふたつの画面、ひとつの海。</span></footer>
</main><div id="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>`;

const el = id => document.getElementById(id);
const canvas = el('sea'), draw = createRenderer(canvas);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let socket, ticket, state, retry, connected = false, busy = false, stopped = false, shareOrigin = location.origin;
let keys = new Set(), joy = { x: 0, y: 0 }, joyId = null, cursor = { x: 520, y: 360 }, vertical = true, drag = null, modal = false;
let last = 0, inputClock = 0, previousPad = {}, activePad = null, visualChild = null, replayIndex = -1, roundKey = '', overlayKey = '', reviewedRound = 0;
try { ticket = JSON.parse(sessionStorage.getItem('between-tides-session') || 'null'); } catch {}
const invitedCode = new URLSearchParams(location.search).get('room')?.toUpperCase();
if (invitedCode && /^[A-Z2-9]{6}$/.test(invitedCode)) el('room-input').value = invitedCode;
if (ticket && invitedCode && ticket.code !== invitedCode) ticket = null;

function persist() { try { if (ticket) sessionStorage.setItem('between-tides-session', JSON.stringify(ticket)); else sessionStorage.removeItem('between-tides-session'); } catch {} }
function send(message) { if (socket?.readyState === WebSocket.OPEN) { socket.send(JSON.stringify(message)); return true; } return false; }
function notify(text) { el('toast').textContent = text; el('toast').classList.add('visible'); clearTimeout(notify.timer); notify.timer = setTimeout(() => el('toast').classList.remove('visible'), 3500); }
function connectionUI() {
  el('connection').textContent = connected ? '● 海につながっています' : stopped ? '接続を終了しました' : '○ 再接続しています…';
  el('connection').classList.toggle('online', connected);
  el('create-button').disabled = el('join-button').disabled = !connected || busy;
}
function clearInputs() {
  keys.clear(); joy = { x: 0, y: 0 }; drag = null; joyId = null; previousPad = {};
  el('stick').style.transform = 'translate(0px,0px)';
  if (state?.role === 'child') send({ type: 'input', x: 0, y: 0 });
}
function canPlay() { return connected && state?.status === 'playing' && !modal; }
function connect() {
  clearTimeout(retry);
  const current = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/socket`); socket = current;
  current.onopen = () => { if (socket !== current) return; connected = true; busy = false; connectionUI(); if (ticket) send({ type: 'resume', ...ticket }); };
  current.onmessage = event => {
    if (socket !== current) return;
    const data = JSON.parse(event.data);
    if (data.type === 'session') {
      ticket = { code: data.code, token: data.token }; persist(); busy = false; el('lobby-error').textContent = ''; connectionUI();
      history.replaceState(null, '', `?room=${data.code}`);
    } else if (data.type === 'state') applyState(data);
    else if (data.type === 'left') goLobby();
    else if (data.type === 'error') {
      busy = false; connectionUI(); notify(data.message); el('lobby-error').textContent = data.message;
      if (['expired', 'missing'].includes(data.code) && ticket) { goLobby(); el('lobby-error').textContent = data.message; }
    }
  };
  current.onclose = event => {
    if (socket !== current) return;
    connected = false; busy = false; clearInputs();
    if (event.code === 4001) { stopped = true; ticket = null; persist(); notify('この参加情報は別の画面で開かれました。'); }
    connectionUI(); updateOverlay();
    if (!stopped) retry = setTimeout(connect, 1000);
  };
  current.onerror = () => { el('lobby-error').textContent = 'サーバーに接続できません。起動しているか、URLが正しいか確認してください。'; };
}
function goLobby() {
  clearInputs(); ticket = null; state = null; persist(); roundKey = ''; reviewedRound = 0; overlayKey = '';
  el('play').hidden = true; el('lobby').hidden = false; busy = false; history.replaceState(null, '', '/'); connectionUI();
}
function refreshInvite() {
  if (!ticket) return;
  el('invite-link').value = `${shareOrigin}/?room=${ticket.code}`;
  el('invite-note').textContent = shareOrigin !== location.origin ? '同じWi-Fiの別端末に、このリンクを送ってください。' : '相手のブラウザーでリンクを開くか、ルームコードを入力してください。';
}
fetch('/connection-info').then(r => r.ok ? r.json() : null).then(data => {
  if (['localhost', '127.0.0.1'].includes(location.hostname) && data?.lan?.[0]) shareOrigin = data.lan[0]; refreshInvite();
}).catch(() => {});

el('create-form').onsubmit = event => { event.preventDefault(); if (!connected || busy) return; busy = true; connectionUI(); send({ type: 'create', role: new FormData(event.target).get('role') }); };
el('join-form').onsubmit = event => { event.preventDefault(); if (!connected || busy) return; busy = true; connectionUI(); send({ type: 'join', code: el('room-input').value.trim().toUpperCase() }); };

function applyState(next) {
  const previous = state;
  state = next;
  if (previous?.status !== next.status || previous?.role !== next.role) { clearInputs(); overlayKey = ''; visualChild = { ...next.view.child }; }
  if (previous?.round !== next.round) { replayIndex = -1; reviewedRound = 0; cursor = { x: 520, y: 360 }; }
  el('lobby').hidden = true; el('play').hidden = false; app.dataset.role = next.role;
  const key = `${next.round}-${next.role}`;
  if (roundKey !== key) {
    roundKey = key;
    const child = next.role === 'child';
    el('role-eyebrow').textContent = child ? '子ども役 · 小さな探検家' : '親役 · 海の見守り手';
    el('role-title').textContent = child ? '自由に泳ごう。' : '壁で道をつくろう。';
    el('mission-objective').textContent = next.self.mission.objective;
    el('private-legend').textContent = child ? '真珠' : '静かな入り江';
    el('wall-tools').hidden = child;
    el('joystick-label').textContent = child ? '泳ぐ' : '壁の位置を選ぶ';
    el('joystick').setAttribute('aria-label', child ? '移動用ジョイスティック' : '壁の位置を選ぶジョイスティック');
    el('control-description').innerHTML = child ? '<kbd>WASD</kbd> / <kbd>矢印キー</kbd> / ジョイスティックで移動。壁は迂回するか、1.4秒押し続けると通れます。' : '<kbd>ドラッグ</kbd> で壁を描く。<kbd>WASD・矢印・IJKL</kbd> で位置を選び、<kbd>Space</kbd> で設置、<kbd>R</kbd> で回転。';
    refreshInvite();
  }
  el('room-code').textContent = next.code;
  el('partner-status').textContent = next.partner.connected ? '相手が接続中' : '相手を待っています';
  const remain = Math.max(0, 90 - Math.floor(next.view.time));
  el('timer').textContent = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;
  el('phase-label').textContent = ({ waiting: '出航準備', countdown: 'まもなく出航', playing: '航海中', paused: 'ひと休み', review: '航海の振り返り' })[next.status];
  el('pause').disabled = !connected || !['playing', 'countdown'].includes(next.status);
  el('wall-count').textContent = `壁 ${next.view.walls.length} / 5 · 12秒で消えます`;
  const progress = next.self.progress, target = next.self.mission.target;
  el('mission-progress').textContent = next.role === 'child' ? `真珠 ${progress} / ${target} 個` : `入り江にいた時間 ${progress.toFixed(1)} / ${target} 秒`;
  el('progress-bar').style.width = `${Math.min(100, progress / target * 100)}%`;
  el('replay-controls').hidden = next.status !== 'review'; el('joystick').hidden = next.status === 'review';
  document.querySelector('.private-note').textContent = next.status === 'review' ? '航海が終わったので、二人の目標を公開しました。' : 'この目標は相手の画面には表示されません。';
  el('wall-tools').hidden = next.role !== 'parent' || next.status === 'review';
  el('review').hidden = next.status !== 'review';
  updateOverlay();
  if (next.status === 'review') renderReview();
}
function updateOverlay() {
  if (!state) return;
  const key = JSON.stringify([connected, state.status, state.countdown, state.self.ready, state.partner.connected, state.partner.ready, state.reason]);
  if (overlayKey === key) return;
  overlayKey = key;
  const overlay = el('stage-overlay');
  overlay.hidden = connected && ['playing', 'review'].includes(state.status);
  if (overlay.hidden) { overlay.innerHTML = ''; return; }
  let html;
  if (!connected) html = '<p class="eyebrow">接続を確認しています</p><h2>波が、少し途切れました。</h2><p>同じ役割で自動的に再接続します。</p>';
  else if (state.status === 'countdown') html = `<p class="eyebrow">ふたりで、同時に。</p><strong class="countdown">${state.countdown}</strong><p>まもなく航海がはじまります。</p>`;
  else {
    const paused = state.status === 'paused';
    html = `<p class="eyebrow">${paused ? 'ひと休み' : '出航前の、小さな秘密'}</p><h2>${paused ? '海は、待っています。' : '自分の願いを確かめて。'}</h2>${!paused ? `<p class="stage-objective">${state.self.mission.objective}</p>` : ''}<p>${paused ? state.reason : state.partner.connected ? '二人が準備すると、航海がはじまります。' : 'ルームコードか招待リンクを<br>相手の端末に伝えてください。'}</p><button class="primary" data-action="ready" ${state.self.ready ? 'disabled' : ''}>${state.self.ready ? '相手の準備を待っています…' : paused ? '再開の準備ができました →' : '目標を読んだ · 準備できました →'}</button>${paused ? '<button class="quiet wide" data-action="finish">ここまでの航海を振り返る</button>' : ''}`;
  }
  overlay.innerHTML = `<div class="stage-card">${html}</div>`;
}
function renderReview() {
  const r = state.review;
  if (reviewedRound !== state.round) {
    reviewedRound = state.round;
    el('replay').max = Math.max(0, r.frames.length - 1); el('replay').value = el('replay').max; el('replay-time').textContent = `${state.view.time.toFixed(1)}秒`;
    el('review').innerHTML = `<div class="review-heading"><p class="eyebrow">ふたりの海を重ねてみる</p><h2>あなたの願いは、どこにありましたか。</h2><p>${state.reason} ここで初めて、相手の目標が見えます。</p></div><div class="results"><article><small>子どもの願い · ${r.escaped ? '達成' : '未達成'}</small><h3>${r.missions.child.title}</h3><p>${r.missions.child.objective}</p><p>真珠 ${r.found.length}個 · 光の門 ${r.escaped ? '到着' : '未到着'}</p></article><article><small>親の願い · ${r.safeTime >= 25 ? '達成' : '未達成'}</small><h3>${r.missions.parent.title}</h3><p>${r.missions.parent.objective}</p><p>入り江にいた時間 ${r.safeTime.toFixed(1)}秒</p></article><article><small>ふたりのあいだに残ったもの</small><h3>立ち止まる、乗り越える。</h3><p>壁の前で ${r.blockedTime.toFixed(1)}秒<br>壁を乗り越えた回数 ${r.breaks}回</p></article></div><div class="event-list">${r.logs.length ? r.logs.map(l => `<div><time>${l.time.toFixed(1)}s</time><span>${l.text}</span></div>`).join('') : '<p>まだ記録はありません。</p>'}</div><blockquote>「私がつくった壁は、あなたにはどう見えた？」</blockquote><p class="fine">上の地図を巻き戻しながら、迷った瞬間をひとつずつ話してみてください。</p><button class="primary" data-action="swap" id="swap-button">役割を交代して、もう一度 ⇄</button><p class="fine" id="swap-status"></p>`;
  }
  el('swap-button').disabled = state.self.swap || !state.partner.connected;
  el('swap-status').textContent = state.self.swap ? '相手も同意すると、役割を交代します。' : state.partner.swap ? '相手が役割交代を希望しています。' : '二人とも選ぶと、新しい役割ではじまります。';
}
el('replay').oninput = event => { replayIndex = Number(event.target.value); const f = state.review.frames[replayIndex]; el('replay-time').textContent = `${f?.time.toFixed(1) || 0}秒`; };

function help() {
  if (canPlay() || state?.status === 'countdown') send({ type: 'pause' }); clearInputs(); modal = true;
  el('modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="遊び方"><p class="eyebrow">ふたつの画面、ひとつの海</p><h2>泳ぐ人と、<br>道を変える人。</h2><ol><li>一人が部屋をつくり、もう一人が別の端末でコードまたは招待リンクから参加します。</li><li>それぞれの画面で、自分だけの目標を読みます。二人が「準備できました」を押すと開始します。</li><li>子どもはジョイスティック・WASD・矢印キーで泳ぎます。親はドラッグで壁を置きます。</li><li>各端末のゲームパッド1台を使用できます。左スティックで移動／照準。親はA・×で壁を置き、X・□で回転します。</li><li>壁は最大5つ、12秒間。子どもは迂回するか、1.4秒押し続けると乗り越えられます。</li><li>90秒後に相手の目標と航海の記録を公開します。役割を交代して、もう一度。</li></ol><p class="fine">接続が切れると一時停止します。再接続後は二人の準備で再開します。別のWi-Fiから遊ぶには、公開サーバーへの配置が必要です。</p><button class="primary" data-action="close-help">わかりました →</button></section></div>`;
  el('modal-root').querySelector('button').focus();
}
document.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (['ready', 'pause', 'finish', 'swap'].includes(action)) { clearInputs(); send({ type: action }); }
  if (action === 'leave') send({ type: 'leave' });
  if (action === 'rotate') rotate();
  if (action === 'place') placeCursor();
  if (action === 'help') help();
  if (action === 'close-help') { modal = false; el('modal-root').innerHTML = ''; }
  if (action === 'copy') {
    try { await navigator.clipboard.writeText(el('invite-link').value); notify('招待リンクをコピーしました。'); }
    catch { el('invite-link').focus(); el('invite-link').select(); notify('リンクを選択しました。長押しかコピー操作で相手に送ってください。'); }
  }
});
function rotate() { vertical = !vertical; el('orientation').textContent = vertical ? '縦の壁' : '横の壁'; }
function place(a, b) { if (canPlay() && state.role === 'parent') send({ type: 'wall', a, b }); }
function placeCursor() { place({ x: cursor.x - (vertical ? 0 : 70), y: cursor.y - (vertical ? 70 : 0) }, { x: cursor.x + (vertical ? 0 : 70), y: cursor.y + (vertical ? 70 : 0) }); }
function point(event) { const b = canvas.getBoundingClientRect(); return { x: (event.clientX - b.left) / b.width * 1200, y: (event.clientY - b.top) / b.height * 720 }; }
canvas.onpointerdown = event => { if (!canPlay() || state.role !== 'parent' || drag) return; event.preventDefault(); canvas.setPointerCapture(event.pointerId); cursor = point(event); drag = { id: event.pointerId, a: { ...cursor }, b: { ...cursor } }; };
canvas.onpointermove = event => { if (!canPlay() || state.role !== 'parent') return; if (drag?.id === event.pointerId) { drag.b = point(event); cursor = { ...drag.b }; } else if (!drag && event.pointerType === 'mouse') cursor = point(event); };
canvas.onpointerup = event => { if (drag?.id !== event.pointerId) return; const { a, b } = drag; drag = null; if (Math.hypot(a.x - b.x, a.y - b.y) < 20) placeCursor(); else place(a, b); };
canvas.onpointercancel = () => { drag = null; };
const joystick = el('joystick');
function moveJoy(event) { const b = joystick.getBoundingClientRect(); const x = (event.clientX - b.left - b.width / 2) / 35, y = (event.clientY - b.top - b.height / 2) / 35, n = Math.max(1, Math.hypot(x, y)); joy = { x: x / n, y: y / n }; el('stick').style.transform = `translate(${joy.x * 28}px,${joy.y * 28}px)`; }
joystick.onpointerdown = event => { if (!canPlay() || joyId !== null) return; joyId = event.pointerId; joystick.setPointerCapture(event.pointerId); moveJoy(event); };
joystick.onpointermove = event => { if (joyId === event.pointerId) moveJoy(event); };
joystick.onpointerup = joystick.onpointercancel = event => { if (joyId !== event.pointerId) return; joyId = null; joy = { x: 0, y: 0 }; el('stick').style.transform = 'translate(0px,0px)'; };
const controlKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'Space', 'KeyR'];
window.addEventListener('keydown', event => {
  if (modal) { if (event.code === 'Escape') { modal = false; el('modal-root').innerHTML = ''; } if (event.key === 'Tab') { event.preventDefault(); el('modal-root').querySelector('button')?.focus(); } return; }
  if (event.code === 'Escape' && state?.status === 'playing') { clearInputs(); send({ type: 'pause' }); return; }
  if (!canPlay() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (controlKeys.includes(event.code)) event.preventDefault(); keys.add(event.code);
  if (state.role === 'parent' && !event.repeat) { if (event.code === 'Space') placeCursor(); if (event.code === 'KeyR') rotate(); }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', clearInputs);
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInputs(); if (state?.status === 'playing' || state?.status === 'countdown') send({ type: 'pause' }); } });
window.addEventListener('gamepaddisconnected', () => { activePad = null; clearInputs(); if (canPlay()) send({ type: 'pause' }); });
function readPad() {
  let pads = []; try { pads = [...(navigator.getGamepads?.() || [])].filter(Boolean); } catch {}
  if (!pads.some(p => p.index === activePad)) activePad = pads[0]?.index ?? null;
  const p = pads.find(p => p.index === activePad);
  const axis = index => { const v = p?.axes[index] || 0; return Math.abs(v) < .16 ? 0 : Math.sign(v) * (Math.abs(v) - .16) / .84; };
  return { x: axis(0), y: axis(1), build: !!p?.buttons[0]?.pressed, rotate: !!p?.buttons[2]?.pressed, connected: !!p };
}
let padText = '';
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
  const pad = readPad();
  if (canPlay()) {
    const k = (...codes) => codes.some(c => keys.has(c)) ? 1 : 0;
    let x = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft') + joy.x + pad.x;
    let y = k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp') + joy.y + pad.y;
    if (state.role === 'parent') {
      x += k('KeyL') - k('KeyJ'); y += k('KeyK') - k('KeyI');
      const n = Math.max(1, Math.hypot(x, y)); cursor.x = clamp(cursor.x + x / n * 360 * dt, 25, 1175); cursor.y = clamp(cursor.y + y / n * 360 * dt, 25, 695);
      if (pad.build && !previousPad.build) placeCursor(); if (pad.rotate && !previousPad.rotate) rotate();
    } else {
      inputClock += dt;
      if (inputClock >= 1 / 30) { inputClock = 0; const n = Math.max(1, Math.hypot(x, y)); send({ type: 'input', x: x / n, y: y / n }); }
    }
  }
  previousPad = pad;
  const text = pad.connected ? 'ゲームパッド接続済み · 左スティックを動かしてください。' : !window.isSecureContext ? 'この接続ではキーボード・タッチを使えます。ゲームパッドにはHTTPS接続が必要です。' : 'キーボード・タッチ対応 · ゲームパッドは接続後にボタンを押してください。';
  if (padText !== text) { padText = text; el('pad-status').textContent = text; }
  if (state) {
    let view = state.view;
    const replay = state.status === 'review';
    if (replay && replayIndex >= 0 && state.review.frames[replayIndex]) view = { ...view, ...state.review.frames[replayIndex] };
    if (!visualChild || replay) visualChild = { ...view.child };
    else { const alpha = 1 - Math.exp(-22 * dt); visualChild.x += (view.child.x - visualChild.x) * alpha; visualChild.y += (view.child.y - visualChild.y) * alpha; visualChild.angle = view.child.angle; }
    draw(view, { role: state.role, cursor, vertical, drag, active: canPlay(), replay, frames: state.review?.frames || [], visualChild }, state.status === 'playing' ? now / 1000 : view.time);
  }
  requestAnimationFrame(frame);
}
connectionUI(); connect(); requestAnimationFrame(frame);
