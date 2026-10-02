import { drawMaze } from './maze-renderer.js';
import { edge } from './maze.js';

// The pre-round briefing: three short steps per role, each a title, one line of description and one
// line of controls. The first steps carry a 5×4 practice board to try the controls on.
const GUIDES = {
  parent: [
    { title: '壁を立てて子どもを守る', symbol: '親', tag: 'PARENT',
      description: () => '矢印キーで壁の位置を選択。Tabで向きを選び、Spaceで壁を設置して、子どもが危ないアイテムへ進む道をふさぎます。',
      controls: () => '<kbd data-practice-key="Arrow">矢印キー</kbd>で位置を選択 · <kbd data-practice-key="Tab" role="button" tabindex="0">Tab</kbd> で向き · <kbd data-practice-key="Space" role="button" tabindex="0">Space</kbd> で設置' },
    { title: '壁も接触も親の点を下げる', symbol: '!', tag: 'PARENT SCORE',
      description: s => `壁を立てるたびに親の点が${s.wallCost}点減ります。子どもがアイテムに触れた場合も、そのアイテムの危険度に応じて親の点が下がります。`,
      controls: s => `壁の設置: 親 −${s.wallCost} · アイテムとの接触: 危険度分減点` },
    { title: '制限時間内に親の点を守る', symbol: 'O₂', tag: 'TIME LIMIT',
      description: s => `酸素ボンベの残量が制限時間（${s.duration}秒）です。時間内に危ないアイテムとの接触を抑え、親の点を保ちましょう。`,
      controls: () => '残り時間は上の酸素ボンベで確認' },
  ],
  child: [
    { title: '移動してアイテムを探し、報酬を獲得', symbol: '子', tag: 'CHILD',
      description: () => '矢印キーを押すと子どもが隣のマスへ1歩移動します。アイテムに触れると報酬を獲得します。',
      controls: () => '<kbd data-practice-key="Arrow">矢印キー</kbd>で子どもを操縦 · マスをタップしても移動' },
    { title: '壁を避け、秘密の通路を通り抜ける', symbol: '↗', tag: 'SECRET PASSAGE',
      description: () => 'ふつうの壁の先へは進めません。点線の「秘密の通路」は子どもだけが通り抜けできます。',
      controls: () => '<kbd data-practice-key="Arrow">矢印キー</kbd>で子どもを操縦 · マスをタップしても移動' },
    { title: '酸素が尽きる前に探す', symbol: 'O₂', tag: 'TIME LIMIT',
      description: s => `酸素ボンベが空になると探検終了です（${s.duration}秒）。残量を見ながら、制限時間内にできるだけ多くの報酬を集めましょう。`,
      controls: () => '残り時間は上の酸素ボンベで確認' },
  ],
};
// Compass order, as on the practice board: north, east, south, west.
const DIRECTIONS = [
  { dx: 0, dy: -1, name: '北', key: 'up' }, { dx: 1, dy: 0, name: '東', key: 'right' },
  { dx: 0, dy: 1, name: '南', key: 'down' }, { dx: -1, dy: 0, name: '西', key: 'left' },
];
const KEY_DIRECTION = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
const COLS = 5, ROWS = 4;
const edgeKey = (ax, ay, bx, by) => { const a = `${ax},${ay}`, b = `${bx},${by}`; return a < b ? `${a}|${b}` : `${b}|${a}`; };
const inBounds = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const coordinate = (x, y) => `${String.fromCharCode(65 + x)}-${String(ROWS - y).padStart(2, '0')}`;
const FIXED_WALLS = [edgeKey(1, 1, 2, 1), edgeKey(3, 1, 3, 2)];
const PASSAGES = [edgeKey(1, 1, 2, 1)];

export function createTutorial(container, { onStep, onFinish, onClose } = {}) {
  container.innerHTML = `
<div class="briefing-top"><span class="briefing-kicker"></span><button type="button" class="secondary briefing-close">閉じる <kbd>Esc</kbd></button></div>
<div class="briefing-progress" aria-label="チュートリアル進行状況"><span></span><span></span><span></span></div>
<div class="briefing-layout">
<div class="briefing-art" tabindex="-1">
<div class="briefing-art-heading"><span class="briefing-art-tag"></span><span class="briefing-example">練習</span></div>
<div class="briefing-maze"><canvas class="briefing-canvas" aria-hidden="true"></canvas><div class="briefing-board" role="grid" aria-label="練習用の迷路"></div></div>
<div class="briefing-oxygen oxygen" hidden><span class="oxygen-valve" aria-hidden="true"><i class="oxygen-knob"></i><i class="oxygen-neck"></i></span><span class="oxygen-body"><span class="oxygen-track"><span class="oxygen-fill"></span><span class="oxygen-ticks"></span></span><span class="oxygen-band"></span><span class="oxygen-band"></span><strong></strong><span class="oxygen-label">O₂</span></span></div>
<div class="practice-feedback" role="status" aria-live="polite"></div></div>
<div class="briefing-copy"><div class="briefing-count"></div><h3 class="briefing-title"></h3><p class="briefing-description"></p><div class="briefing-controls"></div></div>
</div>
<div class="briefing-footer"><button type="button" class="secondary briefing-previous">戻る</button><div class="briefing-nav"><button type="button" class="secondary briefing-next">次へ</button><button type="button" class="primary briefing-launch" hidden>確認して待機へ</button></div></div>`;
  const find = selector => container.querySelector(selector);
  const art = find('.briefing-art'), board = find('.briefing-board'), feedback = find('.practice-feedback'), controls = find('.briefing-controls'), layout = find('.briefing-layout');
  let running = false, role = 'parent', settings = {}, step = 0, keyTimer = 0, shownStep = -1, loop = 0, painted = 0;
  const practice = { cursor: { x: 2, y: 2 }, direction: 1, child: { x: 0, y: 3 }, placed: new Set(), fixed: new Set(FIXED_WALLS), passages: new Set(PASSAGES), feedback: '' };

  const parent = () => role === 'parent';
  const steps = () => GUIDES[parent() ? 'parent' : 'child'];
  const last = () => step === steps().length - 1;
  const cursorStep = () => parent() && step === 0;
  const moveStep = () => !parent() && step < 2;
  const passageOpen = () => !parent() && step === 1;

  function start(nextRole, nextSettings) {
    role = nextRole === 'parent' ? 'parent' : 'child'; settings = nextSettings; step = 0; running = true;
    practice.cursor = { x: 2, y: 2 }; practice.direction = 1; practice.child = { x: 0, y: 3 }; practice.placed.clear();
    practice.feedback = parent() ? '矢印キーでカーソルを動かしてみましょう' : '矢印キーで子どもを1マス動かしてみましょう';
    shownStep = -1;
    update();
    // Keys go to the practice board rather than to whichever button the dialog focused first.
    art.focus({ preventScroll: true });
    cancelAnimationFrame(loop); loop = requestAnimationFrame(tick);
  }
  // Water on the practice board keeps moving while the briefing is on screen.
  function tick(now) {
    loop = 0;
    if (!running) return;
    if (now - painted > 33 && container.offsetParent !== null) { painted = now; paint(); }
    loop = requestAnimationFrame(tick);
  }
  function stop() { running = false; }
  function close() { if (!running) return; running = false; onClose?.(); }
  function go(next) {
    if (!running) return;
    const target = Math.max(0, Math.min(steps().length - 1, next));
    if (target === step) return;
    step = target;
    if (moveStep()) { practice.child = { x: 0, y: 3 }; practice.feedback = step === 1 ? '点線の通路の向こうへ進んでみましょう' : '矢印キーで子どもを1マス動かしてみましょう'; }
    update();
  }
  function setKicker(text) { find('.briefing-kicker').textContent = text; }

  function update() {
    if (!running) return;
    const guide = steps()[step];
    find('.briefing-title').textContent = guide.title;
    find('.briefing-description').textContent = guide.description(settings);
    controls.innerHTML = guide.controls(settings);
    find('.briefing-count').textContent = `${String(step + 1).padStart(2, '0')} / ${String(steps().length).padStart(2, '0')}`;
    art.dataset.step = step;
    find('.briefing-art-tag').textContent = guide.tag;
    container.querySelectorAll('.briefing-progress span').forEach((bar, i) => { bar.classList.toggle('is-active', i === step); bar.classList.toggle('is-done', i < step); });
    find('.briefing-previous').disabled = step === 0;
    find('.briefing-next').hidden = last();
    find('.briefing-launch').hidden = !last();
    if (shownStep !== step) {
      layout.dataset.dir = step < shownStep ? 'prev' : 'next';
      layout.classList.remove('is-entering'); void layout.offsetWidth; layout.classList.add('is-entering');
      shownStep = step;
    }
    onStep?.(step, last());
    drawBoard();
  }

  function blocked(x, y, nx, ny) {
    const e = edgeKey(x, y, nx, ny);
    if (passageOpen() && practice.passages.has(e)) return false;
    return practice.fixed.has(e) || practice.placed.has(e);
  }
  // Share the round renderer, including its role-specific symbols and colors.
  function paint() {
    const scoreExample = parent() && step === 1;
    const avatar = practice.child.y * COLS + practice.child.x;
    const convertEdges = edges => new Set([...edges].map(value => {
      const [a, b] = value.split('|').map(point => {
        const [x, y] = point.split(',').map(Number);
        return y * COLS + x;
      });
      return edge(a, b);
    }));
    const walls = convertEdges(practice.placed);
    if (scoreExample) walls.add(edge(12, 13));
    drawMaze(find('.briefing-canvas'), {
      settings: { ...settings, cols: COLS, rows: ROWS, wallLimit: 20 },
      mode: role, phase: cursorStep() ? 'playing' : 'result',
      avatar: scoreExample ? 6 : avatar, goal: COLS - 1,
      trail: scoreExample ? [15, 10, 5, 6] : [avatar],
      base: convertEdges(practice.fixed), walls,
      secrets: passageOpen() ? convertEdges(practice.passages) : new Set(),
      items: [
        { cell: 7, category: 'red', risk: settings.redMin, taken: scoreExample },
        { cell: 3, category: 'yellow', taken: false },
        { cell: 13, category: 'green', taken: false },
      ],
    }, role, practice.cursor.y * COLS + practice.cursor.x, (practice.direction + 3) % 4, { ambient: performance.now() / 1000 });
  }
  function drawBoard() {
    const interactive = cursorStep() || moveStep();
    const scoreExample = parent() && step === 1;
    paint();
    board.classList.toggle('is-visible', interactive);
    find('.briefing-example').textContent = interactive ? '練習' : '表示例';
    const oxygen = find('.briefing-oxygen');
    oxygen.hidden = step !== 2;
    oxygen.querySelector('strong').textContent = String(Math.floor(settings.duration / 60)).padStart(2, '0') + ':' + String(settings.duration % 60).padStart(2, '0');
    feedback.textContent = interactive ? practice.feedback : scoreExample ? '壁 −' + settings.wallCost + ' · アイテム −' + settings.redMin : '残り時間 · O₂';
    board.replaceChildren();
    if (!interactive) return;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const cell = document.createElement('div');
      cell.className = 'practice-cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', coordinate(x, y));
      cell.dataset.x = x; cell.dataset.y = y;
      board.append(cell);
    }
  }

  function moveCursor(direction) {
    practice.cursor.x = Math.max(0, Math.min(COLS - 1, practice.cursor.x + direction.dx));
    practice.cursor.y = Math.max(0, Math.min(ROWS - 1, practice.cursor.y + direction.dy));
    practice.feedback = `選択: ${coordinate(practice.cursor.x, practice.cursor.y)}`;
    drawBoard();
  }
  function moveChild(direction) {
    const { x, y } = practice.child, nx = x + direction.dx, ny = y + direction.dy;
    if (!inBounds(nx, ny)) practice.feedback = '迷路の端です。別の矢印を押してください';
    else if (blocked(x, y, nx, ny)) practice.feedback = '壁で停止。別の方向へ進んでください';
    else {
      practice.child = { x: nx, y: ny };
      practice.feedback = passageOpen() && practice.passages.has(edgeKey(x, y, nx, ny)) ? '秘密の通路を通り抜けました' : `子どもが ${coordinate(nx, ny)} へ移動`;
    }
    drawBoard();
  }
  function rotate() {
    practice.direction = (practice.direction + 1) % DIRECTIONS.length;
    practice.feedback = `設置方向: ${DIRECTIONS[practice.direction].name}`;
    drawBoard();
  }
  function placeWall() {
    const direction = DIRECTIONS[practice.direction], { x, y } = practice.cursor, nx = x + direction.dx, ny = y + direction.dy;
    if (!inBounds(nx, ny)) practice.feedback = '迷路の外には壁を立てられません';
    else {
      const e = edgeKey(x, y, nx, ny);
      if (practice.fixed.has(e)) practice.feedback = '既存の壁です。黄色い辺を選んでください';
      else if (practice.placed.has(e)) practice.feedback = 'そこにはすでに壁があります';
      else { practice.placed.add(e); practice.feedback = `${direction.name}側に壁を設置しました`; }
    }
    drawBoard();
  }
  function highlight(key) {
    controls.querySelectorAll('kbd[data-practice-key]').forEach(kbd => kbd.classList.toggle('is-pressed', kbd.dataset.practiceKey === key));
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => controls.querySelectorAll('kbd.is-pressed').forEach(kbd => kbd.classList.remove('is-pressed')), 180);
  }
  function arrow(index) {
    highlight('Arrow');
    if (cursorStep()) moveCursor(DIRECTIONS[index]); else moveChild(DIRECTIONS[index]);
  }

  function key(event) {
    if (!running) return;
    const index = KEY_DIRECTION[event.key];
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if ((cursorStep() || moveStep()) && index !== undefined) { event.preventDefault(); arrow(index); }
    else if (cursorStep() && event.key === 'Tab') { event.preventDefault(); highlight('Tab'); rotate(); }
    else if (cursorStep() && event.code === 'Space') { event.preventDefault(); highlight('Space'); if (!event.repeat) placeWall(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(step - 1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); go(step + 1); }
    else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON' && !event.repeat) { event.preventDefault(); if (last()) onFinish?.(); else go(step + 1); }
  }
  // The pad mirrors the round: stick or d-pad moves, ○ turns the wall, × places it.
  function pad(input, pressed) {
    if (!running) return;
    // The game's directions run right, down, left, up; the board's run north, east, south, west.
    if (input.step >= 0 && (cursorStep() || moveStep())) arrow((input.step + 1) % 4);
    if (cursorStep() && pressed('circle')) { highlight('Tab'); rotate(); }
    if (cursorStep() && pressed('cross')) { highlight('Space'); placeWall(); }
  }

  // Touch: tap a cell to put the cursor there, or to step the child toward it; the key hints are tappable.
  board.onclick = event => {
    const cell = event.target.closest('.practice-cell');
    if (!cell) return;
    const x = +cell.dataset.x, y = +cell.dataset.y;
    if (cursorStep()) { practice.cursor = { x, y }; practice.feedback = `選択: ${coordinate(x, y)}`; drawBoard(); return; }
    const index = DIRECTIONS.findIndex(d => practice.child.x + d.dx === x && practice.child.y + d.dy === y);
    if (moveStep() && index >= 0) arrow(index);
  };
  controls.onclick = event => {
    const kbd = event.target.closest('kbd[data-practice-key]');
    if (!kbd || !cursorStep()) return;
    if (kbd.dataset.practiceKey === 'Tab') { highlight('Tab'); rotate(); }
    if (kbd.dataset.practiceKey === 'Space') { highlight('Space'); placeWall(); }
  };
  find('.briefing-close').onclick = close;
  find('.briefing-previous').onclick = () => go(step - 1);
  find('.briefing-next').onclick = () => go(step + 1);
  find('.briefing-launch').onclick = () => onFinish?.();
  return { start, stop, key, pad, setKicker, next: () => go(step + 1),
    get step() { return step; }, get last() { return last(); }, get running() { return running; } };
}
