import { drawMaze, resetMazeScene } from './maze-renderer.js';
import { edge, DEFAULTS, WALL_DAMAGE } from './maze.js';
import { HP_MAX, applyDamage, creature } from './creatures.js';
import { hearts, zukan } from './encyclopedia-ui.js';
import { controllerDiagram, padIcon } from './controller-guide.js';
import oceanTitle from './assets/you-see-i-see.png';
import { createSoundObserver } from './sound-effects.js';

// The pre-round briefing: three short steps per role (the navigator's run danger → walls → time), each a title, one line of description and one
// line of controls. The first steps carry a 5×4 practice board to try the controls on.
const GUIDES = {
  parent: [
    { title: '海の中には危険がたくさん', symbol: '!', tag: 'RISK',
      description: () => 'エクスプローラーが自由に海を探索しているよ。\n魚に会うと💛が減っちゃうんだって。\n！が多いほど💛が多く減る可能性が高いみたい…',
      controls: () => '' },
    { title: 'エクスプローラーを守ろう', symbol: 'ナ', tag: 'NAVIGATOR',
      description: () => `ナビゲーターは壁を立てられるよ。\n壁でエクスプローラーを危険な魚から守ってあげよう。\nでも、壁を立てると💛が${WALL_DAMAGE}つ減っちゃうみたい…`,
      controls: () => '<kbd data-practice-key="Arrow">矢印キー</kbd>で位置を選択 · <kbd data-practice-key="Tab" role="button" tabindex="0">Tab</kbd> で向き · <kbd data-practice-key="Space" role="button" tabindex="0">Space</kbd> で設置' },
    { title: '時間内にゴールを目指そう', symbol: 'O₂', tag: 'TIME LIMIT',
      description: () => '制限時間は30秒だよ。\n💛がゼロにならないように壁を立てて守りながら、\nエクスプローラーを画面右上のゴールに導こう。',
      controls: () => '' },
  ],
  child: [
    { title: '魚探しに出かけよう', symbol: 'エ', tag: 'EXPLORER',
      description: () => 'ジョイスティックの向きに合わせて\nエクスプローラーを動かせるよ。\n大きい魚ほど、レアな生き物に出会えるかも…！',
      controls: () => '<kbd data-practice-key="Arrow">矢印キー</kbd>でエクスプローラーを操縦 · マスをタップしても移動' },
    { title: '新しい道を冒険しよう', symbol: '↗', tag: 'SECRET PASSAGE',
      description: () => '途中で壁が現れて進むのをじゃましてくるよ。\nでも、大丈夫。代わりに新しい道が出来るみたい！',
      controls: () => '<kbd data-practice-key="Arrow">矢印キー</kbd>でエクスプローラーを操縦 · マスをタップしても移動' },
    { title: '時間内に魚をたくさん集めよう', symbol: 'O₂', tag: 'TIME LIMIT',
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
const cursorIcon = '<svg class="cursor-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H4v4M16 3h4v4M20 16v4h-4M8 20H4v-4"/></svg>';
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
<div class="briefing-top"><span class="briefing-kicker"></span><span class="briefing-practice-notice" hidden>実際に操作してみてね</span><img class="briefing-logo" src="${oceanTitle}" alt="YOU SEE / I SEE"></div>
<div class="briefing-progress" aria-label="チュートリアル進行状況"><span></span><span></span><span></span></div>
<div class="briefing-layout">
<div class="briefing-art" tabindex="-1">
<div class="briefing-art-heading"><span class="briefing-art-tag"></span><span class="briefing-example">練習</span></div>
<div class="briefing-maze"><canvas class="briefing-canvas" aria-hidden="true"></canvas><div class="briefing-board" role="grid" aria-label="練習用の迷路"></div><div class="briefing-wall-bubble" hidden>壁が現れた！</div></div>
<div class="briefing-hp hp-panel" hidden><span class="hp-label">HP</span><div class="hp-hearts" role="meter" aria-label="エクスプローラーのHP" aria-valuemin="1" aria-valuemax="${HP_MAX}"></div><strong class="briefing-hp-value"></strong></div>
<div class="briefing-oxygen oxygen" hidden><span class="oxygen-valve" aria-hidden="true"><i class="oxygen-knob"></i><i class="oxygen-neck"></i></span><span class="oxygen-body"><span class="oxygen-track"><span class="oxygen-fill"></span><span class="oxygen-ticks"></span></span><span class="oxygen-band"></span><span class="oxygen-band"></span><strong></strong><span class="oxygen-label">O₂</span></span></div>
<div class="practice-feedback" role="status" aria-live="polite"></div></div>
<div class="briefing-copy"><div class="briefing-count"></div><h3 class="briefing-title"></h3><p class="briefing-description"></p><div class="briefing-controls"></div><div class="briefing-pad" hidden></div><div class="briefing-zukan zukan" role="list" aria-label="小サイズの図鑑" hidden></div><p class="briefing-rarity-bubble" hidden>★が多いほどレアな生き物だよ！</p></div>
</div>
<div class="briefing-footer"><button type="button" class="secondary briefing-previous">戻る</button><div class="briefing-nav"><button type="button" class="secondary briefing-next">次へ</button><button type="button" class="primary briefing-launch" hidden>確認して待機へ</button></div></div>`;
  const find = selector => container.querySelector(selector);
  const art = find('.briefing-art'), board = find('.briefing-board'), feedback = find('.practice-feedback'), controls = find('.briefing-controls'), layout = find('.briefing-layout');
  let running = false, controller = false, role = 'parent', settings = {}, step = 0, keyTimer = 0, shownStep = -1, loop = 0, painted = 0;
  const practice = { cursor: { x: 2, y: 2 }, direction: 1, child: { x: 0, y: 3 }, placed: new Set(), feedback: '' };
  const soundObserver = createSoundObserver(name => onSound?.(name), { deadline: false });
  let soundPosition = null;
  let startedAt = 0;
  let trail = [15];
  const taken = new Set();
  let demoCycle = -1, demoHp = null;
  let cursorMovedAt = 0;
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
  const cursorStep = () => parent() && step === 1;
  const timedDemo = () => parent() && step === 2;
  const collectionDemo = () => !parent() && step === 2;
  const wallDemo = () => cursorStep() || timedDemo();
  const moveStep = () => !parent() && step < 2;
  const explorerStep = () => moveStep();
  const explorerRoute = () => step === 1 ? EXPLORER_DETOUR : EXPLORER_ROUTE;
  const explorerWallAppeared = () => !parent() && step === 1 && trail.includes(2);
  function guideRoute() {
    if (!explorerStep()) return [];
    if (step === 0) return explorerRoute();
    const turn = DEMO_ROUTE.indexOf(2);
    return explorerWallAppeared() ? explorerRoute().slice(turn) : explorerRoute().slice(0, turn + 1);
  }
  const fixed = () => new Set([...DEMO_WALLS].filter(value => !explorerWallAppeared() || value !== edge(7, 12)).map(value => {
    const [a, b] = value.split(':').map(Number);
    return edgeKey(a % COLS, Math.floor(a / COLS), b % COLS, Math.floor(b / COLS));
  }));

  function start(nextRole, nextSettings) {
    role = nextRole === 'parent' ? 'parent' : 'child'; settings = { ...DEFAULTS, ...nextSettings }; step = 0; running = true;
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
    step = target;
    if (wallDemo()) { practice.cursor = { x: 0, y: ROWS - 1 }; practice.direction = 1; practice.placed.clear(); practice.feedback = ''; }
    if (moveStep()) { practice.child = { x: 0, y: 3 }; trail = [15]; taken.clear(); practice.feedback = ''; }
    resetPresentation();
    update();
  }
  // The briefing shows no role / status line above the steps.
  function setKicker() { find('.briefing-kicker').textContent = ''; }

  function update() {
    if (!running) return;
    const guide = steps()[step];
    const interactive = cursorStep() || explorerStep();
    const practiceNotice = find('.briefing-practice-notice');
    practiceNotice.hidden = false;
    practiceNotice.textContent = interactive ? '実際に操作してみてね' : '説明動画だよ';
    practiceNotice.classList.toggle('is-interactive', interactive);
    find('.briefing-title').textContent = guide.title;
    find('.briefing-description').textContent = guide.description(settings);
    controls.innerHTML = guide.controls(settings);
    // Left stick moves; directional taps aim walls and horizontal holds navigate the briefing.
    if (controller && (cursorStep() || moveStep())) {
      controls.innerHTML = `<kbd data-practice-key="Arrow">${padIcon('left')} ${parent() ? '位置' : '移動'}</kbd>` + (parent() ? `<kbd data-practice-key="Tab">${padIcon('dpad')} 向き</kbd><kbd data-practice-key="Space">${padIcon('cross')} 設置</kbd>` : '点線は秘密の通路');
    }
    if (cursorStep() || explorerStep()) find('.briefing-footer').insertBefore(controls, find('.briefing-nav'));
    else find('.briefing-copy').insertBefore(controls, find('.briefing-pad'));
    controls.hidden = !controls.innerHTML || ((cursorStep() || explorerStep()) && controller);
    // The controller drawing lights up the buttons this step uses.
    const explorerGuide = explorerStep();
    const showController = !collectionDemo() && (controller || cursorStep() || explorerGuide);
    find('.briefing-zukan').hidden = !collectionDemo();
    find('.briefing-rarity-bubble').hidden = !collectionDemo();
    find('.briefing-pad').classList.toggle('is-wall-guide', cursorStep() || explorerGuide);
    find('.briefing-pad').classList.toggle('is-explorer-guide', explorerGuide);
    find('.briefing-pad').hidden = !showController;
    if (showController) {
      const diagram = controllerDiagram(cursorStep() ? ['left', 'dpad', 'cross'] : moveStep() ? ['left', 'dpad'] : ['dpad']);
      find('.briefing-pad').innerHTML = cursorStep()
        ? `<span class="wall-guide-note">ジョイスティックで<br>カーソル${cursorIcon}を移動</span>${diagram}<span class="wall-guide-note">ボタンの向きに<br>壁を置く</span><span class="wall-guide-hint" hidden></span>`
        : explorerGuide ? `<span class="wall-guide-note explorer-comment-space">ジョイスティックで<br>ナビゲーターを移動</span>${diagram}<span class="wall-guide-note explorer-comment-space" aria-hidden="true"></span><span class="wall-guide-hint" hidden></span>` : diagram;
    }
    find('.briefing-previous').innerHTML = controller ? `${padIcon('prev')} 長押しで戻る` : '戻る';
    find('.briefing-next').innerHTML = controller ? `${padIcon('next')} 長押しで次へ` : '次へ';
    find('.briefing-launch').innerHTML = controller ? `${padIcon('next')} 長押しで確認` : '確認して待機へ';
    container.classList.toggle('pad-briefing', controller);
    find('.briefing-count').textContent = `${String(step + 1).padStart(2, '0')} / ${String(steps().length).padStart(2, '0')}`;
    art.dataset.step = step;
    find('.briefing-art-tag').textContent = guide.tag;
    container.querySelectorAll('.briefing-progress span').forEach((bar, i) => { bar.classList.toggle('is-active', i === step); bar.classList.toggle('is-done', i < step); });
    find('.briefing-previous').disabled = step === 0;
    find('.briefing-next').hidden = last();
    find('.briefing-launch').hidden = !last();
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
      const show = next !== undefined && (explorerWrong || performance.now() - cursorMovedAt >= 2000);
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
    if (!cursorStep()) return;
    if (performance.now() < wrongWallUntil) {
      feedback.textContent = 'そこじゃないよ！';
      return;
    }
    const { x, y } = practice.cursor;
    const reached = x === 2 && y === 0;
    if (practice.feedback.startsWith('ゴールへの道がふさがっています')) {
      feedback.textContent = practice.feedback;
      return;
    }
    if (detourSteps.length) {
      feedback.textContent = (performance.now() - startedAt) / 1000 >= detourSteps.at(-1).at + .4 ? 'ゴールに到着！守ってあげられたね。' : '壁をよけて、下の道からゴールへ向かうよ';
      const pad = find('.briefing-pad');
      find('.wall-guide-hint').hidden = true;
      pad.classList.remove('is-cursor-hint');
      pad.classList.remove('is-cursor-guide');
      pad.querySelector('.is-press-target')?.classList.remove('is-press-target');
      return;
    }
    const instruction = reached ? '右に壁を立てよう' : '■のマスへカーソルを動かそう';
    if (feedback.textContent !== instruction) {
      if (reached) feedback.textContent = instruction;
      else feedback.innerHTML = `<span class="cursor-target-symbol">■</span>のマスへカーソル${cursorIcon}を動かそう`;
    }
    const direction = y > 0 ? { text: '上に倒してみよう', angle: 0, x: 0, y: -12 }
      : x < 2 ? { text: '右に倒してみよう', angle: 90, x: 12, y: 0 }
      : { text: '左に倒してみよう', angle: 270, x: -12, y: 0 };
    const pad = find('.briefing-pad'), hint = find('.wall-guide-hint');
    pad.classList.toggle('is-cursor-guide', !reached);
    pad.querySelector('.ps-petal[data-angle="90"]')?.classList.toggle('is-press-target', reached);
    const show = !reached && performance.now() - cursorMovedAt >= 2000;
    hint.hidden = !(show || reached);
    if (reached) {
      if (hint.textContent !== '▶ボタンを押してみよう') hint.textContent = '▶ボタンを押してみよう';
    } else if (hint.textContent !== direction.text) hint.textContent = direction.text;
    pad.querySelector('.joystick-direction-arrow path').setAttribute('transform', `rotate(${direction.angle} 16 16)`);
    pad.classList.toggle('is-cursor-hint', show);
    pad.style.setProperty('--stick-x', `${direction.x}px`);
    pad.style.setProperty('--stick-y', `${direction.y}px`);
  }
  function paint() {
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
    const riskExample = parent() && step === 0;
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
      feedback.textContent = detourSteps.length ? elapsed >= detourSteps.at(-1).at + .4 ? 'ゴールに到着！守ってあげられたね。' : '壁をよけて、下の道からゴールへ向かうよ' : '時間内にゴールを目指そう';
    }
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
      const met = demoItems.filter(fish => fish.taken), hp = applyDamage(met.reduce((value, fish) => applyDamage(value, fish.damage), HP_MAX), wallDemo() ? practice.placed.size * WALL_DAMAGE : 0);
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
      avatar: autoDemo ? demoTrail.at(-1) : avatar, goal: COLS - 1,
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
    drawMaze(canvas, scene, role, practice.cursor.y * COLS + practice.cursor.x, (practice.direction + 3) % 4, { cursor: wallDemo(), resolution, markScale: .65, wallDamage: wallDemo() ? WALL_DAMAGE : undefined, guideRoute: guideRoute() });
  }
  function drawBoard() {
    const interactive = cursorStep() || moveStep();
    const riskExample = parent() && step === 0;
    feedback.hidden = timedDemo() || collectionDemo();
    find('.briefing-art-heading').hidden = true;
    art.dataset.role = role;
    const oxygen = find('.briefing-oxygen');
    art.insertBefore(oxygen, step === 2 ? find('.briefing-maze') : feedback);
    oxygen.hidden = step !== 2;
    oxygen.querySelector('strong').textContent = String(Math.floor(settings.duration / 60)).padStart(2, '0') + ':' + String(settings.duration % 60).padStart(2, '0');
    oxygen.querySelector('.oxygen-fill').style.width = '100%';
    paint();
    board.classList.toggle('is-visible', interactive);
    find('.briefing-example').textContent = interactive ? '練習' : riskExample ? '自動デモ' : '表示例';
    find('.briefing-hp').hidden = !parent();
    const practiceHint = `${controller ? '左スティック' : '矢印キー'}で${parent() ? 'カーソル' : 'エクスプローラー'}を動かしてみましょう`;
    if (!riskExample && !timedDemo()) feedback.textContent = interactive ? practice.feedback || practiceHint : '残り時間 · O₂';
    updateCursorGuide();
    board.replaceChildren();
    if (!interactive) return;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const cell = document.createElement('div');
      cell.className = 'practice-cell';
      if (cursorStep() && x === 2 && y === 0) cell.classList.add('is-cursor-target');
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', coordinate(x, y) + (cursorStep() && x === 2 && y === 0 ? '（黄色く光る目標のマス）' : ''));
      cell.dataset.x = x; cell.dataset.y = y;
      board.append(cell);
    }
  }

  function moveCursor(direction) {
    cursorMovedAt = performance.now();
    practice.cursor.x = Math.max(0, Math.min(COLS - 1, practice.cursor.x + direction.dx));
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
      if (explorerStep() && step === 1 && cell === 2) wallNoticeUntil = performance.now() + 3000;
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
    practice.direction = (practice.direction + 1) % DIRECTIONS.length;
    practice.feedback = `設置方向: ${DIRECTIONS[practice.direction].name}`;
    drawBoard();
  }
  function placeWall() {
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
          for (let i = 0; i < queue.length && !came.has(4); i++) {
            const cell = queue[i], x = cell % COLS, y = Math.floor(cell / COLS);
            for (const { dx, dy } of DIRECTIONS) {
              const nx = x + dx, ny = y + dy, next = ny * COLS + nx;
              if (!inBounds(nx, ny) || came.has(next) || DEMO_WALLS.has(edge(cell, next)) || practice.placed.has(edgeKey(x, y, nx, ny))) continue;
              came.set(next, cell); queue.push(next);
            }
          }
          if (came.has(4)) {
            const path = [];
            for (let cell = 4; cell !== 2; cell = came.get(cell)) path.unshift(cell);
            let at = Math.max((performance.now() - startedAt) / 1000, DEMO_STEPS.find(point => point.cell === 2).at) + 1;
            detourSteps = path.map(cell => {
              const point = { cell, at };
              at += .7 + (DEMO_FISH.some(fish => fish.cell === cell && !DEMO_ROUTE.slice(0, DEMO_ROUTE.indexOf(2) + 1).includes(cell)) ? 1.6 : 0);
              return point;
            });
          } else practice.feedback = 'ゴールへの道がふさがっています。戻る・次へで練習をやり直してください。';
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
  // Horizontal D-pad taps aim on release, so navigation holds never change the practice wall.
  // The left stick moves exactly as in a round; × places walls.
  function pad(input) {
    if (!running) return;
    showHold(input.hold);
    if (input.long.has('right')) { if (last()) onFinish?.(); else go(step + 1); return; }
    if (input.long.has('left')) { go(step - 1); return; }
    // The game's directions run right, down, left, up; the board's run north, east, south, west.
    if (input.step >= 0 && (cursorStep() || moveStep())) arrow((input.step + 1) % 4);
    const aim = input.tapped.has('right') ? 0 : input.tapped.has('left') ? 2
      : input.pressed.has('right') || input.pressed.has('left') ? -1 : input.aim;
    if (cursorStep() && aim >= 0) { practice.direction = (aim + 1) % 4; practice.feedback = `設置方向: ${DIRECTIONS[practice.direction].name}`; highlight('Tab'); drawBoard(); }
    if (cursorStep() && input.tapped.has('cross')) { highlight('Space'); placeWall(); }
  }
  // The footer buttons fill up while their button is held, so the hold reads as deliberate.
  function showHold(hold) {
    find('.briefing-next').style.setProperty('--hold', hold.right);
    find('.briefing-launch').style.setProperty('--hold', hold.right);
    find('.briefing-previous').style.setProperty('--hold', step > 0 ? hold.left : 0);
  }

  // Touch: tap a cell to put the cursor there, or to step the child toward it; the key hints are tappable.
  board.onclick = event => {
    const cell = event.target.closest('.practice-cell');
    if (!cell) return;
    const x = +cell.dataset.x, y = +cell.dataset.y;
    if (cursorStep()) { cursorMovedAt = performance.now(); practice.cursor = { x, y }; practice.feedback = ''; drawBoard(); return; }
    const index = DIRECTIONS.findIndex(d => practice.child.x + d.dx === x && practice.child.y + d.dy === y);
    if (explorerStep() && index < 0 && trail.length < explorerRoute().length) { explorerWrong = true; drawBoard(); return; }
    if (moveStep() && index >= 0) arrow(index);
  };
  controls.onclick = event => {
    const kbd = event.target.closest('kbd[data-practice-key]');
    if (!kbd || !cursorStep()) return;
    if (kbd.dataset.practiceKey === 'Tab') { highlight('Tab'); rotate(); }
    if (kbd.dataset.practiceKey === 'Space') { highlight('Space'); placeWall(); }
  };
  find('.briefing-previous').onclick = () => go(step - 1);
  find('.briefing-next').onclick = () => go(step + 1);
  find('.briefing-launch').onclick = () => onFinish?.();
  // goTo lets a spectating guest follow the host's current step.
  return { start, stop, key, pad, setKicker, setController: value => { if (controller !== value) { controller = value; update(); } }, next: () => go(step + 1), goTo: go,
    get step() { return step; }, get last() { return last(); }, get running() { return running; } };
}
