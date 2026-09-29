export const DEFAULTS = Object.freeze({ cols: 14, rows: 10, duration: 90, wallLimit: 12, wallCost: 1, moveMs: 500, redMin: 14, redMax: 18, yellowMin: 8, yellowMax: 13, greenMin: 3, greenMax: 7, rewardMin: 3, rewardMax: 18 });
export const LIMITS = { cols: [10, 28], rows: [8, 18], duration: [5, 120], wallLimit: [0, 30], wallCost: [0, 20], moveMs: [100, 1200], redMin: [1, 50], redMax: [1, 50], yellowMin: [1, 50], yellowMax: [1, 50], greenMin: [1, 50], greenMax: [1, 50], rewardMin: [1, 50], rewardMax: [1, 50] };
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const edge = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
export function normalize(settings = {}) {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([k, fallback]) => [k, Number.isFinite(+settings[k]) ? Math.max(LIMITS[k][0], Math.min(LIMITS[k][1], Math.round(+settings[k]))) : fallback]));
}
export function rng(seed) { const random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; random.state = () => seed; return random; }
export function neighbor(s, cell, dir) {
  const [dx, dy] = DIRS[dir], x = cell % s.settings.cols + dx, y = Math.floor(cell / s.settings.cols) + dy;
  return x >= 0 && y >= 0 && x < s.settings.cols && y < s.settings.rows ? y * s.settings.cols + x : -1;
}
export function neighbors(s, cell) { return DIRS.map((_, i) => neighbor(s, cell, i)).filter(n => n >= 0); }
export function canMove(s, a, b, role = 'child') {
  if (!neighbors(s, a).includes(b)) return false;
  const e = edge(a, b);
  return (role === 'child' && s.secrets.has(e)) || (!s.base.has(e) && !s.walls.has(e));
}
export function reachable(s, from = s.avatar) {
  const seen = new Set([from]), queue = [from];
  for (let i = 0; i < queue.length; i++) for (const n of neighbors(s, queue[i])) if (!seen.has(n) && canMove(s, queue[i], n)) { seen.add(n); queue.push(n); }
  return seen;
}
export function createMaze(settings = {}, seed = 260830) {
  const config = normalize(settings), random = rng(seed), count = config.cols * config.rows;
  const s = { settings: config, seed, random, phase: 'ready', mode: 'parent', time: 0, avatar: (config.rows - 1) * config.cols, goal: config.cols - 1, base: new Set(), walls: new Set(), secrets: new Set(), items: [], parentScore: 100, childScore: 0, collected: 0, moves: 0, trail: [], logs: [], moveClock: 0, cpuClock: 0, nextCpu: 2.4, cooldown: 0 };
  for (let a = 0; a < count; a++) for (const b of neighbors(s, a)) s.base.add(edge(a, b));
  const seen = new Set([s.avatar]), stack = [s.avatar];
  while (stack.length) {
    const a = stack.at(-1), options = neighbors(s, a).filter(n => !seen.has(n));
    if (!options.length) { stack.pop(); continue; }
    const b = options[Math.floor(random() * options.length)];
    s.base.delete(edge(a, b)); seen.add(b); stack.push(b);
  }
  // A few loops offer choices without losing the character of a carved maze.
  const closed = [...s.base];
  for (let i = 0; i < Math.floor(count / 32); i++) s.base.delete(closed.splice(Math.floor(random() * closed.length), 1)[0]);
  const roll = (lo, hi) => Math.min(lo, hi) + Math.floor(random() * (Math.abs(hi - lo) + 1));
  // One item per zone of a 4×3 grid keeps them spread evenly, so no item is far from the next;
  // none sits within two steps of the start, where the child would grab it instantly.
  for (let i = 0; i < 12; i++) {
    const category = ['green', 'yellow', 'red'][i % 3], zx = i % 4, zy = Math.floor(i / 4), cells = [];
    for (let y = Math.floor(zy * config.rows / 3); y < Math.floor((zy + 1) * config.rows / 3); y++)
      for (let x = Math.floor(zx * config.cols / 4); x < Math.floor((zx + 1) * config.cols / 4); x++) { const n = y * config.cols + x; if (n !== s.goal && x + (config.rows - 1 - y) > 2) cells.push(n); }
    const cell = cells[Math.floor(random() * cells.length)];
    s.items.push({ cell, category, risk: roll(config[category + 'Min'], config[category + 'Max']), reward: roll(config.rewardMin, config.rewardMax), taken: false });
  }
  s.trail.push(s.avatar);
  return s;
}
function log(s, text) { s.logs.unshift({ time: s.time, text }); s.logs.length = Math.min(s.logs.length, 30); }
export function start(s) { if (s.phase === 'ready' || s.phase === 'paused') s.phase = 'playing'; }
export function placeWall(s, cell, dir) {
  const b = neighbor(s, cell, dir), e = edge(cell, b);
  if (s.phase !== 'playing' || b < 0 || s.base.has(e) || s.walls.has(e) || s.walls.size >= s.settings.wallLimit) return false;
  s.walls.add(e); s.parentScore -= s.settings.wallCost; s.childScore -= 1;
  // Restore full reachability through child-only passages, preferring original walls.
  let area = reachable(s);
  while (area.size < s.settings.cols * s.settings.rows) {
    const candidates = [], fallback = [];
    for (const a of area) for (const n of neighbors(s, a)) if (!area.has(n)) {
      const boundary = edge(a, n); fallback.push(boundary); if (!s.walls.has(boundary)) candidates.push(boundary);
    }
    const options = candidates.length ? candidates : fallback;
    s.secrets.add(options[Math.floor(s.random() * options.length)]);
    area = reachable(s);
  }
  log(s, `壁を設置 · 親 −${s.settings.wallCost}, 子ども −1`);
  return true;
}
export function move(s, dir) {
  if (s.phase !== 'playing' || s.cooldown > 0) return false;
  const b = neighbor(s, s.avatar, dir);
  if (!canMove(s, s.avatar, b)) return false;
  if (s.secrets.has(edge(s.avatar, b))) log(s, '子どもだけが知る秘密の通路を通りました。');
  s.avatar = b; s.moves++; s.trail.push(b); s.cooldown = s.settings.moveMs / 1000;
  const item = s.items.find(i => i.cell === b && !i.taken);
  if (item) { item.taken = true; s.collected++; s.parentScore -= item.risk; s.childScore += item.reward; log(s, `未知のアイテムを発見 · 親 −${item.risk}, 子ども +${item.reward}`); }
  return true;
}
export function autoDirection(s) {
  const goals = new Set(s.items.filter(i => !i.taken).map(i => i.cell));
  if (!goals.size) return -1;
  const queue = [s.avatar], came = new Map([[s.avatar, null]]);
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i];
    if (goals.has(a)) { let b = a; while (came.get(b) !== s.avatar) b = came.get(b); return DIRS.findIndex((_, d) => neighbor(s, s.avatar, d) === b); }
    for (const n of neighbors(s, a)) if (!came.has(n) && canMove(s, a, n)) { came.set(n, a); queue.push(n); }
  }
  return -1;
}
function cpuWall(s) {
  const candidates = [];
  for (let a = 0; a < s.settings.cols * s.settings.rows; a++) {
    const distance = Math.abs(a % s.settings.cols - s.avatar % s.settings.cols) + Math.abs(Math.floor(a / s.settings.cols) - Math.floor(s.avatar / s.settings.cols));
    if (distance < 1 || distance > 4) continue;
    for (let dir = 0; dir < 2; dir++) { const b = neighbor(s, a, dir); if (b >= 0 && !s.base.has(edge(a, b)) && !s.walls.has(edge(a, b))) candidates.push([a, dir]); }
  }
  if (candidates.length) placeWall(s, ...candidates[Math.floor(s.random() * candidates.length)]);
}
export function tick(s, dt, direction = -1) {
  if (s.phase !== 'playing') return;
  dt = Math.max(0, Math.min(.1, dt)); s.time = Math.min(s.settings.duration, s.time + dt); s.cooldown = Math.max(0, s.cooldown - dt);
  if (s.time >= s.settings.duration) { s.phase = 'result'; log(s, '探検終了 · 二人の結果を比べてみましょう。'); return; }
  if (s.mode === 'parent' || s.mode === 'cpu') direction = autoDirection(s);
  if (direction >= 0) move(s, direction);
  if (s.mode === 'child' || s.mode === 'cpu') { s.cpuClock += dt; if (s.cpuClock >= s.nextCpu) { s.cpuClock = 0; s.nextCpu = 1.3 + s.random() * 1.5; cpuWall(s); } }
}
