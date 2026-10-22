import { drawMaze, resetMazeScene } from './maze-renderer.js';
import { edge, DEFAULTS, WALL_DAMAGE } from './maze.js';
import { HP_MAX, applyDamage, creature } from './creatures.js';
import { hearts, zukan } from './encyclopedia-ui.js';
import { controllerDiagram, padIcon, petalIcon } from './controller-guide.js';
import oceanTitle from './assets/you-see-i-see.png';
import { createSoundObserver } from './sound-effects.js';
import { FISH_ICON_PATH } from './fish-icon.js';

// The pre-round briefing: short steps per role (the navigator's run danger → first wall → walls → time;
// the explorer's explore → detour → collection), each a title, one line of description and one line
// of controls. Steps are told apart by `kind`, not by position. The practice boards are 5×4, except
// the navigator's first wall lesson on an empty 7×4 board.
const PLACE_CONTROLS = () => '<kbd data-practice-key="Arrow">矢印キー</kbd>で位置を選択 · <kbd data-practice-key="Tab" role="button" tabindex="0">Tab</kbd> で向き · <kbd data-practice-key="Space" role="button" tabindex="0">Space</kbd> で設置';
const GUIDES = {
  parent: [
    { kind: 'risk', title: '海の中には危険がたくさん', symbol: '!', tag: 'RISK',
      description: () => 'エクスプローラーが自由に海を探索しているよ。\n魚に会うと💛が減っちゃうんだって。\n{danger-fish}は💛が多く減る可能性が高いみたい…',
      controls: () => '' },
    { kind: 'basics', title: '壁を立ててみよう！', symbol: '壁', tag: 'WALL',
      description: () => 'カーソルを■のマスへ動かして、\n上向きに壁を立ててみよう。',
      controls: PLACE_CONTROLS },
    { kind: 'wall', title: 'エクスプローラーを守ろう', symbol: 'ナ', tag: 'NAVIGATOR',
      description: () => `ナビゲーターは壁を立てられるよ。\n壁でエクスプローラーを危険な魚から守ってあげよう。\nでも、壁を立てると💛が${WALL_DAMAGE}つ減っちゃうみたい…`,
      controls: PLACE_CONTROLS },
    { kind: 'timed', title: '時間内に守ってあげよう', symbol: 'O₂', tag: 'TIME LIMIT',
      description: () => '制限時間は30秒だよ。\n💛がゼロにならないように壁を立てて、\nエクスプローラーを危険な魚から守ろう。',
      controls: () => '' },
  ],
  child: [
    { kind: 'explore', title: '魚探しに出かけよう', symbol: 'エ', tag: 'EXPLORER',
      description: () => 'ジョイスティックの向きに合わせて\nエクスプローラーを動かせるよ。\n大きい魚ほど、レアな生き物に出会えるかも…！',
      controls: () => '<kbd data-practice-key="Arrow">矢印キー</kbd>で移動' },
    { kind: 'detour', title: '新しい道を冒険しよう', symbol: '↗', tag: 'SECRET PASSAGE',
      description: () => '途中で壁が現れて進むのをじゃましてくるよ。\nでも、大丈夫。代わりに新しい道が出来るみたい！',
      controls: () => '<kbd data-practice-key="Arrow">矢印キー</kbd>で移動' },
    { kind: 'collection', title: '時間内に魚をたくさん集めよう', symbol: 'O₂', tag: 'TIME LIMIT',
      description: () => '制限時間は30秒だよ。\n出会った魚は図鑑に登録されるよ。\nできるだけレアな魚を集めよう！',
      controls: () => '' },
  ],
};
// Compass order, as on the practice board: north, east, south, west.
const DIRECTIONS = [
  { dx: 0, dy: -1, name: '北', key: 'up' }, { dx: 1, dy: 0, name: '東', key: 'right' },
  { dx: 0, dy: 1, name: '南', key: 'down' }, { dx: -1, dy: 0, name: '西', key: 'left' },
];
const KEY_DIRECTION = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
const COLS = 5, ROWS = 4;
// The navigator's first wall lesson: an empty 7×4 board. The cursor starts at column 2, row 3 facing
// right; the lesson is to move it to column 6, row 2 and close its top side (1-based, from the top left).
const BASIC_COLS = 7, BASIC_START = { x: 1, y: 2 }, BASIC_TARGET = { x: 5, y: 1 };
const cursorIcon = '<svg class="cursor-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H4v4M16 3h4v4M20 16v4h-4M8 20H4v-4"/></svg>';
function setGuideDescription(element, description) {
  const fragments = description.split('{danger-fish}');
  element.replaceChildren();
  fragments.forEach((fragment, index) => {
    element.append(document.createTextNode(fragment));
    if (index === fragments.length - 1) return;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'briefing-danger-fish');
    icon.setAttribute('viewBox', '-10 -8 20 16');
    icon.setAttribute('aria-label', '高危険度の魚');
    icon.setAttribute('role', 'img');
    const fish = document.createElementNS(icon.namespaceURI, 'path');
    fish.setAttribute('d', FISH_ICON_PATH);
    fish.setAttribute('fill', '#e83b43');
    fish.setAttribute('stroke', '#ffaaa5');
    fish.setAttribute('stroke-width', '.7');
    const mark = document.createElementNS(icon.namespaceURI, 'text');
    mark.setAttribute('x', '0');
    mark.setAttribute('y', '0');
    mark.setAttribute('fill', '#fff');
    mark.setAttribute('font-size', '7');
    mark.setAttribute('font-weight', '900');
    mark.setAttribute('text-anchor', 'middle');
    mark.setAttribute('dominant-baseline', 'central');
    mark.textContent = '!';
    icon.append(fish, mark);
    element.append(icon);
  });
}
const edgeKey = (ax, ay, bx, by) => { const a = `${ax},${ay}`, b = `${bx},${by}`; return a < b ? `${a}|${b}` : `${b}|${a}`; };
const inBounds = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const coordinate = (x, y) => `${String.fromCharCode(65 + x)}-${String(ROWS - y).padStart(2, '0')}`;
const BOARD_WIDTH = COLS * 36 + 28;
const DEMO_ROUTE = [15, 10, 5, 0, 1, 6, 7, 2, 3, 8, 13, 14, 9, 4];
const EXPLORER_ROUTE = DEMO_ROUTE.slice(0, DEMO_ROUTE.indexOf(14) + 1);
const EXPLORER_DETOUR = [...DEMO_ROUTE.slice(0, DEMO_ROUTE.indexOf(2) + 1), 7, 12, 17, 18];
const DEMO_FISH = [
  { cell: 7, size: 'small', creature: 'clownfish', maxRisk: 1, risk: 1, damage: 1 },
  { cell: 3, size: 'medium', creature: 'octopus', maxRisk: 2, risk: 2, damage: 2 },
  { cell: 13, size: 'large', creature: 'shark', maxRisk: 3, risk: 3, damage: 4 },
  { cell: 17, size: 'medium', creature: 'octopus', maxRisk: 2, risk: 2, damage: 2 },
];
// With the wall up, the explorer detours to the fish on the bottom row (there is no goal any more).
const DETOUR_FISH = 17;
const DEMO_STEPS = [];
let arrival = 1;
for (const cell of DEMO_ROUTE) {
  DEMO_STEPS.push({ cell, at: arrival });
  arrival += .7 + (DEMO_FISH.some(fish => fish.cell === cell) ? 1.6 : 0);
}
const DEMO_DURATION = DEMO_STEPS.at(-1).at + 3;
const DEMO_WALLS = new Set();
for (let cell = 0; cell < COLS * ROWS; cell++) for (const next of [cell % COLS < COLS - 1 ? cell + 1 : -1, cell + COLS < COLS * ROWS ? cell + COLS : -1]) {
  if (next >= 0 && !DEMO_ROUTE.some((point, i) => i > 0 && edge(DEMO_ROUTE[i - 1], point) === edge(cell, next))) DEMO_WALLS.add(edge(cell, next));
}
// Branches connect the remaining cells without creating a shortcut past the fish.
for (const [a, b] of [[10, 11], [11, 12], [12, 17], [17, 16], [17, 18], [18, 19]]) DEMO_WALLS.delete(edge(a, b));
DEMO_WALLS.delete(edge(14, 19));

export function createTutorial(container, { onStep, onFinish, onClose, onSound } = {}) {
  container.innerHTML = `
<div class="briefing-top"><div class="briefing-count"></div><span class="briefing-kicker" hidden></span><span class="briefing-practice-notice" hidden>実際に操作してみてね</span><img class="briefing-logo" src="${oceanTitle}" alt="YOU SEE / I SEE"></div>
<div class="briefing-progress" aria-label="チュートリアル進行状況"><span></span><span></span><span></span></div>
<div class="briefing-layout">
<div class="briefing-art" tabindex="-1">
<div class="briefing-art-heading"><span class="briefing-art-tag"></span><span class="briefing-example">練習</span></div>
<div class="briefing-maze"><canvas class="briefing-canvas" aria-hidden="true"></canvas><div class="briefing-board" role="grid" aria-label="練習用の迷路"></div><div class="briefing-wall-bubble" hidden>壁が現れた！</div><div class="demo-badge" hidden><i aria-hidden="true"></i>説明動画</div></div>
<div class="briefing-hp hp-panel" hidden><span class="hp-label">HP</span><div class="hp-hearts" role="meter" aria-label="エクスプローラーのHP" aria-valuemin="1" aria-valuemax="${HP_MAX}"></div><strong class="briefing-hp-value"></strong></div>
<div class="briefing-oxygen oxygen" hidden><span class="oxygen-valve" aria-hidden="true"><i class="oxygen-knob"></i><i class="oxygen-neck"></i></span><span class="oxygen-body"><span class="oxygen-track"><span class="oxygen-fill"></span><span class="oxygen-ticks"></span></span><span class="oxygen-band"></span><span class="oxygen-band"></span><strong></strong><span class="oxygen-label">O₂</span></span></div>
<div class="practice-feedback" role="status" aria-live="polite"></div></div>
<div class="briefing-copy"><h3 class="briefing-title"></h3><p class="briefing-description"></p><div class="briefing-controls"></div><div class="briefing-pad" hidden></div><div class="briefing-zukan zukan" role="list" aria-label="小サイズの図鑑" hidden></div><p class="briefing-rarity-bubble" hidden>★が多いほどレアな生き物だよ！</p></div>
</div>
<div class="briefing-footer"><button type="button" class="secondary briefing-previous">戻る</button><div class="briefing-nav"><button type="button" class="secondary briefing-next">次へ</button><button type="button" class="primary briefing-launch" hidden>確認して準備完了</button></div></div>`;
  const find = selector => container.querySelector(selector);
  const art = find('.briefing-art'), board = find('.briefing-board'), feedback = find('.practice-feedback'), controls = find('.briefing-controls'), layout = find('.briefing-layout');
  let running = false, controller = false, role = 'parent', settings = {}, step = 0, keyTimer = 0, shownStep = -1, loop = 0, painted = 0, goalStep = -1;
  const practice = { cursor: { x: 2, y: 2 }, direction: 1, child: { x: 0, y: 3 }, placed: new Set(), feedback: '' };
  const soundObserver = createSoundObserver(name => onSound?.(name), { deadline: false });
  let soundPosition = null;
  let startedAt = 0;
  let trail = [15];
  const taken = new Set();
  let demoCycle = -1, demoHp = null;
  let cursorMovedAt = 0;
  // The step whose cursor has moved: before that, the navigator's practice only introduces the cursor.
  let awakeStep = -1;
  // The first wall lesson: walls placed on its empty board, and whether the top of the target is closed.
  const basicsPlaced = new Set();
  let basicsDone = false;
  let detourSteps = [];
  let wrongWallUntil = 0;
  let explorerWrong = false;
  let explorerCompletedAt = null;
  let wallNoticeUntil = 0;
  let registeredSmall = null;

  function resetPresentation() {
    soundObserver.reset(); soundPosition = null;
    startedAt = performance.now();
    cursorMovedAt = startedAt;
    detourSteps = [];
    wrongWallUntil = 0;
    explorerWrong = false;
    explorerCompletedAt = null;
    wallNoticeUntil = 0;
    registeredSmall = null;
    demoCycle = -1; demoHp = null;
    resetMazeScene(find('.briefing-canvas'));
  }

  const parent = () => role === 'parent';
  const steps = () => GUIDES[parent() ? 'parent' : 'child'];
  const last = () => step === steps().length - 1;
  const kind = () => steps()[step]?.kind;
  const riskStep = () => kind() === 'risk';
  const basicsStep = () => kind() === 'basics';
  const cursorStep = () => kind() === 'wall';
  const timedDemo = () => kind() === 'timed';
  const collectionDemo = () => kind() === 'collection';
  // Steps where the navigator moves the cursor and places walls by hand.
  const placingStep = () => basicsStep() || cursorStep();
  const boardCols = () => basicsStep() ? BASIC_COLS : COLS;
  const wallDemo = () => cursorStep() || timedDemo();
  const cursorIntro = () => cursorStep() && awakeStep !== step;
  // The first cursor move ends the intro: the diver sets off from the start and the target shows.
  function wake() { if (!cursorIntro()) return; awakeStep = step; startedAt = cursorMovedAt = performance.now(); }
  const moveStep = () => kind() === 'explore' || kind() === 'detour';
  const explorerStep = () => moveStep();
  const explorerRoute = () => kind() === 'detour' ? EXPLORER_DETOUR : EXPLORER_ROUTE;
  const explorerWallAppeared = () => kind() === 'detour' && trail.includes(2);
  function guideRoute() {
    if (!explorerStep()) return [];
    if (kind() === 'explore') return explorerRoute();
    const turn = DEMO_ROUTE.indexOf(2);
    return explorerWallAppeared() ? explorerRoute().slice(turn) : explorerRoute().slice(0, turn + 1);
  }
  const fixed = () => new Set([...DEMO_WALLS].filter(value => !explorerWallAppeared() || value !== edge(7, 12)).map(value => {
    const [a, b] = value.split(':').map(Number);
    return edgeKey(a % COLS, Math.floor(a / COLS), b % COLS, Math.floor(b / COLS));
  }));

  function start(nextRole, nextSettings) {
    role = nextRole === 'parent' ? 'parent' : 'child'; settings = { ...DEFAULTS, ...nextSettings }; step = 0; running = true; goalStep = -1; awakeStep = -1;
    practice.cursor = { x: 0, y: ROWS - 1 }; practice.direction = 1; practice.child = { x: 0, y: 3 }; practice.placed.clear();
    practice.feedback = '';
    trail = [15]; taken.clear(); resetPresentation();
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
  function stop() { running = false; cancelAnimationFrame(loop); loop = 0; }
  function close() { if (!running) return; stop(); onClose?.(); }
  function go(next) {
    if (!running) return;
    const target = Math.max(0, Math.min(steps().length - 1, next));
    if (target === step) return;
    step = target; awakeStep = -1;
    if (basicsStep()) { practice.cursor = { ...BASIC_START }; practice.direction = 1; practice.feedback = ''; basicsPlaced.clear(); basicsDone = false; }
    if (wallDemo()) { practice.cursor = { x: 0, y: ROWS - 1 }; practice.direction = 1; practice.placed.clear(); practice.feedback = ''; }
    if (moveStep()) { practice.child = { x: 0, y: 3 }; trail = [15]; taken.clear(); practice.feedback = ''; }
    resetPresentation();
    update();
  }
  // The briefing shows no role / status line above the steps.
  function setKicker() { find('.briefing-kicker').textContent = ''; }

  // There is no going back. The next (or final) button stays hidden until this step's goal is reached
  // or its demo has played through once, then rises in (CSS); × / Enter / → advance only after that.
  function syncNav() {
    const ready = goalStep === step;
    find('.briefing-previous').hidden = true;
    find('.briefing-next').hidden = last() || !ready;
    find('.briefing-launch').hidden = !last() || !ready;
    for (const button of [find('.briefing-next'), find('.briefing-launch')]) button.classList.toggle('is-goal-reached', ready);
  }
  function advance() { if (!running || goalStep !== step) return; if (last()) onFinish?.(); else go(step + 1); }
  // Titles stay on one line: a title wider than its column is scaled down to fit.
  function fitTitle() {
    const title = find('.briefing-title');
    title.style.fontSize = '';
    requestAnimationFrame(() => {
      const room = title.parentElement.clientWidth, wide = title.scrollWidth;
      if (room > 0 && wide > room) title.style.fontSize = `${parseFloat(getComputedStyle(title).fontSize) * room / wide * .98}px`;
    });
  }
  addEventListener('resize', () => { if (running) fitTitle(); });
  function update() {
    if (!running) return;
    const guide = steps()[step];
    const interactive = placingStep() || explorerStep();
    const practiceNotice = find('.briefing-practice-notice');
    practiceNotice.hidden = false;
    practiceNotice.textContent = interactive ? '実際に操作してみてね' : '▶ 説明動画（見るだけ）';
    // A watch-only step reads as a video: a playing badge over the board.
    art.classList.toggle('is-demo', !interactive);
    find('.demo-badge').hidden = interactive;
    practiceNotice.classList.toggle('is-interactive', interactive);
    find('.briefing-title').textContent = guide.title;
    fitTitle();
    setGuideDescription(find('.briefing-description'), guide.description(settings));
    controls.innerHTML = guide.controls(settings);
    // Left stick moves; directional taps aim walls and horizontal holds navigate the briefing.
    if (controller && (placingStep() || moveStep())) {
      controls.innerHTML = `<kbd data-practice-key="Arrow">${padIcon('left')} ${parent() ? '位置' : '移動'}</kbd>` + (parent() ? `<kbd data-practice-key="Tab">${padIcon('dpad')} 押した向きに設置</kbd>` : '点線は秘密の通路');
    }
    if (placingStep() || explorerStep()) find('.briefing-footer').insertBefore(controls, find('.briefing-nav'));
    else find('.briefing-copy').insertBefore(controls, find('.briefing-pad'));
    // The key / button legend is no longer shown; the centred next button is the only footer item.
    controls.hidden = true;
    // The controller drawing lights up the buttons this step uses.
    const explorerGuide = explorerStep();
    // Watch-only demo steps (the navigator's risk and time-limit videos) show no controller drawing.
    const showController = !collectionDemo() && !riskStep() && !timedDemo() && (controller || placingStep() || explorerGuide);
    find('.briefing-zukan').hidden = !collectionDemo();
    find('.briefing-rarity-bubble').hidden = !collectionDemo();
    find('.briefing-pad').classList.toggle('is-wall-guide', placingStep() || explorerGuide);
    find('.briefing-pad').classList.toggle('is-explorer-guide', explorerGuide);
    find('.briefing-pad').hidden = !showController;
    if (showController) {
      const diagram = controllerDiagram(placingStep() ? ['left', 'dpad'] : moveStep() ? ['left', 'dpad'] : ['dpad']);
      find('.briefing-pad').innerHTML = placingStep()
        ? `<span class="wall-guide-note">ジョイスティックで<br>カーソル${cursorIcon}を移動</span>${diagram}<span class="wall-guide-note">ボタンの向きに<br>壁を置く</span><span class="wall-guide-hint" hidden></span>`
        : explorerGuide ? `<span class="wall-guide-note explorer-comment-space">ジョイスティックで<br>エクスプローラーを移動</span>${diagram}<span class="wall-guide-note explorer-comment-space" aria-hidden="true"></span><span class="wall-guide-hint" hidden></span>` : diagram;
    }
    find('.briefing-previous').innerHTML = controller ? `${petalIcon('prev')} 長押しで戻る` : '戻る';
    find('.briefing-next').innerHTML = controller ? `${padIcon('cross')} 次へ` : '次へ';
    find('.briefing-launch').innerHTML = controller ? `${padIcon('cross')} 準備完了` : '確認して準備完了';
    container.classList.toggle('pad-briefing', controller);
    find('.briefing-count').textContent = `${String(step + 1).padStart(2, '0')} / ${String(steps().length).padStart(2, '0')}`;
    art.dataset.step = step;
    find('.briefing-art-tag').textContent = guide.tag;
    // One progress segment per step (the navigator now has four).
    const progress = find('.briefing-progress');
    if (progress.children.length !== steps().length) progress.replaceChildren(...steps().map(() => document.createElement('span')));
    container.querySelectorAll('.briefing-progress span').forEach((bar, i) => { bar.classList.toggle('is-active', i === step); bar.classList.toggle('is-done', i < step); });
    syncNav();
    if (shownStep !== step) {
      if (interactive) {
        practiceNotice.classList.remove('is-interactive');
        void practiceNotice.offsetWidth;
        practiceNotice.classList.add('is-interactive');
      }
      layout.dataset.dir = step < shownStep ? 'prev' : 'next';
      layout.classList.remove('is-entering'); void layout.offsetWidth; layout.classList.add('is-entering');
      shownStep = step;
    }
    onStep?.(step, last());
    drawBoard();
  }

  function blocked(x, y, nx, ny) {
    const e = edgeKey(x, y, nx, ny);
    return fixed().has(e) || practice.placed.has(e) || (explorerWallAppeared() && e === edgeKey(2, 0, 3, 0));
  }
  // Share the round renderer, including its role-specific symbols and colors.
  function updateCursorGuide() {
    const wallNotice = explorerWallAppeared() && performance.now() < wallNoticeUntil;
    find('.briefing-wall-bubble').hidden = !wallNotice;
    feedback.classList.toggle('is-wrong-direction', explorerStep() && explorerWrong);
    if (explorerStep()) {
      const pad = find('.briefing-pad'), hint = find('.wall-guide-hint');
      const next = explorerRoute()[trail.length];
      feedback.textContent = next === undefined ? '最後まで探検できたね！' : '線に沿ってジョイスティックを動かそう';
      if (wallNotice) feedback.textContent = '壁が現れた！';
      const show = next !== undefined;
      pad.classList.toggle('is-cursor-guide', next !== undefined);
      pad.classList.toggle('is-cursor-hint', show);
      hint.hidden = !show;
      if (next !== undefined) {
        const dx = next % COLS - practice.child.x, dy = Math.floor(next / COLS) - practice.child.y;
        const angle = dy < 0 ? 0 : dx > 0 ? 90 : dy > 0 ? 180 : 270;
        const directionName = dy < 0 ? '上' : dx > 0 ? '右' : dy > 0 ? '下' : '左';
        hint.textContent = `${directionName}に倒してみよう`;
        if (explorerWrong) feedback.textContent = `そっちじゃないよ${directionName}だよ`;
        pad.querySelector('.joystick-direction-arrow path').setAttribute('transform', `rotate(${angle} 16 16)`);
        pad.style.setProperty('--stick-x', `${dx * 12}px`);
        pad.style.setProperty('--stick-y', `${dy * 12}px`);
      }
      return;
    }
    if (basicsStep()) {
      // Guide one thing at a time: move to the target, turn the cursor up, then place.
      const pad = find('.briefing-pad'), hint = find('.wall-guide-hint');
      const { x, y } = practice.cursor, at = x === BASIC_TARGET.x && y === BASIC_TARGET.y, up = practice.direction === 0;
      const say = text => { if (feedback.textContent !== text) feedback.textContent = text; };
      pad.querySelectorAll('.is-press-target').forEach(element => element.classList.remove('is-press-target'));
      if (basicsDone) {
        say('上をふさげたね！ 次へ進もう');
        hint.hidden = true; pad.classList.remove('is-cursor-hint', 'is-cursor-guide');
        return;
      }
      if (performance.now() < wrongWallUntil) say('そこじゃないよ！ ■のマスの上に立てよう');
      else if (!at) { if (!feedback.querySelector('.cursor-target-symbol')) feedback.innerHTML = `<span class="cursor-target-symbol">■</span>のマスへカーソル${cursorIcon}を動かそう`; }
      else say(controller ? '▲ボタンで上に壁を立てよう' : up ? 'Spaceで壁を立てよう' : 'Tabで向きを上にしよう');
      pad.classList.toggle('is-cursor-guide', !at); pad.classList.toggle('is-cursor-hint', !at);
      hint.hidden = false;
      if (!at) {
        const direction = x < BASIC_TARGET.x ? { text: '右', angle: 90, x: 12, y: 0 } : x > BASIC_TARGET.x ? { text: '左', angle: 270, x: -12, y: 0 }
          : y < BASIC_TARGET.y ? { text: '下', angle: 180, x: 0, y: 12 } : { text: '上', angle: 0, x: 0, y: -12 };
        if (hint.textContent !== `${direction.text}に倒してみよう`) hint.textContent = `${direction.text}に倒してみよう`;
        pad.querySelector('.joystick-direction-arrow path')?.setAttribute('transform', `rotate(${direction.angle} 16 16)`);
        pad.style.setProperty('--stick-x', `${direction.x}px`); pad.style.setProperty('--stick-y', `${direction.y}px`);
      } else {
        const text = '▲ボタンを押してみよう';
        if (hint.textContent !== text) hint.textContent = text;
        pad.querySelector('.ps-petal[data-angle="0"]')?.classList.add('is-press-target');
      }
      return;
    }
    if (!cursorStep()) return;
    if (performance.now() < wrongWallUntil) {
      feedback.textContent = 'そこじゃないよ！';
      return;
    }
    const { x, y } = practice.cursor;
    const reached = x === 2 && y === 0;
    if (practice.feedback.startsWith('魚への道がふさがっています')) {
      feedback.textContent = practice.feedback;
      return;
    }
    if (detourSteps.length) {
      feedback.textContent = (performance.now() - startedAt) / 1000 >= detourSteps.at(-1).at + .4 ? '魚に出会えた！守ってあげられたね。' : '壁をよけて、別の道へ進もう';
      const pad = find('.briefing-pad');
      find('.wall-guide-hint').hidden = true;
      pad.classList.remove('is-cursor-hint');
      pad.classList.remove('is-cursor-guide');
      pad.querySelector('.is-press-target')?.classList.remove('is-press-target');
      return;
    }
    const instruction = reached ? '右に壁を立てよう' : '■のマスへカーソルを動かそう';
    // Before the first move only the cursor is introduced; the target appears once it moves.
    if (cursorIntro()) {
      if (!feedback.querySelector('.cursor-intro')) feedback.innerHTML = `<span class="cursor-intro">光っているのがカーソル${cursorIcon}！ 動かしてみよう</span>`;
    } else if (feedback.textContent !== instruction) {
      if (reached) feedback.textContent = instruction;
      else feedback.innerHTML = `<span class="cursor-target-symbol">■</span>のマスへカーソル${cursorIcon}を動かそう`;
    }
    const direction = y > 0 ? { text: '上に倒してみよう', angle: 0, x: 0, y: -12 }
      : x < 2 ? { text: '右に倒してみよう', angle: 90, x: 12, y: 0 }
      : { text: '左に倒してみよう', angle: 270, x: -12, y: 0 };
    const pad = find('.briefing-pad'), hint = find('.wall-guide-hint');
    pad.classList.toggle('is-cursor-guide', !reached);
    pad.querySelector('.ps-petal[data-angle="90"]')?.classList.toggle('is-press-target', reached);
    const show = !reached;
    hint.hidden = !(show || reached);
    if (reached) {
      if (hint.textContent !== '▶ボタンを押してみよう') hint.textContent = '▶ボタンを押してみよう';
    } else if (hint.textContent !== direction.text) hint.textContent = direction.text;
    pad.querySelector('.joystick-direction-arrow path').setAttribute('transform', `rotate(${direction.angle} 16 16)`);
    pad.classList.toggle('is-cursor-hint', show);
    pad.style.setProperty('--stick-x', `${direction.x}px`);
    pad.style.setProperty('--stick-y', `${direction.y}px`);
  }
  // The first wall lesson draws an empty 7×4 board: no walls, fish, diver or start marker, just the
  // cursor and the walls placed here.
  function paintBasics() {
    updateCursorGuide();
    if (basicsDone && goalStep !== step) goalStep = step;
    syncNav();
    const toCell = point => { const [x, y] = point.split(',').map(Number); return y * BASIC_COLS + x; };
    const walls = new Set([...basicsPlaced].map(value => { const [a, b] = value.split('|').map(toCell); return edge(a, b); }));
    const width = BASIC_COLS * 36 + 28, canvas = find('.briefing-canvas'), shown = (canvas.clientWidth || width) * (devicePixelRatio || 1);
    const resolution = Math.min(6, Math.max(2, Math.ceil(shown / width * 2) / 2));
    const scene = { settings: { ...settings, cols: BASIC_COLS, rows: ROWS, wallLimit: 20 }, mode: 'parent', phase: 'playing', time: (performance.now() - startedAt) / 1000, moves: 0,
      avatar: 0, goal: -1, trail: [], base: new Set(), walls, secrets: new Set(), items: [] };
    soundObserver.update(scene);
    const cursorCell = practice.cursor.y * BASIC_COLS + practice.cursor.x;
    if (soundPosition && soundPosition.cursor !== cursorCell) onSound?.('move');
    soundPosition = { avatar: 0, cursor: cursorCell };
    drawMaze(canvas, scene, 'parent', cursorCell, (practice.direction + 3) % 4, { cursor: true, resolution, empty: true });
  }
  function paint() {
    if (basicsStep()) { paintBasics(); return; }
    // Until the cursor first moves, the diver waits at the start: its clock does not run.
    if (cursorIntro()) startedAt = performance.now();
    if (collectionDemo() && (performance.now() - startedAt) / 1000 >= DEMO_STEPS.find(point => point.cell === 2).at + 3) {
      resetPresentation();
    }
    if (explorerStep() && explorerCompletedAt !== null && performance.now() - explorerCompletedAt >= 3000) {
      practice.child = { x: 0, y: ROWS - 1 }; practice.feedback = '';
      trail = [15]; taken.clear(); resetPresentation();
    }
    if (wallDemo() && detourSteps.length && (performance.now() - startedAt) / 1000 >= detourSteps.at(-1).at + 1.4) {
      practice.cursor = { x: 0, y: ROWS - 1 }; practice.direction = 1;
      practice.child = { x: 0, y: ROWS - 1 }; practice.placed.clear(); practice.feedback = '';
      trail = [15]; taken.clear(); resetPresentation();
    }
    updateCursorGuide();
    const riskExample = riskStep();
    const navigatorDemo = riskExample || wallDemo();
    const autoDemo = navigatorDemo || collectionDemo();
    const elapsed = (performance.now() - startedAt) / 1000;
    const stopAt = DEMO_STEPS.find(point => point.cell === 2).at;
    if (timedDemo() || collectionDemo()) {
      const remaining = Math.max(0, 30 - elapsed), oxygen = find('.briefing-oxygen');
      oxygen.querySelector('strong').textContent = `00:${String(Math.ceil(remaining)).padStart(2, '0')}`;
      oxygen.querySelector('.oxygen-fill').style.width = `${remaining / 30 * 100}%`;
    }
    if (timedDemo()) {
      const moves = Math.max(0, Math.min(5, Math.floor((elapsed - 2) / .7)));
      practice.cursor = { x: Math.max(0, moves - 3), y: Math.max(0, ROWS - 1 - moves) };
      if (!detourSteps.length && elapsed >= stopAt + 1) placeWall();
      feedback.textContent = detourSteps.length ? elapsed >= detourSteps.at(-1).at + .4 ? '魚に出会えた！守ってあげられたね。' : '壁をよけて、別の道へ進もう' : '時間内に魚を探しに行こう';
    }
    // Once this step's goal is reached, the next button lights up until the step changes (the
    // navigator's demo loops back afterwards, so the highlight is kept rather than re-checked).
    const goal = explorerStep() ? explorerRoute()[trail.length] === undefined
      : riskStep() ? elapsed >= DEMO_DURATION
      : collectionDemo() ? elapsed >= stopAt + 2.5
      : (wallDemo() || timedDemo()) && detourSteps.length > 0 && elapsed >= detourSteps.at(-1).at + .4;
    if (goal && goalStep !== step) goalStep = step;
    syncNav();
    const demoTime = collectionDemo() ? Math.min(elapsed, stopAt) : wallDemo() ? detourSteps.length ? elapsed : Math.min(elapsed, stopAt) : elapsed % DEMO_DURATION;
    const steps = wallDemo() || collectionDemo() ? [...DEMO_STEPS.filter(point => point.at <= stopAt), ...detourSteps] : DEMO_STEPS;
    const demoTrail = steps.filter(point => point.at <= demoTime).map(point => point.cell);
    if (!demoTrail.length) demoTrail.push(DEMO_ROUTE[0]);
    const demoItems = DEMO_FISH.map(fish => ({ ...fish, taken: steps.some(point => point.cell === fish.cell && demoTime >= point.at + .35) }));
    if (collectionDemo()) {
      const found = demoItems.some(fish => fish.size === 'small' && fish.taken);
      if (registeredSmall !== found) {
        const book = find('.briefing-zukan');
        book.innerHTML = zukan(new Set(found ? ['clownfish'] : []), found ? 'clownfish' : '');
        book.querySelectorAll('.zukan-row:not(.small)').forEach(row => row.remove());
        book.querySelector('.zukan-size-icon').remove();
        registeredSmall = found;
      }
    }
    if (navigatorDemo) {
      const cycle = riskExample ? Math.floor(elapsed / DEMO_DURATION) : 0;
      if (cycle !== demoCycle) {
        resetMazeScene(find('.briefing-canvas')); demoCycle = cycle;
        soundObserver.reset(); soundPosition = null;
      }
      const met = demoItems.filter(fish => fish.taken), hp = applyDamage(met.reduce((value, fish) => applyDamage(value, fish.damage), HP_MAX), wallDemo() ? practice.placed.size * WALL_DAMAGE : 0);   // walls cost HP in both wall steps, as in a round
      if (hp !== demoHp) {
        const meter = find('.briefing-hp .hp-hearts'), panel = find('.briefing-hp');
        meter.innerHTML = hearts(hp); meter.setAttribute('aria-valuenow', hp);
        find('.briefing-hp-value').textContent = `${hp} / ${HP_MAX}`;
        panel.classList.remove('is-hit');
        if (demoHp !== null && hp < demoHp) { void panel.offsetWidth; panel.classList.add('is-hit'); }
        demoHp = hp;
        const latest = met.at(-1);
        if (riskExample) feedback.textContent = latest ? `${creature(latest.creature).name}に遭遇 · 💛 −${latest.damage}` : '魚に会うと💛はどうなる？';
      }
    }
    const avatar = practice.child.y * COLS + practice.child.x;
    const convertEdges = edges => new Set([...edges].map(value => {
      const [a, b] = value.split('|').map(point => {
        const [x, y] = point.split(',').map(Number);
        return y * COLS + x;
      });
      return edge(a, b);
    }));
    const walls = convertEdges(practice.placed);
    if (explorerWallAppeared()) walls.add(edge(2, 3));
    // Draw at the size the board is shown (in device pixels), in half steps so resizing seldom repaints layers.
    const canvas = find('.briefing-canvas'), shown = (canvas.clientWidth || BOARD_WIDTH) * (devicePixelRatio || 1);
    const resolution = Math.min(6, Math.max(2, Math.ceil(shown / BOARD_WIDTH * 2) / 2));
    const scene = {
      settings: { ...settings, cols: COLS, rows: ROWS, wallLimit: 20 },
      mode: role, phase: 'playing', time: autoDemo ? demoTime : elapsed, moves: (autoDemo ? demoTrail : trail).length - 1,
      avatar: autoDemo ? demoTrail.at(-1) : avatar, goal: -1,
      trail: autoDemo ? demoTrail : trail,
      base: autoDemo ? DEMO_WALLS : convertEdges(fixed()), walls: riskExample ? new Set() : walls,
      secrets: new Set(explorerWallAppeared() ? [edge(7, 12)] : []),
      items: autoDemo ? demoItems : DEMO_FISH.map(fish => ({ ...fish, taken: taken.has(fish.cell) })),
    };
    soundObserver.update({
      ...scene,
      items: parent() ? scene.items : scene.items.map(({ damage, ...item }) => item),
    });
    const position = { avatar: scene.avatar, cursor: practice.cursor.y * COLS + practice.cursor.x };
    if (soundPosition) {
      if (cursorStep() && position.cursor !== soundPosition.cursor) onSound?.('move');
      if (position.avatar === scene.goal && soundPosition.avatar !== scene.goal) onSound?.('finish');
    }
    soundPosition = position;
    drawMaze(canvas, scene, role, practice.cursor.y * COLS + practice.cursor.x, (practice.direction + 3) % 4, { cursor: wallDemo(), cursorSpotlight: cursorIntro(), resolution, markScale: .65, wallDamage: wallDemo() ? WALL_DAMAGE : undefined, guideRoute: guideRoute() });
  }
  function drawBoard() {
    const interactive = placingStep() || moveStep();
    const riskExample = riskStep();
    feedback.hidden = timedDemo() || collectionDemo();
    find('.briefing-art-heading').hidden = true;
    art.dataset.role = role;
    const oxygen = find('.briefing-oxygen');
    art.insertBefore(oxygen, timedDemo() || collectionDemo() ? find('.briefing-maze') : feedback);
    oxygen.hidden = !(timedDemo() || collectionDemo());
    oxygen.querySelector('strong').textContent = String(Math.floor(settings.duration / 60)).padStart(2, '0') + ':' + String(settings.duration % 60).padStart(2, '0');
    oxygen.querySelector('.oxygen-fill').style.width = '100%';
    paint();
    board.classList.toggle('is-visible', interactive);
    find('.briefing-example').textContent = interactive ? '練習' : riskExample ? '自動デモ' : '表示例';
    find('.briefing-hp').hidden = !parent() || basicsStep();
    const practiceHint = `${controller ? '左スティック' : '矢印キー'}で${parent() ? 'カーソル' : 'エクスプローラー'}を動かしてみましょう`;
    if (!riskExample && !timedDemo()) feedback.textContent = interactive ? practice.feedback || practiceHint : '残り時間 · O₂';
    updateCursorGuide();
    board.replaceChildren();
    if (!interactive) return;
    // The tap grid matches the board drawn under it (7 wide for the first wall lesson).
    const cols = boardCols();
    board.style.gridTemplateColumns = `repeat(${cols},1fr)`;
    board.style.left = board.style.right = `${14 / (cols * 36 + 28) * 100}%`;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < cols; x++) {
      const cell = document.createElement('div');
      cell.className = 'practice-cell';
      const target = basicsStep() ? !basicsDone && x === BASIC_TARGET.x && y === BASIC_TARGET.y : cursorStep() && !cursorIntro() && x === 2 && y === 0;
      if (target) cell.classList.add('is-cursor-target');
      // The first wall lesson also marks the side to close: the top of the target cell.
      if (target && basicsStep()) cell.classList.add('is-wall-target-up');
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', coordinate(x, y) + (target ? '（黄色く光る目標のマス）' : ''));
      cell.dataset.x = x; cell.dataset.y = y;
      board.append(cell);
    }
  }

  function moveCursor(direction) {
    wake();
    if (basicsStep()) wrongWallUntil = 0;   // a new move replaces the "not there" note
    cursorMovedAt = performance.now();
    practice.cursor.x = Math.max(0, Math.min(boardCols() - 1, practice.cursor.x + direction.dx));
    practice.cursor.y = Math.max(0, Math.min(ROWS - 1, practice.cursor.y + direction.dy));
    practice.feedback = '';
    drawBoard();
  }
  function moveChild(direction) {
    const { x, y } = practice.child, nx = x + direction.dx, ny = y + direction.dy;
    if (explorerStep()) {
      const next = explorerRoute()[trail.length];
      if (next === undefined) return;
      if (nx !== next % COLS || ny !== Math.floor(next / COLS)) {
        explorerWrong = true;
        drawBoard();
        return;
      }
      explorerWrong = false;
      cursorMovedAt = performance.now();
    }
    if (!inBounds(nx, ny)) practice.feedback = '迷路の端です。別の方向へ進んでください';
    else if (blocked(x, y, nx, ny)) practice.feedback = '壁で停止。別の方向へ進んでください';
    else {
      practice.child = { x: nx, y: ny };
      const cell = ny * COLS + nx;
      trail.push(cell);
      if (kind() === 'detour' && cell === 2) wallNoticeUntil = performance.now() + 3000;
      const pickup = DEMO_FISH.some(fish => fish.cell === cell) && !taken.has(cell);
      if (pickup) taken.add(cell);
      practice.feedback = `エクスプローラーが ${coordinate(nx, ny)} へ移動`;
      if (pickup) practice.feedback += ' · 生き物を発見';
      if (explorerStep() && trail.length === explorerRoute().length) {
        practice.feedback = '最後まで探検できたね！';
        explorerCompletedAt = performance.now();
      }
    }
    drawBoard();
  }
  function rotate() {
    if (basicsStep()) wrongWallUntil = 0;
    practice.direction = (practice.direction + 1) % DIRECTIONS.length;
    practice.feedback = `設置方向: ${DIRECTIONS[practice.direction].name}`;
    drawBoard();
  }
  function placeWall() {
    // First wall lesson: only the top side of the target cell counts.
    if (basicsStep()) {
      if (basicsDone) return;
      const { x, y } = practice.cursor;
      if (x === BASIC_TARGET.x && y === BASIC_TARGET.y && practice.direction === 0) {
        basicsPlaced.add(edgeKey(x, y, x, y - 1)); basicsDone = true; wrongWallUntil = 0;
      } else wrongWallUntil = performance.now() + 2000;
      drawBoard();
      return;
    }
    const direction = DIRECTIONS[practice.direction], { x, y } = practice.cursor, nx = x + direction.dx, ny = y + direction.dy;
    if (x !== 2 || y !== 0 || direction.dx !== 1 || direction.dy !== 0) {
      wrongWallUntil = performance.now() + 2000;
      drawBoard();
      return;
    }
    if (detourSteps.length) return;
    wrongWallUntil = 0;
    if (!inBounds(nx, ny)) practice.feedback = '迷路の外には壁を立てられません';
    else {
      const e = edgeKey(x, y, nx, ny);
      if (DEMO_WALLS.has(edge(y * COLS + x, ny * COLS + nx))) practice.feedback = '既存の壁です。黄色い辺を選んでください';
      else if (practice.placed.has(e)) practice.feedback = 'そこにはすでに壁があります';
      else {
        practice.placed.add(e); practice.feedback = `${direction.name}側に壁を設置しました`;
        if (e === edgeKey(2, 0, 3, 0)) {
          const queue = [2], came = new Map([[2, null]]);
          for (let i = 0; i < queue.length && !came.has(DETOUR_FISH); i++) {
            const cell = queue[i], x = cell % COLS, y = Math.floor(cell / COLS);
            for (const { dx, dy } of DIRECTIONS) {
              const nx = x + dx, ny = y + dy, next = ny * COLS + nx;
              if (!inBounds(nx, ny) || came.has(next) || DEMO_WALLS.has(edge(cell, next)) || practice.placed.has(edgeKey(x, y, nx, ny))) continue;
              came.set(next, cell); queue.push(next);
            }
          }
          if (came.has(DETOUR_FISH)) {
            const path = [];
            for (let cell = DETOUR_FISH; cell !== 2; cell = came.get(cell)) path.unshift(cell);
            let at = Math.max((performance.now() - startedAt) / 1000, DEMO_STEPS.find(point => point.cell === 2).at) + 1;
            detourSteps = path.map(cell => {
              const point = { cell, at };
              at += .7 + (DEMO_FISH.some(fish => fish.cell === cell && !DEMO_ROUTE.slice(0, DEMO_ROUTE.indexOf(2) + 1).includes(cell)) ? 1.6 : 0);
              return point;
            });
          } else practice.feedback = '魚への道がふさがっています。もう一度やり直してください。';
        }
      }
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
    if (placingStep()) moveCursor(DIRECTIONS[index]); else moveChild(DIRECTIONS[index]);
  }

  function key(event) {
    if (!running) return;
    const index = KEY_DIRECTION[event.key];
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if ((placingStep() || moveStep()) && index !== undefined) { event.preventDefault(); arrow(index); }
    else if (placingStep() && event.key === 'Tab') { event.preventDefault(); highlight('Tab'); rotate(); }
    else if (placingStep() && event.code === 'Space') { event.preventDefault(); highlight('Space'); if (!event.repeat) placeWall(); }
    else if (event.key === 'ArrowLeft') event.preventDefault();
    else if (event.key === 'ArrowRight') { event.preventDefault(); advance(); }
    else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON' && !event.repeat) { event.preventDefault(); advance(); }
  }
  // ← / → place on a tap (release), like in a round; × moves on once the step's goal is reached.
  // The left stick moves exactly as in a round; a D-pad press turns the wall and places it (no ×).
  function pad(input) {
    if (!running) return;
    if (input.tapped.has('cross')) { advance(); return; }
    // The game's directions run right, down, left, up; the board's run north, east, south, west.
    if (input.step >= 0 && (placingStep() || moveStep())) arrow((input.step + 1) % 4);
    const dpad = input.tapped.has('right') ? 0 : input.tapped.has('left') ? 2 : input.pressed.has('up') ? 3 : input.pressed.has('down') ? 1 : -1;
    const aim = dpad >= 0 ? dpad : ['right', 'left', 'up', 'down'].some(name => input.pressed.has(name)) ? -1 : input.aim;
    if (placingStep() && aim >= 0) { practice.direction = (aim + 1) % 4; practice.feedback = `設置方向: ${DIRECTIONS[practice.direction].name}`; highlight('Tab'); drawBoard(); }
    if (placingStep() && dpad >= 0) { highlight('Space'); placeWall(); }
  }

  // Touch: tap a cell to put the cursor there, or to step the child toward it; the key hints are tappable.
  board.onclick = event => {
    const cell = event.target.closest('.practice-cell');
    if (!cell) return;
    const x = +cell.dataset.x, y = +cell.dataset.y;
    if (placingStep()) { wake(); cursorMovedAt = performance.now(); practice.cursor = { x, y }; practice.feedback = ''; drawBoard(); return; }
    const index = DIRECTIONS.findIndex(d => practice.child.x + d.dx === x && practice.child.y + d.dy === y);
    if (explorerStep() && index < 0 && trail.length < explorerRoute().length) { explorerWrong = true; drawBoard(); return; }
    if (moveStep() && index >= 0) arrow(index);
  };
  controls.onclick = event => {
    const kbd = event.target.closest('kbd[data-practice-key]');
    if (!kbd || !placingStep()) return;
    if (kbd.dataset.practiceKey === 'Tab') { highlight('Tab'); rotate(); }
    if (kbd.dataset.practiceKey === 'Space') { highlight('Space'); placeWall(); }
  };
  find('.briefing-next').onclick = advance;
  find('.briefing-launch').onclick = advance;
  // goTo lets a spectating guest follow the host's current step.
  return { start, stop, key, pad, setKicker, setController: value => { if (controller !== value) { controller = value; update(); } }, next: () => go(step + 1), goTo: go,
    get step() { return step; }, get last() { return last(); }, get running() { return running; } };
}
